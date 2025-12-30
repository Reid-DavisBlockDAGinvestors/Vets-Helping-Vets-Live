import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// Persona KYC start placeholder
// Body: { userId?: string, name?: string, email?: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const apiKey = process.env.PERSONA_API_KEY
    const environment = process.env.PERSONA_ENVIRONMENT || 'sandbox'

    if (!apiKey) {
      logger.debug('[kyc/start] missing PERSONA_API_KEY; returning mock link')
      return NextResponse.json({ link: 'https://withpersona.com/verify?mock=true', environment })
    }

    // Placeholder: return a link to a hosted flow; in production call Persona API to create inquiry
    return NextResponse.json({ link: 'https://withpersona.com/verify', environment })
  } catch (e) {
    logger.error('[kyc/start] Error:', e)
    return NextResponse.json({ error: 'KYC_START_FAILED' }, { status: 500 })
  }
}
