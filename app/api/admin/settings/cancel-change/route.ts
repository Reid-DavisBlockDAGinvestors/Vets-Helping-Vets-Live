import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/settings/cancel-change
 * Cancel a pending settings change
 */
export async function POST(req: NextRequest) {
  try {
    // Verify admin auth
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const { data: userData } = await supabaseAdmin.auth.getUser(token)
    const uid = userData?.user?.id
    if (!uid) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const { data: profile } = await supabaseAdmin.from('profiles').select('role, email').eq('id', uid).single()
    if (!['admin', 'super_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const body = await req.json()
    const { pendingId } = body

    if (!pendingId) {
      return NextResponse.json({ error: 'pendingId required' }, { status: 400 })
    }

    // Fetch pending change
    const { data: pendingChange, error: fetchError } = await supabaseAdmin
      .from('pending_settings_changes')
      .select('*')
      .eq('id', pendingId)
      .single()

    if (fetchError || !pendingChange) {
      return NextResponse.json({ error: 'Pending change not found' }, { status: 404 })
    }

    // Verify status
    if (pendingChange.status !== 'pending') {
      return NextResponse.json({ 
        error: `Change is not pending (status: ${pendingChange.status})` 
      }, { status: 400 })
    }

    // Only the requester or a super_admin can cancel
    if (pendingChange.requested_by !== uid && profile?.role !== 'super_admin') {
      return NextResponse.json({ 
        error: 'Only the requester or a super_admin can cancel this change' 
      }, { status: 403 })
    }

    // Mark as cancelled
    await supabaseAdmin
      .from('pending_settings_changes')
      .update({
        status: 'cancelled',
        cancelled_by: uid,
        cancelled_at: new Date().toISOString()
      })
      .eq('id', pendingId)

    // Log to audit trail
    await supabaseAdmin.from('admin_audit_log').insert({
      user_id: uid,
      action: `settings_${pendingChange.change_type}_cancelled`,
      details: {
        pendingId,
        chainId: pendingChange.chain_id,
        contractVersion: pendingChange.contract_version,
        changeType: pendingChange.change_type,
        currentValue: pendingChange.current_value,
        newValue: pendingChange.new_value
      },
      created_at: new Date().toISOString()
    })

    logger.info(`[cancel-change] Change ${pendingId} cancelled by ${profile?.email}`)

    return NextResponse.json({
      ok: true,
      message: 'Change cancelled successfully'
    })

  } catch (e: any) {
    logger.error('[admin/settings/cancel-change] Error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
