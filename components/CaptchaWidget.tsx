'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'

interface CaptchaWidgetProps {
  onVerify: (token: string) => void
  onExpire?: () => void
  onError?: (error: string) => void
  theme?: 'light' | 'dark'
  size?: 'normal' | 'compact'
}

const SITE_KEY = process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY || ''
const PROVIDER = process.env.NEXT_PUBLIC_CAPTCHA_PROVIDER || 'turnstile'

/**
 * CAPTCHA Widget Component
 * Supports Turnstile (Cloudflare) and hCaptcha
 */
export default function CaptchaWidget({
  onVerify,
  onExpire,
  onError,
  theme = 'dark',
  size = 'normal'
}: CaptchaWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isEnabled, setIsEnabled] = useState(false)

  useEffect(() => {
    setIsEnabled(!!SITE_KEY)
  }, [])

  // Render widget after script loads
  useEffect(() => {
    if (!isLoaded || !containerRef.current || !SITE_KEY) return

    const renderWidget = () => {
      if (PROVIDER === 'turnstile' && (window as any).turnstile) {
        widgetIdRef.current = (window as any).turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          theme,
          size,
          callback: onVerify,
          'expired-callback': onExpire,
          'error-callback': onError,
        })
      } else if (PROVIDER === 'hcaptcha' && (window as any).hcaptcha) {
        widgetIdRef.current = (window as any).hcaptcha.render(containerRef.current, {
          sitekey: SITE_KEY,
          theme,
          size,
          callback: onVerify,
          'expired-callback': onExpire,
          'error-callback': onError,
        })
      }
    }

    // Small delay to ensure DOM is ready
    setTimeout(renderWidget, 100)

    return () => {
      // Cleanup widget on unmount
      if (widgetIdRef.current) {
        try {
          if (PROVIDER === 'turnstile' && (window as any).turnstile) {
            (window as any).turnstile.remove(widgetIdRef.current)
          } else if (PROVIDER === 'hcaptcha' && (window as any).hcaptcha) {
            (window as any).hcaptcha.remove(widgetIdRef.current)
          }
        } catch {}
      }
    }
  }, [isLoaded, onVerify, onExpire, onError, theme, size])

  // Don't render if not enabled
  if (!isEnabled) {
    return null
  }

  const scriptSrc = PROVIDER === 'turnstile'
    ? 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    : 'https://js.hcaptcha.com/1/api.js?render=explicit'

  return (
    <>
      <Script
        src={scriptSrc}
        onLoad={() => setIsLoaded(true)}
        strategy="lazyOnload"
      />
      <div
        ref={containerRef}
        data-testid="captcha-widget"
        className="my-4"
      />
    </>
  )
}

/**
 * Hook to manage CAPTCHA state
 */
export function useCaptcha() {
  const [token, setToken] = useState<string | null>(null)
  const [isVerified, setIsVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleVerify = (newToken: string) => {
    setToken(newToken)
    setIsVerified(true)
    setError(null)
  }

  const handleExpire = () => {
    setToken(null)
    setIsVerified(false)
  }

  const handleError = (err: string) => {
    setError(err)
    setIsVerified(false)
  }

  const reset = () => {
    setToken(null)
    setIsVerified(false)
    setError(null)
  }

  // Check if CAPTCHA is required
  const isRequired = !!process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY

  return {
    token,
    isVerified,
    error,
    isRequired,
    handleVerify,
    handleExpire,
    handleError,
    reset,
  }
}
