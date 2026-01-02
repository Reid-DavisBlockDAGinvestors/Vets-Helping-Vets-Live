/**
 * Service Worker for PatriotPledge PWA
 * 
 * Offline support and caching strategy
 * Psychology: Reliability builds trust
 * - Users can browse campaigns offline
 * - Fast loading creates positive association
 */

const CACHE_NAME = 'patriotpledge-v1'
const OFFLINE_URL = '/offline'

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/marketplace',
  '/offline',
  '/manifest.json',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg',
]

// Install event - precache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching critical assets')
      return cache.addAll(PRECACHE_ASSETS)
    })
  )
  // Activate immediately
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name)
            return caches.delete(name)
          })
      )
    })
  )
  // Take control immediately
  self.clients.claim()
})

// Fetch event - network-first with cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip API requests (always fetch fresh)
  if (url.pathname.startsWith('/api/')) return

  // Skip external requests
  if (url.origin !== self.location.origin) return

  event.respondWith(
    (async () => {
      try {
        // Try network first
        const networkResponse = await fetch(request)
        
        // Cache successful responses
        if (networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME)
          cache.put(request, networkResponse.clone())
        }
        
        return networkResponse
      } catch (error) {
        // Network failed, try cache
        const cachedResponse = await caches.match(request)
        
        if (cachedResponse) {
          console.log('[SW] Serving from cache:', request.url)
          return cachedResponse
        }

        // If it's a navigation request, show offline page
        if (request.mode === 'navigate') {
          const offlineResponse = await caches.match(OFFLINE_URL)
          if (offlineResponse) {
            return offlineResponse
          }
        }

        throw error
      }
    })()
  )
})

// Background sync for donations (when back online)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-donations') {
    event.waitUntil(syncPendingDonations())
  }
})

async function syncPendingDonations() {
  // Get pending donations from IndexedDB and sync
  console.log('[SW] Syncing pending donations')
}

// Push notifications for campaign updates
self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  
  const options = {
    body: data.body || 'New update from PatriotPledge',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'PatriotPledge', options)
  )
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') return

  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  )
})
