'use client'

import type { AIFieldType } from './types'

interface AIAssistButtonsProps {
  field: AIFieldType
  hasContent: boolean
  hasTitle: boolean
  isProcessing: boolean
  onImprove: () => void
  onExpand: () => void
  onGenerate: () => void
}

/**
 * AI assist buttons for form text fields
 */
export function AIAssistButtons({
  hasContent,
  hasTitle,
  isProcessing,
  onImprove,
  onExpand,
  onGenerate
}: AIAssistButtonsProps) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {hasContent ? (
        <>
          <button
            type="button"
            disabled={isProcessing}
            onClick={onImprove}
            className="px-3 py-1 text-xs rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 disabled:opacity-50 flex items-center gap-1"
          >
            ✨ Improve
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={onExpand}
            className="px-3 py-1 text-xs rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 disabled:opacity-50 flex items-center gap-1"
          >
            📝 Expand
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={isProcessing || !hasTitle}
          onClick={onGenerate}
          className="px-3 py-1 text-xs rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 disabled:opacity-50 flex items-center gap-1"
        >
          🤖 AI Generate Draft
        </button>
      )}
      {isProcessing && <span className="text-xs text-white/50 animate-pulse">Working...</span>}
    </div>
  )
}

export default AIAssistButtons
