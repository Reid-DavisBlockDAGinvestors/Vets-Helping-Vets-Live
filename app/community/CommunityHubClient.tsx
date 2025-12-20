'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { CATEGORIES, getCategoryById } from '@/lib/categories'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface Post {
  id: string
  user_id: string
  campaign_id?: string
  content: string
  media_urls: string[]
  media_types: string[]
  post_type: string
  likes_count: number
  comments_count: number
  shares_count: number
  is_pinned: boolean
  is_featured: boolean
  created_at: string
  user: {
    display_name: string
    avatar_url: string | null
    is_verified: boolean
    is_creator: boolean
    is_donor: boolean
  }
  isLiked: boolean
}

interface CampaignPreview {
  id: string
  title: string
  image_uri: string | null
  slug?: string
  short_code?: string
  campaign_id?: number
  category?: string
}

interface Category {
  id: string
  name: string
  icon: string
  count: number
}

interface Comment {
  id: string
  user_id: string
  content: string
  created_at: string
  likes_count: number
  user: {
    display_name: string
    avatar_url: string | null
    is_verified: boolean
  }
}

// Convert IPFS URI to HTTP gateway URL
const toHttpUrl = (uri: string | null): string | null => {
  if (!uri) return null
  if (uri.startsWith('ipfs://')) {
    return `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`
  }
  return uri
}

export default function CommunityHubClient() {
  const searchParams = useSearchParams()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [token, setToken] = useState<string | null>(null)
  const [newPostContent, setNewPostContent] = useState('')
  const [postingLoading, setPostingLoading] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<string[]>([])
  const [mediaTypes, setMediaTypes] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'all' | 'discussions' | 'updates' | 'media'>('all')
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [postComments, setPostComments] = useState<Record<string, Comment[]>>({})
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [embedInput, setEmbedInput] = useState('')
  const [showEmbedModal, setShowEmbedModal] = useState(false)
  const [userProfile, setUserProfile] = useState<{ display_name: string; avatar_url: string | null } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [campaignPreviews, setCampaignPreviews] = useState<Record<string, CampaignPreview>>({})
  const [deletingPost, setDeletingPost] = useState<string | null>(null)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [editPostContent, setEditPostContent] = useState('')
  const [savingPost, setSavingPost] = useState(false)
  const [editingComment, setEditingComment] = useState<{ postId: string; comment: Comment } | null>(null)
  const [editCommentContent, setEditCommentContent] = useState('')
  const [savingComment, setSavingComment] = useState(false)
  const [deletingComment, setDeletingComment] = useState<string | null>(null)
  const [filterCampaign, setFilterCampaign] = useState<CampaignPreview | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [allCampaigns, setAllCampaigns] = useState<CampaignPreview[]>([])
  const [myCampaigns, setMyCampaigns] = useState<(CampaignPreview & { interactionTypes?: string[] })[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['all']))
  const [myExpanded, setMyExpanded] = useState(true)
  
  // Categories for fundraisers - dynamically built from shared config
  const categories: Category[] = [
    { id: 'all', name: 'All Campaigns', icon: '🏠', count: allCampaigns.length },
    ...CATEGORIES.map(cat => ({
      id: cat.id,
      name: cat.label,
      icon: cat.emoji,
      count: allCampaigns.filter(c => c.category === cat.id).length
    }))
  ]
  
  // Toggle category expansion
  const toggleCategoryExpand = (catId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(catId)) {
        newSet.delete(catId)
      } else {
        newSet.add(catId)
      }
      return newSet
    })
  }
  
  // Get campaigns for a specific category
  const getCampaignsForCategory = (catId: string) => {
    if (catId === 'all') return allCampaigns
    return allCampaigns.filter(c => c.category === catId)
  }

  useEffect(() => {
    const prefill = searchParams.get('prefill')
    if (prefill && !newPostContent) {
      setNewPostContent(prefill)
      // Extract any campaign mentions from prefill and fetch their previews
      const mentions = prefill.match(/@\[([^\]]+)\]/g) || []
      const ids = mentions.map((m: string) => m.slice(2, -1)).filter(Boolean)
      if (ids.length > 0) {
        fetchCampaignPreviews(ids)
      }
    }
  }, [searchParams, newPostContent])

  // Load all campaigns for sidebar
  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        // Request up to 50 campaigns (max allowed by API)
        const res = await fetch('/api/marketplace/fundraisers?limit=50')
        if (res.ok) {
          const data = await res.json()
          // API returns 'items' array, not 'fundraisers'
          const fundraisers = data?.items || data?.fundraisers || []
          console.log('[Community] Loaded campaigns:', fundraisers.length, fundraisers.map((f: any) => ({ title: f.title, category: f.category })))
          const campaigns = fundraisers.map((f: any) => ({
            id: f.id,
            title: f.title,
            image_uri: f.image,
            slug: f.slug,
            short_code: f.short_code,
            campaign_id: f.campaignId,
            category: f.category || 'general'  // API returns 'category', not 'causeType'
          }))
          setAllCampaigns(campaigns)
        }
      } catch (e) {
        console.error('Failed to load campaigns for sidebar:', e)
      }
    }
    loadCampaigns()
  }, [])

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_: any, session: any) => {
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

  const fetchUserProfile = async (accessToken: string) => {
    try {
      const res = await fetch('/api/community/profile', {
        headers: { authorization: `Bearer ${accessToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        setUserProfile(data?.profile || null)
      }
      // Check if user is admin
      const adminRes = await fetch('/api/admin/me', {
        headers: { authorization: `Bearer ${accessToken}` }
      })
      if (adminRes.ok) {
        const adminData = await adminRes.json()
        setIsAdmin(!!adminData?.admin)
      }
      // Fetch user's campaigns
      fetchMyCampaigns(accessToken)
    } catch (e) {
      console.error('Failed to fetch user profile:', e)
    }
  }

  // Fetch campaigns the user has interacted with
  const fetchMyCampaigns = async (accessToken: string) => {
    try {
      const res = await fetch('/api/community/my-campaigns', {
        headers: { authorization: `Bearer ${accessToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        setMyCampaigns(data?.campaigns || [])
      }
    } catch (e) {
      console.error('Failed to fetch my campaigns:', e)
    }
  }

  // Fetch campaign previews for mentions
  const fetchCampaignPreviews = async (ids: string[]) => {
    console.log('[Community] Fetching campaign previews for:', ids)
    const newPreviews: Record<string, CampaignPreview> = {}
    for (const id of ids) {
      // Skip if already fetching or fetched
      if (campaignPreviews[id]) continue
      try {
        const res = await fetch(`/api/community/campaigns/${id}`)
        console.log(`[Community] Fetch campaign ${id}: status=${res.status}`)
        if (res.ok) {
          const data = await res.json()
          console.log(`[Community] Campaign ${id} data:`, data?.campaign?.title, data?.campaign?.image_uri)
          if (data?.campaign) {
            newPreviews[id] = {
              id: data.campaign.id,
              title: data.campaign.title,
              image_uri: data.campaign.image_uri,
              slug: data.campaign.slug,
              short_code: data.campaign.short_code,
              campaign_id: data.campaign.campaign_id
            }
          }
        } else {
          console.error(`[Community] Failed to fetch campaign ${id}: ${res.status}`)
        }
      } catch (e) {
        console.error(`Failed to fetch campaign ${id}:`, e)
      }
    }
    if (Object.keys(newPreviews).length > 0) {
      console.log('[Community] Setting campaign previews:', Object.keys(newPreviews))
      setCampaignPreviews(prev => ({ ...prev, ...newPreviews }))
    }
  }

  // Delete a post
  const deletePost = async (postId: string) => {
    if (!token) return
    if (!confirm('Are you sure you want to delete this post?')) return
    
    setDeletingPost(postId)
    try {
      const res = await fetch(`/api/community/posts?id=${postId}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setPosts(prev => prev.filter(p => p.id !== postId))
      } else {
        const err = await res.json()
        alert(err?.error || 'Failed to delete post')
      }
    } catch (e: any) {
      alert(e?.message || 'Failed to delete post')
    } finally {
      setDeletingPost(null)
    }
  }

  // Edit a post
  const startEditPost = (post: Post) => {
    setEditingPost(post)
    setEditPostContent(post.content)
  }

  const cancelEditPost = () => {
    setEditingPost(null)
    setEditPostContent('')
  }

  const saveEditPost = async () => {
    if (!token || !editingPost || !editPostContent.trim()) return
    
    setSavingPost(true)
    try {
      const res = await fetch('/api/community/posts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: editingPost.id, content: editPostContent.trim() })
      })
      if (res.ok) {
        const data = await res.json()
        setPosts(prev => prev.map(p => p.id === editingPost.id ? { ...p, content: editPostContent.trim() } : p))
        cancelEditPost()
      } else {
        const err = await res.json()
        alert(err?.message || err?.error || 'Failed to update post')
      }
    } catch (e: any) {
      alert(e?.message || 'Failed to update post')
    } finally {
      setSavingPost(false)
    }
  }

  // Edit a comment
  const startEditComment = (postId: string, comment: Comment) => {
    setEditingComment({ postId, comment })
    setEditCommentContent(comment.content)
  }

  const cancelEditComment = () => {
    setEditingComment(null)
    setEditCommentContent('')
  }

  const saveEditComment = async () => {
    if (!token || !editingComment || !editCommentContent.trim()) return
    
    setSavingComment(true)
    try {
      const res = await fetch('/api/community/comments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: editingComment.comment.id, content: editCommentContent.trim() })
      })
      if (res.ok) {
        const data = await res.json()
        setPostComments(prev => ({
          ...prev,
          [editingComment.postId]: prev[editingComment.postId]?.map(c => 
            c.id === editingComment.comment.id ? { ...c, content: editCommentContent.trim() } : c
          ) || []
        }))
        cancelEditComment()
      } else {
        const err = await res.json()
        alert(err?.message || err?.error || 'Failed to update comment')
      }
    } catch (e: any) {
      alert(e?.message || 'Failed to update comment')
    } finally {
      setSavingComment(false)
    }
  }

  // Delete a comment
  const deleteComment = async (postId: string, commentId: string) => {
    if (!token) return
    if (!confirm('Are you sure you want to delete this comment?')) return
    
    setDeletingComment(commentId)
    try {
      const res = await fetch(`/api/community/comments?id=${commentId}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setPostComments(prev => ({
          ...prev,
          [postId]: prev[postId]?.filter(c => c.id !== commentId) || []
        }))
        // Update comment count
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p))
      } else {
        const err = await res.json()
        alert(err?.error || 'Failed to delete comment')
      }
    } catch (e: any) {
      alert(e?.message || 'Failed to delete comment')
    } finally {
      setDeletingComment(null)
    }
  }

  // Load posts
  useEffect(() => {
    loadPosts()
  }, [activeTab, token])

  const loadPosts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (activeTab === 'discussions') params.set('type', 'discussion')
      if (activeTab === 'updates') params.set('type', 'update')
      if (activeTab === 'media') params.set('type', 'media')

      const headers: Record<string, string> = {}
      if (token) headers['authorization'] = `Bearer ${token}`

      const res = await fetch(`/api/community/posts?${params}`, { headers, cache: 'no-store' })
      const data = await res.json()
      const fetchedPosts = data?.posts || []
      setPosts(fetchedPosts)
      
      // Extract campaign mentions and fetch previews
      const mentionIds = new Set<string>()
      for (const post of fetchedPosts) {
        const mentions = post.content.match(/@\[([^\]]+)\]/g) || []
        for (const m of mentions) {
          const id = m.slice(2, -1)
          if (id && !campaignPreviews[id]) mentionIds.add(id)
        }
      }
      if (mentionIds.size > 0) {
        fetchCampaignPreviews(Array.from(mentionIds))
      }
    } catch (e) {
      console.error('Failed to load posts:', e)
    } finally {
      setLoading(false)
    }
  }

  const createPost = async () => {
    if (!newPostContent.trim() && selectedMedia.length === 0) return
    if (!token) {
      alert('Please sign in to post')
      return
    }

    setPostingLoading(true)
    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          content: newPostContent.trim(),
          media_urls: selectedMedia,
          media_types: mediaTypes,
          post_type: selectedMedia.length > 0 ? 'media' : 'discussion'
        })
      })

      if (res.ok) {
        await res.json().catch(() => ({}))
        setNewPostContent('')
        setSelectedMedia([])
        setMediaTypes([])
        await loadPosts()
      } else {
        const err = await res.json()
        alert(err?.message || 'Failed to create post')
      }
    } catch (e: any) {
      alert(e?.message || 'Failed to create post')
    } finally {
      setPostingLoading(false)
    }
  }

  const toggleLike = async (postId: string) => {
    if (!token) {
      alert('Please sign in to like posts')
      return
    }

    // Optimistic update
    setPosts(prev => prev.map(p => p.id === postId ? {
      ...p,
      isLiked: !p.isLiked,
      likes_count: p.isLiked ? p.likes_count - 1 : p.likes_count + 1
    } : p))

    try {
      await fetch('/api/community/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ post_id: postId })
      })
    } catch {
      // Revert on error
      loadPosts()
    }
  }

  const loadComments = async (postId: string) => {
    try {
      const res = await fetch(`/api/community/comments?post_id=${postId}`)
      const data = await res.json()
      setPostComments(prev => ({ ...prev, [postId]: data?.comments || [] }))
    } catch (e) {
      console.error('Failed to load comments:', e)
    }
  }

  const toggleComments = (postId: string) => {
    const newExpanded = new Set(expandedComments)
    if (newExpanded.has(postId)) {
      newExpanded.delete(postId)
    } else {
      newExpanded.add(postId)
      if (!postComments[postId]) {
        loadComments(postId)
      }
    }
    setExpandedComments(newExpanded)
  }

  const submitComment = async (postId: string) => {
    const content = commentInputs[postId]?.trim()
    if (!content || !token) return

    try {
      const res = await fetch('/api/community/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ post_id: postId, content })
      })

      if (res.ok) {
        const data = await res.json()
        setPostComments(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), data.comment]
        }))
        setCommentInputs(prev => ({ ...prev, [postId]: '' }))
        // Update comment count
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p))
      }
    } catch (e) {
      console.error('Failed to submit comment:', e)
    }
  }

  const addEmbed = () => {
    const url = embedInput.trim()
    if (!url) return

    // Detect media type
    let type = 'link'
    if (url.includes('youtube.com') || url.includes('youtu.be')) type = 'youtube'
    else if (url.includes('twitter.com') || url.includes('x.com')) type = 'twitter'
    else if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) type = 'image'
    else if (url.match(/\.(mp4|webm|mov)$/i)) type = 'video'

    setSelectedMedia(prev => [...prev, url])
    setMediaTypes(prev => [...prev, type])
    setEmbedInput('')
    setShowEmbedModal(false)
  }

  const removeMedia = (index: number) => {
    setSelectedMedia(prev => prev.filter((_, i) => i !== index))
    setMediaTypes(prev => prev.filter((_, i) => i !== index))
  }

  const shareToSocial = (platform: string, post: Post) => {
    const text = encodeURIComponent(post.content.slice(0, 280))
    const url = encodeURIComponent(`${window.location.origin}/community?post=${post.id}`)

    const shareUrls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      reddit: `https://reddit.com/submit?url=${url}&title=${text}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`
    }

    window.open(shareUrls[platform], '_blank', 'width=600,height=400')
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

  // Find campaign by ID, UUID, slug, or short_code
  const findCampaign = (id: string): CampaignPreview | null => {
    // First check campaignPreviews (fetched from API)
    if (campaignPreviews[id]) return campaignPreviews[id]
    
    // Then check allCampaigns (loaded from marketplace)
    const found = allCampaigns.find(c => 
      c.id === id || 
      c.slug === id || 
      c.short_code === id ||
      String(c.campaign_id) === id
    )
    return found || null
  }

  // Render post content with campaign mentions as styled links
  const renderPostContent = (content: string) => {
    // Split content by @[id] mentions
    const parts = content.split(/(@\[[^\]]+\])/g)
    
    return parts.map((part, index) => {
      const mentionMatch = part.match(/^@\[([^\]]+)\]$/)
      if (mentionMatch) {
        const id = mentionMatch[1]
        const campaign = findCampaign(id)
        if (campaign) {
          // Render as a styled campaign link
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
          // Campaign not found - fetch it asynchronously
          if (!campaignPreviews[id]) {
            fetchCampaignPreviews([id])
          }
          return (
            <span key={index} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-white/50 text-sm">
              <span className="animate-pulse">🎗️</span>
              <span>Loading...</span>
            </span>
          )
        }
      }
      // Regular text
      return <span key={index}>{part}</span>
    })
  }

  const renderMedia = (urls: string[], types: string[]) => {
    if (!urls.length) return null

    return (
      <div className={`mt-3 grid gap-2 ${urls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {urls.map((url, i) => {
          const type = types[i] || 'image'

          if (type === 'youtube') {
            const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)?.[1]
            return (
              <div key={i} className="rounded-xl overflow-hidden aspect-video bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}`}
                  className="w-full h-full"
                  allowFullScreen
                />
              </div>
            )
          }

          if (type === 'twitter') {
            return (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" 
                className="block p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-2 text-blue-400">
                  <span className="text-xl">𝕏</span>
                  <span className="text-sm">View on X/Twitter →</span>
                </div>
              </a>
            )
          }

          if (type === 'video') {
            return (
              <video key={i} src={url} controls className="w-full rounded-xl max-h-96" />
            )
          }

          if (type === 'gif' || type === 'image') {
            return (
              <img key={i} src={url} alt="" className="w-full rounded-xl object-cover max-h-96" />
            )
          }

          return (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
              className="block p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-blue-400 text-sm truncate">
              🔗 {url}
            </a>
          )
        })}
      </div>
    )
  }

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-b from-patriotic-navy to-gray-900 flex">
      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        className="lg:hidden fixed bottom-4 left-4 z-50 w-12 h-12 bg-blue-600 hover:bg-blue-500 rounded-full shadow-lg flex items-center justify-center text-white text-xl transition-colors"
        aria-label="Toggle sidebar"
      >
        {mobileSidebarOpen ? '✕' : '☰'}
      </button>

      {/* Mobile Sidebar Backdrop */}
      {mobileSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar - Discord-like */}
      <div className={`
        ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-72'} 
        fixed lg:sticky top-0 left-0 h-screen z-40
        w-72 transform transition-transform duration-300 ease-in-out
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex-shrink-0 bg-gray-900 lg:bg-gray-900/80 border-r border-white/10 flex flex-col
      `}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          {!sidebarCollapsed && (
            <h2 className="text-lg font-bold text-white">🏛️ Community</h2>
          )}
          <button
            onClick={() => {
              if (window.innerWidth < 1024) {
                setMobileSidebarOpen(false)
              } else {
                setSidebarCollapsed(!sidebarCollapsed)
              }
            }}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        {/* Categories with nested campaigns */}
        <div className="flex-1 overflow-y-auto">
          {/* Your Campaigns Section - only show if logged in and has campaigns */}
          {user && myCampaigns.length > 0 && !sidebarCollapsed && (
            <div className="border-b border-white/10 pb-2 mb-2">
              <button
                onClick={() => setMyExpanded(!myExpanded)}
                className="w-full flex items-center gap-2 px-4 py-2 text-left"
              >
                <span className={`text-xs transition-transform ${myExpanded ? 'rotate-90' : ''}`}>▶</span>
                <span className="text-lg">⭐</span>
                <span className="flex-1 text-sm font-medium text-yellow-400">Your Campaigns</span>
                <span className="text-xs text-white/40 bg-yellow-500/20 px-2 py-0.5 rounded-full">
                  {myCampaigns.length}
                </span>
              </button>
              {myExpanded && (
                <div className="ml-4 mt-1 space-y-0.5 border-l border-yellow-500/30 pl-2">
                  {myCampaigns.map(campaign => (
                    <button
                      key={campaign.id}
                      onClick={() => {
                        setFilterCampaign(campaign)
                        setSelectedCategory(null)
                      }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
                        filterCampaign?.id === campaign.id
                          ? 'bg-yellow-500/20 text-yellow-300'
                          : 'text-white/60 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {/* NFT Thumbnail */}
                      <div className="w-6 h-6 rounded overflow-hidden bg-white/10 flex-shrink-0">
                        {campaign.image_uri ? (
                          <img
                            src={toHttpUrl(campaign.image_uri) || ''}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs">⭐</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <span className="text-sm truncate block">{campaign.title}</span>
                        {campaign.interactionTypes && campaign.interactionTypes.length > 0 && (
                          <span className="text-xs text-white/40">
                            {campaign.interactionTypes.includes('created') && '👤 Creator'}
                            {campaign.interactionTypes.includes('purchased') && '🛒 Supporter'}
                            {campaign.interactionTypes.includes('commented') && '💬 Engaged'}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!sidebarCollapsed && (
            <p className="text-xs text-white/40 uppercase tracking-wider px-4 py-2">Browse Campaigns</p>
          )}
          <div className="space-y-1 px-2">
            {categories.map(cat => {
              const campaignsInCategory = getCampaignsForCategory(cat.id)
              const isExpanded = expandedCategories.has(cat.id)
              const hasActiveCampaign = filterCampaign && (
                cat.id === 'all' || filterCampaign.category === cat.id
              )
              
              return (
                <div key={cat.id}>
                  {/* Category Header */}
                  <button
                    onClick={() => {
                      if (sidebarCollapsed) {
                        setSelectedCategory(cat.id === 'all' ? null : cat.id)
                        setFilterCampaign(null)
                      } else {
                        toggleCategoryExpand(cat.id)
                      }
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      (selectedCategory === cat.id) || (cat.id === 'all' && !selectedCategory && !filterCampaign)
                        ? 'bg-blue-600/20 text-blue-400'
                        : hasActiveCampaign
                          ? 'bg-purple-600/10 text-purple-300'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }`}
                    title={sidebarCollapsed ? cat.name : undefined}
                  >
                    {!sidebarCollapsed && (
                      <span className={`text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                        ▶
                      </span>
                    )}
                    <span className="text-lg">{cat.icon}</span>
                    {!sidebarCollapsed && (
                      <>
                        <span className="flex-1 text-left text-sm font-medium">{cat.name}</span>
                        <span className="text-xs text-white/40 bg-white/10 px-2 py-0.5 rounded-full">
                          {cat.count}
                        </span>
                      </>
                    )}
                  </button>
                  
                  {/* Campaigns under this category */}
                  {!sidebarCollapsed && isExpanded && campaignsInCategory.length > 0 && (
                    <div className="ml-4 mt-1 space-y-0.5 border-l border-white/10 pl-2">
                      {campaignsInCategory.map(campaign => (
                        <button
                          key={campaign.id}
                          onClick={() => {
                            setFilterCampaign(campaign)
                            setSelectedCategory(null)
                          }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
                            filterCampaign?.id === campaign.id
                              ? 'bg-purple-600/20 text-purple-400'
                              : 'text-white/60 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          {/* NFT Thumbnail */}
                          <div className="w-6 h-6 rounded overflow-hidden bg-white/10 flex-shrink-0">
                            {campaign.image_uri ? (
                              <img
                                src={toHttpUrl(campaign.image_uri) || ''}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs">
                                {getCategoryById(campaign.category || 'other')?.emoji || '💝'}
                              </div>
                            )}
                          </div>
                          <span className="flex-1 text-left text-sm truncate">{campaign.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Empty state for category */}
                  {!sidebarCollapsed && isExpanded && campaignsInCategory.length === 0 && (
                    <div className="ml-6 py-2 text-xs text-white/40">
                      No active campaigns
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Sidebar Footer */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-white/10">
            <Link
              href="/marketplace"
              className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
            >
              <span>🛒</span>
              <span>View Marketplace</span>
            </Link>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <div className="border-b border-white/10 bg-white/5 backdrop-blur-xl sticky top-0 z-10">
          <div className="px-6 py-4">
            <div className="flex items-center gap-4">
              {filterCampaign ? (
                <>
                  {filterCampaign.image_uri && (
                    <img
                      src={toHttpUrl(filterCampaign.image_uri) || ''}
                      alt=""
                      className="w-12 h-12 rounded-xl object-cover"
                    />
                  )}
                  <div>
                    <h1 className="text-xl font-bold text-white">{filterCampaign.title}</h1>
                    <p className="text-white/60 text-sm">Campaign discussions and updates</p>
                  </div>
                  <Link
                    href={`/story/${filterCampaign.id}`}
                    className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    View Campaign →
                  </Link>
                </>
              ) : selectedCategory ? (
                <div>
                  <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    {categories.find(c => c.id === selectedCategory)?.icon}
                    {categories.find(c => c.id === selectedCategory)?.name}
                  </h1>
                  <p className="text-white/60 text-sm">Browse {selectedCategory} campaigns and discussions</p>
                </div>
              ) : (
                <div>
                  <h1 className="text-xl font-bold text-white">🏛️ Community Hub</h1>
                  <p className="text-white/60 text-sm">Connect with creators, donors, and supporters</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8">
          {/* Create Post */}
          {user ? (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-6">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold overflow-hidden">
                  {userProfile?.avatar_url ? (
                    <img src={userProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (user.email?.[0] || '?').toUpperCase()
                  )}
                </div>
                <div className="flex-1">
                  {/* Show preview of mentions if content has @[...] */}
                  {newPostContent.includes('@[') ? (
                    <div className="mb-2 p-3 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-xs text-white/40 mb-1">Preview:</p>
                      <div className="text-white text-sm">{renderPostContent(newPostContent)}</div>
                    </div>
                  ) : null}
                  <textarea
                    value={newPostContent}
                    onChange={e => setNewPostContent(e.target.value)}
                    placeholder="What's on your mind? Share updates, ask questions, celebrate milestones..."
                    className="w-full bg-transparent text-white placeholder:text-white/40 resize-none focus:outline-none min-h-[80px]"
                  />

                  {/* Selected Media Preview */}
                  {selectedMedia.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedMedia.map((url, i) => (
                        <div key={i} className="relative">
                          <div className="w-20 h-20 rounded-lg bg-white/10 overflow-hidden">
                            {mediaTypes[i] === 'image' || mediaTypes[i] === 'gif' ? (
                              <img src={url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-2xl">
                                {mediaTypes[i] === 'youtube' ? '▶️' : mediaTypes[i] === 'twitter' ? '𝕏' : '🔗'}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => removeMedia(i)}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                    <div className="flex gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                        title="Upload Image"
                      >
                        🖼️
                      </button>
                      <button
                        onClick={() => setShowEmbedModal(true)}
                        className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                        title="Add Link/Video"
                      >
                        🔗
                      </button>
                      <button
                        className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                        title="Add GIF"
                      >
                        GIF
                      </button>
                    </div>
                    <button
                      onClick={createPost}
                      disabled={postingLoading || (!newPostContent.trim() && selectedMedia.length === 0)}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-full font-medium transition-colors"
                    >
                      {postingLoading ? 'Posting...' : 'Post'}
                    </button>
                  </div>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={e => {
                  // For now, show placeholder. Real implementation would upload to storage
                  if (e.target.files?.[0]) {
                    const file = e.target.files[0]
                    const type = file.type.startsWith('video') ? 'video' : 'image'
                    // Placeholder: In production, upload to Supabase storage
                    alert('Media upload coming soon! For now, use the link button to embed from URL.')
                  }
                }}
              />
            </div>
          ) : (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-6 mb-6 text-center">
              <p className="text-white/60 mb-3">Sign in to join the conversation</p>
              <Link href="/admin" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-medium transition-colors inline-block">
                Sign In
              </Link>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {[
              { id: 'all', label: 'All Posts', icon: '📰' },
              { id: 'discussions', label: 'Discussions', icon: '💬' },
              { id: 'updates', label: 'Updates', icon: '📢' },
              { id: 'media', label: 'Media', icon: '🖼️' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Campaign Filter Banner */}
          {filterCampaign && (
            <div className="mb-4 p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center gap-3">
              {filterCampaign.image_uri && (
                <img
                  src={toHttpUrl(filterCampaign.image_uri) || ''}
                  alt={filterCampaign.title}
                  className="w-10 h-10 rounded-lg object-cover"
                />
              )}
              <div className="flex-1">
                <p className="text-sm text-purple-300">Showing discussions for:</p>
                <p className="font-medium text-white">{filterCampaign.title}</p>
              </div>
              <button
                onClick={() => setFilterCampaign(null)}
                className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                Clear Filter
              </button>
            </div>
          )}

          {/* Posts Feed */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-white/50">Loading posts...</p>
            </div>
          ) : posts.filter(p => {
            if (!filterCampaign) return true
            // Filter posts that mention this campaign
            const campaignId = filterCampaign.id
            const mentions = p.content.match(/@\[([^\]]+)\]/g) || []
            const mentionedIds = mentions.map((m: string) => m.slice(2, -1))
            // Check if post mentions this campaign by id, slug, short_code, or campaign_id
            return mentionedIds.some((id: string) => {
              const preview = campaignPreviews[id]
              return preview?.id === campaignId
            }) || p.campaign_id === campaignId
          }).length === 0 ? (
            <div className="text-center py-12 rounded-2xl bg-white/5 border border-white/10">
              <div className="text-4xl mb-4">🌟</div>
              <h3 className="text-xl font-semibold text-white mb-2">No posts yet</h3>
              <p className="text-white/60">Be the first to start a conversation!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.filter(p => {
                if (!filterCampaign) return true
                const campaignId = filterCampaign.id
                const mentions = p.content.match(/@\[([^\]]+)\]/g) || []
                const mentionedIds = mentions.map((m: string) => m.slice(2, -1))
                return mentionedIds.some((id: string) => {
                  const preview = campaignPreviews[id]
                  return preview?.id === campaignId
                }) || p.campaign_id === campaignId
              }).map(post => (
                <div key={post.id} className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
                  {/* Post Header */}
                  <div className="p-4 pb-0">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold overflow-hidden">
                        {post.user.avatar_url ? (
                          <img src={post.user.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (post.user.display_name?.[0] || '?').toUpperCase()
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{post.user.display_name}</span>
                          {post.user.is_verified && <span className="text-blue-400" title="Verified">✓</span>}
                          {post.user.is_creator && <span className="px-1.5 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">Creator</span>}
                          {post.user.is_donor && <span className="px-1.5 py-0.5 rounded text-xs bg-green-500/20 text-green-400">Donor</span>}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-white/50">
                          <span>{formatDate(post.created_at)}</span>
                          {post.campaign_id && (
                            <>
                              <span>•</span>
                              <Link href={`/story/${post.campaign_id}`} className="text-blue-400 hover:underline">
                                View Campaign
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                      {post.is_pinned && <span className="text-yellow-400" title="Pinned">📌</span>}
                      {/* Edit/Delete buttons for owner or admin */}
                      {user && (post.user_id === user.id || isAdmin) && (
                        <div className="flex items-center gap-1">
                          {/* Edit button - owner only */}
                          {post.user_id === user.id && (
                            <button
                              onClick={() => startEditPost(post)}
                              className="p-1.5 rounded-lg text-white/40 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                              title="Edit post"
                            >
                              ✏️
                            </button>
                          )}
                          {/* Delete button - owner or admin */}
                          <button
                            onClick={() => deletePost(post.id)}
                            disabled={deletingPost === post.id}
                            className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                            title="Delete post"
                          >
                            {deletingPost === post.id ? (
                              <span className="animate-spin">⏳</span>
                            ) : (
                              <span>🗑️</span>
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Post Content */}
                    <div className="mt-3 text-white whitespace-pre-wrap">{renderPostContent(post.content)}</div>

                    {/* Campaign Preview Cards */}
                    {(() => {
                      const mentions = post.content.match(/@\[([^\]]+)\]/g) || []
                      const uniqueIds = Array.from(new Set(mentions.map((m: string) => m.slice(2, -1))))
                      // Trigger fetch for any campaigns not yet loaded
                      const missingIds = uniqueIds.filter(id => !findCampaign(id) && !campaignPreviews[id])
                      if (missingIds.length > 0) {
                        fetchCampaignPreviews(missingIds)
                      }
                      return uniqueIds.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {uniqueIds.map((id: string) => {
                            // Use findCampaign to check both campaignPreviews and allCampaigns
                            const campaign = findCampaign(id)
                            if (!campaign) {
                              // Show loading placeholder while fetching
                              return (
                                <div
                                  key={id}
                                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 animate-pulse"
                                >
                                  <div className="w-16 h-16 rounded-lg bg-white/10"></div>
                                  <div className="flex-1">
                                    <div className="h-4 bg-white/10 rounded w-3/4 mb-2"></div>
                                    <div className="h-3 bg-white/10 rounded w-1/2"></div>
                                  </div>
                                </div>
                              )
                            }
                            return (
                              <div
                                key={id}
                                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10"
                              >
                                {campaign.image_uri ? (
                                  <img
                                    src={toHttpUrl(campaign.image_uri) || ''}
                                    alt={campaign.title}
                                    className="w-16 h-16 rounded-lg object-cover"
                                  />
                                ) : (
                                  <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-900/50 to-purple-900/50 flex items-center justify-center">
                                    <span className="text-2xl">🎖️</span>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-white truncate">{campaign.title}</p>
                                  <div className="flex gap-2 mt-1">
                                    <Link
                                      href={`/story/${campaign.id}`}
                                      className="text-sm text-blue-400 hover:text-blue-300"
                                    >
                                      View Campaign →
                                    </Link>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault()
                                        setFilterCampaign(campaign)
                                      }}
                                      className="text-sm text-purple-400 hover:text-purple-300"
                                    >
                                      💬 Discussions
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}

                    {/* Media */}
                    {renderMedia(post.media_urls, post.media_types)}
                  </div>

                  {/* Post Actions */}
                  <div className="p-4 flex items-center gap-6 border-t border-white/10 mt-4">
                    <button
                      onClick={() => toggleLike(post.id)}
                      className={`flex items-center gap-2 transition-colors ${
                        post.isLiked ? 'text-red-400' : 'text-white/60 hover:text-red-400'
                      }`}
                    >
                      <span>{post.isLiked ? '❤️' : '🤍'}</span>
                      <span>{post.likes_count}</span>
                    </button>
                    <button
                      onClick={() => toggleComments(post.id)}
                      className="flex items-center gap-2 text-white/60 hover:text-blue-400 transition-colors"
                    >
                      <span>💬</span>
                      <span>{post.comments_count}</span>
                    </button>
                    <div className="relative group">
                      <button className="flex items-center gap-2 text-white/60 hover:text-green-400 transition-colors">
                        <span>📤</span>
                        <span>Share</span>
                      </button>
                      {/* Share Dropdown */}
                      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block">
                        <div className="bg-gray-900 border border-white/10 rounded-xl shadow-xl p-2 flex gap-1">
                          <button onClick={() => shareToSocial('twitter', post)} className="p-2 hover:bg-white/10 rounded-lg" title="Share on X">𝕏</button>
                          <button onClick={() => shareToSocial('facebook', post)} className="p-2 hover:bg-white/10 rounded-lg" title="Share on Facebook">📘</button>
                          <button onClick={() => shareToSocial('reddit', post)} className="p-2 hover:bg-white/10 rounded-lg" title="Share on Reddit">🔴</button>
                          <button onClick={() => shareToSocial('linkedin', post)} className="p-2 hover:bg-white/10 rounded-lg" title="Share on LinkedIn">💼</button>
                          <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/community?post=${post.id}`)} className="p-2 hover:bg-white/10 rounded-lg" title="Copy Link">🔗</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Comments Section */}
                  {expandedComments.has(post.id) && (
                    <div className="border-t border-white/10 p-4 bg-white/[0.02]">
                      {/* Comment Input */}
                      {user && (
                        <div className="flex gap-3 mb-4">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold overflow-hidden">
                            {userProfile?.avatar_url ? (
                              <img src={userProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (user.email?.[0] || '?').toUpperCase()
                            )}
                          </div>
                          <div className="flex-1 flex gap-2">
                            <input
                              value={commentInputs[post.id] || ''}
                              onChange={e => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && submitComment(post.id)}
                              placeholder="Write a comment..."
                              className="flex-1 bg-white/10 border border-white/10 rounded-full px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
                            />
                            <button
                              onClick={() => submitComment(post.id)}
                              disabled={!commentInputs[post.id]?.trim()}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-full text-sm font-medium transition-colors"
                            >
                              Reply
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Comments List */}
                      <div className="space-y-3">
                        {(postComments[post.id] || []).map(comment => (
                          <div key={comment.id} className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                              {comment.user.avatar_url ? (
                                <img src={comment.user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                              ) : (
                                (comment.user.display_name?.[0] || '?').toUpperCase()
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="bg-white/5 rounded-2xl px-4 py-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-white text-sm">{comment.user.display_name}</span>
                                    {comment.user.is_verified && <span className="text-blue-400 text-xs">✓</span>}
                                  </div>
                                  {/* Edit/Delete buttons for comment owner or admin */}
                                  {user && (comment.user_id === user.id || isAdmin) && (
                                    <div className="flex items-center gap-1">
                                      {comment.user_id === user.id && (
                                        <button
                                          onClick={() => startEditComment(post.id, comment)}
                                          className="p-1 rounded text-white/30 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                                          title="Edit comment"
                                        >
                                          <span className="text-xs">✏️</span>
                                        </button>
                                      )}
                                      <button
                                        onClick={() => deleteComment(post.id, comment.id)}
                                        disabled={deletingComment === comment.id}
                                        className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                        title="Delete comment"
                                      >
                                        {deletingComment === comment.id ? (
                                          <span className="text-xs animate-spin">⏳</span>
                                        ) : (
                                          <span className="text-xs">🗑️</span>
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <p className="text-white/80 text-sm">{comment.content}</p>
                              </div>
                              <div className="flex items-center gap-4 mt-1 ml-4 text-xs text-white/50">
                                <span>{formatDate(comment.created_at)}</span>
                                <button className="hover:text-white">Like</button>
                                <button className="hover:text-white">Reply</button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {!postComments[post.id]?.length && (
                          <p className="text-white/40 text-center py-4">No comments yet. Be the first!</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Embed Modal */}
      {showEmbedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowEmbedModal(false)} />
          <div className="relative bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Add Media Link</h3>
            <p className="text-white/60 text-sm mb-4">
              Paste a URL to embed content from YouTube, X/Twitter, or any image/video link.
            </p>
            <input
              value={embedInput}
              onChange={e => setEmbedInput(e.target.value)}
              placeholder="https://youtube.com/watch?v=... or https://x.com/..."
              className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowEmbedModal(false)}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addEmbed}
                disabled={!embedInput.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Post Modal */}
      {editingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={cancelEditPost} />
          <div className="relative bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg">
            <h3 className="text-xl font-bold text-white mb-4">Edit Post</h3>
            <textarea
              value={editPostContent}
              onChange={e => setEditPostContent(e.target.value)}
              className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 mb-4 min-h-[150px] resize-none"
              placeholder="What's on your mind?"
            />
            <div className="flex gap-3">
              <button
                onClick={cancelEditPost}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEditPost}
                disabled={!editPostContent.trim() || savingPost}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {savingPost ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Comment Modal */}
      {editingComment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={cancelEditComment} />
          <div className="relative bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg">
            <h3 className="text-xl font-bold text-white mb-4">Edit Comment</h3>
            <textarea
              value={editCommentContent}
              onChange={e => setEditCommentContent(e.target.value)}
              className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 mb-4 min-h-[100px] resize-none"
              placeholder="Write your comment..."
            />
            <div className="flex gap-3">
              <button
                onClick={cancelEditComment}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEditComment}
                disabled={!editCommentContent.trim() || savingComment}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {savingComment ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
