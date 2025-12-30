'use client'

import { logger } from '@/lib/logger'

import { useState, useEffect, useCallback } from 'react'

interface DiditVerificationProps {
  submissionId?: string  // Optional - can verify before submission exists
  email?: string         // Email as fallback identifier
  phone?: string
  onComplete?: (status: 'completed' | 'failed' | 'cancelled') => void
  onStatusChange?: (status: string) => void
  onSessionCreated?: (sessionId: string) => void  // When Didit session is created
}

type VerificationStatus = 
  | 'not_started' 
  | 'loading' 
  | 'ready' 
  | 'in_progress' 
  | 'completed' 
  | 'failed' 
  | 'needs_review'
  | 'expired'
  | 'error'

export default function DiditVerification({
  submissionId,
  email,
  phone,
  onComplete,
  onStatusChange,
  onSessionCreated,
}: DiditVerificationProps) {
  // Use submissionId if available, otherwise use email as identifier
  const uniqueId = submissionId || email || ''
  const [status, setStatus] = useState<VerificationStatus>('not_started')
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null)
  const [verificationResult, setVerificationResult] = useState<{
    idVerified?: boolean
    livenessPass?: boolean
    faceMatch?: boolean
    verifiedAt?: string
  } | null>(null)

  // Check existing verification status only if we have a submissionId
  // (For new submissions, skip initial check)
  useEffect(() => {
    if (submissionId) {
      checkStatus()
    }
  }, [submissionId])

  // Disable auto-polling - user can manually check status
  // The webhook will update status when verification completes in production
  // useEffect(() => {
  //   if (status !== 'in_progress' || !sessionId) return
  //   const interval = setInterval(() => checkStatus(), 5000)
  //   return () => clearInterval(interval)
  // }, [status, sessionId])

  const checkStatus = async () => {
    logger.debug('[DiditVerification] Checking status...', { uniqueId, submissionId, sessionId })
    
    try {
      // If we have a submissionId, check submission status
      if (submissionId) {
        logger.debug('[DiditVerification] Checking submission:', submissionId)
        const res = await fetch(`/api/submissions/${submissionId}/verification`)
        const data = await res.json().catch(() => ({ success: false, error: 'Invalid response' }))
        logger.debug('[DiditVerification] Submission response:', data)
        
        if (data.success) {
          const diditStatus = data.diditStatus || data.didit_status || data.verification_status
          
          if (diditStatus === 'Approved' || data.verification_status === 'verified') {
            setStatus('completed')
            setVerificationResult({
              idVerified: data.didit_id_verified,
              livenessPass: data.didit_liveness_passed,
              faceMatch: data.didit_face_match,
              verifiedAt: data.didit_verified_at
            })
            onComplete?.('completed')
            onStatusChange?.('completed')
          } else if (diditStatus === 'Declined') {
            setStatus('failed')
            onComplete?.('failed')
            onStatusChange?.('failed')
          } else if (diditStatus === 'Expired') {
            setStatus('expired')
            onStatusChange?.('expired')
          } else if (diditStatus === 'In Progress' || diditStatus === 'Pending Review') {
            setStatus('in_progress')
            onStatusChange?.('in_progress')
          } else if (data.didit_session_id) {
            setSessionId(data.didit_session_id)
            setStatus('ready')
          }
        }
      } else if (sessionId) {
        // If no submissionId but we have a sessionId, check Didit directly
        logger.debug('[DiditVerification] Checking Didit session directly:', sessionId)
        const res = await fetch(`/api/didit/session?sessionId=${sessionId}`)
        logger.debug('[DiditVerification] Didit response status:', res.status)
        const data = await res.json().catch(() => ({ success: false, error: 'Invalid response' }))
        
        logger.debug('[DiditVerification] Full session response:', JSON.stringify(data, null, 2))
        
        if (data.success && data.session) {
          const diditStatus = data.session.status
          logger.debug('[DiditVerification] Didit status:', diditStatus)
          
          // Handle various Didit status values (case-insensitive)
          const normalizedStatus = (diditStatus || '').toLowerCase()
          logger.debug('[DiditVerification] Normalized status:', normalizedStatus)
          
          if (normalizedStatus === 'approved' || normalizedStatus === 'completed' || normalizedStatus === 'verified' || normalizedStatus === 'success') {
            setStatus('completed')
            setVerificationResult({
              idVerified: true,
              livenessPass: true,
              faceMatch: true,
            })
            onComplete?.('completed')
            onStatusChange?.('completed')
          } else if (normalizedStatus === 'declined' || normalizedStatus === 'rejected' || normalizedStatus === 'failed') {
            setStatus('failed')
            onComplete?.('failed')
            onStatusChange?.('failed')
          } else if (normalizedStatus === 'pending review' || normalizedStatus === 'pending_review' || normalizedStatus === 'review') {
            setStatus('needs_review')
            onStatusChange?.('needs_review')
          } else if (normalizedStatus === 'in progress' || normalizedStatus === 'in_progress' || normalizedStatus === 'pending' || normalizedStatus === 'processing') {
            setStatus('in_progress')
            onStatusChange?.('in_progress')
          } else if (normalizedStatus === 'expired') {
            setStatus('expired')
            onStatusChange?.('expired')
          } else {
            // Unknown status - log it
            logger.warn('[DiditVerification] Unknown status:', diditStatus)
          }
        }
      }
    } catch (err) {
      logger.error('[DiditVerification] Check status error:', err)
    }
  }

  const startVerification = async () => {
    if (!uniqueId) {
      setError('Please provide email or complete form first')
      return
    }
    
    setStatus('loading')
    setError(null)

    try {
      const res = await fetch('/api/didit/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: submissionId || undefined,
          email,
          phone,
          // If no submissionId, use email as vendorData
          vendorData: submissionId || email,
        }),
      })

      const data = await res.json().catch(() => ({ error: 'Invalid response from server' }))

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create verification session')
      }

      setSessionId(data.sessionId)
      setVerificationUrl(data.verificationUrl)
      setStatus('ready')
      
      // Notify parent of session creation
      onSessionCreated?.(data.sessionId)

      // Automatically open verification in new tab
      if (data.verificationUrl) {
        window.open(data.verificationUrl, '_blank')
        setStatus('in_progress')
      }
    } catch (err: any) {
      logger.error('[DiditVerification] Start error:', err)
      setError(err?.message || 'Failed to start verification')
      setStatus('error')
    }
  }

  const openVerification = () => {
    if (verificationUrl) {
      window.open(verificationUrl, '_blank')
      setStatus('in_progress')
    }
  }

  const getStatusDisplay = () => {
    switch (status) {
      case 'completed':
        return {
          icon: '✅',
          title: 'Identity Verified',
          subtitle: 'Your identity has been successfully verified',
          color: 'bg-green-500/20 border-green-500/30 text-green-400',
        }
      case 'failed':
        return {
          icon: '❌',
          title: 'Verification Failed',
          subtitle: 'We could not verify your identity. Please try again.',
          color: 'bg-red-500/20 border-red-500/30 text-red-400',
        }
      case 'needs_review':
        return {
          icon: '🔍',
          title: 'Under Review',
          subtitle: 'Your verification is being reviewed by our team',
          color: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
        }
      case 'in_progress':
        return {
          icon: '⏳',
          title: 'Verification In Progress',
          subtitle: 'Complete the verification in the opened tab',
          color: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
        }
      case 'expired':
        return {
          icon: '⏰',
          title: 'Session Expired',
          subtitle: 'Please start a new verification',
          color: 'bg-gray-500/20 border-gray-500/30 text-gray-400',
        }
      case 'loading':
        return {
          icon: '⏳',
          title: 'Starting Verification',
          subtitle: 'Please wait...',
          color: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
        }
      case 'error':
        return {
          icon: '⚠️',
          title: 'Error',
          subtitle: error || 'Something went wrong',
          color: 'bg-red-500/20 border-red-500/30 text-red-400',
        }
      default:
        return {
          icon: '🔐',
          title: 'Identity Verification Required',
          subtitle: 'Verify your identity to continue',
          color: 'bg-white/5 border-white/10 text-white',
        }
    }
  }

  const displayStatus = getStatusDisplay()

  return (
    <div className={`rounded-xl border p-6 ${displayStatus.color}`}>
      <div className="flex items-start gap-4">
        <div className="text-3xl">{displayStatus.icon}</div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{displayStatus.title}</h3>
          <p className="text-sm opacity-80 mt-1">{displayStatus.subtitle}</p>

          {/* Verification Results */}
          {status === 'completed' && verificationResult && (
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className={verificationResult.idVerified ? 'text-green-400' : 'text-gray-400'}>
                  {verificationResult.idVerified ? '✓' : '○'}
                </span>
                <span>ID Document Verified</span>
              </div>
              {verificationResult.livenessPass !== undefined && (
                <div className="flex items-center gap-2">
                  <span className={verificationResult.livenessPass ? 'text-green-400' : 'text-gray-400'}>
                    {verificationResult.livenessPass ? '✓' : '○'}
                  </span>
                  <span>Liveness Check</span>
                </div>
              )}
              {verificationResult.faceMatch !== undefined && (
                <div className="flex items-center gap-2">
                  <span className={verificationResult.faceMatch ? 'text-green-400' : 'text-gray-400'}>
                    {verificationResult.faceMatch ? '✓' : '○'}
                  </span>
                  <span>Face Match</span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-4 flex flex-wrap gap-3">
            {status === 'loading' && (
              <button
                type="button"
                disabled
                className="px-4 py-2 rounded-lg bg-blue-600/50 text-white font-medium"
              >
                Starting...
              </button>
            )}
            {(status === 'not_started' || status === 'expired' || status === 'error' || status === 'failed') && (
              <button
                type="button"
                onClick={startVerification}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
              >
                Start Verification
              </button>
            )}

            {(status === 'ready' || status === 'in_progress') && verificationUrl && (
              <button
                type="button"
                onClick={openVerification}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
              >
                {status === 'ready' ? 'Open Verification' : 'Continue Verification'}
              </button>
            )}
            
            {/* Always show Check Status button when we have a session */}
            {sessionId && status !== 'completed' && status !== 'loading' && (
              <button
                type="button"
                onClick={checkStatus}
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium transition-colors flex items-center gap-2"
              >
                🔄 Check Verification Status
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
