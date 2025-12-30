'use client'

/**
 * MediaPreview Component
 * 
 * Displays uploaded media files with preview and remove functionality
 * Following ISP - focused on media preview only
 */

import { type MediaFile } from './types'

interface MediaPreviewProps {
  mediaFiles: MediaFile[]
  onRemove: (index: number) => void
}

export default function MediaPreview({ mediaFiles, onRemove }: MediaPreviewProps) {
  if (mediaFiles.length === 0) return null

  return (
    <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3" data-testid="media-preview-grid">
      {mediaFiles.map((media, index) => (
        <div 
          key={index} 
          className="relative group rounded-lg overflow-hidden bg-white/5 border border-white/10"
          data-testid={`media-preview-item-${index}`}
        >
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
            onClick={() => onRemove(index)}
            data-testid={`remove-media-btn-${index}`}
            aria-label={`Remove ${media.name}`}
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
  )
}
