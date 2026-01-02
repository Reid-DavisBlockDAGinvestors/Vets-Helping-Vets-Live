import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/settings/approve-change
 * Approve a pending settings change (for multi-sig)
 * Financial-grade security:
 * - Only super_admins can approve
 * - Cannot approve your own request
 * - Logs all approvals to audit trail
 */
export async function POST(req: NextRequest) {
  try {
    // Verify super_admin auth (only super_admins can approve)
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const { data: userData } = await supabaseAdmin.auth.getUser(token)
    const uid = userData?.user?.id
    if (!uid) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const { data: profile } = await supabaseAdmin.from('profiles').select('role, email').eq('id', uid).single()
    
    // Only super_admins can approve multi-sig changes
    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ 
        error: 'Only super_admins can approve multi-sig changes' 
      }, { status: 403 })
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

    // Cannot approve your own request
    if (pendingChange.requested_by === uid) {
      return NextResponse.json({ 
        error: 'Cannot approve your own change request' 
      }, { status: 403 })
    }

    // Check if already approved by this user
    const approvals = pendingChange.approvals || []
    if (approvals.includes(uid)) {
      return NextResponse.json({ 
        error: 'You have already approved this change' 
      }, { status: 400 })
    }

    // Add approval
    const newApprovals = [...approvals, uid]
    
    await supabaseAdmin
      .from('pending_settings_changes')
      .update({
        approvals: newApprovals,
        updated_at: new Date().toISOString()
      })
      .eq('id', pendingId)

    // Log to audit trail
    await supabaseAdmin.from('admin_audit_log').insert({
      user_id: uid,
      action: `settings_${pendingChange.change_type}_approved`,
      details: {
        pendingId,
        chainId: pendingChange.chain_id,
        contractVersion: pendingChange.contract_version,
        changeType: pendingChange.change_type,
        currentValue: pendingChange.current_value,
        newValue: pendingChange.new_value,
        approvalCount: newApprovals.length,
        requiredApprovals: pendingChange.required_approvals
      },
      created_at: new Date().toISOString()
    })

    logger.info(`[approve-change] Change ${pendingId} approved by ${profile?.email} (${newApprovals.length}/${pendingChange.required_approvals})`)

    const fullyApproved = newApprovals.length >= (pendingChange.required_approvals || 2)

    return NextResponse.json({
      ok: true,
      approvalCount: newApprovals.length,
      requiredApprovals: pendingChange.required_approvals || 2,
      fullyApproved,
      message: fullyApproved 
        ? 'Change is fully approved and ready for execution after timelock'
        : `Approval recorded. ${(pendingChange.required_approvals || 2) - newApprovals.length} more approval(s) needed.`
    })

  } catch (e: any) {
    logger.error('[admin/settings/approve-change] Error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
