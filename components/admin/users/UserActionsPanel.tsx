'use client'

import { useState } from 'react'
import type { UserData } from './types'

interface UserActionsPanelProps {
  user: UserData
  onActionComplete?: () => void
}

export function UserActionsPanel({ user, onActionComplete }: UserActionsPanelProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [authDetails, setAuthDetails] = useState<any>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  const fetchAuthDetails = async () => {
    if (authDetails || !user.email) return
    setLoadingDetails(true)
    try {
      const res = await fetch(`/api/admin/user-audit?email=${encodeURIComponent(user.email)}`)
      const data = await res.json()
      if (data.found) {
        setAuthDetails(data)
      }
    } catch (e) {
      console.error('Failed to fetch auth details:', e)
    } finally {
      setLoadingDetails(false)
    }
  }

  useState(() => {
    fetchAuthDetails()
  })

  const performAction = async (action: string, extraData?: any) => {
    if (!user.email) {
      setMessage({ type: 'error', text: 'User email not available' })
      return
    }
    
    setLoading(action)
    setMessage(null)
    
    try {
      const res = await fetch('/api/admin/user-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, action, ...extraData })
      })
      
      const data = await res.json()
      
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: data.message || 'Action completed successfully' })
        fetchAuthDetails()
        onActionComplete?.()
      } else {
        setMessage({ type: 'error', text: data.error || 'Action failed' })
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Network error' })
    } finally {
      setLoading(null)
    }
  }

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' })
      return
    }
    await performAction('set_password', { password: newPassword })
    setShowPasswordDialog(false)
    setNewPassword('')
  }

  const emailConfirmed = authDetails?.user?.email_confirmed_at
  const recoverySent = authDetails?.user?.recovery_sent_at
  const lastSignIn = authDetails?.user?.last_sign_in_at
  const createdAt = authDetails?.user?.created_at
  const isBanned = authDetails?.user?.is_banned
  const mfaFactors = authDetails?.user?.factors || []
  const providers = authDetails?.user?.app_metadata?.providers || []

  return (
    <div className="space-y-6" data-testid="user-actions-panel">
      {/* Status Message */}
      {message && (
        <div className={`rounded-lg p-4 ${
          message.type === 'success' 
            ? 'bg-green-500/10 border border-green-500/30 text-green-400' 
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {loadingDetails ? (
        <div className="text-center py-8 text-white/50">Loading account details...</div>
      ) : (
        <>
          {/* Account Status Overview */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              📊 Account Status
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-white/50">Email Status:</span>
                <span className={`ml-2 ${emailConfirmed ? 'text-green-400' : 'text-yellow-400'}`}>
                  {emailConfirmed ? '✅ Confirmed' : '⏳ Pending'}
                </span>
              </div>
              <div>
                <span className="text-white/50">Account Status:</span>
                <span className={`ml-2 ${isBanned ? 'text-red-400' : 'text-green-400'}`}>
                  {isBanned ? '🚫 Banned' : '✅ Active'}
                </span>
              </div>
              <div>
                <span className="text-white/50">Last Sign In:</span>
                <span className="ml-2 text-white">
                  {lastSignIn ? new Date(lastSignIn).toLocaleDateString() : 'Never'}
                </span>
              </div>
              <div>
                <span className="text-white/50">Created:</span>
                <span className="ml-2 text-white">
                  {createdAt ? new Date(createdAt).toLocaleDateString() : 'Unknown'}
                </span>
              </div>
              <div>
                <span className="text-white/50">Auth Providers:</span>
                <span className="ml-2 text-white">
                  {providers.length > 0 ? providers.join(', ') : 'email'}
                </span>
              </div>
              <div>
                <span className="text-white/50">MFA:</span>
                <span className={`ml-2 ${mfaFactors.length > 0 ? 'text-green-400' : 'text-white/50'}`}>
                  {mfaFactors.length > 0 ? '✅ Enabled' : '❌ Not enabled'}
                </span>
              </div>
            </div>
          </div>

          {/* Password & Access */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              🔐 Password & Access
            </h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowPasswordDialog(true)}
                disabled={loading !== null}
                data-testid="reset-password-btn"
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading === 'set_password' ? 'Setting...' : '🔑 Reset Password'}
              </button>
              <button
                onClick={() => performAction('send_recovery')}
                disabled={loading !== null}
                data-testid="send-recovery-btn"
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading === 'send_recovery' ? 'Sending...' : '📧 Send Recovery Email'}
              </button>
            </div>
            {recoverySent && (
              <p className="text-xs text-white/40 mt-3">
                Last recovery email sent: {new Date(recoverySent).toLocaleString()}
              </p>
            )}
          </div>

          {/* Email Management */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              📧 Email Management
            </h3>
            <div className="flex flex-wrap gap-3">
              {!emailConfirmed && (
                <button
                  onClick={() => performAction('confirm_email')}
                  disabled={loading !== null}
                  data-testid="confirm-email-btn"
                  className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loading === 'confirm_email' ? 'Confirming...' : '✅ Confirm Email'}
                </button>
              )}
              {emailConfirmed && (
                <div className="px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                  ✅ Email confirmed on {new Date(emailConfirmed).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {/* Security */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              🛡️ Security
            </h3>
            <div className="flex flex-wrap gap-3">
              {mfaFactors.length > 0 && (
                <button
                  onClick={() => performAction('reset_mfa')}
                  disabled={loading !== null}
                  data-testid="reset-mfa-btn"
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loading === 'reset_mfa' ? 'Resetting...' : '🔓 Reset MFA'}
                </button>
              )}
              {mfaFactors.length === 0 && (
                <div className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-sm">
                  No MFA factors to reset
                </div>
              )}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-5">
            <h3 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
              ⚠️ Danger Zone
            </h3>
            <p className="text-sm text-white/50 mb-4">
              These actions are irreversible. Use with caution.
            </p>
            <div className="flex flex-wrap gap-3">
              {!isBanned ? (
                <button
                  onClick={() => performAction('ban_user')}
                  disabled={loading !== null}
                  data-testid="ban-user-btn"
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loading === 'ban_user' ? 'Banning...' : '🚫 Ban User'}
                </button>
              ) : (
                <button
                  onClick={() => performAction('unban_user')}
                  disabled={loading !== null}
                  data-testid="unban-user-btn"
                  className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loading === 'unban_user' ? 'Unbanning...' : '✅ Unban User'}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Password Reset Dialog */}
      {showPasswordDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-white mb-4">Reset Password</h3>
            <p className="text-sm text-white/50 mb-4">
              Set a new password for {user.email}
            </p>
            <input
              type="text"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              data-testid="new-password-input"
              className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPasswordDialog(false)
                  setNewPassword('')
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={loading !== null || !newPassword}
                data-testid="confirm-password-btn"
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading === 'set_password' ? 'Setting...' : 'Set Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserActionsPanel
