'use client'

import { useState, useCallback } from 'react'
import type { CategoryId } from '@/lib/categories'
import type { 
  ContactInfo, 
  AddressInfo, 
  StoryContent,
  VerificationDocs
} from '../types'

/**
 * Main form state hook - manages all submission form data
 */
export function useSubmissionForm() {
  // Campaign info
  const [category, setCategory] = useState<CategoryId>('veteran')
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState(1000)

  // Story sections
  const [background, setBackground] = useState('')
  const [need, setNeed] = useState('')
  const [fundsUsage, setFundsUsage] = useState('')

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

  // Verification
  const [verificationComplete, setVerificationComplete] = useState(false)
  const [diditSessionId, setDiditSessionId] = useState<string | null>(null)
  const [diditStatus, setDiditStatus] = useState('not_started')
  const [verificationDocs, setVerificationDocs] = useState<VerificationDocs>({ supporting: [] })

  // Combined story getter
  const getFullStory = useCallback(() => {
    const parts = []
    if (background) parts.push(`About Me:\n${background}`)
    if (need) parts.push(`What I Need:\n${need}`)
    if (fundsUsage) parts.push(`How Funds Will Be Used:\n${fundsUsage}`)
    return parts.join('\n\n')
  }, [background, need, fundsUsage])

  // Full name getter
  const getFullName = useCallback(() => {
    return `${firstName} ${lastName}`.trim()
  }, [firstName, lastName])

  // Clear media
  const clearMedia = useCallback(() => {
    setImage(null)
    setMediaMime(null)
    setPreviewUri(null)
    setPreviewImageUri(null)
  }, [])

  // Bulk setters for loading data
  const setCampaignInfo = useCallback((data: { category?: CategoryId; title?: string; goal?: number }) => {
    if (data.category) setCategory(data.category)
    if (data.title) setTitle(data.title)
    if (data.goal) setGoal(data.goal)
  }, [])

  const setStoryContent = useCallback((data: Partial<StoryContent>) => {
    if (data.background !== undefined) setBackground(data.background)
    if (data.need !== undefined) setNeed(data.need)
    if (data.fundsUsage !== undefined) setFundsUsage(data.fundsUsage)
  }, [])

  const setContactInfo = useCallback((data: Partial<ContactInfo>) => {
    if (data.firstName !== undefined) setFirstName(data.firstName)
    if (data.lastName !== undefined) setLastName(data.lastName)
    if (data.company !== undefined) setCompany(data.company)
    if (data.phone !== undefined) setPhone(data.phone)
    if (data.email !== undefined) setEmail(data.email)
    if (data.wallet !== undefined) setWallet(data.wallet)
  }, [])

  const setAddressInfo = useCallback((data: Partial<AddressInfo>) => {
    if (data.streetAddress !== undefined) setStreetAddress(data.streetAddress)
    if (data.city !== undefined) setCity(data.city)
    if (data.stateProvince !== undefined) setStateProvince(data.stateProvince)
    if (data.zipCode !== undefined) setZipCode(data.zipCode)
    if (data.country !== undefined) setCountry(data.country)
  }, [])

  return {
    // Campaign
    category, setCategory,
    title, setTitle,
    goal, setGoal,
    setCampaignInfo,

    // Story
    background, setBackground,
    need, setNeed,
    fundsUsage, setFundsUsage,
    setStoryContent,
    getFullStory,

    // Contact
    firstName, setFirstName,
    lastName, setLastName,
    company, setCompany,
    phone, setPhone,
    email, setEmail,
    wallet, setWallet,
    setContactInfo,
    getFullName,

    // Address
    streetAddress, setStreetAddress,
    city, setCity,
    stateProvince, setStateProvince,
    zipCode, setZipCode,
    country, setCountry,
    setAddressInfo,

    // Media
    image, setImage,
    mediaMime, setMediaMime,
    imageLoading, setImageLoading,
    clearMedia,

    // Preview
    previewUri, setPreviewUri,
    previewBackend, setPreviewBackend,
    previewImageUri, setPreviewImageUri,

    // Verification
    verificationComplete, setVerificationComplete,
    diditSessionId, setDiditSessionId,
    diditStatus, setDiditStatus,
    verificationDocs, setVerificationDocs,
  }
}

export type UseSubmissionFormReturn = ReturnType<typeof useSubmissionForm>
