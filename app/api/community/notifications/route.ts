import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET - Fetch user notifications
 * 
 * Query params:
 * - limit: number (default 50)
 * - offset: number (default 0)
 * - unreadOnly: boolean (default false)
 */
export async function GET(req: NextRequest) {
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

    const userId = userData.user.id
    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    // Build query
    let query = supabaseAdmin
      .from('community_notifications')
      .select(`
        *,
        actor:community_profiles!community_notifications_actor_id_fkey (
          display_name,
          avatar_url
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (unreadOnly) {
      query = query.eq('is_read', false)
    }

    const { data: notifications, error } = await query

    if (error) {
      // Gracefully handle if table doesn't exist yet
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        logger.debug('[notifications] Table not yet created, returning empty')
        return NextResponse.json({ notifications: [], unreadCount: 0, hasMore: false })
      }
      logger.error('[notifications] Fetch error:', error)
      return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 })
    }

    // Get unread count
    const { count: unreadCount } = await supabaseAdmin
      .from('community_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    return NextResponse.json({
      notifications: notifications || [],
      unreadCount: unreadCount || 0,
      hasMore: (notifications?.length || 0) === limit
    })
  } catch (e: any) {
    logger.error('[notifications] Error:', e)
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}

/**
 * PATCH - Mark notification(s) as read
 * 
 * Body:
 * - id: string (single notification)
 * - markAllRead: boolean (mark all as read)
 */
export async function PATCH(req: NextRequest) {
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

    const userId = userData.user.id
    const body = await req.json()
    const { id, markAllRead } = body

    if (markAllRead) {
      // Mark all notifications as read
      const { error } = await supabaseAdmin
        .from('community_notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)

      if (error) {
        logger.error('[notifications] Mark all read error:', error)
        return NextResponse.json({ error: 'UPDATE_FAILED' }, { status: 500 })
      }

      return NextResponse.json({ ok: true, message: 'All notifications marked as read' })
    }

    if (id) {
      // Mark single notification as read
      const { error } = await supabaseAdmin
        .from('community_notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', userId) // Ensure user owns this notification

      if (error) {
        logger.error('[notifications] Mark read error:', error)
        return NextResponse.json({ error: 'UPDATE_FAILED' }, { status: 500 })
      }

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 })
  } catch (e: any) {
    logger.error('[notifications] PATCH error:', e)
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}

/**
 * DELETE - Clear all notifications for user
 */
export async function DELETE(req: NextRequest) {
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

    const userId = userData.user.id

    const { error } = await supabaseAdmin
      .from('community_notifications')
      .delete()
      .eq('user_id', userId)

    if (error) {
      logger.error('[notifications] Delete error:', error)
      return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, message: 'All notifications cleared' })
  } catch (e: any) {
    logger.error('[notifications] DELETE error:', e)
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}
