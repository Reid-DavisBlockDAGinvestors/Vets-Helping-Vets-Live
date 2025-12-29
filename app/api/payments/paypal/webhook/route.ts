import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// PayPal webhook placeholder: capture events and issue receipts/milestones
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    logger.purchase('[webhook:paypal] event', body?.event_type || 'unknown')
    const amount = Number(body?.resource?.amount?.value || 0)
    const donor = body?.resource?.payer?.email_address || 'PayPal User'
    if (amount > 0) {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/receipt/global`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, donorName: donor, txHash: body?.resource?.id || 'paypal' })
      }).catch(()=>{})
    }
    // TODO: trigger milestone releases via oracle
    return NextResponse.json({ received: true })
  } catch (e) {
    console.error('paypal webhook error', e)
    return NextResponse.json({ received: true, error: 'WEBHOOK_ERROR' })
  }
}
