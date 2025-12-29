'use client'

import { ROLE_BADGES } from './types'

interface RoleBadgeProps {
  role: string
  variant?: 'inline' | 'pill'
}

/**
 * Role badge component for displaying user roles
 */
export function RoleBadge({ role, variant = 'pill' }: RoleBadgeProps) {
  const badge = ROLE_BADGES[role] || ROLE_BADGES.user

  if (variant === 'inline') {
    return (
      <span className={`text-xs ${badge.text}`}>
        {badge.label}
      </span>
    )
  }

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badge.bg} ${badge.text}`}>
      {badge.label}
    </span>
  )
}

export default RoleBadge
