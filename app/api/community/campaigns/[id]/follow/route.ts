import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

// POST - Toggle follow on a campaign
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : ''
    
    if (!token) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !userData?.user?.id) {
      return NextResponse.json({ error: 'INVALID_TOKEN' }, { status: 401 })
    }

    const campaignId = params.id
    const userId = userData.user.id

    // Check if already following
    const { data: existing } = await supabaseAdmin
      .from('campaign_followers')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      // Unfollow
      await supabaseAdmin
        .from('campaign_followers')
        .delete()
        .eq('id', existing.id)

      // Log activity
      await supabaseAdmin.from('campaign_activity').insert({
        campaign_id: campaignId,
        activity_type: 'follow',
        actor_id: userId,
        metadata: { action: 'unfollow' }
      })

      return NextResponse.json({ ok: true, following: false })
    } else {
      // Follow
      const body = await req.json().catch(() => ({}))
      
      await supabaseAdmin.from('campaign_followers').insert({
        campaign_id: campaignId,
        user_id: userId,
        notify_posts: body.notify_posts ?? true,
        notify_updates: body.notify_updates ?? true,
        notify_milestones: body.notify_milestones ?? true
      })

      // Log activity
      await supabaseAdmin.from('campaign_activity').insert({
        campaign_id: campaignId,
        activity_type: 'follow',
        actor_id: userId,
        metadata: { action: 'follow' }
      })

      return NextResponse.json({ ok: true, following: true })
    }
  } catch (e: any) {
    logger.error('[community/campaigns/follow] Error:', e)
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}

// GET - Check if user is following a campaign
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : ''
    
    if (!token) {
      return NextResponse.json({ following: false })
    }

    const { data: userData } = await supabaseAdmin.auth.getUser(token)
    if (!userData?.user?.id) {
      return NextResponse.json({ following: false })
    }

    const { data: existing } = await supabaseAdmin
      .from('campaign_followers')
      .select('id, notify_posts, notify_updates, notify_milestones')
      .eq('campaign_id', params.id)
      .eq('user_id', userData.user.id)
      .maybeSingle()

    return NextResponse.json({ 
      following: !!existing,
      settings: existing || null
    })
  } catch (e: any) {
    return NextResponse.json({ following: false })
  }
}
