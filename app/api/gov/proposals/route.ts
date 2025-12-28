import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'
import { sendProposalSubmitted, sendProposalVotingOpen } from '@/lib/mailer'

// GET: list proposals (optionally filter by admin param to see pending ones)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const admin = searchParams.get('admin') === 'true'
    
    let query = supabase
      .from('proposals')
      .select('id, title, description, category, submitter_name, submitter_email, submitter_wallet, submitter_nfts_owned, submitter_campaigns_created, submitter_total_donated, yes_votes, no_votes, open, status, admin_notes, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    
    // Non-admin only sees approved/open proposals
    if (!admin) {
      query = query.or('status.eq.approved,open.eq.true')
    }
    
    const { data, error } = await query
    if (error) {
      logger.error('[Proposals] Error:', error)
      throw error
    }
    
    const items = (data || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      category: p.category,
      submitterName: p.submitter_name,
      submitterEmail: p.submitter_email,
      submitterWallet: p.submitter_wallet,
      submitterNftsOwned: Number(p.submitter_nfts_owned || 0),
      submitterCampaignsCreated: Number(p.submitter_campaigns_created || 0),
      submitterTotalDonated: Number(p.submitter_total_donated || 0),
      yesVotes: Number(p.yes_votes || 0),
      noVotes: Number(p.no_votes || 0),
      open: !!p.open,
      status: p.status || 'pending',
      adminNotes: p.admin_notes,
      createdAt: p.created_at
    }))
    return NextResponse.json({ items })
  } catch (e) {
    logger.error('[Proposals] GET error:', e)
    return NextResponse.json({ items: [] })
  }
}

// POST: create proposal (status=pending, needs admin approval to go live)
export async function POST(req: NextRequest) {
  try {
    const { 
      title, 
      description, 
      category, 
      submitter_name, 
      submitter_email,
      submitter_wallet,
      submitter_nfts_owned,
      submitter_campaigns_created,
      submitter_total_donated
    } = await req.json()
    
    if (!title || !description) {
      return NextResponse.json({ error: 'Title and description required' }, { status: 400 })
    }
    if (!submitter_wallet) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 })
    }
    
    const { data, error } = await supabase
      .from('proposals')
      .insert({ 
        title, 
        description, 
        category: category || 'general',
        submitter_name,
        submitter_email,
        submitter_wallet,
        submitter_nfts_owned: submitter_nfts_owned || 0,
        submitter_campaigns_created: submitter_campaigns_created || 0,
        submitter_total_donated: submitter_total_donated || 0,
        open: false, // Starts closed until admin approves
        status: 'pending'
      })
      .select('id')
      .single()
    
    if (error) {
      logger.error('[Proposals] Insert error:', error)
      throw error
    }
    
    logger.debug('[Proposals] Created proposal:', data?.id, 'by wallet:', submitter_wallet)
    
    // Send confirmation email to submitter
    if (submitter_email) {
      try {
        await sendProposalSubmitted({
          email: submitter_email,
          proposalId: data?.id,
          proposalTitle: title,
          submitterName: submitter_name
        })
        logger.debug(`[Proposals] Sent submission confirmation to ${submitter_email}`)
      } catch (emailErr) {
        logger.error('[Proposals] Failed to send submission email:', emailErr)
      }
    }
    
    return NextResponse.json({ id: data?.id, success: true })
  } catch (e: any) {
    logger.error('[Proposals] POST error:', e)
    return NextResponse.json({ error: e?.message || 'CREATE_FAILED' }, { status: 500 })
  }
}

// PUT: update proposal (admin action)
export async function PUT(req: NextRequest) {
  try {
    const { id, status, open, admin_notes } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing proposal ID' }, { status: 400 })
    
    // Get current proposal state before update
    const { data: currentProposal } = await supabase
      .from('proposals')
      .select('open, status, title, description, submitter_email, submitter_name')
      .eq('id', id)
      .single()
    
    const updates: any = {}
    if (status !== undefined) updates.status = status
    if (open !== undefined) updates.open = open
    if (admin_notes !== undefined) updates.admin_notes = admin_notes
    updates.updated_at = new Date().toISOString()
    
    const { error } = await supabase
      .from('proposals')
      .update(updates)
      .eq('id', id)
    
    if (error) throw error
    
    logger.debug('[Proposals] Updated proposal:', id, updates)
    
    // If proposal was just opened for voting (open changed from false to true)
    const justOpened = open === true && currentProposal && !currentProposal.open
    if (justOpened && currentProposal) {
      // Notify the submitter
      if (currentProposal.submitter_email) {
        try {
          await sendProposalVotingOpen({
            email: currentProposal.submitter_email,
            proposalId: id,
            proposalTitle: currentProposal.title,
            proposalDescription: currentProposal.description || '',
            recipientName: currentProposal.submitter_name
          })
          logger.debug(`[Proposals] Notified submitter ${currentProposal.submitter_email} that voting is open`)
        } catch (emailErr) {
          logger.error('[Proposals] Failed to notify submitter:', emailErr)
        }
      }
      
      // Notify all donors and creators (people who have purchased NFTs or created campaigns)
      try {
        // Get unique emails from events (purchases) and submissions (creators)
        const { data: purchaseEmails } = await supabaseAdmin
          .from('events')
          .select('metadata')
          .not('metadata->buyerEmail', 'is', null)
        
        const { data: creatorEmails } = await supabaseAdmin
          .from('submissions')
          .select('creator_email')
          .not('creator_email', 'is', null)
          .eq('status', 'minted')
        
        const uniqueEmails = new Set<string>()
        
        // Add creator emails
        creatorEmails?.forEach((c: any) => {
          if (c.creator_email) uniqueEmails.add(c.creator_email)
        })
        
        // Send to each unique email (limit to prevent spam)
        const emailList = Array.from(uniqueEmails).slice(0, 100)
        for (const email of emailList) {
          if (email === currentProposal.submitter_email) continue // Already notified
          try {
            await sendProposalVotingOpen({
              email,
              proposalId: id,
              proposalTitle: currentProposal.title,
              proposalDescription: currentProposal.description || ''
            })
          } catch {}
        }
        logger.debug(`[Proposals] Notified ${emailList.length} community members about new vote`)
      } catch (notifyErr) {
        logger.error('[Proposals] Failed to notify community:', notifyErr)
      }
    }
    
    return NextResponse.json({ success: true })
  } catch (e: any) {
    logger.error('[Proposals] PUT error:', e)
    return NextResponse.json({ error: e?.message || 'UPDATE_FAILED' }, { status: 500 })
  }
}
