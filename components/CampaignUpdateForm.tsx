"use client"

import { useState } from 'react'
import { ipfsToHttp } from '@/lib/ipfs'
import { logger } from '@/lib/logger'

// Supported formats
const IMAGE_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
const VIDEO_FORMATS = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov']
const AUDIO_FORMATS = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/aac']
const HEIC_FORMATS = ['image/heic', 'image/heif']

type MediaFile = {
  dataUrl: string
  type: 'image' | 'video' | 'audio'
  mimeType: string
  name: string
}

type Campaign = {
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

type Props = {
  campaign: Campaign
  walletAddress: string
  onClose: () => void
  onSubmitted: () => void
}

export default function CampaignUpdateForm({ campaign, walletAddress, onClose, onSubmitted }: Props) {
  const [title, setTitle] = useState('')
  const [storyUpdate, setStoryUpdate] = useState('')
  const [fundsUtilization, setFundsUtilization] = useState('')
  const [benefits, setBenefits] = useState('')
  const [stillNeeded, setStillNeeded] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  // Media state
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)

  // Determine media type from mime type
  const getMediaType = (mimeType: string): 'image' | 'video' | 'audio' | null => {
    const mt = mimeType.toLowerCase()
    if (IMAGE_FORMATS.includes(mt) || HEIC_FORMATS.includes(mt)) return 'image'
    if (VIDEO_FORMATS.includes(mt) || mt.startsWith('video/')) return 'video'
    if (AUDIO_FORMATS.includes(mt) || mt.startsWith('audio/')) return 'audio'
    return null
  }

  // Handle file selection
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
  }

  // Convert File to data URL
  const fileToDataUrl = (file: File): Promise<string> => {
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

  // Convert Blob to data URL
  const blobToDataUrl = (blob: Blob): Promise<string> => {
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

  // Remove a media file
  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Upload media files to IPFS
  const uploadMediaFiles = async (): Promise<string[]> => {
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
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    // Validate at least one field is filled (text or media)
    if (!storyUpdate && !fundsUtilization && !benefits && !stillNeeded && mediaFiles.length === 0) {
      setError('Please provide at least one update field or upload media')
      setSubmitting(false)
      return
    }

    try {
      // Upload media files to IPFS first
      let mediaUris: string[] = []
      if (mediaFiles.length > 0) {
        setError(null)
        mediaUris = await uploadMediaFiles()
        if (mediaUris.length === 0 && mediaFiles.length > 0) {
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
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-gray-900 border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-white/10 p-5 flex items-start justify-between">
          <div className="flex items-center gap-4">
            {campaign.imageUri && (
              <img
                src={ipfsToHttp(campaign.imageUri)}
                alt={campaign.title}
                className="w-12 h-12 rounded-lg object-cover"
              />
            )}
            <div>
              <h2 className="text-lg font-semibold text-white">Update Your Story</h2>
              <p className="text-sm text-white/50">{campaign.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Success State */}
        {success ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Update Submitted!</h3>
            <p className="text-white/60">
              Your update has been sent to our team for review. Once approved, it will be pushed to all NFT holders.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            {/* Info Banner */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <div className="flex gap-3">
                <div className="flex-shrink-0 text-blue-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-sm">
                  <p className="text-blue-300 font-medium">Living NFT Update</p>
                  <p className="text-white/60 mt-1">
                    Your update will be reviewed by our team. Once approved, all NFT holders (including future buyers) will see your updated story on their NFTs.
                  </p>
                </div>
              </div>
            </div>

            {/* Update Title (Optional) */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Update Title <span className="text-white/40">(optional)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Week 2 Progress Report"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
              />
            </div>

            {/* Current Situation / Story Update */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Current Situation Update
              </label>
              <textarea
                value={storyUpdate}
                onChange={(e) => setStoryUpdate(e.target.value)}
                placeholder="Share your current situation, progress, or any updates on your story..."
                rows={4}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors resize-none"
              />
            </div>

            {/* Funds Utilization */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                How Funds Have Been Used
              </label>
              <textarea
                value={fundsUtilization}
                onChange={(e) => setFundsUtilization(e.target.value)}
                placeholder="Describe how the donations have been utilized so far..."
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors resize-none"
              />
            </div>

            {/* Benefits Received */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Benefits & Impact
              </label>
              <textarea
                value={benefits}
                onChange={(e) => setBenefits(e.target.value)}
                placeholder="Share the positive impact and benefits from the donations..."
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors resize-none"
              />
            </div>

            {/* What's Still Needed */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                What's Still Needed
              </label>
              <textarea
                value={stillNeeded}
                onChange={(e) => setStillNeeded(e.target.value)}
                placeholder="What additional help or resources are still needed to reach your goal..."
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors resize-none"
              />
            </div>

            {/* Media Upload */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Upload Media <span className="text-white/40">(photos, videos, audio)</span>
              </label>
              
              {/* File Input */}
              <div className="relative">
                <input
                  type="file"
                  accept="image/*,video/*,audio/*,.heic,.heif"
                  multiple
                  onChange={onFileChange}
                  disabled={mediaLoading || submitting}
                  className="hidden"
                  id="media-upload"
                />
                <label
                  htmlFor="media-upload"
                  className={`flex items-center justify-center gap-3 w-full px-4 py-4 border-2 border-dashed border-white/20 rounded-xl cursor-pointer transition-colors ${
                    mediaLoading ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-500/50 hover:bg-white/5'
                  }`}
                >
                  {mediaLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-white/60">Processing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="text-white/60">Click to upload photos, videos, or audio</span>
                    </>
                  )}
                </label>
              </div>
              
              <p className="text-xs text-white/40 mt-2">
                Supported: JPEG, PNG, GIF, WebP, MP4, WebM, MP3, WAV, M4A. iPhone photos (HEIC) auto-converted.
              </p>

              {/* Media Error */}
              {mediaError && (
                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-xs">
                  {mediaError}
                </div>
              )}

              {/* Media Previews */}
              {mediaFiles.length > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                  {mediaFiles.map((media, index) => (
                    <div key={index} className="relative group rounded-lg overflow-hidden bg-white/5 border border-white/10">
                      {media.type === 'image' && (
                        <img
                          src={media.dataUrl}
                          alt={media.name}
                          className="w-full h-24 object-cover"
                        />
                      )}
                      {media.type === 'video' && (
                        <video
                          src={media.dataUrl}
                          className="w-full h-24 object-cover"
                        />
                      )}
                      {media.type === 'audio' && (
                        <div className="w-full h-24 flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-blue-900/30">
                          <svg className="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                      )}
                      
                      {/* Type badge */}
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white/70 uppercase">
                        {media.type}
                      </div>
                      
                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => removeMedia(index)}
                        className="absolute top-1 right-1 p-1 bg-red-500/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      
                      {/* Filename */}
                      <div className="p-1.5 text-[10px] text-white/50 truncate">
                        {media.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-5 py-3 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Update'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
