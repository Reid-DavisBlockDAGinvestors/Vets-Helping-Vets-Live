import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// Cash App create payment placeholder
// Body: { amount: number (USD cents), tokenId?: string }
export async function POST(req: NextRequest) {
  try {
    const { amount, tokenId } = await req.json()
    if (!amount || amount <= 0) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
    const fee = Math.round(amount * 0.01)
    const toCreator = amount - fee
    const key = process.env.CASHAPP_KEY

    // Placeholder deep link; integrate Square/Cash App APIs in production
    const deepLink = key
      ? `cashapp://pay?amount=${(amount/100).toFixed(2)}&note=PatriotPledge%20${tokenId||''}`
      : null

    return NextResponse.json({
      mode: 'cashapp',
      deepLink,
      breakdown: { amount, nonprofitFeePct: 1, fee, toCreator },
      notice: 'Placeholder. Implement Square/Cash App payment + webhook capture in production.'
    })
  } catch (e:any) {
    logger.error('[cashapp] Create error:', e)
    return NextResponse.json({ error: 'CASHAPP_CREATE_FAILED' }, { status: 500 })
  }
}
