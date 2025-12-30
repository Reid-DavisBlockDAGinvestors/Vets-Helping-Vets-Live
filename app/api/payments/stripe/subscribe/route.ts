import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { logger } from '@/lib/logger'

// Create a Stripe subscription for recurring donations.
// Body: { amount: number (USD cents), customerEmail: string, tokenId?: string }
// Note: In production, create products/prices or use metered billing. Here we use a dynamic price per subscription via Price API.
export async function POST(req: NextRequest) {
  try {
    const { amount, customerEmail, tokenId } = await req.json()
    const stripe = getStripe()

    if (!amount || amount <= 0 || !customerEmail) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
    }

    // 1% fee logic: display purposes only; settlement handled in webhook/transfer flow.
    const fee = Math.round(amount * 0.01)
    const toCreator = amount - fee

    // Create/upsert customer
    const customers = await stripe.customers.list({ email: customerEmail, limit: 1 })
    const customer = customers.data[0] || await stripe.customers.create({ email: customerEmail })

    // Create a price for the specific amount (USD, recurring monthly)
    const price = await stripe.prices.create({
      currency: 'usd',
      unit_amount: amount,
      recurring: { interval: 'month' },
      product_data: { name: `PatriotPledge Recurring Donation${tokenId ? ` • Token ${tokenId}` : ''}` },
      metadata: { tokenId: tokenId || 'n/a', type: 'recurring-donation', nonprofitFeeCents: String(fee) }
    })

    // Create subscription in incomplete state (requires payment method attach on client)
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: price.id }],
      payment_behavior: 'default_incomplete',
      metadata: { tokenId: tokenId || 'n/a', type: 'recurring-donation' },
      expand: ['latest_invoice.payment_intent']
    })

    return NextResponse.json({
      id: subscription.id,
      mode: 'subscription',
      clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret || null,
      breakdown: { amount, nonprofitFeePct: 1, fee, toCreator }
    })
  } catch (e: any) {
    logger.error('[stripe/subscribe] Error:', e)
    return NextResponse.json({ error: 'SUBSCRIBE_FAILED' }, { status: 500 })
  }
}
