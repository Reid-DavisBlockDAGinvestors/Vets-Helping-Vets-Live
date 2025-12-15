'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null)

  useEffect(() => {
    // Check if we have a valid session from the reset link
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      // If user has a session from clicking the reset link, they can reset
      setIsValidSession(!!session)
    }
    checkSession()

    // Listen for auth state changes (when user clicks the email link)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleResetPassword = async () => {
    if (password !== confirmPassword) {
      setMessage('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setMessage(error.message)
      } else {
        setIsSuccess(true)
        setMessage('✅ Password updated successfully!')
        // Redirect to home after 3 seconds
        setTimeout(() => router.push('/'), 3000)
      }
    } catch (e: any) {
      setMessage(e?.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  // Still checking session
  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  // No valid session - show error
  if (!isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-black p-4">
        <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-white mb-2">Invalid or Expired Link</h1>
          <p className="text-white/60 mb-6">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-black p-4">
      <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🔐</div>
          <h1 className="text-xl font-bold text-white">Set New Password</h1>
          <p className="text-white/60 text-sm mt-1">
            Enter your new password below
          </p>
        </div>

        {isSuccess ? (
          <div className="text-center">
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 mb-4">
              {message}
            </div>
            <p className="text-white/60 text-sm">
              Redirecting to homepage...
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-white/70 text-sm mb-2">New Password</label>
              <input
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-2">Confirm Password</label>
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleResetPassword()}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            {message && !isSuccess && (
              <div className="p-3 rounded-lg text-sm text-center bg-red-500/10 border border-red-500/30 text-red-400">
                {message}
              </div>
            )}

            <button
              onClick={handleResetPassword}
              disabled={loading || !password || !confirmPassword}
              className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium transition-colors disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>

            <div className="text-center">
              <Link href="/" className="text-sm text-white/60 hover:text-white">
                ← Back to homepage
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
