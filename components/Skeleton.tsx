'use client'

import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

/**
 * Basic skeleton loader component
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-white/10',
        className
      )}
    />
  )
}

/**
 * NFT Card skeleton for loading states
 */
export function NFTCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Image placeholder */}
      <Skeleton className="h-52 w-full rounded-none" />
      
      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <Skeleton className="h-6 w-3/4" />
        
        {/* Category badge */}
        <Skeleton className="h-5 w-20 rounded-full" />
        
        {/* Description */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        
        {/* Progress bar */}
        <Skeleton className="h-2 w-full rounded-full" />
        
        {/* Stats row */}
        <div className="flex justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  )
}

/**
 * Story page skeleton
 */
export function StoryPageSkeleton() {
  return (
    <div className="container py-8 space-y-8">
      {/* Hero image */}
      <Skeleton className="h-64 md:h-96 w-full rounded-2xl" />
      
      {/* Title and meta */}
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <div className="flex gap-3">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
      </div>
      
      {/* Progress section */}
      <div className="rounded-xl border border-white/10 p-6 space-y-4">
        <Skeleton className="h-4 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      
      {/* Story content */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  )
}

/**
 * Table row skeleton
 */
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-white/10">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  )
}

/**
 * Dashboard stat card skeleton
 */
export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      <Skeleton className="h-4 w-20 mb-2" />
      <Skeleton className="h-8 w-24" />
    </div>
  )
}

/**
 * Profile skeleton
 */
export function ProfileSkeleton() {
  return (
    <div className="flex items-center gap-4">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  )
}

/**
 * Grid of NFT card skeletons
 */
export function NFTGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <NFTCardSkeleton key={i} />
      ))}
    </div>
  )
}

export default Skeleton
