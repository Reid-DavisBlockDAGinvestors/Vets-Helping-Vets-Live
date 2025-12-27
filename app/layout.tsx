import './globals.css'
import { ReactNode } from 'react'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import BugReportButton from '@/components/BugReportButton'
import { Toaster } from '@/components/Toaster'
import { ThemeProvider } from '@/components/ThemeProvider'

export const metadata = {
  title: 'PatriotPledge NFTs',
  description: 'The most advanced NFT-powered fundraising platform in history.'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-patriotic-blue dark:bg-patriotic-blue light:bg-gray-50 text-patriotic-white dark:text-patriotic-white light:text-gray-900 transition-colors">
        <ThemeProvider>
          <NavBar />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
          <BugReportButton />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
