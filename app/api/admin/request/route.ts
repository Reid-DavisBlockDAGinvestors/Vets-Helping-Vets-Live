import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// POST - Submit admin access request
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'MISSING_TOKEN' }, { status: 401 })

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'INVALID_TOKEN' }, { status: 401 })
    }

    const uid = userData.user.id
    const userEmail = userData.user.email || ''

    const body = await req.json().catch(() => ({}))
    const name = body?.name || ''
    const reason = body?.reason || ''

    // Check if user already has a pending request
    const { data: existing } = await supabaseAdmin
      .from('admin_requests')
      .select('id, status')
      .eq('user_id', uid)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'ALREADY_PENDING', message: 'You already have a pending request' }, { status: 400 })
    }

    // Check if user is already an admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', uid)
      .maybeSingle()

    if (profile?.role === 'admin') {
      return NextResponse.json({ error: 'ALREADY_ADMIN', message: 'You are already an admin' }, { status: 400 })
    }

    // Create the request
    const { error: insertErr } = await supabaseAdmin.from('admin_requests').insert({
      user_id: uid,
      email: userEmail,
      name,
      reason,
      status: 'pending'
    })

    if (insertErr) {
      return NextResponse.json({ error: 'INSERT_FAILED', details: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, message: 'Admin access request submitted' })
  } catch (e: any) {
    return NextResponse.json({ error: 'REQUEST_FAILED', details: e?.message }, { status: 500 })
  }
}

// GET - Check request status (for the requesting user)
export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'MISSING_TOKEN' }, { status: 401 })

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'INVALID_TOKEN' }, { status: 401 })
    }

    const uid = userData.user.id

    const { data: requests } = await supabaseAdmin
      .from('admin_requests')
      .select('id, status, reason, created_at, reviewed_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(5)

    return NextResponse.json({ requests: requests || [] })
  } catch (e: any) {
    return NextResponse.json({ error: 'FETCH_FAILED', details: e?.message }, { status: 500 })
  }
}
