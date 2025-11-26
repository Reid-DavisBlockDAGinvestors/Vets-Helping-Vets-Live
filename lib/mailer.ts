type EmailPayload = {
  to: string
  subject: string
  html: string
}

export async function sendEmail(payload: EmailPayload) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.FROM_EMAIL || 'no-reply@patriotpledge.local'
  if (!apiKey) {
    console.log('[mailer] RESEND_API_KEY not set, skipping email', payload)
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
    const data = await res.json().catch(()=>({}))
    if (!res.ok) throw new Error(data?.message || 'RESEND_ERROR')
    return { id: data?.id }
  } catch (e) {
    console.error('[mailer] error', e)
    return { error: (e as any)?.message || String(e) }
  }
}
