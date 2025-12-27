/**
 * CAPTCHA Interface - Following Interface Segregation Principle
 * Allows swapping between different CAPTCHA providers (hCaptcha, Turnstile, reCAPTCHA)
 */

export interface ICaptchaVerifier {
  verify(token: string): Promise<CaptchaVerificationResult>
}

export interface CaptchaVerificationResult {
  success: boolean
  errorCodes?: string[]
  hostname?: string
  challenge_ts?: string
}

export interface CaptchaConfig {
  siteKey: string
  secretKey: string
  provider: 'hcaptcha' | 'turnstile' | 'recaptcha'
}

export interface CaptchaWidgetProps {
  siteKey: string
  onVerify: (token: string) => void
  onExpire?: () => void
  onError?: (error: string) => void
  theme?: 'light' | 'dark'
  size?: 'normal' | 'compact' | 'invisible'
}
