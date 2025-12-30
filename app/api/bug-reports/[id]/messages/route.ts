import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendBugReportMessageEmail } from '@/lib/mailer'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// POST - Add a message to a bug report
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reportId = params.id
    if (!reportId) {
      return NextResponse.json({ error: 'Report ID required' }, { status: 400 })
    }

    const body = await req.json()
    const { message } = body

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Get user from auth
    const authHeader = req.headers.get('authorization')
    let userId: string | null = null
    let userEmail: string | null = null
    let userName: string | null = null
    let isAdmin = false

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const { data: { user } } = await supabaseAdmin.auth.getUser(token)
      if (user) {
        userId = user.id
        userEmail = user.email || null
        userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'

        // Check if admin
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        
        isAdmin = !!(profile && ['admin', 'super_admin'].includes(profile.role))
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    // Fetch the bug report
    const { data: report, error: reportError } = await supabaseAdmin
      .from('bug_reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Check access - user can only message on their own reports (or admin can message any)
    const isOwner = report.user_id === userId || report.user_email === userEmail
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    // Insert message
    const { data: newMessage, error: msgError } = await supabaseAdmin
      .from('bug_report_messages')
      .insert({
        bug_report_id: reportId,
        sender_id: userId,
        sender_email: userEmail,
        sender_name: isAdmin ? 'Admin' : userName,
        is_admin: isAdmin,
        message: message.trim(),
      })
      .select()
      .single()

    if (msgError) {
      logger.error('[bug-reports/messages] Insert error:', msgError)
      return NextResponse.json({ error: 'Failed to send message', details: msgError.message }, { status: 500 })
    }

    // Send email notification
    let emailSent = false
    if (isAdmin && report.user_email) {
      // Admin replied - notify user
      const emailResult = await sendBugReportMessageEmail({
        email: report.user_email,
        reportId,
        reportTitle: report.title,
        senderName: 'Admin',
        message: message.trim(),
      })
      emailSent = !!emailResult.id
    }
    // Note: We could also notify admins when users reply, but that requires a different email setup

    // Update last_admin_response_at if admin
    if (isAdmin) {
      await supabaseAdmin
        .from('bug_reports')
        .update({ last_admin_response_at: new Date().toISOString() })
        .eq('id', reportId)
    }

    logger.debug(`[bug-reports/messages] Message added to ${reportId} by ${userEmail} (admin: ${isAdmin})`)

    return NextResponse.json({ 
      success: true, 
      message: newMessage,
      emailSent,
    })
  } catch (e: any) {
    logger.error('[bug-reports/messages] POST error:', e)
    return NextResponse.json({ error: 'Failed to send message', details: e?.message }, { status: 500 })
  }
}
