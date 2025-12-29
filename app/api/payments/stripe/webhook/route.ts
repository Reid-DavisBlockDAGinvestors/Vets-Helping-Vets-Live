import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Stripe webhook for payment events (one-time and subscriptions)
// Set STRIPE_WEBHOOK_SECRET in env.
export async function POST(req: NextRequest) {
  const stripe = getStripe()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'MISSING_WEBHOOK_SECRET' }, { status: 500 })

  const sig = req.headers.get('stripe-signature') || ''
  const buf = Buffer.from(await req.arrayBuffer())

  let event: Stripe.Event

  try {
    event = Stripe.webhooks.constructEvent(buf, sig, secret)
  } catch (err: any) {
    console.error('stripe webhook signature verify failed', err)
    return new NextResponse('Bad signature', { status: 400 })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        logger.purchase('[webhook] one-time success', { id: pi.id, metadata: pi.metadata })
        // TODO: Mark donation paid, trigger milestone release via oracle, enqueue receipt
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/receipt/global`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: (pi.amount || 0) / 100, donorName: pi.receipt_email || 'Donor', txHash: pi.id })
        }).catch(()=>{})
        break
      }
      case 'charge.succeeded': {
        const ch = event.data.object as Stripe.Charge
        logger.purchase('[webhook] charge succeeded', { id: ch.id })
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/receipt/global`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: (ch.amount || 0) / 100, donorName: ch.receipt_email || 'Donor', txHash: ch.id })
        }).catch(()=>{})
        break
      }
      case 'checkout.session.completed': {
        const cs = event.data.object as Stripe.Checkout.Session
        logger.purchase('[webhook] checkout session completed', { id: cs.id, mode: cs.mode })
        const amount = (cs.amount_total || 0) / 100
        const donor = cs.customer_details?.email || 'Customer'
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/receipt/global`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, donorName: donor, txHash: cs.id })
        }).catch(()=>{})
        break
      }
      case 'invoice.paid': {
        const inv = event.data.object as Stripe.Invoice
        logger.purchase('[webhook] subscription paid', { id: inv.id, subscription: inv.subscription })
        // TODO: Use subscription metadata to associate tokenId, release milestone, issue receipt
        const amount = (inv.amount_paid || 0) / 100
        const donor = inv.customer_email || 'Subscriber'
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/receipt/global`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, donorName: donor, txHash: inv.id })
        }).catch(()=>{})
        break
      }
      case 'payment_intent.payment_failed':
      case 'invoice.payment_failed': {
        console.warn('[webhook] payment failed', event.type)
        break
      }
      default:
        // no-op
        break
    }
  } catch (e) {
    console.error('webhook handler error', e)
    return NextResponse.json({ received: true, error: 'HANDLER_ERROR' })
  }

  return NextResponse.json({ received: true })
}

