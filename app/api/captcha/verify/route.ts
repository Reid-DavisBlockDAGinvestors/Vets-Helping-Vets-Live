import { NextRequest, NextResponse } from 'next/server'
import { createCaptchaVerifier, shouldEnforceCaptcha } from '@/lib/captcha/verifier'

export const dynamic = 'force-dynamic'

/**
 * POST /api/captcha/verify
 * Verifies a CAPTCHA token
 */
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'CAPTCHA token required' },
        { status: 400 }
      )
    }

    // Skip verification if not enforced
    if (!shouldEnforceCaptcha()) {
      return NextResponse.json({ success: true, message: 'CAPTCHA not enforced in this environment' })
    }

    const verifier = createCaptchaVerifier()
    const result = await verifier.verify(token)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'CAPTCHA verification failed', codes: result.errorCodes },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Verification failed' },
      { status: 500 }
    )
  }
}
