'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
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

interface CommunityProfile {
  display_name: string
  bio: string | null
  avatar_url: string | null
  cover_url: string | null
  website_url: string | null
  twitter_handle: string | null
}

export default function UserAccountPortal() {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  
  const [isOpen, setIsOpen] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [company, setCompany] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [communityProfile, setCommunityProfile] = useState<CommunityProfile | null>(null)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editTwitter, setEditTwitter] = useState('')
  const [editWebsite, setEditWebsite] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [mounted, setMounted] = useState(false)

  // Track mount state for portal
  useEffect(() => {
    setMounted(true)
  }, [])

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

      // Also fetch community profile
      const commRes = await fetch('/api/community/profile', {
        headers: { authorization: `Bearer ${token}` }
      })
      if (commRes.ok) {
        const commData = await commRes.json()
        setCommunityProfile(commData?.profile || null)
      }
    } catch (e) {
      console.error('Failed to fetch profile:', e)
    }
  }

  const handleAvatarUpload = async (file: File) => {
    if (!file) return
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    setUploadingAvatar(true)
    setProfileMessage('')
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'avatar')

      const res = await fetch('/api/community/upload', {
        method: 'POST',
        headers: { authorization: `Bearer ${session.access_token}` },
        body: formData
      })

      const data = await res.json()
      
      if (res.ok && data.url) {
        setCommunityProfile(prev => prev ? { ...prev, avatar_url: data.url } : null)
        setProfileMessage('✅ Avatar updated!')
      } else {
        const errMsg = data?.message || data?.error || 'Upload failed'
        setProfileMessage(`❌ ${errMsg}`)
        console.error('Upload failed:', data)
      }
    } catch (e: any) {
      setProfileMessage(e?.message || 'Upload failed')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const saveProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    setLoading(true)
    setProfileMessage('')

    try {
      const res = await fetch('/api/community/profile', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          authorization: `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({
          display_name: editDisplayName,
          bio: editBio,
          twitter_handle: editTwitter,
          website_url: editWebsite,
          avatar_url: communityProfile?.avatar_url
        })
      })

      if (res.ok) {
        const data = await res.json()
        setCommunityProfile(data?.profile || null)
        setProfileMessage('✅ Profile saved!')
        setTimeout(() => setShowProfileModal(false), 1000)
      } else {
        const err = await res.json()
        setProfileMessage(err?.message || 'Failed to save')
      }
    } catch (e: any) {
      setProfileMessage(e?.message || 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const openProfileEditor = () => {
    setEditDisplayName(communityProfile?.display_name || user?.email?.split('@')[0] || '')
    setEditBio(communityProfile?.bio || '')
    setEditTwitter(communityProfile?.twitter_handle || '')
    setEditWebsite(communityProfile?.website_url || '')
    setProfileMessage('')
    setShowProfileModal(true)
    setIsOpen(false)
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
        options: { 
          data: { 
            first_name: firstName,
            last_name: lastName,
            company: company || null,
            full_name: `${firstName} ${lastName}`.trim()
          } 
        }
      })
      if (error) {
        setMessage(error.message)
      } else {
        setMessage('✅ Check your email to confirm your account!')
        // Clear form
        setFirstName('')
        setLastName('')
        setCompany('')
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
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold overflow-hidden">
              {communityProfile?.avatar_url ? (
                <img src={communityProfile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                (user.email?.[0] || '?').toUpperCase()
              )}
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
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold overflow-hidden">
                  {communityProfile?.avatar_url ? (
                    <img src={communityProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (user.email?.[0] || '?').toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">
                    {communityProfile?.display_name || user.email?.split('@')[0]}
                  </div>
                  <div className="text-sm text-white/60 truncate">{user.email}</div>
                  {profile?.role && (
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mt-1 ${getRoleBadge(profile.role).bg} ${getRoleBadge(profile.role).text}`}>
                      {getRoleBadge(profile.role).label}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={openProfileEditor}
                className="w-full mt-3 px-3 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <span>✏️</span>
                <span>Edit Profile</span>
              </button>
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

      {/* Auth Modal - rendered via portal */}
      {mounted && showAuthModal && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-4">
            <div 
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowAuthModal(false)}
            />
            <div className="relative z-[100000] bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6">
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
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="First Name"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
                    />
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Company / Organization (optional - for tax receipts)"
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
                  />
                </>
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
                disabled={loading || !email || !password || (authMode === 'signup' && (!firstName || !lastName))}
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
        </div>,
        document.body
      )}

      {/* Profile Edit Modal - rendered via portal */}
      {mounted && showProfileModal && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-4">
            <div 
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowProfileModal(false)}
            />
            <div className="relative z-[100000] bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <button
              onClick={() => setShowProfileModal(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-xl font-bold text-white mb-6">Edit Profile</h2>

            {/* Avatar Upload */}
            <div className="flex flex-col items-center mb-6">
              <div 
                onClick={() => avatarInputRef.current?.click()}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold overflow-hidden cursor-pointer hover:opacity-80 transition-opacity relative group"
              >
                {communityProfile?.avatar_url ? (
                  <img src={communityProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  (user?.email?.[0] || '?').toUpperCase()
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white text-sm">📷 Change</span>
                </div>
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleAvatarUpload(file)
                }}
              />
              <p className="text-sm text-white/50 mt-2">
                {uploadingAvatar ? 'Uploading...' : 'Click to upload photo'}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">Display Name</label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={e => setEditDisplayName(e.target.value)}
                  placeholder="Your display name"
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">Bio</label>
                <textarea
                  value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">Twitter/X Handle</label>
                <div className="flex items-center">
                  <span className="px-3 py-3 bg-white/5 border border-r-0 border-white/10 rounded-l-lg text-white/50">@</span>
                  <input
                    type="text"
                    value={editTwitter}
                    onChange={e => setEditTwitter(e.target.value.replace('@', ''))}
                    placeholder="username"
                    className="flex-1 px-4 py-3 rounded-r-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">Website</label>
                <input
                  type="url"
                  value={editWebsite}
                  onChange={e => setEditWebsite(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              {profileMessage && (
                <div className={`p-3 rounded-lg text-sm text-center ${
                  profileMessage.startsWith('✅') 
                    ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}>
                  {profileMessage}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/15 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveProfile}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-lg font-medium transition-colors"
                >
                  {loading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
