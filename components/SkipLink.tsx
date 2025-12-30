'use client'

/**
 * SkipLink Component
 * 
 * Accessibility skip navigation link for keyboard users
 * WCAG 2.1 AA requirement - allows users to skip repetitive content
 */

import { SKIP_TARGETS } from '@/lib/accessibility'

export function SkipLink() {
  return (
    <a
      href={`#${SKIP_TARGETS.MAIN_CONTENT}`}
      data-testid="skip-to-content-link"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-white"
    >
      Skip to main content
    </a>
  )
}

export default SkipLink
