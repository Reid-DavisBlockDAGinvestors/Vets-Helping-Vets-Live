import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/admin/distributions/tip-split?campaignId=xxx
 * Get tip split configuration for a campaign
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

    const { data: tipSplit, error } = await supabase
      .from('tip_split_configs')
      .select('*')
      .eq('campaign_id', campaignId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching tip split:', error)
      return NextResponse.json({ error: 'Failed to fetch tip split' }, { status: 500 })
    }

    // Return default if not configured
    const config = tipSplit || {
      campaign_id: campaignId,
      submitter_percent: 100,
      nonprofit_percent: 0,
      created_at: null,
      updated_at: null
    }

    return NextResponse.json({ tipSplit: config })

  } catch (error) {
    console.error('Error in tip-split GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/distributions/tip-split
 * Set tip split configuration for a campaign
 * Body: { campaignId, submitterPercent, nonprofitPercent }
 */
export async function POST(request: NextRequest) {
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { campaignId, submitterPercent, nonprofitPercent } = body

    // Validate inputs
    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
    }

    if (typeof submitterPercent !== 'number' || typeof nonprofitPercent !== 'number') {
      return NextResponse.json({ error: 'Percentages must be numbers' }, { status: 400 })
    }

    if (submitterPercent < 0 || submitterPercent > 100 || nonprofitPercent < 0 || nonprofitPercent > 100) {
      return NextResponse.json({ error: 'Percentages must be 0-100' }, { status: 400 })
    }

    if (submitterPercent + nonprofitPercent !== 100) {
      return NextResponse.json({ error: 'Percentages must total 100' }, { status: 400 })
    }

    // Upsert the tip split config
    const { data, error } = await supabase
      .from('tip_split_configs')
      .upsert({
        campaign_id: campaignId,
        submitter_percent: submitterPercent,
        nonprofit_percent: nonprofitPercent,
        updated_at: new Date().toISOString(),
        updated_by: user.id
      }, {
        onConflict: 'campaign_id'
      })
      .select()
      .single()

    if (error) {
      console.error('Error upserting tip split:', error)
      return NextResponse.json({ error: 'Failed to save tip split' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      tipSplit: data,
      message: `Tip split updated: ${submitterPercent}% submitter / ${nonprofitPercent}% nonprofit`
    })

  } catch (error) {
    console.error('Error in tip-split POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
