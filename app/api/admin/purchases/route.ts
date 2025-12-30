import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

// GET - Fetch all purchases (admin only)
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
      return NextResponse.json({ error: 'FORBIDDEN - Admin access required' }, { status: 403 })
    }

    // Parse query params
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const campaignId = searchParams.get('campaign_id')

    // Build query
    let query = supabaseAdmin
      .from('purchases')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (campaignId) {
      query = query.eq('campaign_id', parseInt(campaignId))
    }

    const { data: purchases, error, count } = await query

    if (error) {
      logger.error('[admin/purchases] Query error:', error)
      return NextResponse.json({ error: 'Failed to fetch purchases', details: error.message }, { status: 500 })
    }

    // Get campaign titles for each purchase
    const campaignIds = [...new Set(purchases?.map(p => p.campaign_id).filter(Boolean) || [])]
    let campaignTitles: Record<number, string> = {}
    
    if (campaignIds.length > 0) {
      const { data: submissions } = await supabaseAdmin
        .from('submissions')
        .select('campaign_id, title')
        .in('campaign_id', campaignIds)
      
      for (const sub of (submissions || [])) {
        if (sub.campaign_id) {
          campaignTitles[sub.campaign_id] = sub.title || `Campaign #${sub.campaign_id}`
        }
      }
    }

    // Enrich purchases with campaign titles
    const enrichedPurchases = purchases?.map(p => ({
      ...p,
      campaign_title: p.campaign_id ? (campaignTitles[p.campaign_id] || `Campaign #${p.campaign_id}`) : 'Unknown'
    })) || []

    // Calculate summary stats
    const totalAmount = purchases?.reduce((sum, p) => sum + (p.amount_usd || 0), 0) || 0
    const totalTips = purchases?.reduce((sum, p) => sum + (p.tip_usd || 0), 0) || 0
    const totalBDAG = purchases?.reduce((sum, p) => sum + (p.amount_bdag || 0), 0) || 0

    return NextResponse.json({
      purchases: enrichedPurchases,
      total: count || 0,
      limit,
      offset,
      summary: {
        totalAmountUSD: Math.round(totalAmount * 100) / 100,
        totalTipsUSD: Math.round(totalTips * 100) / 100,
        totalBDAG: Math.round(totalBDAG * 100) / 100,
        averageUSD: purchases?.length ? Math.round((totalAmount / purchases.length) * 100) / 100 : 0
      }
    })

  } catch (error: any) {
    logger.error('[admin/purchases] Error:', error)
    return NextResponse.json({ error: 'Failed', details: error?.message }, { status: 500 })
  }
}
