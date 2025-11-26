import { NextRequest, NextResponse } from 'next/server'
import { getContract, getRelayerSigner } from '@/lib/onchain'

export async function POST(req: NextRequest) {
  try {
    const ctype = req.headers.get('content-type') || ''
    if (!/application\/json/i.test(ctype)) {
      return NextResponse.json({ error: 'UNSUPPORTED_CONTENT_TYPE' }, { status: 415 })
    }
    const body = await req.json().catch(()=>null)
    if (!body) return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })

    const to: string | undefined = body.to || body.toAddress
    const uri: string | undefined = body.uri
    const cat: string = body.category || body.cat || 'general'
    const goalRaw = body.goalWei ?? body.goal ?? 0
    const goalWei = BigInt(goalRaw)
    if (!to) return NextResponse.json({ error: 'MISSING_TO' }, { status: 400 })
    if (!uri) return NextResponse.json({ error: 'MISSING_URI' }, { status: 400 })

    const signer = getRelayerSigner()
    const contract = getContract(signer)
    const tx = await contract.mint(to, uri, cat, goalWei)
    const rcpt = await tx.wait()
    return NextResponse.json({ status: 'MINT_SUBMITTED', txHash: rcpt?.hash || tx.hash })
  } catch (e: any) {
    const details = process.env.NODE_ENV === 'production' ? undefined : (e?.message || String(e))
    return NextResponse.json({ error: 'MINT_SINGLE_FAILED', details }, { status: 500 })
  }
}
