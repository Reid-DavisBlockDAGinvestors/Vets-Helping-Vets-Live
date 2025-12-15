'use client'

import { openBugReport } from './BugReportButton'

interface ErrorWithBugReportProps {
  error: string
  details?: string
  onRetry?: () => void
  context?: {
    page?: string
    action?: string
    category?: 'general' | 'purchase' | 'submission' | 'wallet' | 'auth' | 'display' | 'performance' | 'other'
  }
}

/**
 * Error display component with integrated bug report button
 * Use this anywhere you display an error to users
 */
export default function ErrorWithBugReport({ 
  error, 
  details, 
  onRetry,
  context 
}: ErrorWithBugReportProps) {
  const handleReportBug = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('[ErrorWithBugReport] Opening bug report modal')
    openBugReport({
      title: `Error: ${error}`,
      description: details 
        ? `Error: ${error}\n\nDetails: ${details}` 
        : `Error: ${error}`,
      category: context?.category || 'general',
      errorMessage: details || error
    })
  }

  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-red-400 font-medium">{error}</p>
          {details && (
            <p className="text-red-400/70 text-sm mt-1">{details}</p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 mt-4">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Retry
          </button>
        )}
        <button
          onClick={handleReportBug}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <span>🐛</span>
          Report Bug
        </button>
      </div>
    </div>
  )
}

/**
 * Inline error for smaller contexts
 */
export function InlineErrorWithBugReport({ 
  error, 
  onRetry,
  context 
}: Omit<ErrorWithBugReportProps, 'details'>) {
  const handleReportBug = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    openBugReport({
      title: `Error: ${error}`,
      description: `Error encountered: ${error}`,
      category: context?.category || 'general',
      errorMessage: error
    })
  }

  return (
    <div className="flex items-center gap-3 text-red-400">
      <span>{error}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-red-300 hover:text-white underline text-sm"
        >
          Retry
        </button>
      )}
      <button
        onClick={handleReportBug}
        className="text-white/60 hover:text-white text-sm flex items-center gap-1"
        title="Report this bug"
      >
        🐛
      </button>
    </div>
  )
}
