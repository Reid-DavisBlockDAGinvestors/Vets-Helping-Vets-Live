'use client'

/**
 * AIButtons Component
 * 
 * AI assistance buttons for story form fields
 * Following ISP - focused on AI action buttons only
 */

interface AIButtonsProps {
  field: 'background' | 'need' | 'fundsUsage'
  value: string
  aiBusy: boolean
  onAIAction: (field: 'background' | 'need' | 'fundsUsage', mode: 'improve' | 'expand' | 'generate') => void
  hasTitle: boolean
}

export function AIButtons({ field, value, aiBusy, onAIAction, hasTitle }: AIButtonsProps) {
  return (
    <div className="mt-2 flex flex-wrap gap-2" data-testid={`ai-buttons-${field}`}>
      {value?.trim() ? (
        <>
          <button 
            type="button" 
            disabled={aiBusy} 
            onClick={() => onAIAction(field, 'improve')}
            data-testid={`ai-improve-${field}-btn`}
            className="px-3 py-1 text-xs rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 disabled:opacity-50"
          >
            ✨ Improve
          </button>
          <button 
            type="button" 
            disabled={aiBusy} 
            onClick={() => onAIAction(field, 'expand')}
            data-testid={`ai-expand-${field}-btn`}
            className="px-3 py-1 text-xs rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 disabled:opacity-50"
          >
            📝 Expand
          </button>
        </>
      ) : (
        <button 
          type="button" 
          disabled={aiBusy || !hasTitle} 
          onClick={() => onAIAction(field, 'generate')}
          data-testid={`ai-generate-${field}-btn`}
          className="px-3 py-1 text-xs rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 disabled:opacity-50"
        >
          🤖 AI Generate Draft
        </button>
      )}
      {aiBusy && <span className="text-xs text-white/50 animate-pulse">Working...</span>}
    </div>
  )
}
