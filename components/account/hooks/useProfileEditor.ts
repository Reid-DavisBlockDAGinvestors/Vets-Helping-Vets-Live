'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { CommunityProfile, ProfileEditState } from '../types'

interface UseProfileEditorOptions {
  user: any
  communityProfile: CommunityProfile | null
  onProfileUpdate: (profile: CommunityProfile) => void
}

/**
 * Hook for profile editing functionality
 */
export function useProfileEditor({
  user,
  communityProfile,
  onProfileUpdate,
}: UseProfileEditorOptions) {
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [message, setMessage] = useState('')
  
  const [editState, setEditState] = useState<ProfileEditState>({
    displayName: '',
    firstName: '',
    lastName: '',
    bio: '',
    twitter: '',
    website: '',
  })

  const updateEditState = useCallback((updates: Partial<ProfileEditState>) => {
    setEditState(prev => ({ ...prev, ...updates }))
  }, [])

  const openEditor = useCallback(() => {
    setEditState({
      displayName: communityProfile?.display_name || user?.email?.split('@')[0] || '',
      firstName: communityProfile?.first_name || '',
      lastName: communityProfile?.last_name || '',
      bio: communityProfile?.bio || '',
      twitter: communityProfile?.twitter_handle || '',
      website: communityProfile?.website_url || '',
    })
    setMessage('')
    setShowModal(true)
  }, [communityProfile, user])

  const handleAvatarUpload = useCallback(async (file: File) => {
    if (!file) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    setUploadingAvatar(true)
    setMessage('')

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
        if (communityProfile) {
          onProfileUpdate({ ...communityProfile, avatar_url: data.url })
        }
        setMessage('✅ Avatar updated!')
      } else {
        setMessage(`❌ ${data?.message || data?.error || 'Upload failed'}`)
      }
    } catch (e: any) {
      setMessage(e?.message || 'Upload failed')
    } finally {
      setUploadingAvatar(false)
    }
  }, [communityProfile, onProfileUpdate])

  const saveProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/community/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          display_name: editState.displayName,
          first_name: editState.firstName,
          last_name: editState.lastName,
          bio: editState.bio,
          twitter_handle: editState.twitter,
          website_url: editState.website,
          avatar_url: communityProfile?.avatar_url
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (data?.profile) {
          onProfileUpdate(data.profile)
        }
        setMessage('✅ Profile saved!')
        setTimeout(() => setShowModal(false), 1000)
      } else {
        const err = await res.json()
        setMessage(err?.message || 'Failed to save')
      }
    } catch (e: any) {
      setMessage(e?.message || 'Failed to save')
    } finally {
      setLoading(false)
    }
  }, [editState, communityProfile, onProfileUpdate])

  const resetPassword = useCallback(async () => {
    if (!user?.email) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      setMessage('❌ Not authenticated')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { authorization: `Bearer ${session.access_token}` }
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.message || 'Failed to send reset link')
      }

      setMessage('✅ Password reset link sent to your email!')
    } catch (e: any) {
      setMessage(`❌ ${e?.message || 'Failed to send reset link'}`)
    } finally {
      setLoading(false)
    }
  }, [user])

  return {
    showModal,
    setShowModal,
    loading,
    uploadingAvatar,
    message,
    editState,
    updateEditState,
    openEditor,
    handleAvatarUpload,
    saveProfile,
    resetPassword,
  }
}
