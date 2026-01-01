'use client'

/**
 * CommunityHubClientV2 - Modular Refactored Version
 * 
 * Original: 1,623 lines (monolithic)
 * Refactored: ~300 lines (orchestrator pattern)
 * 
 * Uses modular components from @/components/community:
 * - usePosts - Post CRUD operations
 * - useComments - Comment CRUD operations
 * - PostCard - Individual post display
 * - PostComposer - Post creation
 */

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { CATEGORIES, getCategoryById, mapLegacyCategory } from '@/lib/categories'
import { logger } from '@/lib/logger'
import {
  usePosts,
  useComments,
  PostCard,
  PostComposer,
  type Post,
  type CampaignPreview,
  type PostTab,
  type UserProfile
} from '@/components/community'

// Convert IPFS URI to HTTP gateway URL
const toHttpUrl = (uri: string | null): string | null => {
  if (!uri) return null
  if (uri.startsWith('ipfs://')) {
    return `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`
  }
  return uri
}

export default function CommunityHubClientV2() {
  const searchParams = useSearchParams()
  
  // Auth state
  const [user, setUser] = useState<any>(null)
  const [token, setToken] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // Filter state
  const [activeTab, setActiveTab] = useState<PostTab>('all')
  const [filterCampaign, setFilterCampaign] = useState<CampaignPreview | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Campaign data
  const [allCampaigns, setAllCampaigns] = useState<CampaignPreview[]>([])
  const [myCampaigns, setMyCampaigns] = useState<CampaignPreview[]>([])
  const [campaignPreviews, setCampaignPreviews] = useState<Record<string, CampaignPreview>>({})

  // UI state
  const [newPostContent, setNewPostContent] = useState('')
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // Use modular hooks
  const {
    posts,
    isLoading,
    createPost,
    deletePost,
    likePost
  } = usePosts({ token, activeTab, filterCampaign })

  const {
    comments,
    fetchComments,
    addComment,
    deleteComment
  } = useComments(token)

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)
      setToken(session?.access_token || null)
      if (session?.access_token) {
        fetchUserProfile(session.access_token)
      }
    }
    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null)
      setToken(session?.access_token || null)
      if (session?.access_token) {
        fetchUserProfile(session.access_token)
      } else {
        setUserProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Load campaigns for sidebar
  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        const res = await fetch('/api/marketplace/fundraisers?limit=50')
        if (res.ok) {
          const data = await res.json()
          const fundraisers = data?.items || data?.fundraisers || []
          const campaigns = fundraisers.map((f: any) => ({
            id: f.id,
            title: f.title,
            image_uri: f.image,
            slug: f.slug,
            short_code: f.short_code,
            campaign_id: f.campaignId,
            category: mapLegacyCategory(f.category || 'general')
          }))
          setAllCampaigns(campaigns)
        }
      } catch (e) {
        console.error('Failed to load campaigns:', e)
      }
    }
    loadCampaigns()
  }, [])

  // Handle prefill from URL
  useEffect(() => {
    const prefill = searchParams.get('prefill')
    if (prefill && !newPostContent) {
      setNewPostContent(prefill)
    }
  }, [searchParams, newPostContent])

  const fetchUserProfile = async (accessToken: string) => {
    try {
      const res = await fetch('/api/community/profile', {
        headers: { authorization: `Bearer ${accessToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        setUserProfile(data?.profile || null)
      }
      // Check admin status
      const adminRes = await fetch('/api/admin/me', {
        headers: { authorization: `Bearer ${accessToken}` }
      })
      if (adminRes.ok) {
        const adminData = await adminRes.json()
        setIsAdmin(!!adminData?.admin)
      }
      // Fetch user's campaigns
      const myCampaignsRes = await fetch('/api/community/my-campaigns', {
        headers: { authorization: `Bearer ${accessToken}` }
      })
      if (myCampaignsRes.ok) {
        const data = await myCampaignsRes.json()
        setMyCampaigns(data?.campaigns || [])
      }
    } catch (e) {
      console.error('Failed to fetch user profile:', e)
    }
  }

  // Fetch campaign preview for mentions
  const fetchCampaignPreview = useCallback(async (id: string) => {
    if (campaignPreviews[id]) return
    try {
      const res = await fetch(`/api/community/campaigns/${id}`)
      if (res.ok) {
        const data = await res.json()
        if (data?.campaign) {
          setCampaignPreviews(prev => ({
            ...prev,
            [id]: {
              id: data.campaign.id,
              title: data.campaign.title,
              image_uri: data.campaign.image_uri,
              slug: data.campaign.slug,
              short_code: data.campaign.short_code,
              campaign_id: data.campaign.campaign_id
            }
          }))
        }
      }
    } catch (e) {
      console.error(`Failed to fetch campaign ${id}:`, e)
    }
  }, [campaignPreviews])

  // Find campaign by ID
  const findCampaign = useCallback((id: string): CampaignPreview | null => {
    if (campaignPreviews[id]) return campaignPreviews[id]
    const found = allCampaigns.find(c => 
      c.id === id || c.slug === id || c.short_code === id || String(c.campaign_id) === id
    )
    return found || null
  }, [campaignPreviews, allCampaigns])

  // Render post content with campaign mentions
  const renderPostContent = useCallback((content: string) => {
    const parts = content.split(/(@\[[^\]]+\])/g)
    return parts.map((part, index) => {
      const mentionMatch = part.match(/^@\[([^\]]+)\]$/)
      if (mentionMatch) {
        const id = mentionMatch[1]
        const campaign = findCampaign(id)
        if (campaign) {
          return (
            <Link
              key={index}
              href={`/story/${campaign.id}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 hover:text-purple-200 transition-colors text-sm font-medium"
            >
              <span>🎗️</span>
              <span>{campaign.title}</span>
            </Link>
          )
        } else {
          fetchCampaignPreview(id)
          return (
            <span key={index} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-white/50 text-sm">
              <span className="animate-pulse">🎗️</span>
              <span>Loading...</span>
            </span>
          )
        }
      }
      return <span key={index}>{part}</span>
    })
  }, [findCampaign, fetchCampaignPreview])

  // Toggle comments
  const toggleComments = useCallback((postId: string) => {
    setExpandedComments(prev => {
      const next = new Set(prev)
      if (next.has(postId)) {
        next.delete(postId)
      } else {
        next.add(postId)
        if (!comments[postId]) {
          fetchComments(postId)
        }
      }
      return next
    })
  }, [comments, fetchComments])

  // Handle post creation
  const handleCreatePost = useCallback(async () => {
    if (!newPostContent.trim()) return
    const result = await createPost(newPostContent)
    if (result.success) {
      setNewPostContent('')
    } else {
      alert(result.error || 'Failed to create post')
    }
  }, [newPostContent, createPost])

  // Handle comment submission
  const handleSubmitComment = useCallback(async (postId: string) => {
    const content = commentInputs[postId]?.trim()
    if (!content) return
    const result = await addComment(postId, content)
    if (result.success) {
      setCommentInputs(prev => ({ ...prev, [postId]: '' }))
    }
  }, [commentInputs, addComment])

  // Categories for sidebar
  const categories = [
    { id: 'all', name: 'All Campaigns', icon: '🏠', count: allCampaigns.length },
    ...CATEGORIES.map(cat => ({
      id: cat.id,
      name: cat.label,
      icon: cat.emoji,
      count: allCampaigns.filter(c => c.category === cat.id).length
    }))
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-patriotic-navy to-gray-900 flex">
      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        className="lg:hidden fixed bottom-4 left-4 z-50 w-12 h-12 bg-blue-600 hover:bg-blue-500 rounded-full shadow-lg flex items-center justify-center text-white text-xl transition-colors"
      >
        {mobileSidebarOpen ? '✕' : '☰'}
      </button>

      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`
        ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-72'} 
        fixed lg:sticky top-0 left-0 h-screen z-40
        w-72 transform transition-transform duration-300 ease-in-out
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex-shrink-0 bg-gray-900 lg:bg-gray-900/80 border-r border-white/10 flex flex-col
      `}>
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          {!sidebarCollapsed && <h2 className="text-lg font-bold text-white">🏛️ Community</h2>}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id === 'all' ? null : cat.id)
                setFilterCampaign(null)
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                (selectedCategory === cat.id) || (cat.id === 'all' && !selectedCategory && !filterCampaign)
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="text-lg">{cat.icon}</span>
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 text-left text-sm font-medium">{cat.name}</span>
                  <span className="text-xs text-white/40 bg-white/10 px-2 py-0.5 rounded-full">{cat.count}</span>
                </>
              )}
            </button>
          ))}
        </div>

        {!sidebarCollapsed && (
          <div className="p-4 border-t border-white/10">
            <Link href="/marketplace" className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
              <span>🛒</span>
              <span>View Marketplace</span>
            </Link>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="border-b border-white/10 bg-white/5 backdrop-blur-xl sticky top-0 z-10 px-6 py-4">
          <h1 className="text-xl font-bold text-white">🏛️ Community Hub</h1>
          <p className="text-white/60 text-sm">Connect with creators, donors, and supporters</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8">
            {/* Post Composer */}
            {user && (
              <PostComposer
                content={newPostContent}
                onChange={setNewPostContent}
                onSubmit={handleCreatePost}
                isSubmitting={false}
                userProfile={userProfile}
                userEmail={user?.email}
                renderContentPreview={renderPostContent}
                campaigns={allCampaigns.map(c => ({
                  id: c.id,
                  title: c.title,
                  slug: c.slug,
                  image_uri: c.image_uri || undefined
                }))}
              />
            )}

            {!user && (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-6 mb-6 text-center">
                <p className="text-white/60">Sign in to post and interact with the community</p>
              </div>
            )}

            {/* Posts Feed */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white rounded-full" />
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
                <div className="text-4xl mb-3">💬</div>
                <p className="text-white/70">No posts yet</p>
                <p className="text-white/50 text-sm mt-1">Be the first to start a discussion!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={user?.id}
                    isAdmin={isAdmin}
                    comments={comments[post.id] || []}
                    commentsExpanded={expandedComments.has(post.id)}
                    commentInput={commentInputs[post.id] || ''}
                    onToggleLike={(reactionType) => likePost(post.id)}
                    onToggleComments={() => toggleComments(post.id)}
                    onCommentInputChange={(value) => setCommentInputs(prev => ({ ...prev, [post.id]: value }))}
                    onSubmitComment={() => handleSubmitComment(post.id)}
                    onDeletePost={() => deletePost(post.id)}
                    onDeleteComment={(commentId) => deleteComment(post.id, commentId)}
                    renderPostContent={renderPostContent}
                    campaignPreviews={campaignPreviews}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
