import { Suspense } from 'react'
import VerificationCompleteClient from './VerificationCompleteClient'

export default function VerificationCompletePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-blue-900/20 to-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-white">Loading...</div>
      </div>
    }>
      <VerificationCompleteClient />
    </Suspense>
  )
}

