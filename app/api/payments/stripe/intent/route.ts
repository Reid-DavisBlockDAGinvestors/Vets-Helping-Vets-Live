import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'

// Create a one-time PaymentIntent for fiat donations (USD)
// Body: { amount: number (USD cents), tokenId?: string, customerEmail?: string }
export async function POST(req: NextRequest) {
  try {
    const { amount, tokenId, customerEmail } = await req.json()
    const stripe = getStripe()
    if (!amount || amount <= 0) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })

    const fee = Math.round(amount * 0.01)
    const toCreator = amount - fee

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      receipt_email: customerEmail,
      metadata: {
        tokenId: tokenId || 'n/a',
        type: 'one-time-donation',
        nonprofitFeeCents: String(fee),
        toCreatorCents: String(toCreator),
      },
      automatic_payment_methods: { enabled: true },
    })

    return NextResponse.json({
      id: paymentIntent.id,
      mode: 'payment',
      clientSecret: paymentIntent.client_secret,
      breakdown: { amount, nonprofitFeePct: 1, fee, toCreator }
    })
  } catch (e: any) {
    console.error('stripe intent error', e)
    return NextResponse.json({ error: 'INTENT_FAILED' }, { status: 500 })
  }
}
