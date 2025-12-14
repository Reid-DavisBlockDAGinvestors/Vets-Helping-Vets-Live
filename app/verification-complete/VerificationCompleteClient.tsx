'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function VerificationCompleteClient() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<string>('loading')
  const [message, setMessage] = useState<string>('')
  
  const sessionId = searchParams.get('verificationSessionId') || searchParams.get('sessionId')
  const statusParam = searchParams.get('status')

  useEffect(() => {
    if (statusParam) {
      // Normalize status from URL
      const normalizedStatus = statusParam.toLowerCase().replace(/\+/g, ' ')
      
      if (normalizedStatus === 'approved' || normalizedStatus === 'verified') {
        setStatus('approved')
        setMessage('Your identity has been verified successfully!')
      } else if (normalizedStatus === 'declined' || normalizedStatus === 'failed') {
        setStatus('declined')
        setMessage('Unfortunately, your verification was not successful. Please contact support if you believe this is an error.')
      } else if (normalizedStatus === 'in review' || normalizedStatus === 'pending review') {
        setStatus('pending')
        setMessage('Your verification is being reviewed. We\'ll notify you once the review is complete.')
      } else if (normalizedStatus === 'expired') {
        setStatus('expired')
        setMessage('Your verification session has expired. Please start a new verification.')
      } else {
        setStatus('pending')
        setMessage('Your verification is in progress. We\'ll notify you of the results.')
      }
    } else {
      setStatus('unknown')
      setMessage('Verification status unknown. Please check your email for updates.')
    }
  }, [statusParam])

  const getStatusIcon = () => {
    switch (status) {
      case 'approved':
        return (
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )
      case 'declined':
        return (
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )
      case 'pending':
        return (
          <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )
      case 'expired':
        return (
          <div className="w-20 h-20 rounded-full bg-gray-500/20 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )
      default:
        return (
          <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center mb-6 animate-pulse">
            <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )
    }
  }

  const getStatusTitle = () => {
    switch (status) {
      case 'approved':
        return 'Verification Complete!'
      case 'declined':
        return 'Verification Unsuccessful'
      case 'pending':
        return 'Verification In Review'
      case 'expired':
        return 'Session Expired'
      case 'loading':
        return 'Processing...'
      default:
        return 'Verification Status'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-blue-900/20 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-8 text-center">
        {getStatusIcon()}
        
        <h1 className="text-2xl font-bold text-white mb-4">
          {getStatusTitle()}
        </h1>
        
        <p className="text-gray-300 mb-6">
          {message}
        </p>
        
        {sessionId && (
          <p className="text-xs text-gray-500 mb-6">
            Session ID: {sessionId}
          </p>
        )}
        
        {/* Primary action: Close this tab and return to original form */}
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 mb-6">
          <p className="text-green-400 font-medium mb-2">✓ You can close this tab</p>
          <p className="text-sm text-gray-400">
            Your verification status has been saved. Return to your original submission tab to continue.
          </p>
        </div>
        
        <div className="space-y-3">
          <button 
            onClick={() => window.close()}
            className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors cursor-pointer"
          >
            Close This Tab
          </button>
          
          <p className="text-xs text-gray-500">
            If the tab doesn't close, simply close it manually and return to your submission.
          </p>
        </div>
        
        {status === 'pending' && (
          <p className="mt-6 text-sm text-gray-400">
            Your verification is being reviewed. You can still submit your campaign - we'll update your verification status automatically.
          </p>
        )}
        
        {status === 'declined' && (
          <p className="mt-6 text-sm text-gray-400">
            Need help? Contact us at{' '}
            <a href="mailto:support@vetshelpingvets.life" className="text-blue-400 hover:underline">
              support@vetshelpingvets.life
            </a>
          </p>
        )}
      </div>
    </div>
  )
}
