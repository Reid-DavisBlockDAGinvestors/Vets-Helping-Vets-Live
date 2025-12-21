import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendBugReportStatusEmail } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// Debug endpoint to send bug report response emails
export async function POST(req: NextRequest) {
  const debugKey = req.headers.get('x-debug-key') || req.nextUrl.searchParams.get('key')
  const expectedKey = process.env.DEBUG_API_KEY || 'dev-debug-key'
  
  if (debugKey !== expectedKey) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { reportId, newStatus, resolutionNotes, adminMessage } = body

    if (!reportId) {
      return NextResponse.json({ error: 'Missing reportId' }, { status: 400 })
    }

    // Get the bug report
    const { data: report, error } = await supabaseAdmin
      .from('bug_reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (error || !report) {
      return NextResponse.json({ error: 'Report not found', details: error?.message }, { status: 404 })
    }

    if (!report.user_email) {
      return NextResponse.json({ error: 'No email on file for this report' }, { status: 400 })
    }

    const oldStatus = report.status
    const status = newStatus || 'resolved'

    // Update the report status
    const { error: updateError } = await supabaseAdmin
      .from('bug_reports')
      .update({ 
        status,
        resolution_notes: resolutionNotes || report.resolution_notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', reportId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update report', details: updateError.message }, { status: 500 })
    }

    // Send the email
    const emailResult = await sendBugReportStatusEmail({
      email: report.user_email,
      reportId,
      reportTitle: report.title,
      oldStatus,
      newStatus: status,
      resolutionNotes: resolutionNotes || report.resolution_notes,
      adminMessage,
    })

    return NextResponse.json({ 
      success: true,
      emailSent: !!emailResult.id,
      emailId: emailResult.id,
      report: {
        id: reportId,
        title: report.title,
        email: report.user_email,
        oldStatus,
        newStatus: status
      }
    })
  } catch (e: any) {
    console.error('[send-bug-response] Error:', e)
    return NextResponse.json({ error: 'Failed', details: e?.message }, { status: 500 })
  }
}
