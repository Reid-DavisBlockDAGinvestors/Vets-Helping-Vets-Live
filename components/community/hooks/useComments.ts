'use client'

import { useState, useCallback } from 'react'
import { logger } from '@/lib/logger'
import type { Comment } from '../types'

interface UseCommentsReturn {
  comments: Record<string, Comment[]>
  loadingPostId: string | null
  fetchComments: (postId: string) => Promise<void>
  addComment: (postId: string, content: string) => Promise<{ success: boolean; error?: string }>
  updateComment: (postId: string, commentId: string, content: string) => Promise<{ success: boolean; error?: string }>
  deleteComment: (postId: string, commentId: string) => Promise<{ success: boolean; error?: string }>
}

export function useComments(token?: string | null): UseCommentsReturn {
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [loadingPostId, setLoadingPostId] = useState<string | null>(null)

  const fetchComments = useCallback(async (postId: string) => {
    setLoadingPostId(postId)
    try {
      const headers: Record<string, string> = {}
      if (token) {
        headers.authorization = `Bearer ${token}`
      }

      const res = await fetch(`/api/community/comments?postId=${postId}`, { headers })
      if (res.ok) {
        const data = await res.json()
        setComments(prev => ({ ...prev, [postId]: data?.comments || [] }))
      }
    } catch (e) {
      logger.error('Failed to fetch comments:', e)
    } finally {
      setLoadingPostId(null)
    }
  }, [token])

  const addComment = useCallback(async (
    postId: string,
    content: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: 'Not authenticated' }
    if (!content.trim()) return { success: false, error: 'Content required' }

    try {
      const res = await fetch('/api/community/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ postId, content: content.trim() })
      })

      if (!res.ok) {
        const data = await res.json()
        return { success: false, error: data?.error || 'Failed to add comment' }
      }

      const data = await res.json()
      if (data?.comment) {
        setComments(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), data.comment]
        }))
      }
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to add comment' }
    }
  }, [token])

  const updateComment = useCallback(async (
    postId: string,
    commentId: string,
    content: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: 'Not authenticated' }

    try {
      const res = await fetch('/api/community/comments', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id: commentId, content: content.trim() })
      })

      if (!res.ok) {
        const data = await res.json()
        return { success: false, error: data?.error || 'Failed to update comment' }
      }

      setComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).map(c =>
          c.id === commentId ? { ...c, content: content.trim() } : c
        )
      }))
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to update comment' }
    }
  }, [token])

  const deleteComment = useCallback(async (
    postId: string,
    commentId: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: 'Not authenticated' }

    try {
      const res = await fetch(`/api/community/comments?id=${commentId}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` }
      })

      if (!res.ok) {
        const data = await res.json()
        return { success: false, error: data?.error || 'Failed to delete comment' }
      }

      setComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).filter(c => c.id !== commentId)
      }))
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to delete comment' }
    }
  }, [token])

  return {
    comments,
    loadingPostId,
    fetchComments,
    addComment,
    updateComment,
    deleteComment
  }
}
