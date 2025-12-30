'use client'

/**
 * UserAccountPortalV2 - Modular Account Portal
 * 
 * Orchestrator component using modular account/ structure
 * Following ISP - delegates to focused hooks and components
 * 
 * Original: 756 lines (monolithic)
 * Refactored: ~180 lines (orchestrator pattern)
 * 
 * Uses modular components from @/components/account:
 * - useAccountAuth - Authentication state and actions
 * - useProfileEditor - Profile editing state
 * - AuthModal - Login/Signup/Forgot password modal
 * - WalletSection - Wallet display
 * - UserAvatar - Avatar component
 * - RoleBadge - Role display
 */

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useWallet } from '@/hooks/useWallet'
import { 
  useAccountAuth, 
  useProfileEditor,
  AuthModal, 
  WalletSection, 
  UserAvatar, 
  RoleBadge 
} from './account'

export default function UserAccountPortalV2() {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Use modular hooks
  const auth = useAccountAuth()
  const profile = useProfileEditor({
    user: auth.user,
    communityProfile: auth.communityProfile,
    onProfileUpdate: auth.setCommunityProfile
  })
  const wallet = useWallet()

  useEffect(() => {
    setMounted(true)
  }, [])

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

  const handleOpenProfile = () => {
    profile.openEditor()
    setIsOpen(false)
  }

  // Not logged in - show sign in button
  if (!auth.user) {
    return (
      <>
        <button
          onClick={() => auth.setShowAuthModal(true)}
          data-testid="sign-in-btn"
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          Sign In
        </button>

        {mounted && (
          <AuthModal
            isOpen={auth.showAuthModal}
            onClose={() => auth.setShowAuthModal(false)}
            mode={auth.authMode}
            onModeChange={auth.setAuthMode}
            formState={auth.formState}
            onFormChange={auth.updateFormState}
            onSubmit={auth.handleSubmit}
            loading={auth.loading}
            message={auth.message}
          />
        )}
      </>
    )
  }

  // Logged in - show account dropdown
  return (
    <>
      <div ref={dropdownRef} className="relative" data-testid="user-account-portal">
        <button
          onClick={() => setIsOpen(!isOpen)}
          data-testid="account-dropdown-btn"
          aria-label="Account menu"
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <UserAvatar 
            avatarUrl={auth.communityProfile?.avatar_url} 
            email={auth.communityProfile?.display_name || auth.user?.email} 
            size="sm"
          />
          <span className="text-white text-sm hidden sm:inline">
            {auth.communityProfile?.display_name || auth.user?.email?.split('@')[0]}
          </span>
          <svg className={`w-4 h-4 text-white/50 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div 
            className="absolute right-0 mt-2 w-72 rounded-xl bg-gray-900 border border-white/10 shadow-xl overflow-hidden z-50"
            data-testid="account-dropdown-menu"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <UserAvatar 
                  avatarUrl={auth.communityProfile?.avatar_url} 
                  email={auth.communityProfile?.display_name || auth.user?.email}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">
                    {auth.communityProfile?.display_name || auth.user?.email?.split('@')[0]}
                  </div>
                  <div className="text-xs text-white/50 truncate">{auth.user?.email}</div>
                </div>
                {auth.profile?.role && <RoleBadge role={auth.profile.role} />}
              </div>
            </div>

            {/* Menu Items */}
            <div className="p-2">
              <button
                onClick={handleOpenProfile}
                data-testid="edit-profile-btn"
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
              >
                <span>👤</span>
                <span>Edit Profile</span>
              </button>
              
              <a
                href="/dashboard"
                data-testid="my-campaigns-link"
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
              >
                <span>📊</span>
                <span>My Campaigns</span>
              </a>
              
              <a
                href="/community"
                data-testid="community-link"
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
              >
                <span>💬</span>
                <span>Community</span>
              </a>

              {auth.profile?.role && ['admin', 'super_admin', 'moderator'].includes(auth.profile.role) && (
                <a
                  href="/admin"
                  data-testid="admin-panel-link"
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                >
                  <span>⚙️</span>
                  <span>Admin Panel</span>
                </a>
              )}
            </div>

            {/* Wallet Section */}
            <WalletSection
              address={wallet.address}
              isConnected={wallet.isConnected}
              balance={wallet.balance}
              isOnBlockDAG={wallet.isOnBlockDAG}
              onDisconnect={wallet.disconnect}
              onSwitchNetwork={wallet.switchToBlockDAG}
            />

            {/* Logout */}
            <div className="p-2 border-t border-white/10">
              <button
                onClick={auth.handleLogout}
                data-testid="logout-btn"
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors"
              >
                <span>🚪</span>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Profile Editor Modal */}
      {mounted && profile.showModal && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => profile.setShowModal(false)} />
            <div className="relative z-[100000] bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6">
              <button onClick={() => profile.setShowModal(false)} className="absolute top-4 right-4 text-white/50 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <h2 className="text-xl font-bold text-white mb-6">Edit Profile</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={profile.editState.displayName}
                    onChange={e => profile.updateEditState({ displayName: e.target.value })}
                    data-testid="profile-displayname-input"
                    className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">First Name</label>
                    <input
                      type="text"
                      value={profile.editState.firstName}
                      onChange={e => profile.updateEditState({ firstName: e.target.value })}
                      data-testid="profile-firstname-input"
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={profile.editState.lastName}
                      onChange={e => profile.updateEditState({ lastName: e.target.value })}
                      data-testid="profile-lastname-input"
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Bio</label>
                  <textarea
                    value={profile.editState.bio}
                    onChange={e => profile.updateEditState({ bio: e.target.value })}
                    data-testid="profile-bio-input"
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                  />
                </div>

                {profile.message && (
                  <div className={`p-3 rounded-lg text-sm ${profile.message.includes('✅') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {profile.message}
                  </div>
                )}

                <button
                  onClick={profile.saveProfile}
                  disabled={profile.loading}
                  data-testid="save-profile-btn"
                  className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50"
                >
                  {profile.loading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Auth Modal (for re-login scenarios) */}
      {mounted && (
        <AuthModal
          isOpen={auth.showAuthModal}
          onClose={() => auth.setShowAuthModal(false)}
          mode={auth.authMode}
          onModeChange={auth.setAuthMode}
          formState={auth.formState}
          onFormChange={auth.updateFormState}
          onSubmit={auth.handleSubmit}
          loading={auth.loading}
          message={auth.message}
        />
      )}
    </>
  )
}
