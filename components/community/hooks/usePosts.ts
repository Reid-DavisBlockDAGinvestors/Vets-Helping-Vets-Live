'use client'

import { useState, useCallback, useEffect } from 'react'
import { logger } from '@/lib/logger'
import type { Post, PostTab, CampaignPreview } from '../types'

interface UsePostsOptions {
  token?: string | null
  activeTab?: PostTab
  filterCampaign?: CampaignPreview | null
}

interface UsePostsReturn {
  posts: Post[]
  isLoading: boolean
  error: string | null
  fetchPosts: () => Promise<void>
  createPost: (content: string, mediaUrls?: string[], mediaTypes?: string[]) => Promise<{ success: boolean; error?: string }>
  updatePost: (postId: string, content: string) => Promise<{ success: boolean; error?: string }>
  deletePost: (postId: string) => Promise<{ success: boolean; error?: string }>
  likePost: (postId: string) => Promise<{ success: boolean; error?: string }>
  updatePostLocally: (postId: string, updates: Partial<Post>) => void
  removePostLocally: (postId: string) => void
}

export function usePosts({ token, activeTab = 'all', filterCampaign }: UsePostsOptions = {}): UsePostsReturn {
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPosts = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      let url = '/api/community/posts?'
      if (activeTab !== 'all') {
        url += `type=${activeTab}&`
      }
      if (filterCampaign?.id) {
        url += `campaignId=${filterCampaign.id}&`
      }

      const headers: Record<string, string> = {}
      if (token) {
        headers.authorization = `Bearer ${token}`
      }

      const res = await fetch(url, { headers })
      if (!res.ok) {
        throw new Error('Failed to load posts')
      }

      const data = await res.json()
      setPosts(data?.posts || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load posts')
      logger.error('[usePosts] Error fetching posts:', e)
    } finally {
      setIsLoading(false)
    }
  }, [token, activeTab, filterCampaign?.id])

  // Fetch posts on mount and when filters change
  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const createPost = useCallback(async (
    content: string,
    mediaUrls: string[] = [],
    mediaTypes: string[] = []
  ): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: 'Not authenticated' }
    if (!content.trim()) return { success: false, error: 'Content required' }

    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          content: content.trim(),
          media_urls: mediaUrls,
          media_types: mediaTypes,
          post_type: mediaUrls.length > 0 ? 'media' : 'discussion'
        })
      })

      if (!res.ok) {
        const data = await res.json()
        return { success: false, error: data?.error || 'Failed to create post' }
      }

      const data = await res.json()
      if (data?.post) {
        setPosts(prev => [data.post, ...prev])
      }
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to create post' }
    }
  }, [token])

  const updatePost = useCallback(async (
    postId: string,
    content: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: 'Not authenticated' }

    try {
      const res = await fetch('/api/community/posts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id: postId, content: content.trim() })
      })

      if (!res.ok) {
        const data = await res.json()
        return { success: false, error: data?.error || 'Failed to update post' }
      }

      setPosts(prev => prev.map(p => 
        p.id === postId ? { ...p, content: content.trim() } : p
      ))
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to update post' }
    }
  }, [token])

  const deletePost = useCallback(async (
    postId: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: 'Not authenticated' }

    try {
      const res = await fetch(`/api/community/posts?id=${postId}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` }
      })

      if (!res.ok) {
        const data = await res.json()
        return { success: false, error: data?.error || 'Failed to delete post' }
      }

      setPosts(prev => prev.filter(p => p.id !== postId))
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to delete post' }
    }
  }, [token])

  const likePost = useCallback(async (
    postId: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: 'Not authenticated' }

    try {
      const res = await fetch('/api/community/like', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ postId, reactionType: 'love' })
      })

      if (!res.ok) {
        const data = await res.json()
        return { success: false, error: data?.error || 'Failed to like post' }
      }

      const data = await res.json()
      setPosts(prev => prev.map(p => 
        p.id === postId 
          ? { ...p, isLiked: data.liked, likes_count: p.likes_count + (data.liked ? 1 : -1) }
          : p
      ))
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to like post' }
    }
  }, [token])

  const updatePostLocally = useCallback((postId: string, updates: Partial<Post>) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...updates } : p))
  }, [])

  const removePostLocally = useCallback((postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId))
  }, [])

  return {
    posts,
    isLoading,
    error,
    fetchPosts,
    createPost,
    updatePost,
    deletePost,
    likePost,
    updatePostLocally,
    removePostLocally
  }
}
