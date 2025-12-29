'use client'

/**
 * usePurchaseConfig Hook
 * 
 * Calculates payment configuration based on NFT price, quantity, and tips
 * Following ISP - focused on price calculations
 */

import { useMemo } from 'react'
import type { PaymentConfig } from '../types'

const BDAG_USD_PRICE = 0.05 // 1 BDAG = $0.05 USD

export function usePurchaseConfig(
  pricePerNft: number | null | undefined,
  quantity: number,
  tipAmount: number,
  customAmount: number,
  remainingCopies: number | null | undefined
): PaymentConfig {
  return useMemo(() => {
    const hasNftPrice = !!(pricePerNft && pricePerNft > 0)
    const nftSubtotal = hasNftPrice ? (pricePerNft || 0) * quantity : 0
    const totalAmount = hasNftPrice ? nftSubtotal + tipAmount : customAmount
    const bdagAmount = totalAmount / BDAG_USD_PRICE
    const bdagTipAmount = tipAmount > 0 ? tipAmount / BDAG_USD_PRICE : 0
    const isSoldOut = remainingCopies !== null && remainingCopies !== undefined && remainingCopies <= 0
    const maxQuantity = remainingCopies !== null && remainingCopies !== undefined ? remainingCopies : 10

    return {
      hasNftPrice,
      pricePerNft: pricePerNft || null,
      nftSubtotal,
      totalAmount,
      bdagAmount,
      bdagTipAmount,
      isSoldOut,
      maxQuantity
    }
  }, [pricePerNft, quantity, tipAmount, customAmount, remainingCopies])
}

export function usdToBdag(usd: number): number {
  return usd / BDAG_USD_PRICE
}

export function bdagToUsd(bdag: number): number {
  return bdag * BDAG_USD_PRICE
}

export { BDAG_USD_PRICE }
