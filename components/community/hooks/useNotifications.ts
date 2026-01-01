'use client'

/**
 * useNotifications - Notification management hook
 * 
 * Single Responsibility: Fetch, manage, and subscribe to user notifications
 * 
 * Features:
 * - Fetch user notifications
 * - Mark notifications as read
 * - Real-time notification updates
 * - Unread count tracking
 * 
 * @module components/community/hooks/useNotifications
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface Notification {
  id: string
  user_id: string
  type: 'reaction' | 'comment' | 'reply' | 'mention' | 'follow' | 'milestone' | 'system'
  actor_id?: string
  post_id?: string
  comment_id?: string
  campaign_id?: string
  message?: string
  metadata?: Record<string, any>
  is_read: boolean
  created_at: string
  actor?: {
    display_name: string
    avatar_url: string | null
  }
}

interface UseNotificationsOptions {
  /** Auth token for API calls */
  token?: string | null
  /** Whether to enable real-time updates */
  realtime?: boolean
  /** Maximum notifications to fetch */
  limit?: number
}

interface UseNotificationsReturn {
  /** List of notifications */
  notifications: Notification[]
  /** Number of unread notifications */
  unreadCount: number
  /** Whether notifications are loading */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Fetch/refresh notifications */
  fetchNotifications: () => Promise<void>
  /** Mark a notification as read */
  markAsRead: (notificationId: string) => Promise<void>
  /** Mark all notifications as read */
  markAllAsRead: () => Promise<void>
  /** Clear all notifications */
  clearAll: () => Promise<void>
}

/**
 * Hook for managing user notifications
 */
export function useNotifications({
  token,
  realtime = true,
  limit = 50
}: UseNotificationsOptions = {}): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/community/notifications?limit=${limit}`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      })

      if (!res.ok) {
        throw new Error('Failed to fetch notifications')
      }

      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch (e: any) {
      logger.error('[useNotifications] Fetch error:', e)
      setError(e?.message || 'Failed to fetch notifications')
    } finally {
      setIsLoading(false)
    }
  }, [token, limit])

  // Mark a single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!token) return

    try {
      const res = await fetch('/api/community/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id: notificationId, is_read: true })
      })

      if (res.ok) {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (e) {
      logger.error('[useNotifications] Mark as read error:', e)
    }
  }, [token])

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!token) return

    try {
      const res = await fetch('/api/community/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ markAllRead: true })
      })

      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        setUnreadCount(0)
      }
    } catch (e) {
      logger.error('[useNotifications] Mark all as read error:', e)
    }
  }, [token])

  // Clear all notifications
  const clearAll = useCallback(async () => {
    if (!token) return

    try {
      const res = await fetch('/api/community/notifications', {
        method: 'DELETE',
        headers: {
          authorization: `Bearer ${token}`
        }
      })

      if (res.ok) {
        setNotifications([])
        setUnreadCount(0)
      }
    } catch (e) {
      logger.error('[useNotifications] Clear all error:', e)
    }
  }, [token])

  // Handle new notification from real-time subscription
  const handleNewNotification = useCallback((payload: any) => {
    logger.debug('[useNotifications] New notification received:', payload.new?.id)
    
    if (payload.new) {
      // Fetch the full notification with actor data
      fetchNotifications()
    }
  }, [fetchNotifications])

  // Setup real-time subscription
  useEffect(() => {
    if (!realtime || !token) return

    // Get user ID from token
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) return

      const channelName = `notifications-${user.id}`
      
      channelRef.current = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'community_notifications',
            filter: `user_id=eq.${user.id}`
          },
          handleNewNotification
        )
        .subscribe()
    }

    setupRealtime()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [realtime, token, handleNewNotification])

  // Fetch notifications on mount and when token changes
  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    clearAll
  }
}

export default useNotifications
