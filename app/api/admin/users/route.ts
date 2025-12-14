import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET - Get all platform users with their stats
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

    // Get all profiles
    const { data: profiles, error: profilesErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (profilesErr) {
      console.error('[admin/users] profiles error:', profilesErr)
      return NextResponse.json({ error: 'QUERY_FAILED' }, { status: 500 })
    }

    // Get purchase stats per user
    const { data: purchaseStats } = await supabaseAdmin
      .from('purchases')
      .select('user_id, email, amount_usd, quantity')

    // Build purchase stats map
    const userPurchaseStats: Record<string, { count: number; total: number; nfts: number }> = {}
    for (const p of (purchaseStats || [])) {
      const key = p.user_id || p.email
      if (!key) continue
      if (!userPurchaseStats[key]) {
        userPurchaseStats[key] = { count: 0, total: 0, nfts: 0 }
      }
      userPurchaseStats[key].count += 1
      userPurchaseStats[key].total += p.amount_usd || 0
      userPurchaseStats[key].nfts += p.quantity || 1
    }

    // Get campaigns created per user (by email)
    const { data: submissions } = await supabaseAdmin
      .from('submissions')
      .select('creator_email')
      .in('status', ['minted', 'approved', 'pending'])

    const campaignsCreated: Record<string, number> = {}
    for (const s of (submissions || [])) {
      if (s.creator_email) {
        campaignsCreated[s.creator_email.toLowerCase()] = (campaignsCreated[s.creator_email.toLowerCase()] || 0) + 1
      }
    }

    // Combine data
    const users = (profiles || []).map(p => {
      const stats = userPurchaseStats[p.id] || userPurchaseStats[p.email] || { count: 0, total: 0, nfts: 0 }
      return {
        id: p.id,
        email: p.email,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role: p.role || 'user',
        created_at: p.created_at,
        last_sign_in_at: p.last_sign_in_at,
        purchases_count: stats.count,
        nfts_owned: stats.nfts,
        total_spent_usd: stats.total,
        campaigns_created: campaignsCreated[p.email?.toLowerCase()] || 0
      }
    })

    return NextResponse.json({ users })
  } catch (e: any) {
    console.error('[admin/users] Error:', e)
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}
