import { ICaptchaVerifier, CaptchaVerificationResult, CaptchaConfig } from './types'

/**
 * Turnstile (Cloudflare) CAPTCHA Verifier
 * Free, privacy-focused alternative to reCAPTCHA
 */
export class TurnstileVerifier implements ICaptchaVerifier {
  private secretKey: string
  private verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

  constructor(secretKey: string) {
    this.secretKey = secretKey
  }

  async verify(token: string): Promise<CaptchaVerificationResult> {
    // Allow test tokens in non-production
    if (process.env.NODE_ENV !== 'production' && token.startsWith('test-')) {
      return { success: true, hostname: 'localhost' }
    }

    try {
      const response = await fetch(this.verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: this.secretKey,
          response: token,
        }),
      })

      const result = await response.json()
      return {
        success: result.success,
        errorCodes: result['error-codes'],
        hostname: result.hostname,
        challenge_ts: result.challenge_ts,
      }
    } catch (error) {
      return {
        success: false,
        errorCodes: ['verification-failed'],
      }
    }
  }
}

/**
 * hCaptcha Verifier
 * Privacy-focused CAPTCHA
 */
export class HCaptchaVerifier implements ICaptchaVerifier {
  private secretKey: string
  private verifyUrl = 'https://hcaptcha.com/siteverify'

  constructor(secretKey: string) {
    this.secretKey = secretKey
  }

  async verify(token: string): Promise<CaptchaVerificationResult> {
    if (process.env.NODE_ENV !== 'production' && token.startsWith('test-')) {
      return { success: true, hostname: 'localhost' }
    }

    try {
      const response = await fetch(this.verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: this.secretKey,
          response: token,
        }),
      })

      const result = await response.json()
      return {
        success: result.success,
        errorCodes: result['error-codes'],
        hostname: result.hostname,
        challenge_ts: result.challenge_ts,
      }
    } catch (error) {
      return {
        success: false,
        errorCodes: ['verification-failed'],
      }
    }
  }
}

/**
 * Factory function to create appropriate verifier
 */
export function createCaptchaVerifier(config?: Partial<CaptchaConfig>): ICaptchaVerifier {
  const provider = config?.provider || process.env.CAPTCHA_PROVIDER || 'turnstile'
  const secretKey = config?.secretKey || process.env.CAPTCHA_SECRET_KEY || ''

  switch (provider) {
    case 'hcaptcha':
      return new HCaptchaVerifier(secretKey)
    case 'turnstile':
    default:
      return new TurnstileVerifier(secretKey)
  }
}

/**
 * Check if CAPTCHA is enabled
 */
export function isCaptchaEnabled(): boolean {
  return !!process.env.CAPTCHA_SITE_KEY && !!process.env.CAPTCHA_SECRET_KEY
}

/**
 * Check if CAPTCHA should be enforced (production only by default)
 */
export function shouldEnforceCaptcha(): boolean {
  if (process.env.CAPTCHA_ENFORCE === 'true') return true
  if (process.env.CAPTCHA_ENFORCE === 'false') return false
  return process.env.NODE_ENV === 'production' && isCaptchaEnabled()
}
