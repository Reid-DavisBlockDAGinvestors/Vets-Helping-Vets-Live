import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET - Get purchases for a specific user
export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const userId = params.userId
    
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

    // Use admin client for queries
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { auth: { persistSession: false } }
    )

    // Check if user is admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    // Check if userId is a wallet address (starts with 0x) or a UUID
    const isWalletId = userId.startsWith('0x')
    console.log('[admin/users/purchases] userId:', userId, 'isWalletId:', isWalletId)

    let purchases: any[] = []
    let purchasesErr: any = null
    let targetWallet: string | null = null
    let targetEmail: string | null = null

    if (isWalletId) {
      // For wallet-only users, query directly by wallet_address
      targetWallet = userId
      console.log('[admin/users/purchases] Querying by wallet_address:', targetWallet)
      
      const result = await supabaseAdmin
        .from('purchases')
        .select('*')
        .ilike('wallet_address', targetWallet)
        .order('created_at', { ascending: false })
      
      purchases = result.data || []
      purchasesErr = result.error
    } else {
      // For profile users, get their profile and query by user_id, email, or wallet_address
      const { data: targetUser } = await supabaseAdmin
        .from('profiles')
        .select('email, wallet_address')
        .eq('id', userId)
        .maybeSingle()

      targetEmail = targetUser?.email || null
      targetWallet = targetUser?.wallet_address || null

      // Build query conditions
      const queryConditions: string[] = [`user_id.eq.${userId}`]
      if (targetEmail) {
        queryConditions.push(`email.ilike.${targetEmail}`)
      }
      if (targetWallet) {
        queryConditions.push(`wallet_address.ilike.${targetWallet}`)
      }

      console.log('[admin/users/purchases] Query conditions:', queryConditions)

      const result = await supabaseAdmin
        .from('purchases')
        .select('*')
        .or(queryConditions.join(','))
        .order('created_at', { ascending: false })
      
      purchases = result.data || []
      purchasesErr = result.error
    }

    // Get campaign titles for the purchases (separate query since no FK)
    const campaignIds = [...new Set(purchases.map(p => p.campaign_id).filter(Boolean))]
    let campaignTitles: Record<number, string> = {}
    if (campaignIds.length > 0) {
      const { data: campaigns } = await supabaseAdmin
        .from('submissions')
        .select('campaign_id, title')
        .in('campaign_id', campaignIds)
      
      for (const c of (campaigns || [])) {
        campaignTitles[c.campaign_id] = c.title
      }
    }

    console.log('[admin/users/purchases] Found purchases:', purchases?.length || 0)
    console.log('[admin/users/purchases] Campaign IDs:', [...new Set(purchases.map(p => p.campaign_id).filter(Boolean))])

    if (purchasesErr) {
      console.error('[admin/users/purchases] error:', purchasesErr)
      return NextResponse.json({ error: 'QUERY_FAILED' }, { status: 500 })
    }

    const formattedPurchases = (purchases || []).map(p => ({
      id: p.id,
      campaign_id: p.campaign_id,
      campaign_title: campaignTitles[p.campaign_id] || `Campaign #${p.campaign_id || p.submission_id}`,
      amount_usd: p.amount_usd || 0,
      quantity: p.quantity || 1,
      created_at: p.created_at,
      tx_hash: p.tx_hash
    }))

    // Get campaigns created by this user (only for profile users, not wallet-only users)
    let userEmail: string | null = null
    
    if (!isWalletId) {
      // Only look up profile/auth for UUID users, not wallet addresses
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      userEmail = targetProfile?.email
      
      // Get user email from auth if not in profile
      if (!userEmail) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId)
        userEmail = authUser?.user?.email || null
      }
    }
    // Wallet-only users don't have profiles or auth records, so skip created campaigns lookup

    let createdCampaigns: any[] = []
    if (userEmail) {
      const { data: campaigns } = await supabaseAdmin
        .from('submissions')
        .select('id, campaign_id, title, image_uri, status, goal, category, created_at')
        .ilike('creator_email', userEmail)
        .order('created_at', { ascending: false })
      
      createdCampaigns = (campaigns || []).map(c => ({
        id: c.id,
        campaign_id: c.campaign_id,
        title: c.title,
        image_uri: c.image_uri,
        status: c.status,
        goal: c.goal,
        category: c.category,
        created_at: c.created_at
      }))
    }

    // Get unique campaigns from purchases for "interacted with" section
    const purchasedCampaignIds = [...new Set(formattedPurchases.map(p => p.campaign_id).filter(Boolean))]
    let purchasedCampaigns: any[] = []
    if (purchasedCampaignIds.length > 0) {
      const { data: campaigns } = await supabaseAdmin
        .from('submissions')
        .select('id, campaign_id, title, image_uri, status, goal, category')
        .in('campaign_id', purchasedCampaignIds)
      
      purchasedCampaigns = (campaigns || []).map(c => ({
        id: c.id,
        campaign_id: c.campaign_id,
        title: c.title,
        image_uri: c.image_uri,
        status: c.status,
        goal: c.goal,
        category: c.category,
        purchase_count: formattedPurchases.filter(p => p.campaign_id === c.campaign_id).length,
        total_spent: formattedPurchases.filter(p => p.campaign_id === c.campaign_id).reduce((sum, p) => sum + (p.amount_usd || 0), 0)
      }))
    }

    console.log('[admin/users/purchases] Final response:', {
      purchases: formattedPurchases.length,
      purchasedCampaigns: purchasedCampaigns.length,
      createdCampaigns: createdCampaigns.length,
      purchasedCampaignIds
    })

    return NextResponse.json({ 
      purchases: formattedPurchases,
      createdCampaigns,
      purchasedCampaigns
    })
  } catch (e: any) {
    console.error('[admin/users/purchases] Error:', e)
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}
