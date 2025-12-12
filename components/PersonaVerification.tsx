'use client'

import { useState, useEffect, useCallback } from 'react'

interface PersonaVerificationProps {
  submissionId?: string  // Optional - can verify before submission
  email?: string
  name?: string
  phone?: string
  onComplete?: (status: 'completed' | 'failed' | 'cancelled') => void
  onStatusChange?: (status: string) => void
  onInquiryCreated?: (inquiryId: string) => void  // Callback when inquiry is created
}

type VerificationStatus = 
  | 'not_started' 
  | 'loading' 
  | 'ready' 
  | 'in_progress' 
  | 'completed' 
  | 'failed' 
  | 'needs_review'
  | 'error'

export default function PersonaVerification({
  submissionId,
  email,
  name,
  phone,
  onComplete,
  onStatusChange,
  onInquiryCreated
}: PersonaVerificationProps) {
  const [status, setStatus] = useState<VerificationStatus>('not_started')
  const [error, setError] = useState<string | null>(null)
  const [inquiryId, setInquiryId] = useState<string | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [verificationResult, setVerificationResult] = useState<{
    faceMatch?: boolean
    docVerified?: boolean
    verifiedAt?: string
  } | null>(null)

  // Check existing verification status (only if we have a submissionId)
  useEffect(() => {
    if (submissionId) {
      checkStatus()
    }
  }, [submissionId])

  const checkStatus = async () => {
    try {
      const res = await fetch(`/api/verification/persona?submissionId=${submissionId}`)
      const data = await res.json()
      
      if (data.success) {
        if (data.personaStatus === 'completed') {
          setStatus('completed')
          setVerificationResult({
            faceMatch: data.faceMatch,
            docVerified: data.docVerified,
            verifiedAt: data.verifiedAt
          })
        } else if (data.personaStatus === 'failed') {
          setStatus('failed')
        } else if (data.personaStatus === 'needs_review') {
          setStatus('needs_review')
        } else if (data.inquiryId) {
          setInquiryId(data.inquiryId)
          setStatus('ready')
        }
        
        onStatusChange?.(data.personaStatus || 'not_started')
      }
    } catch (err) {
      console.error('[PersonaVerification] Check status error:', err)
    }
  }

  const startVerification = async () => {
    setStatus('loading')
    setError(null)

    try {
      const res = await fetch('/api/verification/persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: submissionId || undefined,  // Only include if we have one
          email,
          name,
          phone,
          action: inquiryId ? 'resume' : 'create',
          existingInquiryId: inquiryId || undefined
        })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to start verification')
      }

      setInquiryId(data.inquiryId)
      setSessionToken(data.sessionToken)
      setStatus('ready')

      // Notify parent of inquiry creation
      onInquiryCreated?.(data.inquiryId)

      // Open Persona flow
      openPersonaFlow(data.inquiryId, data.sessionToken)

    } catch (err: any) {
      setError(err.message || 'Failed to start verification')
      setStatus('error')
    }
  }

  const openPersonaFlow = (inquiryIdParam: string, sessionTokenParam: string) => {
    setStatus('in_progress')
    console.log('[PersonaVerification] Opening flow:', { inquiryIdParam, sessionTokenParam, templateId: process.env.NEXT_PUBLIC_PERSONA_TEMPLATE_ID })

    // Check if Persona SDK is already loaded
    // @ts-ignore
    if (window.Persona) {
      console.log('[PersonaVerification] SDK already loaded, creating client')
      createPersonaClient(inquiryIdParam, sessionTokenParam)
      return
    }

    // Load Persona SDK dynamically (latest version)
    const script = document.createElement('script')
    script.src = 'https://cdn.withpersona.com/dist/persona-v5.0.0.js'
    script.async = true
    script.onload = () => {
      console.log('[PersonaVerification] SDK loaded successfully')
      createPersonaClient(inquiryIdParam, sessionTokenParam)
    }
    script.onerror = (e) => {
      console.error('[PersonaVerification] Failed to load SDK:', e)
      setError('Failed to load verification system')
      setStatus('error')
    }
    document.body.appendChild(script)
  }

  const createPersonaClient = (inquiryIdParam: string, sessionTokenParam: string) => {
    try {
      const environment = process.env.NEXT_PUBLIC_PERSONA_ENVIRONMENT || 'sandbox'
      
      console.log('[PersonaVerification] Creating client with:', { inquiryIdParam, sessionTokenParam: sessionTokenParam?.substring(0, 20) + '...', environment })
      
      // When resuming an inquiry, we use inquiryId + sessionToken (NOT templateId)
      // @ts-ignore - Persona SDK adds this to window
      const client = new window.Persona.Client({
        inquiryId: inquiryIdParam,
        sessionToken: sessionTokenParam,
        environment,
        onReady: () => {
          console.log('[PersonaVerification] Client ready, opening...')
          client.open()
        },
        onComplete: ({ inquiryId: completedId, status }: { inquiryId: string, status: string }) => {
          console.log('[PersonaVerification] Complete:', { completedId, status })
          setStatus('completed')
          onComplete?.('completed')
          // Refresh status from server
          if (submissionId) {
            setTimeout(checkStatus, 2000)
          }
        },
        onCancel: ({ inquiryId: cancelledId }: { inquiryId: string }) => {
          console.log('[PersonaVerification] Cancelled:', cancelledId)
          setStatus('ready')
          onComplete?.('cancelled')
        },
        onError: (error: any) => {
          console.error('[PersonaVerification] Client error:', error)
          setError(error?.message || 'Verification error')
          setStatus('error')
          onComplete?.('failed')
        }
      })
    } catch (e: any) {
      console.error('[PersonaVerification] Failed to create client:', e)
      setError(e?.message || 'Failed to initialize verification')
      setStatus('error')
    }
  }

  // Render based on status
  const renderContent = () => {
    switch (status) {
      case 'not_started':
      case 'ready':
        return (
          <div className="text-center py-6">
            <div className="text-5xl mb-4">🔐</div>
            <h4 className="text-lg font-semibold text-white mb-2">
              Verify Your Identity
            </h4>
            <p className="text-sm text-white/60 mb-6 max-w-md mx-auto">
              Complete a quick identity check to build trust with donors. 
              You'll need your government ID and to take a selfie.
            </p>
            <button
              onClick={startVerification}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium transition-all shadow-lg shadow-blue-500/25"
            >
              Start Verification
            </button>
            <p className="mt-4 text-xs text-white/40">
              Powered by Persona • Takes about 2 minutes
            </p>
          </div>
        )

      case 'loading':
        return (
          <div className="text-center py-8">
            <div className="animate-spin text-4xl mb-4">⏳</div>
            <p className="text-white/60">Starting verification...</p>
          </div>
        )

      case 'in_progress':
        return (
          <div className="text-center py-8">
            <div className="animate-pulse text-4xl mb-4">📸</div>
            <p className="text-white/60">Verification in progress...</p>
            <p className="text-xs text-white/40 mt-2">
              Complete the steps in the popup window
            </p>
          </div>
        )

      case 'completed':
        return (
          <div className="text-center py-6">
            <div className="text-5xl mb-4">✅</div>
            <h4 className="text-lg font-semibold text-green-400 mb-2">
              Identity Verified!
            </h4>
            {verificationResult && (
              <div className="text-sm text-white/60 space-y-1">
                {verificationResult.faceMatch && (
                  <p>✓ Face matched to ID</p>
                )}
                {verificationResult.docVerified && (
                  <p>✓ Document verified</p>
                )}
                {verificationResult.verifiedAt && (
                  <p className="text-xs text-white/40 mt-2">
                    Verified on {new Date(verificationResult.verifiedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </div>
        )

      case 'failed':
        return (
          <div className="text-center py-6">
            <div className="text-5xl mb-4">❌</div>
            <h4 className="text-lg font-semibold text-red-400 mb-2">
              Verification Failed
            </h4>
            <p className="text-sm text-white/60 mb-4">
              We couldn't verify your identity. This can happen if photos are unclear.
            </p>
            <button
              onClick={startVerification}
              className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg font-medium transition-all"
            >
              Try Again
            </button>
          </div>
        )

      case 'needs_review':
        return (
          <div className="text-center py-6">
            <div className="text-5xl mb-4">👀</div>
            <h4 className="text-lg font-semibold text-yellow-400 mb-2">
              Under Review
            </h4>
            <p className="text-sm text-white/60">
              Your verification is being reviewed by our team. 
              We'll notify you once complete (usually within 24-48 hours).
            </p>
          </div>
        )

      case 'error':
        return (
          <div className="text-center py-6">
            <div className="text-5xl mb-4">⚠️</div>
            <h4 className="text-lg font-semibold text-red-400 mb-2">
              Something Went Wrong
            </h4>
            <p className="text-sm text-white/60 mb-4">{error}</p>
            <button
              onClick={startVerification}
              className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg font-medium transition-all"
            >
              Try Again
            </button>
          </div>
        )
    }
  }

  return (
    <div className="rounded-xl bg-gradient-to-br from-blue-900/30 to-purple-900/20 border border-blue-500/20 p-6">
      {renderContent()}
    </div>
  )
}
