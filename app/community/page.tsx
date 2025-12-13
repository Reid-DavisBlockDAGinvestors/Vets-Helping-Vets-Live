'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

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

interface Comment {
  id: string
  content: string
  created_at: string
  likes_count: number
  user: {
    display_name: string
    avatar_url: string | null
    is_verified: boolean
  }
}

export default function CommunityHub() {
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
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    } catch (e) {
      console.error('Failed to fetch user profile:', e)
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

      const res = await fetch(`/api/community/posts?${params}`, { headers })
      const data = await res.json()
      setPosts(data?.posts || [])
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
        setNewPostContent('')
        setSelectedMedia([])
        setMediaTypes([])
        loadPosts()
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-patriotic-navy to-gray-900">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/5 backdrop-blur-xl sticky top-0 z-10">
        <div className="container py-6">
          <h1 className="text-3xl font-bold text-white mb-2">🏛️ Community Hub</h1>
          <p className="text-white/60">Connect with creators, donors, and supporters</p>
        </div>
      </div>

      <div className="container py-8">
        <div className="max-w-3xl mx-auto">
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

          {/* Posts Feed */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-white/50">Loading posts...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 rounded-2xl bg-white/5 border border-white/10">
              <div className="text-4xl mb-4">🌟</div>
              <h3 className="text-xl font-semibold text-white mb-2">No posts yet</h3>
              <p className="text-white/60">Be the first to start a conversation!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map(post => (
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
                    </div>

                    {/* Post Content */}
                    <div className="mt-3 text-white whitespace-pre-wrap">{post.content}</div>
                    
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
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-sm font-bold">
                              {comment.user.avatar_url ? (
                                <img src={comment.user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                              ) : (
                                (comment.user.display_name?.[0] || '?').toUpperCase()
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="bg-white/5 rounded-2xl px-4 py-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-white text-sm">{comment.user.display_name}</span>
                                  {comment.user.is_verified && <span className="text-blue-400 text-xs">✓</span>}
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
    </div>
  )
}
