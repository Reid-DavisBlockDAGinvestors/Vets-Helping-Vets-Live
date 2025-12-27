import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { debugGuard } from '@/lib/debugGuard'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// Debug endpoint to view bug reports - requires DEBUG_KEY for security
export async function GET(req: NextRequest) {
  const blocked = debugGuard()
  if (blocked) return blocked

  // Simple API key check for debug endpoints
  const debugKey = req.headers.get('x-debug-key') || req.nextUrl.searchParams.get('key')
  const expectedKey = process.env.DEBUG_API_KEY || 'dev-debug-key'
  
  if (debugKey !== expectedKey) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  try {
    const { data: reports, error } = await supabaseAdmin
      .from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[debug/bug-reports] Query error:', error)
      return NextResponse.json({ error: 'Query failed', details: error.message }, { status: 500 })
    }

    // Summary stats
    const stats = {
      total: reports?.length || 0,
      byStatus: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
    }

    reports?.forEach(r => {
      stats.byStatus[r.status] = (stats.byStatus[r.status] || 0) + 1
      stats.byPriority[r.priority] = (stats.byPriority[r.priority] || 0) + 1
    })

    return NextResponse.json({ 
      stats,
      reports: reports?.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        status: r.status,
        priority: r.priority,
        category: r.category,
        user_email: r.user_email,
        user_name: r.user_name,
        resolution_notes: r.resolution_notes,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }))
    })
  } catch (e: any) {
    console.error('[debug/bug-reports] Error:', e)
    return NextResponse.json({ error: 'Failed to fetch bug reports', details: e?.message }, { status: 500 })
  }
}
