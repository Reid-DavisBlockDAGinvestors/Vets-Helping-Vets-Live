'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { UserProfile, CommunityProfile, AuthFormState, AuthMode } from '../types'

/**
 * Hook for account authentication state and actions
 */
export function useAccountAuth() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [communityProfile, setCommunityProfile] = useState<CommunityProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  
  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  
  // Auth form state
  const [formState, setFormState] = useState<AuthFormState>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    company: '',
  })

  const updateFormState = useCallback((updates: Partial<AuthFormState>) => {
    setFormState(prev => ({ ...prev, ...updates }))
  }, [])

  const fetchProfile = useCallback(async (token: string) => {
    try {
      const res = await fetch('/api/admin/me', {
        headers: { authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
      }

      const commRes = await fetch('/api/community/profile', {
        headers: { authorization: `Bearer ${token}` }
      })
      if (commRes.ok) {
        const commData = await commRes.json()
        setCommunityProfile(commData?.profile || null)
      }
    } catch (e) {
      logger.error('Failed to fetch profile:', e)
    }
  }, [])

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
        setCommunityProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const handleLogin = useCallback(async () => {
    setLoading(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ 
        email: formState.email, 
        password: formState.password 
      })
      if (error) {
        setMessage(error.message)
      } else {
        setShowAuthModal(false)
        setFormState({ email: '', password: '', firstName: '', lastName: '', company: '' })
      }
    } catch (e: any) {
      setMessage(e?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }, [formState.email, formState.password])

  const handleSignup = useCallback(async () => {
    setLoading(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.signUp({
        email: formState.email,
        password: formState.password,
        options: {
          data: {
            first_name: formState.firstName,
            last_name: formState.lastName,
            company: formState.company || null,
            full_name: `${formState.firstName} ${formState.lastName}`.trim()
          }
        }
      })
      if (error) {
        setMessage(error.message)
      } else {
        setMessage('✅ Check your email to confirm your account!')
        setFormState(prev => ({ ...prev, firstName: '', lastName: '', company: '' }))
      }
    } catch (e: any) {
      setMessage(e?.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }, [formState])

  const handleForgotPassword = useCallback(async () => {
    if (!formState.email) {
      setMessage('Please enter your email address')
      return
    }
    setLoading(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formState.email, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      if (error) {
        setMessage(error.message)
      } else {
        setMessage('✅ Check your email for a password reset link!')
      }
    } catch (e: any) {
      setMessage(e?.message || 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }, [formState.email])

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setCommunityProfile(null)
  }, [])

  const handleSubmit = useCallback(() => {
    switch (authMode) {
      case 'login':
        return handleLogin()
      case 'signup':
        return handleSignup()
      case 'forgot':
        return handleForgotPassword()
    }
  }, [authMode, handleLogin, handleSignup, handleForgotPassword])

  return {
    user,
    profile,
    communityProfile,
    setCommunityProfile,
    loading,
    message,
    setMessage,
    showAuthModal,
    setShowAuthModal,
    authMode,
    setAuthMode,
    formState,
    updateFormState,
    handleLogin,
    handleSignup,
    handleForgotPassword,
    handleLogout,
    handleSubmit,
    fetchProfile,
  }
}
