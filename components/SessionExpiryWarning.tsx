'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, clearAllAuthData } from '@/lib/supabase'

/**
 * ELITE SECURITY - Session Expiry Warning Component
 * 
 * Shows a warning modal when session is about to expire,
 * allowing users to extend their session or logout securely.
 */

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes
const WARNING_BEFORE_MS = 2 * 60 * 1000 // Show warning 2 minutes before expiry
const CHECK_INTERVAL_MS = 30 * 1000 // Check every 30 seconds

interface SessionExpiryWarningProps {
  onSessionExpired?: () => void
}

export function SessionExpiryWarning({ onSessionExpired }: SessionExpiryWarningProps) {
  const [showWarning, setShowWarning] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [lastActivity, setLastActivity] = useState(Date.now())

  // Update activity on user interaction
  const updateActivity = useCallback(() => {
    setLastActivity(Date.now())
    setShowWarning(false)
  }, [])

  // Extend session
  const extendSession = useCallback(async () => {
    try {
      await supabase.auth.refreshSession()
      updateActivity()
    } catch (err) {
      console.error('Failed to extend session:', err)
    }
  }, [updateActivity])

  // Secure logout
  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      clearAllAuthData()
      onSessionExpired?.()
      window.location.href = '/'
    } catch (err) {
      console.error('Logout error:', err)
      // Force clear and redirect anyway
      clearAllAuthData()
      window.location.href = '/'
    }
  }, [onSessionExpired])

  // Check session status
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return // No active session

      const timeSinceActivity = Date.now() - lastActivity
      const timeUntilExpiry = INACTIVITY_TIMEOUT_MS - timeSinceActivity

      if (timeUntilExpiry <= 0) {
        // Session expired
        await handleLogout()
      } else if (timeUntilExpiry <= WARNING_BEFORE_MS) {
        // Show warning
        setTimeRemaining(Math.ceil(timeUntilExpiry / 1000))
        setShowWarning(true)
      }
    }

    const interval = setInterval(checkSession, CHECK_INTERVAL_MS)
    
    // Update countdown when warning is shown
    const countdownInterval = showWarning 
      ? setInterval(() => {
          setTimeRemaining(prev => {
            if (prev <= 1) {
              handleLogout()
              return 0
            }
            return prev - 1
          })
        }, 1000)
      : null

    return () => {
      clearInterval(interval)
      if (countdownInterval) clearInterval(countdownInterval)
    }
  }, [lastActivity, showWarning, handleLogout])

  // Listen for user activity
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true })
    })

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity)
      })
    }
  }, [updateActivity])

  if (!showWarning) return null

  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      data-testid="session-expiry-warning"
    >
      <div className="bg-gray-900 border border-yellow-500/50 rounded-2xl p-8 max-w-md mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Session Expiring</h3>
            <p className="text-yellow-400 text-sm">Security timeout warning</p>
          </div>
        </div>
        
        <p className="text-white/80 mb-4">
          For your security, your session will expire due to inactivity.
        </p>
        
        <div className="bg-black/30 rounded-lg p-4 mb-6 text-center">
          <p className="text-white/60 text-sm mb-1">Time remaining</p>
          <p className="text-3xl font-mono font-bold text-yellow-400">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={extendSession}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            data-testid="extend-session-btn"
          >
            Stay Logged In
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors"
            data-testid="logout-btn"
          >
            Logout
          </button>
        </div>

        <p className="text-white/40 text-xs text-center mt-4">
          🔒 Financial-grade security: Sessions expire after 15 minutes of inactivity
        </p>
      </div>
    </div>
  )
}

export default SessionExpiryWarning
