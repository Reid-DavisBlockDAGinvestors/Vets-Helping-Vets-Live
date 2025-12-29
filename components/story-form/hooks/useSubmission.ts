'use client'

/**
 * useSubmission Hook
 * 
 * Handles form submission and preview generation
 * Following ISP - focused on submission logic
 */

import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { CategoryId } from '@/lib/categories'
import type { VerificationDocs, MessageType } from '../types'

interface SubmissionData {
  title: string
  story: string
  category: CategoryId
  goal: number
  wallet: string
  email: string
  firstName: string
  lastName: string
  company: string
  phone: string
  address: {
    street: string
    city: string
    state: string
    zip: string
    country: string
  } | null
  imageUri: string
  metadataUri: string
  verificationDocs: VerificationDocs
  diditSessionId: string | null
  diditStatus: string
}

interface PreviewResult {
  uri: string | null
  imageUri: string | null
  backend: string | null
  error?: string
}

export function useSubmission(
  showMessage: (msg: string, type: MessageType) => void
) {
  const generatePreview = useCallback(async (
    title: string,
    story: string,
    image: string,
    category: CategoryId
  ): Promise<PreviewResult> => {
    if (!title?.trim()) {
      return { uri: null, imageUri: null, backend: null, error: 'Title is required' }
    }
    if (!image) {
      return { uri: null, imageUri: null, backend: null, error: 'Please upload an image first' }
    }

    try {
      const res = await fetch('/api/ipfs-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: title,
          description: story,
          image: image,
          attributes: [{ trait_type: 'category', value: category }]
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.uri) {
        const errorMsg = data?.message || data?.error || 'Preview upload failed'
        return { uri: null, imageUri: null, backend: null, error: errorMsg }
      }
      return { uri: data.uri, imageUri: data?.imageUri || null, backend: data?.backend || null }
    } catch (e: any) {
      const errorMsg = e?.message?.includes('fetch')
        ? 'Network error. Please check your connection and try again.'
        : (e?.message || 'Preview upload failed')
      return { uri: null, imageUri: null, backend: null, error: errorMsg }
    }
  }, [])

  const submitForApproval = useCallback(async (
    data: SubmissionData,
    captchaVerified: boolean,
    captchaRequired: boolean
  ): Promise<{ success: boolean; id?: string; error?: string }> => {
    // Validation
    if (!data.title?.trim()) {
      return { success: false, error: 'Please enter a title' }
    }
    if (!data.story?.trim()) {
      return { success: false, error: 'Please describe your situation or need' }
    }
    if (!data.firstName?.trim() || !data.lastName?.trim()) {
      return { success: false, error: 'First and last name are required' }
    }
    if (!data.phone?.trim()) {
      return { success: false, error: 'Phone number is required' }
    }
    if (!data.email?.trim()) {
      return { success: false, error: 'Email is required' }
    }
    if (!data.imageUri) {
      return { success: false, error: 'Please upload an image' }
    }
    if (captchaRequired && !captchaVerified) {
      return { success: false, error: 'Please complete the CAPTCHA verification' }
    }

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        return { 
          success: false, 
          error: '⚠️ Account required: Please click the profile icon in the top right to log in or create an account before submitting.' 
        }
      }

      const payload = {
        title: data.title,
        story: data.story,
        category: data.category,
        goal: data.goal,
        creator_wallet: data.wallet,
        creator_email: data.email,
        creator_name: `${data.firstName} ${data.lastName}`.trim(),
        creator_first_name: data.firstName,
        creator_last_name: data.lastName,
        company: data.company || null,
        creator_phone: data.phone,
        creator_address: data.address,
        image_uri: data.imageUri,
        metadata_uri: data.metadataUri,
        verification_selfie: data.verificationDocs.selfie?.path || null,
        verification_id_front: data.verificationDocs.idFront?.path || null,
        verification_id_back: data.verificationDocs.idBack?.path || null,
        verification_documents: data.verificationDocs.supporting.map(d => ({
          url: d.path,
          type: d.category,
          name: d.filename
        })),
        didit_session_id: data.diditSessionId,
        didit_status: data.diditStatus === 'completed' ? 'Approved' : 'Not Started'
      }

      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      const responseData = await res.json().catch(() => ({}))
      
      if (!res.ok) {
        return { success: false, error: responseData?.message || responseData?.error || 'Submit failed' }
      }

      logger.debug('[useSubmission] Submission successful:', responseData?.id)
      return { success: true, id: responseData?.id }
    } catch (e: any) {
      logger.error('[useSubmission] Submission error:', e)
      return { success: false, error: e?.message || 'Submit failed' }
    }
  }, [])

  return {
    generatePreview,
    submitForApproval
  }
}
