import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET - Fetch comments for a post
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const postId = searchParams.get('post_id')
    
    if (!postId) {
      return NextResponse.json({ error: 'POST_ID_REQUIRED' }, { status: 400 })
    }

    const { data: comments, error } = await supabaseAdmin
      .from('community_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'FETCH_FAILED', details: error.message }, { status: 500 })
    }

    // Enrich with user profiles
    const enrichedComments = await Promise.all((comments || []).map(async (comment) => {
      const { data: profile } = await supabaseAdmin
        .from('community_profiles')
        .select('display_name, avatar_url, is_verified')
        .eq('user_id', comment.user_id)
        .maybeSingle()
      
      return {
        ...comment,
        user: profile || { display_name: 'Anonymous', avatar_url: null, is_verified: false }
      }
    }))

    return NextResponse.json({ comments: enrichedComments })
  } catch (e: any) {
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}

// POST - Create a comment
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
    const { post_id, content, parent_id } = body

    if (!post_id || !content?.trim()) {
      return NextResponse.json({ error: 'INVALID_INPUT', message: 'post_id and content required' }, { status: 400 })
    }

    // Create comment
    const { data: comment, error: insertErr } = await supabaseAdmin
      .from('community_comments')
      .insert({
        post_id,
        user_id: userData.user.id,
        content: content.trim(),
        parent_id: parent_id || null
      })
      .select()
      .single()

    if (insertErr) {
      return NextResponse.json({ error: 'CREATE_FAILED', details: insertErr.message }, { status: 500 })
    }

    // Update post's comment count
    const { data: post } = await supabaseAdmin.from('community_posts').select('comments_count, user_id').eq('id', post_id).single()
    await supabaseAdmin.from('community_posts').update({ comments_count: (post?.comments_count || 0) + 1 }).eq('id', post_id)

    // Create notification for post owner
    if (post && post.user_id !== userData.user.id) {
      await supabaseAdmin.from('community_notifications').insert({
        user_id: post.user_id,
        type: 'comment',
        actor_id: userData.user.id,
        post_id,
        comment_id: comment.id
      })
    }

    // Get user profile for response
    const { data: profile } = await supabaseAdmin
      .from('community_profiles')
      .select('display_name, avatar_url, is_verified')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    return NextResponse.json({ 
      ok: true, 
      comment: {
        ...comment,
        user: profile || { display_name: userData.user.email?.split('@')[0] || 'User', avatar_url: null, is_verified: false }
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}
