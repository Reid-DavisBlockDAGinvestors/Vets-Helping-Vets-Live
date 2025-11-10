// CAPTCHA verification helper supporting Turnstile or hCaptcha (placeholder)
// Send token via header 'x-captcha-token' or body.captchaToken

export async function verifyCaptcha(input?: { token?: string, remoteIp?: string }) {
  const secret = process.env.TURNSTILE_SECRET || process.env.HCAPTCHA_SECRET
  const token = input?.token
  if (!secret) {
    // Not configured; allow in development
    return { ok: true, mode: 'bypass' }
  }
  if (!token) return { ok: false, error: 'NO_TOKEN' }

  try {
    if (process.env.TURNSTILE_SECRET) {
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET, response: token, remoteip: input?.remoteIp })
      })
      const data = await res.json()
      return { ok: !!data.success, provider: 'turnstile', data }
    }
    if (process.env.HCAPTCHA_SECRET) {
      const form = new URLSearchParams()
      form.set('secret', process.env.HCAPTCHA_SECRET)
      form.set('response', token)
      if (input?.remoteIp) form.set('remoteip', input.remoteIp)
      const res = await fetch('https://hcaptcha.com/siteverify', { method: 'POST', body: form as any })
      const data = await res.json()
      return { ok: !!data.success, provider: 'hcaptcha', data }
    }
  } catch (e) {
    console.warn('captcha verify error', e)
  }
  return { ok: false, error: 'VERIFY_FAILED' }
}
