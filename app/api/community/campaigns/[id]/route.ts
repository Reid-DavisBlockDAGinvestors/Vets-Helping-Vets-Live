import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET - Get campaign details and community feed
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const campaignId = params.id
    const { searchParams } = new URL(req.url)
    const includePosts = searchParams.get('posts') !== 'false'
    const includeStats = searchParams.get('stats') !== 'false'

    // Get campaign by ID, campaign_id, slug, or short_code
    // campaign_id is the numeric ID (e.g., 13), id is the UUID
    const isNumeric = /^\d+$/.test(campaignId)
    
    let campaignQuery = supabaseAdmin.from('submissions').select('*')
    
    if (isNumeric) {
      // If numeric, check campaign_id first
      campaignQuery = campaignQuery.or(`campaign_id.eq.${campaignId},slug.eq.${campaignId},short_code.eq.${campaignId}`)
    } else {
      // If not numeric, check UUID id, slug, or short_code
      campaignQuery = campaignQuery.or(`id.eq.${campaignId},slug.eq.${campaignId},short_code.eq.${campaignId}`)
    }
    
    const { data: campaign, error: campaignErr } = await campaignQuery.single()

    if (campaignErr || !campaign) {
      return NextResponse.json({ error: 'CAMPAIGN_NOT_FOUND' }, { status: 404 })
    }

    let posts = []
    let stats = null

    // Get posts mentioning this campaign
    if (includePosts) {
      const { data: campaignPosts } = await supabaseAdmin
        .from('community_posts')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: false })
        .limit(20)

      // Also get posts that mention this campaign
      const { data: mentionedPosts } = await supabaseAdmin
        .from('post_mentions')
        .select('post_id')
        .eq('campaign_id', campaign.id)
        .eq('mention_type', 'campaign')

      const mentionPostIds = mentionedPosts?.map(m => m.post_id) || []
      
      if (mentionPostIds.length > 0) {
        const { data: additionalPosts } = await supabaseAdmin
          .from('community_posts')
          .select('*')
          .in('id', mentionPostIds)
          .order('created_at', { ascending: false })

        // Combine and deduplicate
        const allPosts = [...(campaignPosts || []), ...(additionalPosts || [])]
        const seenIds = new Set()
        posts = allPosts.filter(p => {
          if (seenIds.has(p.id)) return false
          seenIds.add(p.id)
          return true
        }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      } else {
        posts = campaignPosts || []
      }

      // Enrich posts with user data
      posts = await Promise.all(posts.map(async (post: any) => {
        const { data: profile } = await supabaseAdmin
          .from('community_profiles')
          .select('display_name, avatar_url, is_verified, is_creator, is_donor')
          .eq('user_id', post.user_id)
          .maybeSingle()
        
        return {
          ...post,
          user: profile || { display_name: 'Anonymous', avatar_url: null, is_verified: false }
        }
      }))
    }

    // Get community stats
    if (includeStats) {
      const { data: communityStats } = await supabaseAdmin
        .from('campaign_community_stats')
        .select('*')
        .eq('campaign_id', campaign.id)
        .maybeSingle()

      // Get follower count
      const { count: followersCount } = await supabaseAdmin
        .from('campaign_followers')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)

      stats = {
        ...(communityStats || {}),
        followers_count: followersCount || 0
      }
    }

    // Get tags
    const { data: tagAssociations } = await supabaseAdmin
      .from('campaign_tag_associations')
      .select('tag_id, campaign_tags(id, name, slug, color, icon)')
      .eq('campaign_id', campaign.id)

    const tags = tagAssociations?.map(t => t.campaign_tags).filter(Boolean) || []

    return NextResponse.json({
      campaign: {
        ...campaign,
        tags
      },
      posts,
      stats
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}
