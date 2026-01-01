'use client'

/**
 * useRealtimePosts - Real-time post updates via Supabase Realtime
 * 
 * Single Responsibility: Subscribe to and handle real-time post changes
 * 
 * Features:
 * - New posts appear without refresh
 * - Post updates (likes, comments) reflected instantly
 * - Post deletions removed from feed
 * - Automatic reconnection on disconnect
 * 
 * @module components/community/hooks/useRealtimePosts
 */

import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { Post } from '../types'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

interface UseRealtimePostsOptions {
  /** Whether real-time updates are enabled */
  enabled?: boolean
  /** Filter posts by campaign ID */
  campaignId?: string | null
  /** Callback when a new post is received */
  onNewPost?: (post: Post) => void
  /** Callback when a post is updated */
  onPostUpdate?: (post: Post) => void
  /** Callback when a post is deleted */
  onPostDelete?: (postId: string) => void
}

interface UseRealtimePostsReturn {
  /** Whether the real-time connection is active */
  isConnected: boolean
  /** Manually reconnect to real-time updates */
  reconnect: () => void
  /** Disconnect from real-time updates */
  disconnect: () => void
}

/**
 * Hook for real-time post updates via Supabase Realtime
 */
export function useRealtimePosts({
  enabled = true,
  campaignId = null,
  onNewPost,
  onPostUpdate,
  onPostDelete
}: UseRealtimePostsOptions = {}): UseRealtimePostsReturn {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const isConnectedRef = useRef(false)

  // Handle new post insertion
  const handleInsert = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
    logger.debug('[useRealtimePosts] New post received:', payload.new?.id)
    
    if (payload.new) {
      // Filter by campaign if specified
      if (campaignId && payload.new.campaign_id !== campaignId) {
        return
      }
      
      // Transform to Post type (need to fetch user data)
      fetchPostWithUser(payload.new.id).then(post => {
        if (post && onNewPost) {
          onNewPost(post)
        }
      })
    }
  }, [campaignId, onNewPost])

  // Handle post update
  const handleUpdate = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
    logger.debug('[useRealtimePosts] Post updated:', payload.new?.id)
    
    if (payload.new && onPostUpdate) {
      // Filter by campaign if specified
      if (campaignId && payload.new.campaign_id !== campaignId) {
        return
      }
      
      fetchPostWithUser(payload.new.id).then(post => {
        if (post) {
          onPostUpdate(post)
        }
      })
    }
  }, [campaignId, onPostUpdate])

  // Handle post deletion
  const handleDelete = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
    const oldData = payload.old as { id?: string } | null
    logger.debug('[useRealtimePosts] Post deleted:', oldData?.id)
    
    if (oldData?.id && onPostDelete) {
      onPostDelete(oldData.id)
    }
  }, [onPostDelete])

  // Fetch post with user data
  const fetchPostWithUser = async (postId: string): Promise<Post | null> => {
    try {
      const { data, error } = await supabase
        .from('community_posts')
        .select(`
          *,
          user:community_profiles!community_posts_user_id_fkey (
            display_name,
            avatar_url,
            is_verified,
            is_creator,
            is_donor
          )
        `)
        .eq('id', postId)
        .single()

      if (error || !data) return null

      return {
        id: data.id,
        user_id: data.user_id,
        campaign_id: data.campaign_id,
        content: data.content,
        media_urls: data.media_urls || [],
        media_types: data.media_types || [],
        post_type: data.post_type || 'discussion',
        likes_count: data.likes_count || 0,
        comments_count: data.comments_count || 0,
        shares_count: data.shares_count || 0,
        is_pinned: data.is_pinned || false,
        is_featured: data.is_featured || false,
        created_at: data.created_at,
        user: data.user || {
          display_name: 'Unknown',
          avatar_url: null,
          is_verified: false,
          is_creator: false,
          is_donor: false
        },
        isLiked: false // Will be updated by parent component
      }
    } catch (e) {
      logger.error('[useRealtimePosts] Failed to fetch post:', e)
      return null
    }
  }

  // Connect to real-time channel
  const connect = useCallback(() => {
    if (channelRef.current || !enabled) return

    const channelName = campaignId 
      ? `community-posts-${campaignId}` 
      : 'community-posts-all'

    logger.debug('[useRealtimePosts] Connecting to channel:', channelName)

    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'community_posts',
          ...(campaignId ? { filter: `campaign_id=eq.${campaignId}` } : {})
        },
        handleInsert
      )
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'community_posts',
          ...(campaignId ? { filter: `campaign_id=eq.${campaignId}` } : {})
        },
        handleUpdate
      )
      .on(
        'postgres_changes',
        { 
          event: 'DELETE', 
          schema: 'public', 
          table: 'community_posts'
        },
        handleDelete
      )
      .subscribe((status) => {
        logger.debug('[useRealtimePosts] Subscription status:', status)
        isConnectedRef.current = status === 'SUBSCRIBED'
      })
  }, [enabled, campaignId, handleInsert, handleUpdate, handleDelete])

  // Disconnect from real-time channel
  const disconnect = useCallback(() => {
    if (channelRef.current) {
      logger.debug('[useRealtimePosts] Disconnecting from channel')
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
      isConnectedRef.current = false
    }
  }, [])

  // Reconnect to real-time channel
  const reconnect = useCallback(() => {
    disconnect()
    connect()
  }, [disconnect, connect])

  // Setup and cleanup
  useEffect(() => {
    if (enabled) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [enabled, connect, disconnect])

  return {
    isConnected: isConnectedRef.current,
    reconnect,
    disconnect
  }
}

export default useRealtimePosts
