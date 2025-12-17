import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to view recent submissions and their campaign_id mappings
 * No auth required for debugging
 */
export async function GET(req: NextRequest) {
  try {
    const { data: submissions, error } = await supabaseAdmin
      .from('submissions')
      .select('id, title, status, campaign_id, token_id, contract_address, metadata_uri, visible_on_marketplace, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) {
      return NextResponse.json({ error: 'FETCH_ERROR', details: error.message }, { status: 500 })
    }

    // Group by status
    const byStatus: Record<string, any[]> = {}
    for (const sub of submissions || []) {
      const status = sub.status || 'unknown'
      if (!byStatus[status]) byStatus[status] = []
      byStatus[status].push({
        id: sub.id,
        title: sub.title,
        campaign_id: sub.campaign_id,
        token_id: sub.token_id,
        contract_address: sub.contract_address,
        metadata_uri: sub.metadata_uri?.slice(0, 60) + '...',
        created_at: sub.created_at,
        updated_at: sub.updated_at
      })
    }

    return NextResponse.json({
      total: submissions?.length || 0,
      byStatus,
      submissions: submissions?.map(s => ({
        id: s.id,
        title: s.title,
        status: s.status,
        campaign_id: s.campaign_id,
        token_id: s.token_id,
        has_contract: !!s.contract_address,
        visible: s.visible_on_marketplace
      }))
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'DEBUG_ERROR', details: e?.message }, { status: 500 })
  }
}
