'use client'

/**
 * useStoryForm Hook
 * 
 * Manages story form state and draft persistence
 * Following ISP - focused on form data management
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { mapLegacyCategory } from '@/lib/categories'
import { logger } from '@/lib/logger'
import type { 
  CategoryId 
} from '@/lib/categories'
import type {
  StoryContent,
  ContactInfo,
  AddressInfo,
  MediaState,
  PreviewState,
  SubmissionState,
  VerificationState,
  VerificationDocs,
  FormDraft,
  MessageType
} from '../types'

const FORM_STORAGE_KEY = 'patriotpledge_submission_draft'

const getStoredDraft = (): FormDraft | null => {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(FORM_STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

const saveDraft = (data: FormDraft) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

const clearDraft = () => {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(FORM_STORAGE_KEY)
  } catch {}
}

export function useStoryForm(editSubmissionId?: string) {
  // Story content
  const [category, setCategory] = useState<CategoryId>('veteran')
  const [title, setTitle] = useState('')
  const [background, setBackground] = useState('')
  const [need, setNeed] = useState('')
  const [fundsUsage, setFundsUsage] = useState('')
  const [goal, setGoal] = useState<number>(1000)

  // Contact info
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [wallet, setWallet] = useState('')

  // Address
  const [streetAddress, setStreetAddress] = useState('')
  const [city, setCity] = useState('')
  const [stateProvince, setStateProvince] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [country, setCountry] = useState('United States')

  // Media
  const [image, setImage] = useState<string | null>(null)
  const [mediaMime, setMediaMime] = useState<string | null>(null)
  const [imageLoading, setImageLoading] = useState(false)

  // Preview
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [previewBackend, setPreviewBackend] = useState<string | null>(null)
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null)

  // Submission
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Verification
  const [verificationDocs, setVerificationDocs] = useState<VerificationDocs>({ supporting: [] })
  const [verificationComplete, setVerificationComplete] = useState(false)
  const [diditSessionId, setDiditSessionId] = useState<string | null>(null)
  const [diditStatus, setDiditStatus] = useState<string>('not_started')

  // Edit state
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [editLoadError, setEditLoadError] = useState<string | null>(null)

  // Draft state
  const [draftLoaded, setDraftLoaded] = useState(false)

  // Messages
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<MessageType>('info')

  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isEmailVerified, setIsEmailVerified] = useState(false)
  const [authEmail, setAuthEmail] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setIsLoggedIn(true)
        setAuthEmail(session.user.email || null)
        setIsEmailVerified(!!session.user.email_confirmed_at)
        if (session.user.email && !email) {
          setEmail(session.user.email)
        }
      }
      setAuthChecked(true)
    }
    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setIsLoggedIn(true)
        setAuthEmail(session.user.email || null)
        setIsEmailVerified(!!session.user.email_confirmed_at)
      } else {
        setIsLoggedIn(false)
        setAuthEmail(null)
        setIsEmailVerified(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Load submission for editing
  useEffect(() => {
    if (!editSubmissionId || editingSubmissionId === editSubmissionId) return

    const loadSubmission = async () => {
      setLoadingEdit(true)
      setEditLoadError(null)

      try {
        const { data: session } = await supabase.auth.getSession()
        const token = session?.session?.access_token

        if (!token) {
          setEditLoadError('Please log in to edit your submission')
          setLoadingEdit(false)
          return
        }

        const res = await fetch(`/api/submissions/${editSubmissionId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })

        const data = await res.json()

        if (!res.ok) {
          setEditLoadError(data.message || data.error || 'Failed to load submission')
          setLoadingEdit(false)
          return
        }

        const sub = data.submission
        logger.debug('[useStoryForm] Loaded submission for editing:', sub.id)

        // Populate form fields
        if (sub.category) setCategory(mapLegacyCategory(sub.category))
        if (sub.title) setTitle(sub.title)
        if (sub.goal) setGoal(sub.goal)
        if (sub.creator_name) {
          const nameParts = sub.creator_name.split(' ')
          setFirstName(nameParts[0] || '')
          setLastName(nameParts.slice(1).join(' ') || '')
        }
        if (sub.company) setCompany(sub.company)
        if (sub.creator_phone) setPhone(sub.creator_phone)
        if (sub.creator_wallet) setWallet(sub.creator_wallet)
        if (sub.creator_email) setEmail(sub.creator_email)
        if (sub.image_uri) setImage(sub.image_uri)

        // Parse story sections
        if (sub.story) {
          const story = sub.story as string
          const aboutMatch = story.match(/About Me:\n([\s\S]*?)(?=\n\nWhat I Need:|$)/)
          const needMatch = story.match(/What I Need:\n([\s\S]*?)(?=\n\nHow Funds Will Be Used:|$)/)
          const fundsMatch = story.match(/How Funds Will Be Used:\n([\s\S]*)$/)

          if (aboutMatch) setBackground(aboutMatch[1].trim())
          if (needMatch) setNeed(needMatch[1].trim())
          if (fundsMatch) setFundsUsage(fundsMatch[1].trim())

          if (!aboutMatch && !needMatch && !fundsMatch) {
            setBackground(story)
          }
        }

        // Parse address
        if (sub.creator_address) {
          const addr = sub.creator_address
          if (addr.street) setStreetAddress(addr.street)
          if (addr.city) setCity(addr.city)
          if (addr.state) setStateProvince(addr.state)
          if (addr.zip) setZipCode(addr.zip)
          if (addr.country) setCountry(addr.country)
        }

        // KYC status
        if (sub.didit_session_id) setDiditSessionId(sub.didit_session_id)
        if (sub.didit_status === 'Approved') {
          setDiditStatus('completed')
          setVerificationComplete(true)
        }

        setEditingSubmissionId(editSubmissionId)
        setDraftLoaded(true)
      } catch (err: any) {
        console.error('[useStoryForm] Error loading submission:', err)
        setEditLoadError(err.message || 'Failed to load submission')
      } finally {
        setLoadingEdit(false)
      }
    }

    loadSubmission()
  }, [editSubmissionId, editingSubmissionId])

  // Load draft on mount
  useEffect(() => {
    if (draftLoaded || editSubmissionId) return

    const draft = getStoredDraft()
    logger.debug('[useStoryForm] Loading draft:', draft ? 'found' : 'none')

    if (draft) {
      if (draft.category) setCategory(mapLegacyCategory(draft.category))
      if (draft.title) setTitle(draft.title)
      if (draft.background) setBackground(draft.background)
      if (draft.need) setNeed(draft.need)
      if (draft.fundsUsage) setFundsUsage(draft.fundsUsage)
      if (draft.goal) setGoal(draft.goal)
      if (draft.firstName) setFirstName(draft.firstName)
      if (draft.lastName) setLastName(draft.lastName)
      if (draft.company) setCompany(draft.company)
      if (draft.phone) setPhone(draft.phone)
      if (draft.streetAddress) setStreetAddress(draft.streetAddress)
      if (draft.city) setCity(draft.city)
      if (draft.stateProvince) setStateProvince(draft.stateProvince)
      if (draft.zipCode) setZipCode(draft.zipCode)
      if (draft.country) setCountry(draft.country)
      if (draft.wallet) setWallet(draft.wallet)
      if (draft.email) setEmail(draft.email)
      if (draft.image) setImage(draft.image)
      if (draft.mediaMime) setMediaMime(draft.mediaMime)
      if (draft.diditSessionId) setDiditSessionId(draft.diditSessionId)
      if (draft.diditStatus) setDiditStatus(draft.diditStatus)
      if (draft.verificationComplete) setVerificationComplete(draft.verificationComplete)
    }
    setDraftLoaded(true)
  }, [draftLoaded, editSubmissionId])

  // Auto-save draft
  useEffect(() => {
    if (!draftLoaded || isSubmitted) return

    const draft: FormDraft = {
      category, title, background, need, fundsUsage, goal,
      firstName, lastName, company, phone, streetAddress, city, stateProvince, zipCode, country,
      wallet, email, image, mediaMime,
      diditSessionId, diditStatus, verificationComplete
    }
    saveDraft(draft)
  }, [
    category, title, background, need, fundsUsage, goal,
    firstName, lastName, company, phone, streetAddress, city, stateProvince, zipCode, country,
    wallet, email, image, mediaMime,
    diditSessionId, diditStatus, verificationComplete,
    draftLoaded, isSubmitted
  ])

  // Helper functions
  const getFullStory = useCallback(() => {
    const parts = []
    if (background) parts.push(`About Me:\n${background}`)
    if (need) parts.push(`What I Need:\n${need}`)
    if (fundsUsage) parts.push(`How Funds Will Be Used:\n${fundsUsage}`)
    return parts.join('\n\n')
  }, [background, need, fundsUsage])

  const showMessage = useCallback((msg: string, type: MessageType = 'info') => {
    setMessage(msg)
    setMessageType(type)
    if (type === 'success') setTimeout(() => setMessage(''), 3000)
  }, [])

  const handleClearDraft = useCallback(() => {
    clearDraft()
  }, [])

  const markSubmitted = useCallback((id: string | null) => {
    setIsSubmitted(true)
    setSubmittedId(id)
    clearDraft()
  }, [])

  return {
    // Story content
    storyContent: { category, title, background, need, fundsUsage, goal },
    setCategory, setTitle, setBackground, setNeed, setFundsUsage, setGoal,

    // Contact info
    contactInfo: { firstName, lastName, company, phone, email, wallet },
    setFirstName, setLastName, setCompany, setPhone, setEmail, setWallet,

    // Address
    addressInfo: { streetAddress, city, stateProvince, zipCode, country },
    setStreetAddress, setCity, setStateProvince, setZipCode, setCountry,

    // Media
    mediaState: { image, mediaMime, imageLoading },
    setImage, setMediaMime, setImageLoading,

    // Preview
    previewState: { previewUri, previewBackend, previewImageUri },
    setPreviewUri, setPreviewBackend, setPreviewImageUri,

    // Submission
    submissionState: { isSubmitted, submittedId, isSubmitting },
    setIsSubmitting, markSubmitted,

    // Verification
    verificationState: { verificationDocs, verificationComplete, diditSessionId, diditStatus },
    setVerificationDocs, setVerificationComplete, setDiditSessionId, setDiditStatus,

    // Edit state
    editState: { editingSubmissionId, loadingEdit, editLoadError },

    // Auth state
    authState: { isLoggedIn, isEmailVerified, authEmail, authChecked },

    // Messages
    message, messageType, showMessage,

    // Helpers
    getFullStory, handleClearDraft
  }
}
