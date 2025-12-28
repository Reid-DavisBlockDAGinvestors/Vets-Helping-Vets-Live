import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

// Reaction types for charitable/heartfelt fundraising
export const REACTION_TYPES = ['love', 'pray', 'encourage', 'celebrate', 'care'] as const
export type ReactionType = typeof REACTION_TYPES[number]

// Reaction emoji mapping
export const REACTION_EMOJIS: Record<ReactionType, string> = {
  love: '❤️',
  pray: '🙏',
  encourage: '💪',
  celebrate: '🎉',
  care: '😢'
}

// POST - Toggle reaction on a post or comment
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
    const { post_id, comment_id, reaction_type = 'love' } = body

    if (!post_id && !comment_id) {
      return NextResponse.json({ error: 'TARGET_REQUIRED', message: 'post_id or comment_id required' }, { status: 400 })
    }

    // Validate reaction type (default to 'love' for backward compatibility)
    const validReaction = REACTION_TYPES.includes(reaction_type) ? reaction_type : 'love'

    const userId = userData.user.id

    // Check if already reacted (any type)
    let existingQuery = supabaseAdmin.from('community_likes').select('id, reaction_type').eq('user_id', userId)
    if (post_id) {
      existingQuery = existingQuery.eq('post_id', post_id)
    } else {
      existingQuery = existingQuery.eq('comment_id', comment_id)
    }
    
    const { data: existing } = await existingQuery.maybeSingle()

    if (existing) {
      // If same reaction type, toggle off (unlike)
      // If different reaction type, update to new type
      if (existing.reaction_type === validReaction) {
        // Unlike - same reaction clicked again
        await supabaseAdmin.from('community_likes').delete().eq('id', existing.id)
        
        // Decrement count
        if (post_id) {
          const { data: post } = await supabaseAdmin.from('community_posts').select('likes_count').eq('id', post_id).single()
          await supabaseAdmin.from('community_posts').update({ likes_count: Math.max(0, (post?.likes_count || 1) - 1) }).eq('id', post_id)
        } else {
          const { data: comment } = await supabaseAdmin.from('community_comments').select('likes_count').eq('id', comment_id).single()
          await supabaseAdmin.from('community_comments').update({ likes_count: Math.max(0, (comment?.likes_count || 1) - 1) }).eq('id', comment_id)
        }
        
        return NextResponse.json({ ok: true, liked: false, reaction_type: null })
      } else {
        // Change reaction type (count stays same)
        await supabaseAdmin.from('community_likes').update({ reaction_type: validReaction }).eq('id', existing.id)
        return NextResponse.json({ ok: true, liked: true, reaction_type: validReaction, changed: true })
      }
    } else {
      // New reaction
      await supabaseAdmin.from('community_likes').insert({
        user_id: userId,
        post_id: post_id || null,
        comment_id: comment_id || null,
        reaction_type: validReaction
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
            type: 'reaction',
            actor_id: userId,
            post_id,
            metadata: { reaction_type: validReaction }
          })
        }
      }
      
      return NextResponse.json({ ok: true, liked: true, reaction_type: validReaction })
    }
  } catch (e: any) {
    logger.error('Like/reaction error:', e)
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}
