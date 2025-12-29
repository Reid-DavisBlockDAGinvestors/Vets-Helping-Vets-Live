'use client'

import type { QuantitySelectorProps } from './types'

/**
 * NFT quantity selector component
 */
export function QuantitySelector({
  quantity,
  maxQuantity,
  isSoldOut,
  pricePerNft,
  onQuantityChange,
}: QuantitySelectorProps) {
  const subtotal = pricePerNft * quantity

  return (
    <div>
      <label className="block text-sm font-medium text-white/80 mb-2">Quantity</label>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
          disabled={isSoldOut || quantity <= 1}
          className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold disabled:opacity-50"
        >
          −
        </button>
        <input
          type="number"
          min={1}
          max={maxQuantity}
          value={quantity}
          onChange={e => onQuantityChange(Math.min(maxQuantity, Math.max(1, Number(e.target.value))))}
          disabled={isSoldOut}
          className="w-20 text-center rounded-lg bg-white/5 border border-white/10 py-2 text-lg text-white"
        />
        <button
          onClick={() => onQuantityChange(Math.min(maxQuantity, quantity + 1))}
          disabled={isSoldOut || quantity >= maxQuantity}
          className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold disabled:opacity-50"
        >
          +
        </button>
        <span className="text-white/50 text-sm">× ${pricePerNft} = ${subtotal}</span>
      </div>
    </div>
  )
}

export default QuantitySelector
