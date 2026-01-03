/**
 * CoinGecko Price Provider
 * 
 * Free tier: 10-50 calls/min
 * Pro tier: Higher limits with API key
 */

import { PriceData, PriceSource, COINGECKO_IDS } from './types'
import { logger } from '@/lib/logger'

const COINGECKO_API = 'https://api.coingecko.com/api/v3'
const COINGECKO_PRO_API = 'https://pro-api.coingecko.com/api/v3'

interface CoinGeckoResponse {
  [coinId: string]: {
    usd: number
    usd_24h_change?: number
    last_updated_at?: number
  }
}

/**
 * Fetch prices from CoinGecko for multiple currencies
 */
export async function fetchCoinGeckoPrices(symbols: string[]): Promise<Map<string, PriceData>> {
  const results = new Map<string, PriceData>()
  
  // Filter to only symbols we have CoinGecko IDs for
  const validSymbols = symbols.filter(s => COINGECKO_IDS[s])
  if (validSymbols.length === 0) {
    return results
  }
  
  // Build CoinGecko IDs list
  const coinIds = validSymbols.map(s => COINGECKO_IDS[s]).join(',')
  
  // Use Pro API if key is available
  const apiKey = process.env.COINGECKO_API_KEY
  const baseUrl = apiKey ? COINGECKO_PRO_API : COINGECKO_API
  const headers: HeadersInit = {
    'Accept': 'application/json',
  }
  if (apiKey) {
    headers['x-cg-pro-api-key'] = apiKey
  }
  
  const url = `${baseUrl}/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`
  
  try {
    const response = await fetch(url, {
      headers,
      next: { revalidate: 30 }, // Next.js cache for 30 seconds
    })
    
    if (!response.ok) {
      if (response.status === 429) {
        logger.api('[CoinGecko] Rate limited')
        throw { code: 'RATE_LIMITED', source: 'coingecko' as PriceSource, message: 'Rate limited' }
      }
      throw { code: 'FETCH_FAILED', source: 'coingecko' as PriceSource, message: `HTTP ${response.status}` }
    }
    
    const data: CoinGeckoResponse = await response.json()
    
    // Map back to our symbols
    for (const symbol of validSymbols) {
      const coinId = COINGECKO_IDS[symbol]
      const coinData = data[coinId]
      
      if (coinData && typeof coinData.usd === 'number') {
        results.set(symbol, {
          symbol,
          priceUsd: coinData.usd,
          change24h: coinData.usd_24h_change,
          lastUpdated: coinData.last_updated_at ? coinData.last_updated_at * 1000 : Date.now(),
          source: 'coingecko',
          confidence: 0.95, // High confidence from major exchange aggregator
        })
      }
    }
    
    logger.debug(`[CoinGecko] Fetched ${results.size} prices: ${[...results.keys()].join(', ')}`)
    
  } catch (error: any) {
    if (error.code) {
      throw error // Re-throw our structured errors
    }
    logger.api(`[CoinGecko] Fetch error: ${error.message}`)
    throw { code: 'FETCH_FAILED', source: 'coingecko' as PriceSource, message: error.message }
  }
  
  return results
}

/**
 * Fetch single price from CoinGecko
 */
export async function fetchCoinGeckoPrice(symbol: string): Promise<PriceData | null> {
  const prices = await fetchCoinGeckoPrices([symbol])
  return prices.get(symbol) || null
}
