import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // 1. Campaigns user created (by user_id or email)
    const { data: createdCampaigns, error: createdErr } = await supabaseAdmin
      .from('submissions')
      .select('id, title, image_uri, slug, short_code, campaign_id, category, status')
      .or(`user_id.eq.${userId},email.ilike.%${userEmail}%`)
      .in('status', ['minted', 'approved', 'pending'])
      .order('created_at', { ascending: false })
    
    if (createdErr) console.error('[my-campaigns] createdCampaigns error:', createdErr)
    console.log('[my-campaigns] createdCampaigns:', createdCampaigns?.length, 'for user:', userId, userEmail)

    // 2. Campaigns user purchased NFTs for (from purchases table)
    const { data: purchases, error: purchasesErr } = await supabaseAdmin
      .from('purchases')
      .select('campaign_id, submission_id')
      .or(`user_id.eq.${userId},email.ilike.%${userEmail}%`)
    
    if (purchasesErr) console.error('[my-campaigns] purchases error:', purchasesErr)

    const purchasedSubmissionIds = [...new Set(purchases?.map(p => p.submission_id).filter(Boolean) || [])]
    
    let purchasedCampaigns: any[] = []
    if (purchasedSubmissionIds.length > 0) {
      const { data } = await supabaseAdmin
        .from('submissions')
        .select('id, title, image_uri, slug, short_code, campaign_id, category, status')
        .in('id', purchasedSubmissionIds)
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
        .select('id, title, image_uri, slug, short_code, campaign_id, category, status')
        .in('id', Array.from(mentionedCampaignIds))
        .eq('status', 'minted')
      commentedCampaigns = data || []
      
      // Also try by campaign_id (numeric)
      const numericIds = Array.from(mentionedCampaignIds).filter(id => /^\d+$/.test(id)).map(Number)
      if (numericIds.length > 0) {
        const { data: byNumeric } = await supabaseAdmin
          .from('submissions')
          .select('id, title, image_uri, slug, short_code, campaign_id, category, status')
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
