import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/admin/distributions/history?campaignId=xxx
 * Get distribution history for a specific campaign
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Check admin status - profiles uses 'role' column
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
    }

    // Fetch distribution history for the campaign
    const { data: distributions, error } = await supabase
      .from('distributions')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('initiated_at', { ascending: false })

    if (error) {
      console.error('Error fetching distributions:', error)
      return NextResponse.json({ error: 'Failed to fetch distribution history' }, { status: 500 })
    }

    // Calculate totals
    const totals = {
      totalDistributed: 0,
      totalSubmitter: 0,
      totalNonprofit: 0,
      pendingCount: 0,
      confirmedCount: 0,
      failedCount: 0
    }

    for (const dist of distributions || []) {
      if (dist.status === 'confirmed') {
        totals.totalDistributed += dist.total_amount || 0
        totals.totalSubmitter += dist.submitter_amount || 0
        totals.totalNonprofit += dist.nonprofit_amount || 0
        totals.confirmedCount++
      } else if (dist.status === 'pending' || dist.status === 'processing') {
        totals.pendingCount++
      } else if (dist.status === 'failed') {
        totals.failedCount++
      }
    }

    return NextResponse.json({
      distributions: distributions || [],
      totals,
      count: distributions?.length || 0
    })

  } catch (error) {
    console.error('Error in distributions/history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
