import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// GET - Get a specific bug report (user can only view their own)
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reportId = params.id
    if (!reportId) {
      return NextResponse.json({ error: 'Report ID required' }, { status: 400 })
    }

    // Get user from auth
    const authHeader = req.headers.get('authorization')
    let userId: string | null = null
    let userEmail: string | null = null
    let isAdmin = false

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const { data: { user } } = await supabaseAdmin.auth.getUser(token)
      if (user) {
        userId = user.id
        userEmail = user.email || null

        // Check if admin
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        
        isAdmin = !!(profile && ['admin', 'super_admin'].includes(profile.role))
      }
    }

    // Fetch the bug report
    const { data: report, error } = await supabaseAdmin
      .from('bug_reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (error || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Check access - user can only view their own reports (or admin can view all)
    if (!isAdmin && report.user_id !== userId && report.user_email !== userEmail) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    // Fetch messages for this report
    const { data: messages } = await supabaseAdmin
      .from('bug_report_messages')
      .select('*')
      .eq('bug_report_id', reportId)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      report,
      messages: messages || [],
      isOwner: report.user_id === userId || report.user_email === userEmail,
      isAdmin,
    })
  } catch (e: any) {
    console.error('[bug-reports/id] GET error:', e)
    return NextResponse.json({ error: 'Failed to fetch report', details: e?.message }, { status: 500 })
  }
}
