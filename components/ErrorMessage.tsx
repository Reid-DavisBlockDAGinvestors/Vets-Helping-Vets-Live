'use client'

import { openBugReport } from './BugReportButton'

interface ErrorMessageProps {
  message: string
  category?: 'general' | 'purchase' | 'submission' | 'wallet' | 'auth' | 'display' | 'performance' | 'other'
  context?: string  // Additional context about what the user was trying to do
  showReportButton?: boolean
  className?: string
}

/**
 * ErrorMessage component with optional "Report Bug" button
 * 
 * Usage:
 * <ErrorMessage 
 *   message="Failed to complete purchase" 
 *   category="purchase"
 *   context="User was trying to buy NFT #123"
 * />
 */
export default function ErrorMessage({ 
  message, 
  category = 'general',
  context,
  showReportButton = true,
  className = ''
}: ErrorMessageProps) {
  
  const handleReport = () => {
    openBugReport({
      title: `Error: ${message.slice(0, 50)}${message.length > 50 ? '...' : ''}`,
      description: context || 'I encountered this error while using the app.',
      errorMessage: message,
      category
    })
  }

  return (
    <div className={`bg-red-500/10 border border-red-500/30 rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="text-red-400 text-lg flex-shrink-0">⚠️</span>
        <div className="flex-1 min-w-0">
          <p className="text-red-400 text-sm">{message}</p>
          {showReportButton && (
            <button
              onClick={handleReport}
              className="mt-2 text-xs text-red-300 hover:text-red-200 underline underline-offset-2 flex items-center gap-1"
            >
              🐛 Report this issue
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Inline error with report button - for use in forms
 */
export function InlineError({ 
  message, 
  category = 'general',
  context,
  showReportButton = true 
}: ErrorMessageProps) {
  
  const handleReport = () => {
    openBugReport({
      title: `Error: ${message.slice(0, 50)}${message.length > 50 ? '...' : ''}`,
      description: context || 'I encountered this error.',
      errorMessage: message,
      category
    })
  }

  return (
    <div className="flex items-center gap-2 text-red-400 text-sm">
      <span>{message}</span>
      {showReportButton && (
        <button
          onClick={handleReport}
          className="text-xs text-red-300 hover:text-red-200 underline"
          title="Report this bug"
        >
          🐛
        </button>
      )}
    </div>
  )
}

/**
 * Toast-style error notification with report button
 */
export function ErrorToast({ 
  message, 
  category = 'general',
  context,
  onDismiss
}: ErrorMessageProps & { onDismiss?: () => void }) {
  
  const handleReport = () => {
    openBugReport({
      title: `Error: ${message.slice(0, 50)}${message.length > 50 ? '...' : ''}`,
      description: context || 'I encountered this error.',
      errorMessage: message,
      category
    })
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 max-w-sm animate-slide-up">
      <div className="bg-red-900/95 border border-red-500/50 rounded-xl shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-red-400 text-xl">⚠️</span>
          <div className="flex-1">
            <p className="text-white text-sm font-medium">{message}</p>
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handleReport}
                className="text-xs text-red-300 hover:text-white transition-colors flex items-center gap-1"
              >
                🐛 Report Bug
              </button>
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="text-xs text-white/50 hover:text-white transition-colors"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
