'use client'

import { useEffect, useCallback } from 'react'
import { mapLegacyCategory } from '@/lib/categories'
import { logger } from '@/lib/logger'
import type { DraftData } from '../types'
import type { UseSubmissionFormReturn } from './useSubmissionForm'

const FORM_STORAGE_KEY = 'patriotpledge_submission_draft'

/**
 * Get stored draft from localStorage
 */
function getStoredDraft(): DraftData | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(FORM_STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

/**
 * Save draft to localStorage
 */
function saveDraft(data: DraftData): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

/**
 * Clear draft from localStorage
 */
export function clearDraft(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(FORM_STORAGE_KEY)
  } catch {}
}

interface UseDraftPersistenceOptions {
  form: UseSubmissionFormReturn
  isEditing: boolean
  isSubmitted: boolean
  onDraftLoaded?: () => void
}

/**
 * Hook for draft persistence - saves/loads form data to localStorage
 */
export function useDraftPersistence({
  form,
  isEditing,
  isSubmitted,
  onDraftLoaded
}: UseDraftPersistenceOptions) {
  // Load draft on mount (only if not editing)
  useEffect(() => {
    if (isEditing) return

    const draft = getStoredDraft()
    logger.debug('[Draft] Loading draft:', draft ? 'found' : 'none')

    if (draft) {
      if (draft.category) form.setCategory(mapLegacyCategory(draft.category))
      if (draft.title) form.setTitle(draft.title)
      if (draft.background) form.setBackground(draft.background)
      if (draft.need) form.setNeed(draft.need)
      if (draft.fundsUsage) form.setFundsUsage(draft.fundsUsage)
      if (draft.goal) form.setGoal(draft.goal)
      if (draft.firstName) form.setFirstName(draft.firstName)
      if (draft.lastName) form.setLastName(draft.lastName)
      if (draft.company) form.setCompany(draft.company)
      if (draft.phone) form.setPhone(draft.phone)
      if (draft.email) form.setEmail(draft.email)
      if (draft.wallet) form.setWallet(draft.wallet)
      if (draft.streetAddress) form.setStreetAddress(draft.streetAddress)
      if (draft.city) form.setCity(draft.city)
      if (draft.stateProvince) form.setStateProvince(draft.stateProvince)
      if (draft.zipCode) form.setZipCode(draft.zipCode)
      if (draft.country) form.setCountry(draft.country)
      if (draft.image) form.setImage(draft.image)
      if (draft.mediaMime) form.setMediaMime(draft.mediaMime)
      if (draft.diditSessionId) form.setDiditSessionId(draft.diditSessionId)
      if (draft.diditStatus) form.setDiditStatus(draft.diditStatus)
      if (draft.verificationComplete) form.setVerificationComplete(draft.verificationComplete)
    }

    onDraftLoaded?.()
  }, [isEditing]) // Only run once on mount

  // Auto-save draft when form fields change
  useEffect(() => {
    if (isSubmitted) return // Don't save after submission
    if (isEditing) return // Don't save while editing existing submission

    const draft: DraftData = {
      category: form.category,
      title: form.title,
      background: form.background,
      need: form.need,
      fundsUsage: form.fundsUsage,
      goal: form.goal,
      firstName: form.firstName,
      lastName: form.lastName,
      company: form.company,
      phone: form.phone,
      email: form.email,
      wallet: form.wallet,
      streetAddress: form.streetAddress,
      city: form.city,
      stateProvince: form.stateProvince,
      zipCode: form.zipCode,
      country: form.country,
      image: form.image || undefined,
      mediaMime: form.mediaMime || undefined,
      diditSessionId: form.diditSessionId || undefined,
      diditStatus: form.diditStatus,
      verificationComplete: form.verificationComplete,
    }

    saveDraft(draft)
  }, [
    form.category, form.title, form.background, form.need, form.fundsUsage, form.goal,
    form.firstName, form.lastName, form.company, form.phone, form.email, form.wallet,
    form.streetAddress, form.city, form.stateProvince, form.zipCode, form.country,
    form.image, form.mediaMime, form.diditSessionId, form.diditStatus, form.verificationComplete,
    isSubmitted, isEditing
  ])

  return { clearDraft }
}
