/**
 * CampaignUpdate Types
 * 
 * TypeScript interfaces and constants for campaign update forms
 * Following ISP - small, focused interfaces
 */

export type MediaType = 'image' | 'video' | 'audio'

export interface MediaFile {
  dataUrl: string
  type: MediaType
  mimeType: string
  name: string
}

export interface Campaign {
  id: string
  campaignId: number | null
  title: string
  story: string
  category: string
  goal: number
  imageUri: string
  status: string
  raised: number
}

export interface CampaignUpdateFormProps {
  campaign: Campaign
  walletAddress: string
  onClose: () => void
  onSubmitted: () => void
}

export interface CampaignUpdateFormState {
  title: string
  storyUpdate: string
  fundsUtilization: string
  benefits: string
  stillNeeded: string
}

export interface CampaignUpdateUIState {
  submitting: boolean
  error: string | null
  success: boolean
}

export interface MediaUploadState {
  mediaFiles: MediaFile[]
  mediaLoading: boolean
  mediaError: string | null
}

// Supported file formats
export const IMAGE_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
export const VIDEO_FORMATS = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov']
export const AUDIO_FORMATS = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/aac']
export const HEIC_FORMATS = ['image/heic', 'image/heif']

/**
 * Determine media type from mime type
 */
export function getMediaType(mimeType: string): MediaType | null {
  const mt = mimeType.toLowerCase()
  if (IMAGE_FORMATS.includes(mt) || HEIC_FORMATS.includes(mt)) return 'image'
  if (VIDEO_FORMATS.includes(mt) || mt.startsWith('video/')) return 'video'
  if (AUDIO_FORMATS.includes(mt) || mt.startsWith('audio/')) return 'audio'
  return null
}

/**
 * Convert File to data URL
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to read file'))
      }
    }
    reader.onerror = () => reject(new Error('File read error'))
    reader.readAsDataURL(file)
  })
}

/**
 * Convert Blob to data URL
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to convert blob'))
      }
    }
    reader.onerror = () => reject(new Error('Blob read error'))
    reader.readAsDataURL(blob)
  })
}
