import { NextRequest, NextResponse } from 'next/server'
import { verifyCaptcha } from '@/lib/captcha'
import { getContract, getRelayerSigner } from '@/lib/onchain'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const ctype = req.headers.get('content-type') || ''
    if (!/application\/json/i.test(ctype)) {
      return NextResponse.json({ error: 'UNSUPPORTED_CONTENT_TYPE' }, { status: 415 })
    }
    const body = await req.json()
    const token = body?.captchaToken || req.headers.get('x-captcha-token') || undefined
    const ver = await verifyCaptcha({ token })
    if (!ver.ok) return NextResponse.json({ error: 'CAPTCHA_FAILED' }, { status: 400 })

    const size = Number(body?.size)
    const priceWei = BigInt(body?.priceWei || 0)
    const goalWei = BigInt(body?.goalWei || 0)
    const creator = String(body?.creator || '')
    const baseURI = String(body?.baseURI || '')
    const cat = String(body?.category || body?.cat || 'general')
    if (!size || size <= 0) return NextResponse.json({ error: 'INVALID_SIZE' }, { status: 400 })
    if (!priceWei || priceWei <= 0n) return NextResponse.json({ error: 'INVALID_PRICE' }, { status: 400 })
    if (!creator) return NextResponse.json({ error: 'MISSING_CREATOR' }, { status: 400 })
    if (!baseURI) return NextResponse.json({ error: 'MISSING_BASE_URI' }, { status: 400 })

    const signer = getRelayerSigner()
    const contract = getContract(signer)

    const perTokenGoal = goalWei && size > 0 ? goalWei / BigInt(size) : 0n
    const base = baseURI.replace(/\/$/, '')
    const hashes: string[] = []

    for (let i = 0; i < size; i++) {
      const uri = `${base}/${i}`
      const tx = await contract.mint(creator, uri, cat, perTokenGoal)
      const rcpt = await tx.wait()
      hashes.push(rcpt?.hash || tx.hash)
    }

    return NextResponse.json({ status: 'MINT_SERIES_SUBMITTED', txHashes: hashes })
  } catch (e: any) {
    logger.error('[mint] Error:', e)
    const details = process.env.NODE_ENV === 'production' ? undefined : (e?.message || String(e))
    return NextResponse.json({ error: 'MINT_FAILED', details }, { status: 500 })
  }
}
