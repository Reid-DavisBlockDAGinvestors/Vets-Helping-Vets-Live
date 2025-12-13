import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

async function requireAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
  if (!token) return { ok: false as const, error: 'MISSING_TOKEN' }

  const { data: userData } = await supabaseAdmin.auth.getUser(token)
  const uid = userData?.user?.id
  if (!uid) return { ok: false as const, error: 'INVALID_TOKEN' }

  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single()
  if (profile?.role !== 'admin') return { ok: false as const, error: 'UNAUTHORIZED' }

  return { ok: true as const, userId: uid }
}

// GET - List all admin requests (admin only)
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'pending'

    const { data: requests, error } = await supabaseAdmin
      .from('admin_requests')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: 'FETCH_FAILED', details: error.message }, { status: 500 })
    }

    return NextResponse.json({ requests: requests || [] })
  } catch (e: any) {
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}

// POST - Approve or reject a request (admin only)
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const requestId = body?.requestId
    const action = body?.action // 'approve' or 'reject'

    if (!requestId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'INVALID_INPUT', message: 'requestId and action (approve/reject) required' }, { status: 400 })
    }

    // Get the request
    const { data: request } = await supabaseAdmin
      .from('admin_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (!request) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    }

    if (request.status !== 'pending') {
      return NextResponse.json({ error: 'ALREADY_PROCESSED', message: `Request already ${request.status}` }, { status: 400 })
    }

    // Update the request status
    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    const { error: updateErr } = await supabaseAdmin
      .from('admin_requests')
      .update({
        status: newStatus,
        reviewed_by: auth.userId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId)

    if (updateErr) {
      return NextResponse.json({ error: 'UPDATE_FAILED', details: updateErr.message }, { status: 500 })
    }

    // If approved, update the user's profile to admin
    if (action === 'approve') {
      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: request.user_id,
          email: request.email,
          role: 'admin'
        })

      if (profileErr) {
        return NextResponse.json({ error: 'PROFILE_UPDATE_FAILED', details: profileErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true, status: newStatus, message: `Request ${newStatus}` })
  } catch (e: any) {
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}
