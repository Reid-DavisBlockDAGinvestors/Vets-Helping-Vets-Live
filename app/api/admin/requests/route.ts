import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

async function requireAdmin(req: NextRequest, requireSuperAdmin = false) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
  if (!token) return { ok: false as const, error: 'MISSING_TOKEN' }

  const { data: userData } = await supabaseAdmin.auth.getUser(token)
  const uid = userData?.user?.id
  if (!uid) return { ok: false as const, error: 'INVALID_TOKEN' }

  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single()
  const role = profile?.role || 'user'
  
  // Check permission level
  const adminRoles = ['super_admin', 'admin']
  if (requireSuperAdmin && role !== 'super_admin') {
    return { ok: false as const, error: 'SUPER_ADMIN_REQUIRED' }
  }
  if (!adminRoles.includes(role)) {
    return { ok: false as const, error: 'UNAUTHORIZED' }
  }

  return { ok: true as const, userId: uid, role }
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

// POST - Approve or reject a request (super_admin only for managing admins)
export async function POST(req: NextRequest) {
  try {
    // Only super_admin can approve admin requests
    const auth = await requireAdmin(req, true) // requireSuperAdmin = true
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const requestId = body?.requestId
    const action = body?.action // 'approve' or 'reject'
    const overrideRole = body?.role // Optional: override the requested role

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

    // Determine the role to assign (use override if provided, otherwise use requested)
    const roleToAssign = overrideRole || request.requested_role || 'viewer'
    const validRoles = ['admin', 'moderator', 'viewer']
    if (!validRoles.includes(roleToAssign)) {
      return NextResponse.json({ error: 'INVALID_ROLE', message: 'Invalid role' }, { status: 400 })
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

    // If approved, update the user's profile with the assigned role
    if (action === 'approve') {
      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: request.user_id,
          email: request.email,
          role: roleToAssign
        })

      if (profileErr) {
        return NextResponse.json({ error: 'PROFILE_UPDATE_FAILED', details: profileErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({ 
      ok: true, 
      status: newStatus, 
      role: action === 'approve' ? roleToAssign : null,
      message: `Request ${newStatus}${action === 'approve' ? ` with role: ${roleToAssign}` : ''}` 
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}
