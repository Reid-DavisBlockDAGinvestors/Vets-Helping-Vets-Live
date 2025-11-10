import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const amount = Number(body?.amount || 0)
    const tokenId = body?.tokenId || null
    if (!amount || amount <= 0) return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 })

    const fee = +(amount * 0.01).toFixed(2)
    const toCreator = +(amount - fee).toFixed(2)

    // TODO: Execute on-chain split or Stripe flow. For now, mock success.

    // Analytics (best-effort)
    try {
      await supabase.from('events').insert({ type: 'purchase', amount, token_id: tokenId })
    } catch {}

    return NextResponse.json({
      status: 'PURCHASE_REQUEST_ACCEPTED',
      breakdown: {
        amount,
        nonprofitFeePct: 1,
        fee,
        toCreator
      }
    })
  } catch (e: any) {
    console.error('purchase error', e)
    return NextResponse.json({ error: 'PURCHASE_FAILED' }, { status: 500 })
  }
}
