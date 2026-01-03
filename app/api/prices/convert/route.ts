import { NextRequest, NextResponse } from 'next/server'
import { convertUsdToNative, getPrice, getCurrencyForChain } from '@/lib/prices'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/prices/convert
 * Convert USD to native currency for a specific chain
 * 
 * Body: { usdAmount: number, chainId: number }
 * Returns: { amount, amountWei, rate, symbol, source }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { usdAmount, chainId } = body
    
    if (typeof usdAmount !== 'number' || usdAmount <= 0) {
      return NextResponse.json(
        { error: 'INVALID_AMOUNT', details: 'usdAmount must be a positive number' },
        { status: 400 }
      )
    }
    
    if (typeof chainId !== 'number') {
      return NextResponse.json(
        { error: 'INVALID_CHAIN', details: 'chainId must be a number' },
        { status: 400 }
      )
    }
    
    const result = await convertUsdToNative(usdAmount, chainId)
    
    logger.debug(`[/api/prices/convert] $${usdAmount} → ${result.amount} ${result.toCurrency} @ $${result.rate}`)
    
    return NextResponse.json({
      ...result,
      displayAmount: `${result.amount} ${result.toCurrency}`,
      displayRate: `$${result.rate.toLocaleString()} per ${result.toCurrency}`,
    })
  } catch (error: any) {
    logger.api(`[/api/prices/convert] Error: ${error.message}`)
    return NextResponse.json(
      { error: 'CONVERSION_FAILED', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/prices/convert?usd=10&chainId=1
 * Same as POST but via query params
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const usdAmount = parseFloat(url.searchParams.get('usd') || '0')
    const chainId = parseInt(url.searchParams.get('chainId') || '1', 10)
    
    if (isNaN(usdAmount) || usdAmount <= 0) {
      return NextResponse.json(
        { error: 'INVALID_AMOUNT', details: 'usd query param must be a positive number' },
        { status: 400 }
      )
    }
    
    const result = await convertUsdToNative(usdAmount, chainId)
    
    return NextResponse.json({
      ...result,
      displayAmount: `${result.amount} ${result.toCurrency}`,
      displayRate: `$${result.rate.toLocaleString()} per ${result.toCurrency}`,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    })
  } catch (error: any) {
    logger.api(`[/api/prices/convert] GET Error: ${error.message}`)
    return NextResponse.json(
      { error: 'CONVERSION_FAILED', details: error.message },
      { status: 500 }
    )
  }
}
