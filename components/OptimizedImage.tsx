'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  fill?: boolean
  className?: string
  containerClassName?: string
  priority?: boolean
  quality?: number
  sizes?: string
  'data-testid'?: string
}

/**
 * OptimizedImage - Progressive image loading with blur placeholder
 * 
 * Features:
 * - Blur-up loading effect
 * - Graceful error fallback
 * - Skeleton loading state
 * - Responsive sizing support
 */
export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill = false,
  className = '',
  containerClassName = '',
  priority = false,
  quality = 75,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  'data-testid': testId,
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const handleLoad = () => {
    setIsLoading(false)
  }

  const handleError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  // Fallback placeholder for errors
  if (hasError) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-gray-800 text-gray-400',
          fill ? 'absolute inset-0' : '',
          containerClassName
        )}
        style={!fill ? { width, height } : undefined}
        data-testid={testId ? `${testId}-error` : 'image-error'}
      >
        <div className="text-center p-4">
          <span className="text-2xl block mb-2">📷</span>
          <span className="text-sm">Image unavailable</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        fill ? 'w-full h-full' : '',
        containerClassName
      )}
      style={!fill ? { width, height } : undefined}
    >
      {/* Skeleton loader */}
      {isLoading && (
        <div
          className={cn(
            'absolute inset-0 bg-gray-800 shimmer',
            'animate-pulse'
          )}
          data-testid={testId ? `${testId}-skeleton` : 'image-skeleton'}
        />
      )}

      {/* Actual image */}
      <Image
        src={src}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        className={cn(
          'transition-all duration-500 ease-out',
          isLoading ? 'scale-105 blur-lg opacity-0' : 'scale-100 blur-0 opacity-100',
          className
        )}
        priority={priority}
        quality={quality}
        sizes={sizes}
        onLoad={handleLoad}
        onError={handleError}
        data-testid={testId}
      />
    </div>
  )
}

/**
 * NFTImage - Specialized for NFT/campaign images with aspect ratio
 */
export function NFTImage({
  src,
  alt,
  aspectRatio = '1/1',
  className = '',
  priority = false,
  'data-testid': testId,
}: {
  src: string
  alt: string
  aspectRatio?: string
  className?: string
  priority?: boolean
  'data-testid'?: string
}) {
  return (
    <div
      className={cn('relative w-full', className)}
      style={{ aspectRatio }}
    >
      <OptimizedImage
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className="object-cover rounded-lg"
        data-testid={testId}
      />
    </div>
  )
}

/**
 * AvatarImage - For user/profile avatars
 */
export function AvatarImage({
  src,
  alt,
  size = 40,
  className = '',
  'data-testid': testId,
}: {
  src: string
  alt: string
  size?: number
  className?: string
  'data-testid'?: string
}) {
  const [hasError, setHasError] = useState(false)

  if (hasError || !src) {
    // Fallback to initials
    const initials = alt
      .split(' ')
      .map((word) => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold',
          className
        )}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
        data-testid={testId ? `${testId}-fallback` : 'avatar-fallback'}
      >
        {initials || '?'}
      </div>
    )
  }

  return (
    <div
      className={cn('relative rounded-full overflow-hidden', className)}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        className="object-cover"
        onError={() => setHasError(true)}
        data-testid={testId}
      />
    </div>
  )
}
