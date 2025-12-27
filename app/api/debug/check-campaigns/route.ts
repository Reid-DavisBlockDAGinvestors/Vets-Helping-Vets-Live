import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { debugGuard } from '@/lib/debugGuard'

export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to check specific campaign IDs
 * GET /api/debug/check-campaigns?ids=23,26,30,32,38,40
 */
export async function GET(req: NextRequest) {
  const blocked = debugGuard()
  if (blocked) return blocked

  try {
    const idsParam = req.nextUrl.searchParams.get('ids') || '23,26,30,32,38,40'
    const ids = idsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    
    // Query submissions with these campaign_ids
    const { data: submissions, error } = await supabaseAdmin
      .from('submissions')
      .select('id, title, status, campaign_id, contract_address, visible_on_marketplace, created_at')
      .in('campaign_id', ids)
      .order('campaign_id', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'FETCH_ERROR', details: error.message }, { status: 500 })
    }

    // Also check all minted submissions to see if there are duplicates
    const { data: allMinted } = await supabaseAdmin
      .from('submissions')
      .select('id, title, campaign_id, visible_on_marketplace')
      .eq('status', 'minted')
      .order('campaign_id', { ascending: true })

    // Build a summary
    const summary = ids.map(id => {
      const subs = submissions?.filter(s => s.campaign_id === id) || []
      return {
        campaign_id: id,
        found: subs.length,
        submissions: subs.map(s => ({
          id: s.id,
          title: s.title?.slice(0, 40),
          status: s.status,
          visible: s.visible_on_marketplace,
          has_contract: !!s.contract_address
        }))
      }
    })

    // Check for any duplicates
    const campaignIdCounts: Record<number, number> = {}
    for (const sub of allMinted || []) {
      if (sub.campaign_id != null) {
        campaignIdCounts[sub.campaign_id] = (campaignIdCounts[sub.campaign_id] || 0) + 1
      }
    }
    const duplicates = Object.entries(campaignIdCounts)
      .filter(([_, count]) => count > 1)
      .map(([id, count]) => ({ campaign_id: Number(id), count }))

    return NextResponse.json({
      queried_ids: ids,
      summary,
      total_minted: allMinted?.length || 0,
      duplicates: duplicates.length > 0 ? duplicates : 'none'
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'DEBUG_ERROR', details: e?.message }, { status: 500 })
  }
}
