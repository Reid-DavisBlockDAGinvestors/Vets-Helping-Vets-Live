'use client'

import { Toaster as SonnerToaster } from 'sonner'

/**
 * Toast notification provider
 * Add to layout.tsx to enable toast() calls throughout the app
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        className: 'bg-patriotic-navy border border-white/20 text-white',
        style: {
          background: 'rgba(10, 37, 64, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          color: '#ffffff',
        },
      }}
      theme="dark"
      richColors
      closeButton
    />
  )
}

export default Toaster
