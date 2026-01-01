'use client'

/**
 * NotificationCenter - Dropdown notification panel
 * 
 * Single Responsibility: Display and manage user notifications
 * 
 * Features:
 * - Bell icon with unread badge
 * - Dropdown list of recent notifications
 * - Mark as read on click
 * - Mark all as read button
 * - Clear all button
 * - Links to relevant content
 * 
 * @module components/notifications/NotificationCenter
 */

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useNotifications, type Notification } from '@/components/community/hooks/useNotifications'

interface NotificationCenterProps {
  /** Auth token for API calls */
  token?: string | null
}

/**
 * Get notification message based on type
 */
function getNotificationMessage(notification: Notification): string {
  const actorName = notification.actor?.display_name || 'Someone'
  
  switch (notification.type) {
    case 'reaction':
      const emoji = notification.metadata?.reaction_type === 'love' ? '❤️' : '👍'
      return `${actorName} reacted ${emoji} to your post`
    case 'comment':
      return `${actorName} commented on your post`
    case 'reply':
      return `${actorName} replied to your comment`
    case 'mention':
      return `${actorName} mentioned you in a post`
    case 'follow':
      return `${actorName} started following you`
    case 'milestone':
      return notification.message || 'Your campaign reached a milestone!'
    case 'system':
      return notification.message || 'System notification'
    default:
      return notification.message || 'New notification'
  }
}

/**
 * Get notification icon based on type
 */
function getNotificationIcon(type: Notification['type']): string {
  switch (type) {
    case 'reaction': return '❤️'
    case 'comment': return '💬'
    case 'reply': return '↩️'
    case 'mention': return '@'
    case 'follow': return '👤'
    case 'milestone': return '🎉'
    case 'system': return '🔔'
    default: return '📣'
  }
}

/**
 * Get notification link based on type
 */
function getNotificationLink(notification: Notification): string {
  if (notification.post_id) {
    return `/community?post=${notification.post_id}`
  }
  if (notification.campaign_id) {
    return `/story/${notification.campaign_id}`
  }
  return '/community'
}

/**
 * Format relative time
 */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

/**
 * Individual notification item component
 */
function NotificationItem({ 
  notification, 
  onMarkAsRead 
}: { 
  notification: Notification
  onMarkAsRead: (id: string) => void
}) {
  const handleClick = () => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id)
    }
  }

  return (
    <Link
      href={getNotificationLink(notification)}
      onClick={handleClick}
      className={`block px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${
        !notification.is_read ? 'bg-blue-500/5' : ''
      }`}
      data-testid={`notification-item-${notification.id}`}
    >
      <div className="flex items-start gap-3">
        {/* Actor avatar or icon */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
          {notification.actor?.avatar_url ? (
            <img 
              src={notification.actor.avatar_url} 
              alt="" 
              className="w-full h-full object-cover" 
            />
          ) : (
            <span className="text-lg">{getNotificationIcon(notification.type)}</span>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${!notification.is_read ? 'text-white font-medium' : 'text-white/70'}`}>
            {getNotificationMessage(notification)}
          </p>
          <p className="text-xs text-white/40 mt-0.5">
            {formatRelativeTime(notification.created_at)}
          </p>
        </div>
        
        {/* Unread indicator */}
        {!notification.is_read && (
          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
        )}
      </div>
    </Link>
  )
}

/**
 * NotificationCenter component
 */
export function NotificationCenter({ token }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    clearAll
  } = useNotifications({ token, realtime: true })

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Refresh notifications when opening dropdown
  const handleToggle = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      fetchNotifications()
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
        aria-label="Notifications"
        data-testid="notification-bell-btn"
      >
        <svg 
          className="w-6 h-6 text-white/70" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" 
          />
        </svg>
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span 
            className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center"
            data-testid="notification-badge"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div 
          className="absolute right-0 top-full mt-2 w-80 max-h-[480px] bg-gray-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
          data-testid="notification-dropdown"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-semibold text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  data-testid="mark-all-read-btn"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[360px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-white/20 border-t-white rounded-full" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-white/50 text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-white/10 flex items-center justify-between">
              <Link
                href="/community"
                className="text-xs text-white/50 hover:text-white transition-colors"
                onClick={() => setIsOpen(false)}
              >
                View all activity
              </Link>
              <button
                onClick={clearAll}
                className="text-xs text-red-400/70 hover:text-red-400 transition-colors"
                data-testid="clear-all-btn"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationCenter
