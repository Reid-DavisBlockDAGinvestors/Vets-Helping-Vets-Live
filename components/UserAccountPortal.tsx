'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useWallet } from '@/hooks/useWallet'

interface UserProfile {
  id: string
  email: string
  role: string
  permissions?: {
    canManageCampaigns: boolean
    canApproveUpdates: boolean
    canManageAdmins: boolean
    canViewDashboard: boolean
  }
}

export default function UserAccountPortal() {
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const [isOpen, setIsOpen] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)

  const { 
    address, 
    isConnected, 
    balance,
    isOnBlockDAG,
    connect,
    disconnect,
    switchToBlockDAG
  } = useWallet()

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)
      if (session?.access_token) {
        fetchProfile(session.access_token)
      }
    }
    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user || null)
      if (session?.access_token) {
        fetchProfile(session.access_token)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (token: string) => {
    try {
      const res = await fetch('/api/admin/me', {
        headers: { authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
      }
    } catch (e) {
      console.error('Failed to fetch profile:', e)
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogin = async () => {
    setLoading(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMessage(error.message)
      } else {
        setShowAuthModal(false)
        setEmail('')
        setPassword('')
      }
    } catch (e: any) {
      setMessage(e?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async () => {
    setLoading(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: { data: { name } }
      })
      if (error) {
        setMessage(error.message)
      } else {
        setMessage('✅ Check your email to confirm your account!')
      }
    } catch (e: any) {
      setMessage(e?.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setIsOpen(false)
  }

  const formatBalance = (bal: string | null) => {
    if (!bal) return '0.00'
    const num = parseFloat(bal)
    if (num < 0.01) return '<0.01'
    return num.toFixed(2)
  }

  const getRoleBadge = (role: string) => {
    const badges: Record<string, { bg: string, text: string, label: string }> = {
      super_admin: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Super Admin' },
      admin: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Admin' },
      moderator: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Moderator' },
      viewer: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Viewer' },
      user: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Member' },
    }
    return badges[role] || badges.user
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {user ? (
          // Logged in state
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 transition-all"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
              {(user.email?.[0] || '?').toUpperCase()}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-medium text-white truncate max-w-[120px]">
                {profile?.email?.split('@')[0] || 'Account'}
              </div>
              {profile?.role && profile.role !== 'user' && (
                <div className={`text-xs ${getRoleBadge(profile.role).text}`}>
                  {getRoleBadge(profile.role).label}
                </div>
              )}
            </div>
            <svg className={`w-4 h-4 text-white/60 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        ) : (
          // Not logged in
          <button
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="hidden sm:inline">Sign In</span>
          </button>
        )}

        {/* Dropdown Menu */}
        {isOpen && user && (
          <div className="absolute right-0 mt-2 w-80 bg-gray-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
            {/* User Info */}
            <div className="p-4 border-b border-white/10 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                  {(user.email?.[0] || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">{user.email}</div>
                  {profile?.role && (
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getRoleBadge(profile.role).bg} ${getRoleBadge(profile.role).text}`}>
                      {getRoleBadge(profile.role).label}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Wallet Section */}
            <div className="p-4 border-b border-white/10">
              <div className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wide">Wallet</div>
              {isConnected && address ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-white">{address.slice(0, 6)}...{address.slice(-4)}</span>
                    <span className={`flex items-center gap-1 text-xs ${isOnBlockDAG ? 'text-green-400' : 'text-yellow-400'}`}>
                      <span className={`w-2 h-2 rounded-full ${isOnBlockDAG ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
                      {isOnBlockDAG ? 'BlockDAG' : 'Wrong Network'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-white">{formatBalance(balance)} BDAG</span>
                    <button
                      onClick={() => { disconnect(); setIsOpen(false); }}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Disconnect
                    </button>
                  </div>
                  {!isOnBlockDAG && (
                    <button
                      onClick={() => { switchToBlockDAG(); }}
                      className="w-full mt-1 px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-xs font-medium transition-colors"
                    >
                      Switch to BlockDAG
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => { connect(); }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Connect Wallet
                </button>
              )}
            </div>

            {/* Quick Links */}
            <div className="p-2">
              <a
                href="/dashboard"
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              >
                <span>📊</span>
                <span>My Dashboard</span>
              </a>
              {profile?.permissions?.canViewDashboard && (
                <a
                  href="/admin"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <span>⚙️</span>
                  <span>Admin Portal</span>
                </a>
              )}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <span>🚪</span>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowAuthModal(false)}
          />
          <div className="relative bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-6">
              <div className="text-4xl mb-3">{authMode === 'login' ? '👋' : '🎉'}</div>
              <h2 className="text-xl font-bold text-white">
                {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p className="text-white/60 text-sm mt-1">
                {authMode === 'login' 
                  ? 'Sign in to your PatriotPledge account' 
                  : 'Join the PatriotPledge community'}
              </p>
            </div>

            <div className="space-y-4">
              {authMode === 'signup' && (
                <input
                  type="text"
                  placeholder="Your Name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
                />
              )}
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (authMode === 'login' ? handleLogin() : handleSignup())}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
              />

              <button
                onClick={authMode === 'login' ? handleLogin : handleSignup}
                disabled={loading || !email || !password}
                className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium transition-colors disabled:cursor-not-allowed"
              >
                {loading ? 'Please wait...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}
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

              <div className="text-center">
                <button
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'signup' : 'login')
                    setMessage('')
                  }}
                  className="text-sm text-white/60 hover:text-white"
                >
                  {authMode === 'login' 
                    ? "Don't have an account? Sign up" 
                    : 'Already have an account? Sign in'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
