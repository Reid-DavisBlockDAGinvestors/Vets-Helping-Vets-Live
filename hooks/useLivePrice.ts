/**
 * useLivePrice Hook
 * 
 * Fetches and caches live cryptocurrency prices for purchase calculations
 */

import { useState, useEffect, useCallback } from 'react'

export interface PriceData {
  symbol: string
  priceUsd: number
  change24h?: number
  source: string
  lastUpdated: number
}

export interface ConversionResult {
  fromUsd: number
  toCurrency: string
  amount: string
  amountWei: string
  rate: number
  source: string
  displayAmount: string
  displayRate: string
}

interface UseLivePriceOptions {
  refreshInterval?: number  // ms, default 60000 (1 min)
  enabled?: boolean
}

/**
 * Hook to get live price for a specific chain
 */
export function useLivePrice(chainId: number, options: UseLivePriceOptions = {}) {
  const { refreshInterval = 60000, enabled = true } = options
  
  const [price, setPrice] = useState<PriceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const fetchPrice = useCallback(async () => {
    if (!enabled) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/prices/convert?usd=1&chainId=${chainId}`)
      if (!response.ok) throw new Error('Failed to fetch price')
      
      const data = await response.json()
      setPrice({
        symbol: data.toCurrency,
        priceUsd: data.rate,
        source: data.source,
        lastUpdated: data.timestamp,
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [chainId, enabled])
  
  useEffect(() => {
    fetchPrice()
    
    if (enabled && refreshInterval > 0) {
      const interval = setInterval(fetchPrice, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [fetchPrice, enabled, refreshInterval])
  
  return { price, loading, error, refresh: fetchPrice }
}

/**
 * Hook to convert USD to native currency
 */
export function useConvertPrice(chainId: number) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const convert = useCallback(async (usdAmount: number): Promise<ConversionResult | null> => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/prices/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usdAmount, chainId }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.details || 'Conversion failed')
      }
      
      return await response.json()
    } catch (err: any) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [chainId])
  
  return { convert, loading, error }
}

/**
 * Hook to get all current prices (for admin dashboard)
 */
export function useAllPrices(options: UseLivePriceOptions = {}) {
  const { refreshInterval = 60000, enabled = true } = options
  
  const [prices, setPrices] = useState<Record<string, PriceData>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const fetchPrices = useCallback(async () => {
    if (!enabled) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/prices/current')
      if (!response.ok) throw new Error('Failed to fetch prices')
      
      const data = await response.json()
      setPrices(data.prices)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [enabled])
  
  useEffect(() => {
    fetchPrices()
    
    if (enabled && refreshInterval > 0) {
      const interval = setInterval(fetchPrices, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [fetchPrices, enabled, refreshInterval])
  
  return { prices, loading, error, refresh: fetchPrices }
}

/**
 * Format price for display
 */
export function formatPrice(price: number, symbol: string): string {
  if (price >= 1000) {
    return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  } else if (price >= 1) {
    return `$${price.toFixed(2)}`
  } else {
    return `$${price.toFixed(4)}`
  }
}

/**
 * Format crypto amount for display
 */
export function formatCryptoAmount(amount: string | number, symbol: string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  
  if (num >= 1) {
    return `${num.toFixed(4)} ${symbol}`
  } else if (num >= 0.0001) {
    return `${num.toFixed(6)} ${symbol}`
  } else {
    return `${num.toFixed(8)} ${symbol}`
  }
}
