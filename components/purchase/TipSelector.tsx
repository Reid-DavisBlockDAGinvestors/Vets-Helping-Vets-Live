'use client'

import type { GiftSelectorProps } from './types'

const GIFT_PRESETS = [0, 5, 10, 25, 50]

/**
 * Gift amount selector component
 */
export function GiftSelector({ giftAmount, onGiftChange }: GiftSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/80 mb-2">Add a gift (optional)</label>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-2">
        {GIFT_PRESETS.map(gift => (
          <button
            key={gift}
            onClick={() => onGiftChange(gift)}
            data-testid={`gift-${gift}-btn`}
            className={`rounded-lg py-2 text-sm font-medium transition-all ${
              giftAmount === gift
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
            }`}
          >
            {gift === 0 ? 'None' : `$${gift}`}
          </button>
        ))}
      </div>
    </div>
  )
}

// Legacy export for backwards compatibility
export const TipSelector = GiftSelector
export default GiftSelector
