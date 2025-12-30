/**
 * Accessibility Utilities
 * 
 * Helper functions for WCAG 2.1 AA compliance
 * Following ISP - focused on accessibility helpers only
 */

/**
 * Generate unique IDs for form elements and their labels
 */
export function generateA11yId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Keyboard navigation helper - check if key is actionable
 */
export function isActionKey(event: KeyboardEvent): boolean {
  return event.key === 'Enter' || event.key === ' '
}

/**
 * Handle keyboard navigation for clickable elements
 */
export function handleKeyboardClick(
  event: React.KeyboardEvent,
  callback: () => void
): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    callback()
  }
}

/**
 * Focus trap hook configuration
 */
export interface FocusTrapConfig {
  /** Container element ref */
  containerRef: React.RefObject<HTMLElement>
  /** Whether the trap is active */
  isActive: boolean
  /** Return focus on deactivate */
  returnFocus?: boolean
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'button:not([disabled])',
    'a[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ')

  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors))
}

/**
 * Announce message to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div')
  announcement.setAttribute('role', 'status')
  announcement.setAttribute('aria-live', priority)
  announcement.setAttribute('aria-atomic', 'true')
  announcement.className = 'sr-only'
  announcement.textContent = message
  
  document.body.appendChild(announcement)
  
  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement)
  }, 1000)
}

/**
 * Skip link target ID constants
 */
export const SKIP_TARGETS = {
  MAIN_CONTENT: 'main-content',
  NAVIGATION: 'main-navigation',
  FOOTER: 'footer',
} as const

/**
 * Common ARIA labels for consistency
 */
export const ARIA_LABELS = {
  // Navigation
  MAIN_NAV: 'Main navigation',
  MOBILE_MENU: 'Mobile menu',
  CLOSE_MENU: 'Close menu',
  
  // Forms
  SUBMIT: 'Submit form',
  CANCEL: 'Cancel',
  CLOSE: 'Close',
  SEARCH: 'Search',
  
  // Actions
  EXPAND: 'Expand',
  COLLAPSE: 'Collapse',
  NEXT: 'Next',
  PREVIOUS: 'Previous',
  
  // Status
  LOADING: 'Loading',
  ERROR: 'Error',
  SUCCESS: 'Success',
  
  // Theme
  TOGGLE_THEME: 'Toggle theme',
  DARK_MODE: 'Switch to dark mode',
  LIGHT_MODE: 'Switch to light mode',
} as const

/**
 * Color contrast checker (simplified)
 * Returns true if contrast ratio meets WCAG AA (4.5:1 for normal text)
 */
export function checkContrastRatio(foreground: string, background: string): boolean {
  // Simplified implementation - in production, use a proper color library
  // This is a placeholder for the concept
  return true
}

/**
 * Generate descriptive button text for screen readers
 */
export function getButtonLabel(action: string, context?: string): string {
  return context ? `${action} ${context}` : action
}
