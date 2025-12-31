import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET - Fetch comments for a post
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const postId = searchParams.get('postId') || searchParams.get('post_id')
    
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

// PUT - Edit a comment (owner only)
export async function PUT(req: NextRequest) {
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
    const { id, content } = body

    if (!id) {
      return NextResponse.json({ error: 'COMMENT_ID_REQUIRED' }, { status: 400 })
    }

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'CONTENT_REQUIRED' }, { status: 400 })
    }

    // Fetch the comment to check ownership
    const { data: comment, error: fetchErr } = await supabaseAdmin
      .from('community_comments')
      .select('user_id')
      .eq('id', id)
      .single()

    if (fetchErr || !comment) {
      return NextResponse.json({ error: 'COMMENT_NOT_FOUND' }, { status: 404 })
    }

    // Only owner can edit their own comments
    if (comment.user_id !== userData.user.id) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'You can only edit your own comments' }, { status: 403 })
    }

    // Update the comment
    const { data: updatedComment, error: updateErr } = await supabaseAdmin
      .from('community_comments')
      .update({ 
        content: content.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (updateErr) {
      return NextResponse.json({ error: 'UPDATE_FAILED', details: updateErr.message }, { status: 500 })
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
        ...updatedComment,
        user: profile || { display_name: 'User', avatar_url: null, is_verified: false }
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}

// DELETE - Delete a comment (owner or admin only)
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

    const { searchParams } = new URL(req.url)
    const commentId = searchParams.get('id')

    if (!commentId) {
      return NextResponse.json({ error: 'COMMENT_ID_REQUIRED' }, { status: 400 })
    }

    // Fetch the comment to check ownership and get post_id
    const { data: comment, error: fetchErr } = await supabaseAdmin
      .from('community_comments')
      .select('user_id, post_id')
      .eq('id', commentId)
      .single()

    if (fetchErr || !comment) {
      return NextResponse.json({ error: 'COMMENT_NOT_FOUND' }, { status: 404 })
    }

    // Check if user is owner or admin
    const { data: adminCheck } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    const isOwner = comment.user_id === userData.user.id
    const isAdmin = !!adminCheck

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    // Delete the comment
    const { error: deleteErr } = await supabaseAdmin
      .from('community_comments')
      .delete()
      .eq('id', commentId)

    if (deleteErr) {
      return NextResponse.json({ error: 'DELETE_FAILED', details: deleteErr.message }, { status: 500 })
    }

    // Update post's comment count
    const { data: post } = await supabaseAdmin
      .from('community_posts')
      .select('comments_count')
      .eq('id', comment.post_id)
      .single()
    
    if (post) {
      await supabaseAdmin
        .from('community_posts')
        .update({ comments_count: Math.max(0, (post.comments_count || 1) - 1) })
        .eq('id', comment.post_id)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}
