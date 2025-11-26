import { NextRequest, NextResponse } from 'next/server'

// Venmo payment placeholder
// Body: { amount: number (USD cents), tokenId?: string }
export async function POST(req: NextRequest) {
  try {
    const { amount, tokenId } = await req.json()
    if (!amount || amount <= 0) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
    const fee = Math.round(amount * 0.01)
    const toCreator = amount - fee
    const key = process.env.VENMO_KEY

    // Placeholder: venmo app link
    const deepLink = key
      ? `venmo://paycharge?txn=pay&amount=${(amount/100).toFixed(2)}&note=PatriotPledge%20${tokenId||''}`
      : null

    return NextResponse.json({
      mode: 'venmo',
      deepLink,
      breakdown: { amount, nonprofitFeePct: 1, fee, toCreator },
      notice: 'Placeholder. Implement Venmo API + webhook capture in production.'
    })
  } catch (e:any) {
    console.error('venmo create error', e)
    return NextResponse.json({ error: 'VENMO_CREATE_FAILED' }, { status: 500 })
  }
}
