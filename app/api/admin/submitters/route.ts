import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

// GET - Get all campaign submitters with their stats
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

    // Get all submissions grouped by creator_email
    const { data: submissions, error: submissionsErr } = await supabaseAdmin
      .from('submissions')
      .select('creator_email, creator_name, creator_phone, creator_wallet, status, created_at, sold_count, goal')
      .order('created_at', { ascending: false })

    if (submissionsErr) {
      logger.error('[admin/submitters] submissions error:', submissionsErr)
      return NextResponse.json({ error: 'QUERY_FAILED' }, { status: 500 })
    }

    // Get purchase stats per campaign
    const { data: purchases } = await supabaseAdmin
      .from('purchases')
      .select('submission_id, amount_usd, quantity')

    // Build purchase stats map by submission_id
    const purchaseStats: Record<string, { total: number; nfts: number }> = {}
    for (const p of (purchases || [])) {
      if (!p.submission_id) continue
      if (!purchaseStats[p.submission_id]) {
        purchaseStats[p.submission_id] = { total: 0, nfts: 0 }
      }
      purchaseStats[p.submission_id].total += p.amount_usd || 0
      purchaseStats[p.submission_id].nfts += p.quantity || 1
    }

    // Group by email
    const submitterMap: Record<string, {
      email: string
      name: string | null
      phone: string | null
      wallet_address: string | null
      campaigns_count: number
      minted_count: number
      pending_count: number
      approved_count: number
      total_raised_usd: number
      total_nfts_sold: number
      first_submission: string | null
      last_submission: string | null
    }> = {}

    for (const s of (submissions || [])) {
      const email = s.creator_email?.toLowerCase()
      if (!email) continue

      if (!submitterMap[email]) {
        submitterMap[email] = {
          email: s.creator_email,
          name: s.creator_name,
          phone: s.creator_phone,
          wallet_address: s.creator_wallet,
          campaigns_count: 0,
          minted_count: 0,
          pending_count: 0,
          approved_count: 0,
          total_raised_usd: 0,
          total_nfts_sold: 0,
          first_submission: s.created_at,
          last_submission: s.created_at
        }
      }

      const sub = submitterMap[email]
      sub.campaigns_count += 1
      
      if (s.status === 'minted') sub.minted_count += 1
      if (s.status === 'pending') sub.pending_count += 1
      if (s.status === 'approved') sub.approved_count += 1
      
      sub.total_nfts_sold += s.sold_count || 0
      
      // Update first/last submission dates
      if (s.created_at < sub.first_submission!) sub.first_submission = s.created_at
      if (s.created_at > sub.last_submission!) sub.last_submission = s.created_at

      // Update name/phone/wallet if not set
      if (!sub.name && s.creator_name) sub.name = s.creator_name
      if (!sub.phone && s.creator_phone) sub.phone = s.creator_phone
      if (!sub.wallet_address && s.creator_wallet) sub.wallet_address = s.creator_wallet
    }

    // Calculate total raised from purchases
    for (const s of (submissions || [])) {
      const email = s.creator_email?.toLowerCase()
      if (!email || !submitterMap[email]) continue
      
      // We need submission ID to look up purchases - fetch separately
    }

    // Get submission IDs to calculate raised amounts
    const { data: submissionsWithIds } = await supabaseAdmin
      .from('submissions')
      .select('id, creator_email')

    for (const s of (submissionsWithIds || [])) {
      const email = s.creator_email?.toLowerCase()
      if (!email || !submitterMap[email]) continue
      
      const stats = purchaseStats[s.id]
      if (stats) {
        submitterMap[email].total_raised_usd += stats.total
      }
    }

    const submitters = Object.values(submitterMap)

    return NextResponse.json({ submitters })
  } catch (e: any) {
    logger.error('[admin/submitters] Error:', e)
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}
