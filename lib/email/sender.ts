/**
 * Email Sender - Core email sending functionality
 */

import { EMAIL_CONFIG } from './config'
import { logger } from '@/lib/logger'
import type { EmailPayload } from './types'

/**
 * Send an email using Resend API
 */
export async function sendEmail(payload: EmailPayload): Promise<{ id?: string; error?: string; skipped?: boolean }> {
  const apiKey = EMAIL_CONFIG.RESEND_API_KEY
  const from = EMAIL_CONFIG.FROM_EMAIL

  logger.api('[mailer] Attempting to send email:', {
    to: payload.to,
    subject: payload.subject,
    from,
    hasApiKey: !!apiKey,
  })

  if (!apiKey) {
    logger.api('[mailer] RESEND_API_KEY not set, skipping email')
    return { skipped: true }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html
      })
    })

    const data = await res.json().catch(() => ({}))
    logger.api('[mailer] Resend API response:', { status: res.status, data })

    if (!res.ok) {
      throw new Error(data?.message || `RESEND_ERROR: ${res.status}`)
    }

    logger.api('[mailer] Email sent successfully, id:', data?.id)
    return { id: data?.id }
  } catch (e) {
    logger.api('[mailer] error sending email:', e)
    return { error: (e as any)?.message || String(e) }
  }
}
