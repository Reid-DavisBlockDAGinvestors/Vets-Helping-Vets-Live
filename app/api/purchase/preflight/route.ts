export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { getUsdPrice as getPrice } from '@/lib/ethers'
import { Wallet, formatUnits } from 'ethers'

export async function POST(req: NextRequest) {
  try {
    const ctype = req.headers.get('content-type') || ''
    if (!/application\/json/i.test(ctype)) {
      return NextResponse.json({ error: 'UNSUPPORTED_CONTENT_TYPE' }, { status: 415 })
    }
    const body = await req.json().catch(() => ({}))
    const asset = String(body?.asset || 'BDAG').toUpperCase()

    if (asset !== 'BDAG' || process.env.BDAG_ENABLE_ONCHAIN !== 'true') {
      return NextResponse.json({ maxUsdAllowed: null, maxAssetAllowed: null })
    }

    const price = getPrice('BDAG')
    if (!price) return NextResponse.json({ error: 'PRICE_UNAVAILABLE' }, { status: 500 })

    const pk = process.env.BDAG_RELAYER_KEY
    const primaryRpc = process.env.BLOCKDAG_RELAYER_RPC || process.env.RELAYER_RPC || process.env.BLOCKDAG_RPC || process.env.BLOCKDAG_RPC_FALLBACK
    const rpc = primaryRpc || process.env.BLOCKDAG_RPC || process.env.BLOCKDAG_RPC_FALLBACK
    if (!pk || !rpc) {
      return NextResponse.json({ maxUsdAllowed: null, maxAssetAllowed: null, notice: 'RELAYER_NOT_CONFIGURED' })
    }

    try {
      const { JsonRpcProvider } = await import('ethers')
      const provider = new JsonRpcProvider(rpc)
      const wallet = new Wallet(pk, provider)
      const bal = await provider.getBalance(wallet.address)
      const maxAssetFloat = parseFloat(formatUnits(bal, 18))
      const maxUsdAllowed = +(maxAssetFloat * price).toFixed(2)
      return NextResponse.json({ maxUsdAllowed, maxAssetAllowed: +maxAssetFloat.toFixed(8) })
    } catch (e) {
      // Be resilient: return a safe default allowing UI to proceed; purchase path has its own failover/mocking
      return NextResponse.json({ maxUsdAllowed: null, maxAssetAllowed: null, notice: 'RPC_UNAVAILABLE' })
    }
  } catch (e: any) {
    // Resilient default: do not block UI due to preflight. Return safe defaults.
    return NextResponse.json({ maxUsdAllowed: null, maxAssetAllowed: null, notice: 'PREFLIGHT_FAILED' })
  }
}
