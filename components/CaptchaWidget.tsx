'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
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
 * 
 * IMPORTANT: Only renders ONE widget instance to prevent multiple "Verifying..." loops
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
  const renderAttemptedRef = useRef(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isEnabled, setIsEnabled] = useState(false)

  // Store callbacks in refs to avoid re-renders causing widget recreation
  const onVerifyRef = useRef(onVerify)
  const onExpireRef = useRef(onExpire)
  const onErrorRef = useRef(onError)
  
  // Update refs when callbacks change
  useEffect(() => {
    onVerifyRef.current = onVerify
    onExpireRef.current = onExpire
    onErrorRef.current = onError
  }, [onVerify, onExpire, onError])

  useEffect(() => {
    setIsEnabled(!!SITE_KEY)
  }, [])

  // Render widget ONCE after script loads
  useEffect(() => {
    if (!isLoaded || !containerRef.current || !SITE_KEY) return
    
    // Prevent multiple render attempts
    if (renderAttemptedRef.current || widgetIdRef.current) {
      return
    }
    renderAttemptedRef.current = true

    const renderWidget = () => {
      // Double-check we haven't already rendered
      if (widgetIdRef.current) return
      
      // Clear container first to prevent duplicates
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
      
      if (PROVIDER === 'turnstile' && (window as any).turnstile) {
        widgetIdRef.current = (window as any).turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          theme,
          size,
          callback: (token: string) => onVerifyRef.current(token),
          'expired-callback': () => onExpireRef.current?.(),
          'error-callback': (err: string) => onErrorRef.current?.(err),
        })
      } else if (PROVIDER === 'hcaptcha' && (window as any).hcaptcha) {
        widgetIdRef.current = (window as any).hcaptcha.render(containerRef.current, {
          sitekey: SITE_KEY,
          theme,
          size,
          callback: (token: string) => onVerifyRef.current(token),
          'expired-callback': () => onExpireRef.current?.(),
          'error-callback': (err: string) => onErrorRef.current?.(err),
        })
      }
    }

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(renderWidget, 100)

    return () => {
      clearTimeout(timeoutId)
      // Cleanup widget on unmount
      if (widgetIdRef.current) {
        try {
          if (PROVIDER === 'turnstile' && (window as any).turnstile) {
            (window as any).turnstile.remove(widgetIdRef.current)
          } else if (PROVIDER === 'hcaptcha' && (window as any).hcaptcha) {
            (window as any).hcaptcha.remove(widgetIdRef.current)
          }
        } catch {}
        widgetIdRef.current = null
      }
      renderAttemptedRef.current = false
    }
  }, [isLoaded, theme, size]) // Removed callback dependencies - use refs instead

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
