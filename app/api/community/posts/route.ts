import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

// GET - Fetch posts with pagination and filters
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const campaignId = searchParams.get('campaign_id')
    const userId = searchParams.get('user_id')
    const type = searchParams.get('type')
    const featured = searchParams.get('featured') === 'true'
    
    const offset = (page - 1) * limit

    let query = supabaseAdmin
      .from('community_posts')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (campaignId) query = query.eq('campaign_id', campaignId)
    if (userId) query = query.eq('user_id', userId)
    if (type) query = query.eq('post_type', type)
    if (featured) query = query.eq('is_featured', true)

    const { data: posts, error } = await query

    if (error) {
      logger.error('[community/posts] Fetch error:', error)
      return NextResponse.json({ error: 'FETCH_FAILED', details: error.message }, { status: 500 })
    }

    // Get user's likes if authenticated
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : ''
    let userLikes: string[] = []
    
    if (token) {
      const { data: userData } = await supabaseAdmin.auth.getUser(token)
      if (userData?.user?.id && posts?.length) {
        const postIds = posts.map(p => p.id)
        const { data: likes } = await supabaseAdmin
          .from('community_likes')
          .select('post_id')
          .eq('user_id', userData.user.id)
          .in('post_id', postIds)
        userLikes = likes?.map(l => l.post_id) || []
      }
    }

    const postUserIds = Array.from(new Set((posts || []).map((p: any) => p.user_id).filter(Boolean)))

    const { data: profiles } = postUserIds.length
      ? await supabaseAdmin
          .from('community_profiles')
          .select('user_id, display_name, avatar_url, is_verified, is_creator, is_donor')
          .in('user_id', postUserIds)
      : { data: [] as any[] }

    const profileByUserId = new Map<string, any>((profiles || []).map((p: any) => [p.user_id, p]))

    const enrichedPosts = await Promise.all((posts || []).map(async (post: any) => {
      let userProfile = profileByUserId.get(post.user_id)

      if (!userProfile) {
        // Get from auth
        const { data: authProfile } = await supabaseAdmin
          .from('profiles')
          .select('email')
          .eq('id', post.user_id)
          .maybeSingle()

        userProfile = {
          display_name: authProfile?.email?.split('@')[0] || 'Anonymous',
          avatar_url: null,
          is_verified: false,
          is_creator: false,
          is_donor: false
        }
      }

      return {
        ...post,
        user: userProfile,
        isLiked: userLikes.includes(post.id)
      }
    }))

    return NextResponse.json(
      { posts: enrichedPosts, page, limit },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'Vary': 'Authorization'
        }
      }
    )
  } catch (e: any) {
    logger.error('[community/posts] Error:', e)
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}

// POST - Create a new post
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
    const { content, campaign_id, media_urls, media_types, post_type } = body

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'CONTENT_REQUIRED' }, { status: 400 })
    }

    // Create post
    const { data: post, error: insertErr } = await supabaseAdmin
      .from('community_posts')
      .insert({
        user_id: userData.user.id,
        content: content.trim(),
        campaign_id: campaign_id || null,
        media_urls: media_urls || [],
        media_types: media_types || [],
        post_type: post_type || 'discussion'
      })
      .select()
      .single()

    if (insertErr) {
      return NextResponse.json({ error: 'CREATE_FAILED', details: insertErr.message }, { status: 500 })
    }

    // Parse mentions from content
    // Campaign mentions: @[campaign-slug] or #campaignhashtag
    const campaignMentions = content.match(/@\[([^\]]+)\]/g) || []
    const hashtagMentions = content.match(/#(\w+)/g) || []

    // Process campaign mentions
    for (const mention of campaignMentions) {
      const slug = mention.slice(2, -1) // Remove @[ and ]
      const { data: campaign } = await supabaseAdmin
        .from('submissions')
        .select('id')
        .or(`slug.eq.${slug},short_code.eq.${slug}`)
        .single()
      
      if (campaign) {
        await supabaseAdmin.from('post_mentions').insert({
          post_id: post.id,
          mention_type: 'campaign',
          campaign_id: campaign.id
        })
        
        // Log campaign activity
        await supabaseAdmin.from('campaign_activity').insert({
          campaign_id: campaign.id,
          activity_type: 'mention',
          actor_id: userData.user.id,
          post_id: post.id
        })
      }
    }

    // Process hashtag mentions (match to campaign hashtags)
    for (const hashtag of hashtagMentions) {
      const tag = hashtag.slice(1).toLowerCase() // Remove #
      
      // Check if it's a campaign hashtag
      const { data: campaign } = await supabaseAdmin
        .from('submissions')
        .select('id')
        .eq('hashtag', tag)
        .single()
      
      if (campaign) {
        await supabaseAdmin.from('post_mentions').insert({
          post_id: post.id,
          mention_type: 'campaign',
          campaign_id: campaign.id
        })
      }

      // Check if it's a tag
      const { data: tagRecord } = await supabaseAdmin
        .from('campaign_tags')
        .select('id')
        .eq('slug', tag)
        .single()

      if (tagRecord) {
        await supabaseAdmin.from('post_mentions').insert({
          post_id: post.id,
          mention_type: 'tag',
          tag_id: tagRecord.id
        })
      }
    }

    // If linked to a campaign, log activity
    if (campaign_id) {
      await supabaseAdmin.from('campaign_activity').insert({
        campaign_id,
        activity_type: 'post',
        actor_id: userData.user.id,
        post_id: post.id
      })
    }

    // Ensure user has a community profile
    await supabaseAdmin
      .from('community_profiles')
      .upsert({ 
        user_id: userData.user.id,
        display_name: userData.user.email?.split('@')[0] || 'User'
      }, { onConflict: 'user_id' })

    return NextResponse.json({ ok: true, post })
  } catch (e: any) {
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}

// PUT - Edit a post (owner only)
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
      return NextResponse.json({ error: 'POST_ID_REQUIRED' }, { status: 400 })
    }

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'CONTENT_REQUIRED' }, { status: 400 })
    }

    // Fetch the post to check ownership
    const { data: post, error: fetchErr } = await supabaseAdmin
      .from('community_posts')
      .select('user_id')
      .eq('id', id)
      .single()

    if (fetchErr || !post) {
      return NextResponse.json({ error: 'POST_NOT_FOUND' }, { status: 404 })
    }

    // Only owner can edit (admins cannot edit others' posts, only delete)
    if (post.user_id !== userData.user.id) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'You can only edit your own posts' }, { status: 403 })
    }

    // Update the post
    const { data: updatedPost, error: updateErr } = await supabaseAdmin
      .from('community_posts')
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

    return NextResponse.json({ ok: true, post: updatedPost })
  } catch (e: any) {
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}

// DELETE - Delete a post (owner or admin only)
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
    const postId = searchParams.get('id')

    if (!postId) {
      return NextResponse.json({ error: 'POST_ID_REQUIRED' }, { status: 400 })
    }

    // Fetch the post to check ownership
    const { data: post, error: fetchErr } = await supabaseAdmin
      .from('community_posts')
      .select('user_id')
      .eq('id', postId)
      .single()

    if (fetchErr || !post) {
      return NextResponse.json({ error: 'POST_NOT_FOUND' }, { status: 404 })
    }

    // Check if user is owner or admin
    const { data: adminCheck } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    const isOwner = post.user_id === userData.user.id
    const isAdmin = !!adminCheck

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    // Delete related data first (comments, likes, mentions)
    await supabaseAdmin.from('community_comments').delete().eq('post_id', postId)
    await supabaseAdmin.from('community_likes').delete().eq('post_id', postId)
    await supabaseAdmin.from('post_mentions').delete().eq('post_id', postId)

    // Delete the post
    const { error: deleteErr } = await supabaseAdmin
      .from('community_posts')
      .delete()
      .eq('id', postId)

    if (deleteErr) {
      return NextResponse.json({ error: 'DELETE_FAILED', details: deleteErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}
