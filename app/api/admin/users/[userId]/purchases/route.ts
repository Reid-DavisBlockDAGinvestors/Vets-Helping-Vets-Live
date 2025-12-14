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

    // Get the target user's email
    const { data: targetUser } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .maybeSingle()

    // Get purchases by user_id or email
    const { data: purchases, error: purchasesErr } = await supabaseAdmin
      .from('purchases')
      .select('*, submissions(title)')
      .or(`user_id.eq.${userId}${targetUser?.email ? `,email.ilike.${targetUser.email}` : ''}`)
      .order('created_at', { ascending: false })

    if (purchasesErr) {
      console.error('[admin/users/purchases] error:', purchasesErr)
      return NextResponse.json({ error: 'QUERY_FAILED' }, { status: 500 })
    }

    const formattedPurchases = (purchases || []).map(p => ({
      id: p.id,
      campaign_title: p.submissions?.title || `Campaign #${p.campaign_id || p.submission_id}`,
      amount_usd: p.amount_usd || 0,
      quantity: p.quantity || 1,
      created_at: p.created_at,
      tx_hash: p.tx_hash
    }))

    return NextResponse.json({ purchases: formattedPurchases })
  } catch (e: any) {
    console.error('[admin/users/purchases] Error:', e)
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}
