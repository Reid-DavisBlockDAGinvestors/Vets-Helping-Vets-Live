'use client'

import { useState, useMemo, useCallback } from 'react'
import type { PaymentMethod, CryptoAsset, PurchaseResult, AmountCalculation } from '../types'

const BDAG_USD_PRICE = 0.05 // 1 BDAG = $0.05 USD

interface UsePurchaseStateOptions {
  pricePerNft?: number | null
  remainingCopies?: number | null
}

/**
 * Hook for managing purchase state
 */
export function usePurchaseState({ pricePerNft, remainingCopies }: UsePurchaseStateOptions) {
  // Core state
  const [quantity, setQuantity] = useState(1)
  const [tipAmount, setTipAmount] = useState(0)
  const [customAmount, setCustomAmount] = useState(pricePerNft && pricePerNft > 0 ? pricePerNft : 25)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PurchaseResult | null>(null)

  // Payment method state
  const [activeTab, setActiveTab] = useState<PaymentMethod>('card')
  const [isMonthly, setIsMonthly] = useState(false)
  const [asset, setAsset] = useState<CryptoAsset>('BDAG')

  // Crypto-specific state
  const [cryptoMessage, setCryptoMessage] = useState('')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [maxUsdAllowed, setMaxUsdAllowed] = useState<number | null>(null)

  // Derived values
  const hasNftPrice = pricePerNft && pricePerNft > 0
  const isSoldOut = remainingCopies !== null && remainingCopies !== undefined && remainingCopies <= 0
  const maxQuantity = remainingCopies !== null && remainingCopies !== undefined ? remainingCopies : 10

  // Amount calculations
  const amounts = useMemo<AmountCalculation>(() => {
    const nftSubtotal = hasNftPrice ? pricePerNft * quantity : 0
    const giftAmount = tipAmount // Use tipAmount state but expose as giftAmount
    const totalAmount = hasNftPrice ? nftSubtotal + giftAmount : customAmount
    const bdagAmount = totalAmount / BDAG_USD_PRICE
    const bdagGiftAmount = giftAmount > 0 ? giftAmount / BDAG_USD_PRICE : 0

    return {
      nftSubtotal,
      giftAmount,
      totalAmount,
      bdagAmount,
      bdagGiftAmount,
    }
  }, [hasNftPrice, pricePerNft, quantity, tipAmount, customAmount])

  // Quantity handlers
  const incrementQuantity = useCallback(() => {
    setQuantity(q => Math.min(maxQuantity, q + 1))
  }, [maxQuantity])

  const decrementQuantity = useCallback(() => {
    setQuantity(q => Math.max(1, q - 1))
  }, [])

  const updateQuantity = useCallback((value: number) => {
    setQuantity(Math.min(maxQuantity, Math.max(1, value)))
  }, [maxQuantity])

  // Reset state
  const reset = useCallback(() => {
    setQuantity(1)
    setTipAmount(0)
    setLoading(false)
    setResult(null)
    setCryptoMessage('')
    setTxHash(null)
  }, [])

  return {
    // Core state
    quantity,
    setQuantity: updateQuantity,
    incrementQuantity,
    decrementQuantity,
    tipAmount,
    setTipAmount,
    customAmount,
    setCustomAmount,
    email,
    setEmail,
    loading,
    setLoading,
    result,
    setResult,

    // Payment method state
    activeTab,
    setActiveTab,
    isMonthly,
    setIsMonthly,
    asset,
    setAsset,

    // Crypto state
    cryptoMessage,
    setCryptoMessage,
    txHash,
    setTxHash,
    maxUsdAllowed,
    setMaxUsdAllowed,

    // Derived values
    hasNftPrice,
    isSoldOut,
    maxQuantity,
    amounts,

    // Actions
    reset,
  }
}

export type UsePurchaseStateReturn = ReturnType<typeof usePurchaseState>
