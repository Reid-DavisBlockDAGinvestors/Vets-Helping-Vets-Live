'use client'

import { createPortal } from 'react-dom'
import type { AuthModalProps } from './types'

/**
 * Authentication modal component - Login, Signup, Forgot Password
 */
export function AuthModal({
  isOpen,
  onClose,
  mode,
  onModeChange,
  formState,
  onFormChange,
  onSubmit,
  loading,
  message,
}: AuthModalProps) {
  if (!isOpen) return null

  const titles = {
    login: { emoji: '👋', title: 'Welcome Back', subtitle: 'Sign in to your PatriotPledge account' },
    signup: { emoji: '🎉', title: 'Create Account', subtitle: 'Join the PatriotPledge community' },
    forgot: { emoji: '🔐', title: 'Reset Password', subtitle: 'Enter your email to receive a reset link' },
  }

  const current = titles[mode]

  return createPortal(
    <div className="fixed inset-0 z-[99999] overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className="relative z-[100000] bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/50 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="text-center mb-6">
            <div className="text-4xl mb-3">{current.emoji}</div>
            <h2 className="text-xl font-bold text-white">{current.title}</h2>
            <p className="text-white/60 text-sm mt-1">{current.subtitle}</p>
          </div>

          <div className="space-y-4">
            {mode === 'signup' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="First Name"
                    value={formState.firstName}
                    onChange={e => onFormChange({ firstName: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={formState.lastName}
                    onChange={e => onFormChange({ lastName: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Company / Organization (optional - for tax receipts)"
                  value={formState.company}
                  onChange={e => onFormChange({ company: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
                />
              </>
            )}

            <input
              type="email"
              placeholder="Email"
              value={formState.email}
              onChange={e => onFormChange({ email: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
            />

            {mode !== 'forgot' && (
              <input
                type="password"
                placeholder="Password"
                value={formState.password}
                onChange={e => onFormChange({ password: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && onSubmit()}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
              />
            )}

            {mode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => onModeChange('forgot')}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              onClick={onSubmit}
              disabled={loading || !formState.email || (mode !== 'forgot' && !formState.password) || (mode === 'signup' && (!formState.firstName || !formState.lastName))}
              className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium transition-colors disabled:cursor-not-allowed"
            >
              {loading ? 'Please wait...' : (mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link')}
            </button>

            {message && (
              <div className={`p-3 rounded-lg text-sm text-center ${
                message.startsWith('✅')
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}>
                {message}
              </div>
            )}

            <div className="text-center space-y-2">
              {mode === 'forgot' ? (
                <button
                  onClick={() => onModeChange('login')}
                  className="text-sm text-white/60 hover:text-white"
                >
                  ← Back to sign in
                </button>
              ) : (
                <button
                  onClick={() => onModeChange(mode === 'login' ? 'signup' : 'login')}
                  className="text-sm text-white/60 hover:text-white"
                >
                  {mode === 'login'
                    ? "Don't have an account? Sign up"
                    : 'Already have an account? Sign in'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default AuthModal
