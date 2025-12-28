import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { createClient } from '@supabase/supabase-js'
import { sendBugReportStatusEmail } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// POST - Create a new bug report
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    const {
      title,
      description,
      steps_to_reproduce,
      expected_behavior,
      screenshots,
      page_url,
      user_agent,
      screen_size,
      browser_console_logs,
      category,
      tags
    } = body

    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      )
    }

    // Require authentication for bug reports
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'AUTH_REQUIRED', message: 'Please log in to submit a bug report' },
        { status: 401 }
      )
    }

    const token = authHeader.slice(7)
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'AUTH_REQUIRED', message: 'Please log in to submit a bug report' },
        { status: 401 }
      )
    }

    const userId = user.id
    const userEmail = user.email || null
    
    if (!userEmail) {
      return NextResponse.json(
        { error: 'EMAIL_REQUIRED', message: 'Your account must have a verified email to submit bug reports' },
        { status: 400 }
      )
    }

    // Insert bug report
    const { data, error } = await supabaseAdmin
      .from('bug_reports')
      .insert({
        user_id: userId,
        user_email: userEmail || body.email || null,
        wallet_address: body.wallet_address || null,
        title: title.trim(),
        description: description.trim(),
        steps_to_reproduce: steps_to_reproduce?.trim() || null,
        expected_behavior: expected_behavior?.trim() || null,
        screenshots: screenshots || [],
        page_url: page_url || null,
        user_agent: user_agent || null,
        screen_size: screen_size || null,
        browser_console_logs: browser_console_logs || null,
        category: category || 'general',
        tags: tags || [],
        app_version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'production'
      })
      .select()
      .single()

    if (error) {
      logger.error('[bug-reports] Insert error:', error)
      return NextResponse.json(
        { error: 'Failed to submit bug report', details: error.message },
        { status: 500 }
      )
    }

    logger.debug('[bug-reports] New report submitted:', data.id, 'by:', userEmail || 'anonymous')

    return NextResponse.json({
      success: true,
      id: data.id,
      message: 'Bug report submitted successfully. Thank you for helping us improve!'
    })
  } catch (e: any) {
    logger.error('[bug-reports] Error:', e)
    return NextResponse.json(
      { error: 'Failed to submit bug report', details: e?.message },
      { status: 500 }
    )
  }
}

// GET - List bug reports (admin only)
export async function GET(req: NextRequest) {
  try {
    // Verify admin access
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    // Get query params
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabaseAdmin
      .from('bug_reports')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    const { data, error, count } = await query

    if (error) {
      logger.error('[bug-reports] List error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch bug reports' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      reports: data || [],
      total: count || 0,
      limit,
      offset
    })
  } catch (e: any) {
    logger.error('[bug-reports] Error:', e)
    return NextResponse.json(
      { error: 'Failed to fetch bug reports' },
      { status: 500 }
    )
  }
}

// PATCH - Update a bug report (admin only)
export async function PATCH(req: NextRequest) {
  try {
    // Verify admin access
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    const body = await req.json()
    const { id, status, priority, resolution_notes, assigned_to, admin_message, send_email } = body

    if (!id) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 })
    }

    // Fetch current report to get old status and user email
    const { data: currentReport } = await supabaseAdmin
      .from('bug_reports')
      .select('*')
      .eq('id', id)
      .single()

    if (!currentReport) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const oldStatus = currentReport.status

    const updates: any = {
      updated_at: new Date().toISOString()
    }

    if (status) updates.status = status
    if (priority) updates.priority = priority
    if (resolution_notes !== undefined) updates.resolution_notes = resolution_notes
    if (assigned_to !== undefined) updates.assigned_to = assigned_to

    // If resolving, set resolved_at and resolved_by
    if (status === 'resolved' || status === 'wont_fix' || status === 'duplicate') {
      updates.resolved_at = new Date().toISOString()
      updates.resolved_by = user.id
    }

    // Track admin response time
    updates.last_admin_response_at = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('bug_reports')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('[bug-reports] Update error:', error)
      return NextResponse.json({ error: 'Failed to update bug report', details: error.message }, { status: 500 })
    }

    logger.debug(`[bug-reports] Report ${id} updated by ${user.email}: status=${status || 'unchanged'}`)

    // Send email notification if status changed and user has email
    const shouldSendEmail = send_email !== false && currentReport.user_email && status && status !== oldStatus
    let emailSent = false

    if (shouldSendEmail) {
      const emailResult = await sendBugReportStatusEmail({
        email: currentReport.user_email,
        reportId: id,
        reportTitle: currentReport.title,
        oldStatus,
        newStatus: status,
        resolutionNotes: resolution_notes || currentReport.resolution_notes,
        adminMessage: admin_message,
      })
      emailSent = !!emailResult.id
      if (emailResult.id) {
        logger.debug(`[bug-reports] Status email sent to ${currentReport.user_email}`)
      } else {
        logger.debug(`[bug-reports] Email failed: ${emailResult.error || 'skipped'}`)
      }
    }

    return NextResponse.json({ success: true, report: data, emailSent })
  } catch (e: any) {
    logger.error('[bug-reports] PATCH error:', e)
    return NextResponse.json({ error: 'Failed to update bug report', details: e?.message }, { status: 500 })
  }
}

// DELETE - Delete a bug report (admin only)
export async function DELETE(req: NextRequest) {
  try {
    // Verify admin access
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('bug_reports')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('[bug-reports] Delete error:', error)
      return NextResponse.json({ error: 'Failed to delete bug report', details: error.message }, { status: 500 })
    }

    logger.debug(`[bug-reports] Report ${id} deleted by ${user.email}`)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    logger.error('[bug-reports] DELETE error:', e)
    return NextResponse.json({ error: 'Failed to delete bug report', details: e?.message }, { status: 500 })
  }
}
