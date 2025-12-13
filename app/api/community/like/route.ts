import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// POST - Toggle like on a post or comment
export async function POST(req: NextRequest) {
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

    const body = await req.json()
    const { post_id, comment_id } = body

    if (!post_id && !comment_id) {
      return NextResponse.json({ error: 'TARGET_REQUIRED', message: 'post_id or comment_id required' }, { status: 400 })
    }

    const userId = userData.user.id

    // Check if already liked
    let existingQuery = supabaseAdmin.from('community_likes').select('id').eq('user_id', userId)
    if (post_id) {
      existingQuery = existingQuery.eq('post_id', post_id)
    } else {
      existingQuery = existingQuery.eq('comment_id', comment_id)
    }
    
    const { data: existing } = await existingQuery.maybeSingle()

    if (existing) {
      // Unlike
      await supabaseAdmin.from('community_likes').delete().eq('id', existing.id)
      
      // Decrement count
      if (post_id) {
        const { data: post } = await supabaseAdmin.from('community_posts').select('likes_count').eq('id', post_id).single()
        await supabaseAdmin.from('community_posts').update({ likes_count: Math.max(0, (post?.likes_count || 1) - 1) }).eq('id', post_id)
      } else {
        const { data: comment } = await supabaseAdmin.from('community_comments').select('likes_count').eq('id', comment_id).single()
        await supabaseAdmin.from('community_comments').update({ likes_count: Math.max(0, (comment?.likes_count || 1) - 1) }).eq('id', comment_id)
      }
      
      return NextResponse.json({ ok: true, liked: false })
    } else {
      // Like
      await supabaseAdmin.from('community_likes').insert({
        user_id: userId,
        post_id: post_id || null,
        comment_id: comment_id || null
      })
      
      // Increment count
      if (post_id) {
        const { data: post } = await supabaseAdmin.from('community_posts').select('likes_count').eq('id', post_id).single()
        await supabaseAdmin.from('community_posts').update({ likes_count: (post?.likes_count || 0) + 1 }).eq('id', post_id)
      } else {
        const { data: comment } = await supabaseAdmin.from('community_comments').select('likes_count').eq('id', comment_id).single()
        await supabaseAdmin.from('community_comments').update({ likes_count: (comment?.likes_count || 0) + 1 }).eq('id', comment_id)
      }

      // Create notification for post/comment owner
      if (post_id) {
        const { data: post } = await supabaseAdmin.from('community_posts').select('user_id').eq('id', post_id).single()
        if (post && post.user_id !== userId) {
          await supabaseAdmin.from('community_notifications').insert({
            user_id: post.user_id,
            type: 'like',
            actor_id: userId,
            post_id
          })
        }
      }
      
      return NextResponse.json({ ok: true, liked: true })
    }
  } catch (e: any) {
    console.error('Like error:', e)
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}
