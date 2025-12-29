'use client'

import type { TipSelectorProps } from './types'

const TIP_PRESETS = [0, 5, 10, 25, 50]

/**
 * Tip amount selector component
 */
export function TipSelector({ tipAmount, onTipChange }: TipSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/80 mb-2">Add a tip (optional)</label>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-2">
        {TIP_PRESETS.map(tip => (
          <button
            key={tip}
            onClick={() => onTipChange(tip)}
            className={`rounded-lg py-2 text-sm font-medium transition-all ${
              tipAmount === tip
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
            }`}
          >
            {tip === 0 ? 'None' : `$${tip}`}
          </button>
        ))}
      </div>
    </div>
  )
}

export default TipSelector
