/**
 * Price Service
 * 
 * Multi-chain price feed service with caching and fallbacks
 */

import { 
  PriceData, 
  ConversionResult, 
  PriceSource,
  CHAIN_CURRENCIES,
  CURRENCY_DECIMALS,
  FALLBACK_RATES,
  CACHE_TTL,
  COINGECKO_IDS,
} from './types'
import { fetchCoinGeckoPrices } from './coingecko'
import { logger } from '@/lib/logger'

// In-memory cache
interface CacheEntry {
  data: PriceData
  fetchedAt: number
}

const priceCache = new Map<string, CacheEntry>()

/**
 * Get the native currency symbol for a chain
 */
export function getCurrencyForChain(chainId: number): string {
  return CHAIN_CURRENCIES[chainId] || 'ETH'
}

/**
 * Check if a currency has live price feeds available
 */
export function hasLivePriceFeed(symbol: string): boolean {
  return !!COINGECKO_IDS[symbol]
}

/**
 * Get cached price if still valid
 */
function getCachedPrice(symbol: string, maxAge: number = CACHE_TTL.DISPLAY): PriceData | null {
  const cached = priceCache.get(symbol)
  if (cached && (Date.now() - cached.fetchedAt) < maxAge) {
    return cached.data
  }
  return null
}

/**
 * Set cached price
 */
function setCachedPrice(symbol: string, data: PriceData): void {
  priceCache.set(symbol, {
    data,
    fetchedAt: Date.now(),
  })
}

/**
 * Get fallback price from environment variables
 */
function getFallbackPrice(symbol: string): PriceData {
  const rate = FALLBACK_RATES[symbol]
  if (!rate) {
    logger.api(`[PriceService] No fallback rate for ${symbol}, using 1.0`)
  }
  
  return {
    symbol,
    priceUsd: rate || 1.0,
    lastUpdated: Date.now(),
    source: 'fallback',
    confidence: 0.5, // Low confidence for fallback
  }
}

/**
 * Fetch price for a single currency
 * Uses cache, then live feed, then fallback
 */
export async function getPrice(
  symbol: string, 
  maxCacheAge: number = CACHE_TTL.DISPLAY
): Promise<PriceData> {
  // Check cache first
  const cached = getCachedPrice(symbol, maxCacheAge)
  if (cached) {
    logger.debug(`[PriceService] Cache hit for ${symbol}: $${cached.priceUsd}`)
    return cached
  }
  
  // Try live feed if available
  if (hasLivePriceFeed(symbol)) {
    try {
      const prices = await fetchCoinGeckoPrices([symbol])
      const price = prices.get(symbol)
      if (price) {
        setCachedPrice(symbol, price)
        logger.debug(`[PriceService] Live price for ${symbol}: $${price.priceUsd}`)
        return price
      }
    } catch (error: any) {
      logger.api(`[PriceService] Live feed failed for ${symbol}: ${error.message}`)
    }
  }
  
  // Fall back to env var rate
  const fallback = getFallbackPrice(symbol)
  logger.debug(`[PriceService] Using fallback for ${symbol}: $${fallback.priceUsd}`)
  return fallback
}

/**
 * Fetch prices for multiple currencies at once
 */
export async function getPrices(
  symbols: string[],
  maxCacheAge: number = CACHE_TTL.DISPLAY
): Promise<Map<string, PriceData>> {
  const results = new Map<string, PriceData>()
  const toFetch: string[] = []
  
  // Check cache first
  for (const symbol of symbols) {
    const cached = getCachedPrice(symbol, maxCacheAge)
    if (cached) {
      results.set(symbol, cached)
    } else if (hasLivePriceFeed(symbol)) {
      toFetch.push(symbol)
    } else {
      results.set(symbol, getFallbackPrice(symbol))
    }
  }
  
  // Fetch missing prices
  if (toFetch.length > 0) {
    try {
      const fetched = await fetchCoinGeckoPrices(toFetch)
      for (const [symbol, price] of fetched) {
        setCachedPrice(symbol, price)
        results.set(symbol, price)
      }
      
      // Add fallback for any that failed
      for (const symbol of toFetch) {
        if (!results.has(symbol)) {
          results.set(symbol, getFallbackPrice(symbol))
        }
      }
    } catch (error: any) {
      logger.api(`[PriceService] Batch fetch failed: ${error.message}`)
      // Use fallbacks for all
      for (const symbol of toFetch) {
        results.set(symbol, getFallbackPrice(symbol))
      }
    }
  }
  
  return results
}

/**
 * Convert USD to native currency amount
 * This is the main function used by purchase flows
 */
export async function convertUsdToNative(
  usdAmount: number,
  chainId: number,
  maxCacheAge: number = CACHE_TTL.PURCHASE
): Promise<ConversionResult> {
  const symbol = getCurrencyForChain(chainId)
  const price = await getPrice(symbol, maxCacheAge)
  
  // Calculate native amount
  const nativeAmount = usdAmount / price.priceUsd
  
  // Convert to smallest unit (wei/lamports/satoshi)
  const decimals = CURRENCY_DECIMALS[symbol] || 18
  const amountWei = BigInt(Math.floor(nativeAmount * Math.pow(10, decimals))).toString()
  
  return {
    fromUsd: usdAmount,
    toCurrency: symbol,
    amount: nativeAmount.toFixed(decimals > 8 ? 8 : decimals),
    amountWei,
    rate: price.priceUsd,
    source: price.source,
    timestamp: Date.now(),
  }
}

/**
 * Get price for a specific chain's native currency
 */
export async function getPriceForChain(
  chainId: number,
  maxCacheAge: number = CACHE_TTL.DISPLAY
): Promise<PriceData> {
  const symbol = getCurrencyForChain(chainId)
  return getPrice(symbol, maxCacheAge)
}

/**
 * Get all supported prices (for admin dashboard)
 */
export async function getAllPrices(): Promise<Map<string, PriceData>> {
  const allSymbols = Object.keys(FALLBACK_RATES)
  return getPrices(allSymbols, CACHE_TTL.ADMIN)
}

/**
 * Force refresh cache for a symbol
 */
export function invalidateCache(symbol?: string): void {
  if (symbol) {
    priceCache.delete(symbol)
  } else {
    priceCache.clear()
  }
}

/**
 * Get cache status for debugging
 */
export function getCacheStatus(): { symbol: string; age: number; source: PriceSource }[] {
  const now = Date.now()
  return [...priceCache.entries()].map(([symbol, entry]) => ({
    symbol,
    age: Math.round((now - entry.fetchedAt) / 1000),
    source: entry.data.source,
  }))
}

// Re-export types
export * from './types'
