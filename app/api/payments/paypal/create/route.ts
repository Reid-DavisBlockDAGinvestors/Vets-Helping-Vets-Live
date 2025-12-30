import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// PayPal create order placeholder
// Body: { amount: number (USD cents), tokenId?: string, email?: string }
export async function POST(req: NextRequest) {
  try {
    const { amount, tokenId, email } = await req.json()
    if (!amount || amount <= 0) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })

    const fee = Math.round(amount * 0.01)
    const toCreator = amount - fee
    const client = process.env.PAYPAL_CLIENT_ID
    const secret = process.env.PAYPAL_SECRET

    // Placeholder response. In production, use the PayPal REST SDK to create an order and approval URL
    const approvalUrl = client && secret
      ? 'https://www.sandbox.paypal.com/checkoutnow?token=PLACEHOLDER'
      : 'https://www.sandbox.paypal.com/checkoutnow?token=mock'

    return NextResponse.json({
      mode: 'paypal',
      approvalUrl,
      breakdown: { amount, nonprofitFeePct: 1, fee, toCreator },
      notice: 'Placeholder. Implement PayPal REST SDK order creation + webhook capture in production.'
    })
  } catch (e: any) {
    logger.error('[paypal/create] Error:', e)
    return NextResponse.json({ error: 'PAYPAL_CREATE_FAILED' }, { status: 500 })
  }
}
