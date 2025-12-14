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

    // Get all profiles (registered users)
    const { data: profiles, error: profilesErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (profilesErr) {
      console.error('[admin/users] profiles error:', profilesErr)
    }

    // Get ALL purchases to find users (including those without profiles)
    const { data: allPurchases } = await supabaseAdmin
      .from('purchases')
      .select('user_id, email, wallet_address, amount_usd, quantity, created_at')
      .order('created_at', { ascending: false })

    // Build purchase stats map by email/wallet
    const userPurchaseStats: Record<string, { 
      count: number
      total: number
      nfts: number
      wallet_address: string | null
      first_purchase: string | null
    }> = {}
    
    for (const p of (allPurchases || [])) {
      // Use email as primary key, fallback to wallet
      const key = p.email?.toLowerCase() || p.wallet_address?.toLowerCase()
      if (!key) continue
      if (!userPurchaseStats[key]) {
        userPurchaseStats[key] = { 
          count: 0, 
          total: 0, 
          nfts: 0, 
          wallet_address: p.wallet_address,
          first_purchase: p.created_at
        }
      }
      userPurchaseStats[key].count += 1
      userPurchaseStats[key].total += p.amount_usd || 0
      userPurchaseStats[key].nfts += p.quantity || 1
      if (!userPurchaseStats[key].wallet_address && p.wallet_address) {
        userPurchaseStats[key].wallet_address = p.wallet_address
      }
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

    // Build user list from profiles
    const profileEmails = new Set<string>()
    const users: any[] = []
    
    for (const p of (profiles || [])) {
      const emailKey = p.email?.toLowerCase()
      if (emailKey) profileEmails.add(emailKey)
      
      const stats = userPurchaseStats[emailKey] || { count: 0, total: 0, nfts: 0, wallet_address: null }
      users.push({
        id: p.id,
        email: p.email,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role: p.role || 'user',
        created_at: p.created_at,
        last_sign_in_at: p.last_sign_in_at,
        wallet_address: stats.wallet_address,
        purchases_count: stats.count,
        nfts_owned: stats.nfts,
        total_spent_usd: stats.total,
        campaigns_created: campaignsCreated[emailKey] || 0,
        source: 'profile'
      })
    }

    // Add purchasers who don't have profiles (wallet-only users)
    for (const [key, stats] of Object.entries(userPurchaseStats)) {
      // Skip if this email already has a profile
      if (profileEmails.has(key)) continue
      
      // Check if it's an email or wallet address
      const isEmail = key.includes('@')
      
      users.push({
        id: key,
        email: isEmail ? key : null,
        display_name: isEmail ? null : `Wallet: ${key.slice(0, 6)}...${key.slice(-4)}`,
        avatar_url: null,
        role: 'user',
        created_at: stats.first_purchase,
        last_sign_in_at: null,
        wallet_address: isEmail ? stats.wallet_address : key,
        purchases_count: stats.count,
        nfts_owned: stats.nfts,
        total_spent_usd: stats.total,
        campaigns_created: isEmail ? (campaignsCreated[key] || 0) : 0,
        source: 'purchase'
      })
    }

    // Sort by created_at descending
    users.sort((a, b) => {
      const aDate = new Date(a.created_at || 0).getTime()
      const bDate = new Date(b.created_at || 0).getTime()
      return bDate - aDate
    })

    return NextResponse.json({ users, total: users.length })
  } catch (e: any) {
    console.error('[admin/users] Error:', e)
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}
