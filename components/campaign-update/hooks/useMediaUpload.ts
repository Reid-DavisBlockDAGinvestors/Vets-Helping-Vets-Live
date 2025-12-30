'use client'

/**
 * useMediaUpload Hook
 * 
 * Manages media file uploads for campaign updates
 * Following ISP - focused on media handling only
 */

import { useState, useCallback } from 'react'
import { logger } from '@/lib/logger'
import { 
  type MediaFile, 
  HEIC_FORMATS, 
  getMediaType, 
  fileToDataUrl, 
  blobToDataUrl 
} from '../types'

export interface UseMediaUploadReturn {
  mediaFiles: MediaFile[]
  mediaLoading: boolean
  mediaError: string | null
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  removeMedia: (index: number) => void
  uploadMediaFiles: () => Promise<string[]>
  clearMediaError: () => void
}

export function useMediaUpload(): UseMediaUploadReturn {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)

  const clearMediaError = useCallback(() => {
    setMediaError(null)
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    setMediaLoading(true)
    setMediaError(null)
    
    const newMediaFiles: MediaFile[] = []
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const mimeType = (file.type || '').toLowerCase()
      const fileName = (file.name || '').toLowerCase()
      
      // Check for HEIC/HEIF (iPhone photos)
      const isHeic = HEIC_FORMATS.includes(mimeType) || fileName.endsWith('.heic') || fileName.endsWith('.heif')
      
      if (isHeic) {
        try {
          const heic2any = (await import('heic2any')).default
          const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 }) as Blob
          const dataUrl = await blobToDataUrl(blob)
          newMediaFiles.push({
            dataUrl,
            type: 'image',
            mimeType: 'image/jpeg',
            name: file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg')
          })
        } catch (err: any) {
          setMediaError(`Failed to convert ${file.name}: ${err?.message || 'Unknown error'}`)
          continue
        }
      } else {
        const mediaType = getMediaType(mimeType)
        if (!mediaType) {
          setMediaError(`Unsupported format: ${mimeType || 'unknown'}`)
          continue
        }
        
        try {
          const dataUrl = await fileToDataUrl(file)
          newMediaFiles.push({
            dataUrl,
            type: mediaType,
            mimeType: file.type,
            name: file.name
          })
        } catch (err: any) {
          setMediaError(`Failed to read ${file.name}: ${err?.message}`)
          continue
        }
      }
    }
    
    setMediaFiles(prev => [...prev, ...newMediaFiles])
    setMediaLoading(false)
    // Reset input so same file can be selected again
    e.target.value = ''
  }, [])

  const removeMedia = useCallback((index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const uploadMediaFiles = useCallback(async (): Promise<string[]> => {
    const uris: string[] = []
    for (const media of mediaFiles) {
      try {
        const res = await fetch('/api/ipfs-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl: media.dataUrl })
        })
        const data = await res.json()
        if (res.ok && data.uri) {
          uris.push(data.uri)
        }
      } catch (err) {
        logger.error('Failed to upload media:', err)
      }
    }
    return uris
  }, [mediaFiles])

  return {
    mediaFiles,
    mediaLoading,
    mediaError,
    handleFileChange,
    removeMedia,
    uploadMediaFiles,
    clearMediaError
  }
}
