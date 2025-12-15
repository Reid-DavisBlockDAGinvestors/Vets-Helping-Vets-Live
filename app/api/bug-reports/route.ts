import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // Try to get user info from auth header
    let userId: string | null = null
    let userEmail: string | null = null
    
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const { data: { user } } = await supabaseAdmin.auth.getUser(token)
      if (user) {
        userId = user.id
        userEmail = user.email || null
      }
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
      console.error('[bug-reports] Insert error:', error)
      return NextResponse.json(
        { error: 'Failed to submit bug report', details: error.message },
        { status: 500 }
      )
    }

    console.log('[bug-reports] New report submitted:', data.id, 'by:', userEmail || 'anonymous')

    return NextResponse.json({
      success: true,
      id: data.id,
      message: 'Bug report submitted successfully. Thank you for helping us improve!'
    })
  } catch (e: any) {
    console.error('[bug-reports] Error:', e)
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
      console.error('[bug-reports] List error:', error)
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
    console.error('[bug-reports] Error:', e)
    return NextResponse.json(
      { error: 'Failed to fetch bug reports' },
      { status: 500 }
    )
  }
}
