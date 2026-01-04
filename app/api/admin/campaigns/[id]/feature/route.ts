import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Toggle featured status for a campaign
 * POST /api/admin/campaigns/[id]/feature
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    
    if (!id) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 })
    }

    // Get current featured status
    const { data: submission, error: fetchError } = await supabaseAdmin
      .from('submissions')
      .select('id, title, is_featured, featured_order')
      .eq('id', id)
      .single()

    if (fetchError || !submission) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const newFeaturedStatus = !submission.is_featured

    // If featuring, get the next order number
    let featuredOrder = 0
    if (newFeaturedStatus) {
      const { data: maxOrder } = await supabaseAdmin
        .from('submissions')
        .select('featured_order')
        .eq('is_featured', true)
        .order('featured_order', { ascending: false })
        .limit(1)
        .single()
      
      featuredOrder = (maxOrder?.featured_order || 0) + 1
    }

    // Update featured status
    const { error: updateError } = await supabaseAdmin
      .from('submissions')
      .update({
        is_featured: newFeaturedStatus,
        featured_order: newFeaturedStatus ? featuredOrder : 0,
        featured_at: newFeaturedStatus ? new Date().toISOString() : null
      })
      .eq('id', id)

    if (updateError) {
      logger.error('[Feature] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update featured status' }, { status: 500 })
    }

    logger.api(`[Feature] Campaign ${id} (${submission.title}) featured: ${newFeaturedStatus}`)

    return NextResponse.json({
      success: true,
      id,
      title: submission.title,
      is_featured: newFeaturedStatus,
      featured_order: newFeaturedStatus ? featuredOrder : 0
    })
  } catch (e: any) {
    logger.error('[Feature] Error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

/**
 * Get featured campaigns
 * GET /api/admin/campaigns/featured
 */
export async function GET() {
  try {
    const { data: featured, error } = await supabaseAdmin
      .from('submissions')
      .select('id, title, image_uri, chain_id, chain_name, is_featured, featured_order, featured_at')
      .eq('is_featured', true)
      .order('featured_order', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ featured: featured || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
