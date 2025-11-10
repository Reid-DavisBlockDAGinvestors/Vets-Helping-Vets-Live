import { NextRequest, NextResponse } from 'next/server'
import { verifyCaptcha } from '@/lib/captcha'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const token = body?.captchaToken || req.headers.get('x-captcha-token') || undefined
    const ver = await verifyCaptcha({ token })
    if (!ver.ok) return NextResponse.json({ error: 'CAPTCHA_FAILED' }, { status: 400 })
    console.log('mint request', body)
    // Placeholder: call contract mint on BlockDAG via RPC or have user sign tx client-side
    return NextResponse.json({ status: 'MINT_REQUEST_ACCEPTED' })
  } catch (e: any) {
    console.error('mint error', e)
    return NextResponse.json({ error: 'MINT_FAILED' }, { status: 500 })
  }
}
