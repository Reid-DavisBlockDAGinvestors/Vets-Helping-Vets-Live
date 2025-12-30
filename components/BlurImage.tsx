'use client'

/**
 * BlurImage Component
 * 
 * Progressive image loading with blur placeholder
 * Following ISP - focused on image loading UX only
 */

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { ipfsToHttp } from '@/lib/ipfs'

interface BlurImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  fill?: boolean
  className?: string
  priority?: boolean
  sizes?: string
  'data-testid'?: string
}

// Generate a simple placeholder SVG
function generatePlaceholder(width = 100, height = 100): string {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1e3a5f;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#0f172a;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)"/>
    </svg>
  `
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

export function BlurImage({
  src,
  alt,
  width,
  height,
  fill = false,
  className = '',
  priority = false,
  sizes,
  'data-testid': testId,
}: BlurImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const [imageSrc, setImageSrc] = useState<string>('')

  // Convert IPFS URLs to HTTP
  useEffect(() => {
    if (src) {
      setImageSrc(ipfsToHttp(src))
      setError(false)
    }
  }, [src])

  const handleLoad = () => {
    setIsLoading(false)
  }

  const handleError = () => {
    setError(true)
    setIsLoading(false)
  }

  // Fallback for errors
  if (error || !imageSrc) {
    return (
      <div 
        className={`bg-gradient-to-br from-blue-900/50 to-purple-900/50 flex items-center justify-center ${className}`}
        data-testid={testId}
        style={fill ? undefined : { width, height }}
      >
        <span className="text-4xl opacity-30">🎖️</span>
      </div>
    )
  }

  const imageProps = fill
    ? { fill: true, sizes: sizes || '100vw' }
    : { width: width || 400, height: height || 300 }

  return (
    <div className={`relative overflow-hidden ${className}`} data-testid={testId}>
      <Image
        src={imageSrc}
        alt={alt}
        {...imageProps}
        priority={priority}
        placeholder="blur"
        blurDataURL={generatePlaceholder(width, height)}
        className={`
          duration-700 ease-in-out
          ${isLoading ? 'scale-105 blur-lg' : 'scale-100 blur-0'}
        `}
        onLoad={handleLoad}
        onError={handleError}
      />
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 to-purple-900/30 animate-pulse" />
      )}
    </div>
  )
}

/**
 * Skeleton placeholder for images
 */
export function ImageSkeleton({ 
  className = '',
  aspectRatio = '16/9'
}: { 
  className?: string
  aspectRatio?: string
}) {
  return (
    <div 
      className={`bg-gradient-to-br from-blue-900/30 to-purple-900/30 animate-pulse rounded-lg ${className}`}
      style={{ aspectRatio }}
      data-testid="image-skeleton"
    >
      <div className="w-full h-full flex items-center justify-center">
        <svg 
          className="w-10 h-10 text-white/20" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5} 
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
          />
        </svg>
      </div>
    </div>
  )
}

export default BlurImage
