'use client'

/**
 * Service Worker Registration Component
 * 
 * Registers PWA service worker and handles updates
 * Psychology: Seamless updates maintain trust
 */

import { useEffect, useState } from 'react'
import { logger } from '@/lib/logger'

export function ServiceWorkerRegistration() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })

        logger.info('[PWA] Service worker registered')

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content available
              setUpdateAvailable(true)
              logger.info('[PWA] Update available')
            }
          })
        })

        // Check for updates periodically
        setInterval(() => {
          registration.update()
        }, 60000) // Check every minute

      } catch (error) {
        logger.error('[PWA] Service worker registration failed:', error)
      }
    }

    registerSW()
  }, [])

  const handleUpdate = () => {
    window.location.reload()
  }

  if (!updateAvailable) return null

  return (
    <div 
      className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50"
      data-testid="sw-update-banner"
    >
      <div className="bg-blue-600 rounded-lg shadow-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">🔄</span>
          <p className="text-white text-sm">
            A new version is available!
          </p>
        </div>
        <button
          onClick={handleUpdate}
          className="px-3 py-1.5 bg-white text-blue-600 font-semibold text-sm rounded-lg hover:bg-blue-50 transition-colors"
        >
          Update
        </button>
      </div>
    </div>
  )
}

export default ServiceWorkerRegistration
