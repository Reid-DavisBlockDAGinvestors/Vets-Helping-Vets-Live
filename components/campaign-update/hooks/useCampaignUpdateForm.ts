'use client'

/**
 * useCampaignUpdateForm Hook
 * 
 * Manages campaign update form state and submission
 * Following ISP - focused on form logic only
 */

import { useState, useCallback } from 'react'
import { type Campaign, type CampaignUpdateFormState } from '../types'
import { useMediaUpload } from './useMediaUpload'

export interface UseCampaignUpdateFormReturn {
  // Form state
  formState: CampaignUpdateFormState
  setTitle: (v: string) => void
  setStoryUpdate: (v: string) => void
  setFundsUtilization: (v: string) => void
  setBenefits: (v: string) => void
  setStillNeeded: (v: string) => void
  
  // UI state
  submitting: boolean
  error: string | null
  success: boolean
  
  // Media
  media: ReturnType<typeof useMediaUpload>
  
  // Actions
  handleSubmit: (e: React.FormEvent, campaign: Campaign, walletAddress: string, onSubmitted: () => void) => Promise<void>
}

export function useCampaignUpdateForm(): UseCampaignUpdateFormReturn {
  // Form state
  const [title, setTitle] = useState('')
  const [storyUpdate, setStoryUpdate] = useState('')
  const [fundsUtilization, setFundsUtilization] = useState('')
  const [benefits, setBenefits] = useState('')
  const [stillNeeded, setStillNeeded] = useState('')
  
  // UI state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  // Media hook
  const media = useMediaUpload()

  const handleSubmit = useCallback(async (
    e: React.FormEvent, 
    campaign: Campaign, 
    walletAddress: string,
    onSubmitted: () => void
  ) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    // Validate at least one field is filled
    if (!storyUpdate && !fundsUtilization && !benefits && !stillNeeded && media.mediaFiles.length === 0) {
      setError('Please provide at least one update field or upload media')
      setSubmitting(false)
      return
    }

    try {
      // Upload media files to IPFS first
      let mediaUris: string[] = []
      if (media.mediaFiles.length > 0) {
        setError(null)
        mediaUris = await media.uploadMediaFiles()
        if (mediaUris.length === 0 && media.mediaFiles.length > 0) {
          setError('Failed to upload media files')
          setSubmitting(false)
          return
        }
      }

      const res = await fetch('/api/campaign-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: campaign.id,
          creator_wallet: walletAddress,
          title: title || null,
          story_update: storyUpdate || null,
          funds_utilization: fundsUtilization || null,
          benefits: benefits || null,
          still_needed: stillNeeded || null,
          media_uris: mediaUris.length > 0 ? mediaUris : null
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || data.details || 'Failed to submit update')
      }

      setSuccess(true)
      setTimeout(() => {
        onSubmitted()
      }, 2000)
    } catch (e: any) {
      setError(e?.message || 'Failed to submit update')
    } finally {
      setSubmitting(false)
    }
  }, [title, storyUpdate, fundsUtilization, benefits, stillNeeded, media])

  return {
    formState: { title, storyUpdate, fundsUtilization, benefits, stillNeeded },
    setTitle,
    setStoryUpdate,
    setFundsUtilization,
    setBenefits,
    setStillNeeded,
    submitting,
    error,
    success,
    media,
    handleSubmit
  }
}
