import { NextRequest, NextResponse } from 'next/server'
import { getAllPrices, getCacheStatus } from '@/lib/prices'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const revalidate = 30 // Revalidate every 30 seconds

/**
 * GET /api/prices/current
 * Returns current prices for all supported currencies
 */
export async function GET(req: NextRequest) {
  try {
    const prices = await getAllPrices()
    
    // Convert Map to object for JSON response
    const pricesObj: Record<string, any> = {}
    for (const [symbol, data] of prices) {
      pricesObj[symbol] = {
        symbol: data.symbol,
        priceUsd: data.priceUsd,
        change24h: data.change24h,
        lastUpdated: data.lastUpdated,
        source: data.source,
      }
    }
    
    // Include cache status for debugging
    const cacheStatus = getCacheStatus()
    
    return NextResponse.json({
      prices: pricesObj,
      timestamp: Date.now(),
      cacheStatus,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    })
  } catch (error: any) {
    logger.api(`[/api/prices/current] Error: ${error.message}`)
    return NextResponse.json(
      { error: 'PRICE_FETCH_FAILED', details: error.message },
      { status: 500 }
    )
  }
}
