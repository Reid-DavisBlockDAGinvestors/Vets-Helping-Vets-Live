import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST - Sync campaign sold_count with purchases table
 * This should be run periodically or when data discrepancies are suspected
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    
    // Verify admin
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    logger.debug('[sync-campaigns] Starting sync...')

    // Get all campaigns with campaign_id
    const { data: campaigns } = await supabaseAdmin
      .from('submissions')
      .select('id, campaign_id, sold_count, title')
      .not('campaign_id', 'is', null)

    // Get all purchases grouped by campaign
    const { data: purchases } = await supabaseAdmin
      .from('purchases')
      .select('campaign_id, quantity')

    // Calculate correct sold_count from purchases
    const purchaseCounts: Record<number, number> = {}
    for (const p of (purchases || [])) {
      const cid = p.campaign_id
      purchaseCounts[cid] = (purchaseCounts[cid] || 0) + (p.quantity || 1)
    }

    // Find and fix mismatches
    const fixes: { campaignId: number; title: string; from: number; to: number }[] = []
    
    for (const c of (campaigns || [])) {
      const correctCount = purchaseCounts[c.campaign_id] || 0
      const currentCount = c.sold_count || 0

      if (correctCount !== currentCount) {
        const { error } = await supabaseAdmin
          .from('submissions')
          .update({ sold_count: correctCount })
          .eq('id', c.id)

        if (!error) {
          fixes.push({
            campaignId: c.campaign_id,
            title: c.title,
            from: currentCount,
            to: correctCount
          })
        }
      }
    }

    logger.debug(`[sync-campaigns] Synced ${fixes.length} campaigns`)

    return NextResponse.json({
      success: true,
      synced: fixes.length,
      fixes,
      totalCampaigns: campaigns?.length || 0,
      totalPurchases: purchases?.length || 0
    })
  } catch (e: any) {
    logger.error('[sync-campaigns] Error:', e)
    return NextResponse.json({ error: 'SYNC_FAILED', details: e?.message }, { status: 500 })
  }
}

/**
 * GET - Audit campaign data without making changes
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    // Get campaigns and purchases
    const { data: campaigns } = await supabaseAdmin
      .from('submissions')
      .select('id, campaign_id, sold_count, title, status')
      .not('campaign_id', 'is', null)

    const { data: purchases } = await supabaseAdmin
      .from('purchases')
      .select('campaign_id, quantity, email')

    // Calculate stats
    const purchaseCounts: Record<number, number> = {}
    const purchaseEmails: Record<number, Set<string>> = {}
    
    for (const p of (purchases || [])) {
      const cid = p.campaign_id
      purchaseCounts[cid] = (purchaseCounts[cid] || 0) + (p.quantity || 1)
      if (p.email) {
        if (!purchaseEmails[cid]) purchaseEmails[cid] = new Set()
        purchaseEmails[cid].add(p.email)
      }
    }

    // Find mismatches
    const mismatches: any[] = []
    const duplicateTitles: Record<string, any[]> = {}

    for (const c of (campaigns || [])) {
      const correctCount = purchaseCounts[c.campaign_id] || 0
      const currentCount = c.sold_count || 0

      if (correctCount !== currentCount) {
        mismatches.push({
          campaignId: c.campaign_id,
          title: c.title,
          dbSold: currentCount,
          purchasesSold: correctCount,
          difference: correctCount - currentCount
        })
      }

      // Check for duplicates
      const key = c.title?.toLowerCase().trim()
      if (key) {
        if (!duplicateTitles[key]) duplicateTitles[key] = []
        duplicateTitles[key].push(c)
      }
    }

    const duplicates = Object.entries(duplicateTitles)
      .filter(([_, list]) => list.length > 1)
      .map(([title, list]) => ({ title, count: list.length, campaigns: list }))

    return NextResponse.json({
      success: true,
      audit: {
        totalCampaigns: campaigns?.length || 0,
        totalPurchases: purchases?.length || 0,
        mismatches: mismatches.length,
        duplicates: duplicates.length,
        mismatchDetails: mismatches,
        duplicateDetails: duplicates
      }
    })
  } catch (e: any) {
    logger.error('[sync-campaigns] Audit error:', e)
    return NextResponse.json({ error: 'AUDIT_FAILED', details: e?.message }, { status: 500 })
  }
}
