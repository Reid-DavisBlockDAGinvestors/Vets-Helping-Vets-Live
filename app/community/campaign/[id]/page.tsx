'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface Campaign {
  id: string
  title: string
  slug: string
  short_code: string
  hashtag: string
  description: string
  image_url: string
  goal: number
  status: string
  tags: Array<{ id: string; name: string; slug: string; color: string; icon: string }>
}

interface Post {
  id: string
  content: string
  created_at: string
  likes_count: number
  comments_count: number
  user: {
    display_name: string
    avatar_url: string | null
  }
}

interface Stats {
  followers_count: number
  posts_count: number
  mentions_count: number
}

export default function CampaignCommunityPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const campaignId = params.id as string
  
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [token, setToken] = useState<string | null>(null)
  const [newPostContent, setNewPostContent] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    const prefill = searchParams.get('prefill')
    if (prefill && !newPostContent) {
      setNewPostContent(prefill)
    }
  }, [searchParams, newPostContent])

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)
      setToken(session?.access_token || null)
    }
    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_: any, session: any) => {
      setUser(session?.user || null)
      setToken(session?.access_token || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    loadCampaign()
  }, [campaignId])

  useEffect(() => {
    if (token && campaignId) {
      checkFollowing()
    }
  }, [token, campaignId])

  const loadCampaign = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/community/campaigns/${campaignId}`)
      if (res.ok) {
        const data = await res.json()
        setCampaign(data.campaign)
        setPosts(data.posts || [])
        setStats(data.stats || null)
      }
    } catch (e) {
      console.error('Failed to load campaign:', e)
    } finally {
      setLoading(false)
    }
  }

  const checkFollowing = async () => {
    try {
      const res = await fetch(`/api/community/campaigns/${campaignId}/follow`, {
        headers: { authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setFollowing(data.following)
      }
    } catch (e) {
      console.error('Failed to check following:', e)
    }
  }

  const toggleFollow = async () => {
    if (!token) {
      alert('Please sign in to follow campaigns')
      return
    }

    try {
      const res = await fetch(`/api/community/campaigns/${campaignId}/follow`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}` 
        }
      })
      if (res.ok) {
        const data = await res.json()
        setFollowing(data.following)
        if (stats) {
          setStats({
            ...stats,
            followers_count: data.following ? stats.followers_count + 1 : stats.followers_count - 1
          })
        }
      }
    } catch (e) {
      console.error('Failed to toggle follow:', e)
    }
  }

  const createPost = async () => {
    if (!newPostContent.trim() || !token) return

    setPosting(true)
    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          content: newPostContent.trim(),
          campaign_id: campaign?.id,
          post_type: 'discussion'
        })
      })

      if (res.ok) {
        setNewPostContent('')
        loadCampaign() // Reload posts
      }
    } catch (e) {
      console.error('Failed to create post:', e)
    } finally {
      setPosting(false)
    }
  }

  const formatDate = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-patriotic-navy to-gray-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-patriotic-navy to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-white mb-2">Campaign Not Found</h2>
          <Link href="/community" className="text-blue-400 hover:underline">
            Back to Community Hub
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-patriotic-navy to-gray-900">
      {/* Campaign Header */}
      <div className="border-b border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="container py-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Campaign Image */}
            {campaign.image_url && (
              <div className="w-full md:w-48 h-32 md:h-32 rounded-xl overflow-hidden bg-white/10">
                <img src={campaign.image_url} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            
            {/* Campaign Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-1">{campaign.title}</h1>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-white/60 mb-3">
                    <span className="font-mono bg-white/10 px-2 py-0.5 rounded">#{campaign.hashtag || campaign.short_code}</span>
                    <span>•</span>
                    <span className={`px-2 py-0.5 rounded ${
                      campaign.status === 'minted' ? 'bg-green-500/20 text-green-400' :
                      campaign.status === 'approved' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {campaign.status}
                    </span>
                  </div>
                  
                  {/* Tags */}
                  {campaign.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {campaign.tags.map(tag => (
                        <span 
                          key={tag.id} 
                          className="px-2 py-1 rounded-full text-xs font-medium"
                          style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                        >
                          {tag.icon} {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Follow Button */}
                <button
                  onClick={toggleFollow}
                  className={`px-4 py-2 rounded-full font-medium transition-colors ${
                    following
                      ? 'bg-white/10 text-white hover:bg-white/20'
                      : 'bg-blue-600 text-white hover:bg-blue-500'
                  }`}
                >
                  {following ? '✓ Following' : '+ Follow'}
                </button>
              </div>
              
              {/* Stats */}
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="font-bold text-white">{stats?.followers_count || 0}</span>
                  <span className="text-white/60 ml-1">Followers</span>
                </div>
                <div>
                  <span className="font-bold text-white">{posts.length}</span>
                  <span className="text-white/60 ml-1">Posts</span>
                </div>
                <div>
                  <span className="font-bold text-white">${campaign.goal?.toLocaleString() || 0}</span>
                  <span className="text-white/60 ml-1">Goal</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-8">
        <div className="max-w-3xl mx-auto">
          {/* Quick Links */}
          <div className="flex gap-3 mb-6">
            <Link 
              href={`/story/${campaign.id}`}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg text-sm font-medium transition-colors"
            >
              View Campaign →
            </Link>
            <Link 
              href="/community"
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg text-sm font-medium transition-colors"
            >
              ← Back to Hub
            </Link>
          </div>

          {/* Create Post */}
          {user && (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-6">
              <textarea
                value={newPostContent}
                onChange={e => setNewPostContent(e.target.value)}
                placeholder={`Share your thoughts about "${campaign.title}"...`}
                className="w-full bg-transparent text-white placeholder:text-white/40 resize-none focus:outline-none min-h-[80px] mb-3"
              />
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/40">
                  Use #{campaign.hashtag || campaign.short_code} to mention this campaign
                </span>
                <button
                  onClick={createPost}
                  disabled={posting || !newPostContent.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-full font-medium transition-colors"
                >
                  {posting ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          )}

          {/* Posts */}
          {posts.length === 0 ? (
            <div className="text-center py-12 rounded-2xl bg-white/5 border border-white/10">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-xl font-semibold text-white mb-2">No discussions yet</h3>
              <p className="text-white/60">Be the first to start a conversation about this campaign!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map(post => (
                <div key={post.id} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold overflow-hidden">
                      {post.user.avatar_url ? (
                        <img src={post.user.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (post.user.display_name?.[0] || '?').toUpperCase()
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white">{post.user.display_name}</span>
                        <span className="text-sm text-white/50">{formatDate(post.created_at)}</span>
                      </div>
                      <p className="text-white whitespace-pre-wrap">{post.content}</p>
                      <div className="flex gap-4 mt-3 text-sm text-white/60">
                        <button className="hover:text-white">❤️ {post.likes_count}</button>
                        <button className="hover:text-white">💬 {post.comments_count}</button>
                        <button className="hover:text-white">📤 Share</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
