'use client'

import type { CampaignStatus, UpdateStatus } from './types'

const statusStyles: Record<string, string> = {
  minted: 'bg-green-500/20 text-green-400 border-green-500/30',
  approved: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  pending_onchain: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
}

const updateStatusStyles: Record<string, string> = {
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
}

interface StatusBadgeProps {
  status: CampaignStatus | string
  className?: string
}

interface UpdateStatusBadgeProps {
  status: UpdateStatus | string
  className?: string
}

/**
 * Campaign status badge component
 */
export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const style = statusStyles[status] || 'bg-white/10 text-white/50'
  
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full border ${style} ${className}`}>
      {status}
    </span>
  )
}

/**
 * Update status badge component
 */
export function UpdateStatusBadge({ status, className = '' }: UpdateStatusBadgeProps) {
  const style = updateStatusStyles[status] || 'bg-white/10 text-white/50'
  
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full border ${style} ${className}`}>
      {status}
    </span>
  )
}

export default StatusBadge
