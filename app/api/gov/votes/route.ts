import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// GET: Get all votes for a proposal (admin only)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const proposalId = searchParams.get('proposal_id')
    
    if (!proposalId) {
      return NextResponse.json({ error: 'Proposal ID required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('proposal_votes')
      .select('id, voter_wallet, voter_email, voter_name, support, nfts_owned, campaigns_created, total_donated, created_at')
      .eq('proposal_id', proposalId)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('[Votes] Query error:', error)
      throw error
    }

    const votes = (data || []).map(v => ({
      id: v.id,
      voterWallet: v.voter_wallet,
      voterEmail: v.voter_email,
      voterName: v.voter_name,
      support: v.support,
      nftsOwned: v.nfts_owned || 0,
      campaignsCreated: v.campaigns_created || 0,
      totalDonated: v.total_donated || 0,
      createdAt: v.created_at
    }))

    return NextResponse.json({ votes })
  } catch (e: any) {
    logger.error('[Votes] Error:', e)
    return NextResponse.json({ votes: [], error: e?.message }, { status: 500 })
  }
}
