import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

// GET - Get campaigns the user has interacted with
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    
    // Create Supabase client with user's token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const userId = user.id
    const userEmail = user.email || ''

    // Use admin client for queries
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { auth: { persistSession: false } }
    )

    // 1. Campaigns user created (by creator_email - submissions table uses email, not user_id)
    let createdCampaigns: any[] = []
    if (userEmail) {
      const { data: byEmail, error: byEmailErr } = await supabaseAdmin
        .from('submissions')
        .select('id, title, image_uri, campaign_id, category, status')
        .ilike('creator_email', userEmail)
        .in('status', ['minted', 'approved', 'pending'])
        .order('created_at', { ascending: false })
      
      if (byEmailErr) console.error('[my-campaigns] byEmail error:', byEmailErr)
      createdCampaigns = byEmail || []
    }
    
    logger.api('[my-campaigns] createdCampaigns:', { count: createdCampaigns?.length, userId, userEmail })

    // 2. Campaigns user purchased NFTs for (from purchases table)
    // Query by email and wallet_address (purchases table stores wallet_address, not user_id)
    let purchases: any[] = []
    
    // Get user's linked wallet address from profiles
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('wallet_address')
      .eq('id', userId)
      .single()
    
    const walletAddress = profile?.wallet_address
    
    // Query purchases by email first (most reliable identifier)
    if (userEmail) {
      const { data: purchasesByEmail, error: emailErr } = await supabaseAdmin
        .from('purchases')
        .select('campaign_id')
        .ilike('email', userEmail)
      
      if (emailErr) console.error('[my-campaigns] purchases by email error:', emailErr)
      purchases = purchasesByEmail || []
    }
    
    // Also query by wallet_address and merge results
    if (walletAddress) {
      const { data: purchasesByWallet, error: walletErr } = await supabaseAdmin
        .from('purchases')
        .select('campaign_id')
        .ilike('wallet_address', walletAddress)
      
      if (walletErr) console.error('[my-campaigns] purchases by wallet error:', walletErr)
      // Merge unique campaign_ids
      for (const p of (purchasesByWallet || [])) {
        if (!purchases.find(ex => ex.campaign_id === p.campaign_id)) {
          purchases.push(p)
        }
      }
    }
    
    logger.api('[my-campaigns] purchases:', { count: purchases?.length, userEmail, walletAddress })

    // Get unique campaign IDs from purchases
    const purchasedCampaignIds = [...new Set(purchases?.map(p => p.campaign_id).filter(Boolean) || [])]
    
    let purchasedCampaigns: any[] = []
    if (purchasedCampaignIds.length > 0) {
      const { data } = await supabaseAdmin
        .from('submissions')
        .select('id, title, image_uri, campaign_id, category, status')
        .in('campaign_id', purchasedCampaignIds)
        .eq('status', 'minted')
      purchasedCampaigns = data || []
    }

    // 3. Campaigns user commented on (from community_posts or post_comments)
    const { data: userPosts } = await supabaseAdmin
      .from('community_posts')
      .select('campaign_id, content')
      .eq('user_id', userId)

    // Extract campaign IDs from post mentions
    const mentionedCampaignIds = new Set<string>()
    for (const post of (userPosts || [])) {
      if (post.campaign_id) mentionedCampaignIds.add(post.campaign_id)
      // Also check for @[id] mentions in content
      const mentions = post.content?.match(/@\[([^\]]+)\]/g) || []
      for (const m of mentions) {
        mentionedCampaignIds.add(m.slice(2, -1))
      }
    }

    let commentedCampaigns: any[] = []
    if (mentionedCampaignIds.size > 0) {
      // Try to find by UUID first
      const { data } = await supabaseAdmin
        .from('submissions')
        .select('id, title, image_uri, campaign_id, category, status')
        .in('id', Array.from(mentionedCampaignIds))
        .eq('status', 'minted')
      commentedCampaigns = data || []
      
      // Also try by campaign_id (numeric)
      const numericIds = Array.from(mentionedCampaignIds).filter(id => /^\d+$/.test(id)).map(Number)
      if (numericIds.length > 0) {
        const { data: byNumeric } = await supabaseAdmin
          .from('submissions')
          .select('id, title, image_uri, campaign_id, category, status')
          .in('campaign_id', numericIds)
          .eq('status', 'minted')
        commentedCampaigns = [...commentedCampaigns, ...(byNumeric || [])]
      }
    }

    // Combine and deduplicate
    const allCampaigns = [...(createdCampaigns || []), ...purchasedCampaigns, ...commentedCampaigns]
    const seen = new Set<string>()
    const uniqueCampaigns = allCampaigns.filter(c => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })

    // Tag each campaign with interaction type
    const createdIds = new Set((createdCampaigns || []).map(c => c.id))
    const purchasedIds = new Set(purchasedCampaigns.map(c => c.id))
    const commentedIds = new Set(commentedCampaigns.map(c => c.id))

    const campaigns = uniqueCampaigns.map(c => ({
      ...c,
      interactionTypes: [
        createdIds.has(c.id) ? 'created' : null,
        purchasedIds.has(c.id) ? 'purchased' : null,
        commentedIds.has(c.id) ? 'commented' : null,
      ].filter(Boolean)
    }))

    return NextResponse.json({ campaigns })
  } catch (e: any) {
    console.error('[my-campaigns] Error:', e)
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}
