'use client'

import { useCallback } from 'react'

const SUPPORTED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
const HEIC_FORMATS = ['image/heic', 'image/heif']

interface UseImageUploadOptions {
  onImageLoad: (dataUrl: string, mimeType: string) => void
  onLoadingChange: (loading: boolean) => void
  onMessage: (msg: string, type: 'success' | 'error' | 'info') => void
}

/**
 * Hook for image upload and HEIC conversion
 */
export function useImageUpload({
  onImageLoad,
  onLoadingChange,
  onMessage
}: UseImageUploadOptions) {
  
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return

    const fileType = (f.type || '').toLowerCase()
    const fileName = (f.name || '').toLowerCase()
    const isHeic = HEIC_FORMATS.includes(fileType) || fileName.endsWith('.heic') || fileName.endsWith('.heif')

    if (isHeic) {
      onLoadingChange(true)
      onMessage('Converting iPhone photo to JPEG...', 'info')
      
      try {
        const heic2any = (await import('heic2any')).default
        const blob = await heic2any({ blob: f, toType: 'image/jpeg', quality: 0.85 }) as Blob
        
        const reader = new FileReader()
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            onImageLoad(reader.result, 'image/jpeg')
            onMessage('Photo converted successfully!', 'success')
          }
          onLoadingChange(false)
        }
        reader.onerror = () => {
          onMessage('Failed to read converted image.', 'error')
          onLoadingChange(false)
        }
        reader.readAsDataURL(blob)
      } catch (err: any) {
        onMessage('HEIC conversion failed. Please use a JPEG or PNG image.', 'error')
        onLoadingChange(false)
      }
      return
    }

    if (!SUPPORTED_FORMATS.includes(fileType)) {
      onMessage('Unsupported format. Please use JPEG, PNG, GIF, or WebP.', 'error')
      return
    }

    onLoadingChange(true)
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        onImageLoad(reader.result, f.type || 'image/jpeg')
        onMessage('Image loaded!', 'success')
      }
      onLoadingChange(false)
    }
    reader.onerror = () => {
      onMessage('Failed to read image file.', 'error')
      onLoadingChange(false)
    }
    reader.readAsDataURL(f)
  }, [onImageLoad, onLoadingChange, onMessage])

  return { handleFileSelect }
}
