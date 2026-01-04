import './globals.css'
import { ReactNode } from 'react'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import BugReportButton from '@/components/BugReportButton'
import { Toaster } from '@/components/Toaster'
import { ThemeProvider } from '@/components/ThemeProvider'
import ErrorBoundary from '@/components/ErrorBoundary'
import SkipLink from '@/components/SkipLink'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import SessionExpiryWarning from '@/components/SessionExpiryWarning'
import { SKIP_TARGETS } from '@/lib/accessibility'
import { Web3Provider } from '@/lib/web3'

import type { Metadata, Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#1e3a5f',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://patriotpledge.org'),
  title: 'PatriotPledge - Support Veterans & First Responders',
  description: 'The world\'s greatest NFT-powered fundraising platform for veterans and first responders. Make a difference today.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192x192.svg', sizes: '192x192', type: 'image/svg+xml' },
    ],
    apple: '/icons/icon-192x192.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PatriotPledge',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://patriotpledge.org',
    siteName: 'PatriotPledge',
    title: 'PatriotPledge - Support Veterans & First Responders',
    description: 'The world\'s greatest NFT-powered fundraising platform for veterans and first responders.',
    images: [{ url: '/api/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PatriotPledge - Support Veterans',
    description: 'NFT-powered fundraising for those who served.',
    images: ['/api/og'],
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen flex flex-col bg-patriotic-blue dark:bg-patriotic-blue light:bg-gray-50 text-patriotic-white dark:text-patriotic-white light:text-gray-900 transition-colors font-sans">
        <Web3Provider>
          <ThemeProvider>
            <SkipLink />
            <NavBar />
            <main id={SKIP_TARGETS.MAIN_CONTENT} className="flex-1">
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </main>
            <Footer />
            <BugReportButton />
            <Toaster />
            <ServiceWorkerRegistration />
            <SessionExpiryWarning />
          </ThemeProvider>
        </Web3Provider>
      </body>
    </html>
  )
}
