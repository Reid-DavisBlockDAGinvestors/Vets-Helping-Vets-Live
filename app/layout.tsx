import './globals.css'
import { ReactNode } from 'react'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import BugReportButton from '@/components/BugReportButton'
import { Toaster } from '@/components/Toaster'

export const metadata = {
  title: 'PatriotPledge NFTs',
  description: 'The most advanced NFT-powered fundraising platform in history.'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
        <BugReportButton />
        <Toaster />
      </body>
    </html>
  )
}
