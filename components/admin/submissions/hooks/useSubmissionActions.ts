'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Submission } from '../types'

interface UseSubmissionActionsOptions {
  onSuccess: () => void
}

/**
 * Hook for submission CRUD actions
 */
export function useSubmissionActions({ onSuccess }: UseSubmissionActionsOptions) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const getAuthHeaders = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession()
    const token = session?.session?.access_token
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['authorization'] = `Bearer ${token}`
    return { headers, token }
  }, [])

  const saveEdits = useCallback(async (submission: Submission, benchmarksText: string) => {
    setBusy(true)
    setMessage('')
    try {
      const { id, ...fields } = submission
      const payload: any = { ...fields }
      
      const trimmed = benchmarksText.trim()
      if (trimmed) {
        payload.benchmarks = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      } else {
        payload.benchmarks = null
      }
      
      const { headers } = await getAuthHeaders()
      const res = await fetch(`/api/submissions/${id}`, { 
        method: 'PATCH', 
        headers, 
        body: JSON.stringify(payload) 
      })
      const data = await res.json().catch(() => ({}))
      
      if (!res.ok) {
        setMessage([data?.error, data?.code, data?.details].filter(Boolean).join(' | ') || 'Save failed')
        return false
      }
      
      setMessage('Saved edits')
      onSuccess()
      return true
    } catch (e: any) {
      setMessage(e?.message || 'Save failed')
      return false
    } finally {
      setBusy(false)
    }
  }, [getAuthHeaders, onSuccess])

  const reject = useCallback(async (submission: Submission) => {
    setBusy(true)
    setMessage('')
    try {
      const { headers } = await getAuthHeaders()
      const res = await fetch(`/api/submissions/${submission.id}`, { 
        method: 'PATCH', 
        headers, 
        body: JSON.stringify({ 
          status: 'rejected', 
          reviewer_notes: submission.reviewer_notes || '' 
        }) 
      })
      const data = await res.json().catch(() => ({}))
      
      if (!res.ok) {
        setMessage([data?.error, data?.code, data?.details].filter(Boolean).join(' | ') || 'Reject failed')
        return false
      }
      
      setMessage('Submission rejected')
      onSuccess()
      return true
    } catch (e: any) {
      setMessage(e?.message || 'Reject failed')
      return false
    } finally {
      setBusy(false)
    }
  }, [getAuthHeaders, onSuccess])

  const approveAndMint = useCallback(async (submission: Submission, benchmarksText: string) => {
    setBusy(true)
    setMessage('')
    try {
      const { headers } = await getAuthHeaders()
      
      const trimmedBenchmarks = benchmarksText.trim()
      const benchmarksArray = trimmedBenchmarks
        ? trimmedBenchmarks.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
        : null

      const res = await fetch('/api/submissions/approve', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: submission.id,
          updates: {
            title: submission.title,
            story: submission.story,
            category: submission.category,
            image_uri: submission.image_uri,
            metadata_uri: submission.metadata_uri,
            reviewer_notes: submission.reviewer_notes || '',
            benchmarks: benchmarksArray,
            num_copies: submission.num_copies,
            price_per_copy: submission.price_per_copy,
            goal: submission.goal
          }
        })
      })
      const data = await res.json().catch(() => ({}))
      
      if (!res.ok) {
        const err = String(data?.error || '')
        const details = String(data?.details || '')
        if (err === 'APPROVE_AND_MINT_FAILED' && details.includes('already known')) {
          setMessage('Approve & Mint failed: relayer transaction stuck. Try fresh relayer key.')
        } else {
          setMessage([data?.error, data?.code, data?.details].filter(Boolean).join(' | ') || 'Approve failed')
        }
        return false
      }
      
      const tid = data?.tokenId != null ? ` · tokenId #${data.tokenId}` : ''
      const primaryTx = Array.isArray(data?.txHashes) && data.txHashes.length 
        ? data.txHashes[0] 
        : (data?.txHash || '')
      setMessage('Approved and minted on-chain: ' + (primaryTx || '(tx pending)') + tid)
      onSuccess()
      return true
    } catch (e: any) {
      setMessage(e?.message || 'Approve failed')
      return false
    } finally {
      setBusy(false)
    }
  }, [getAuthHeaders, onSuccess])

  const deleteSubmission = useCallback(async (submission: Submission) => {
    if (!confirm('Delete this submission permanently?')) return false
    
    setBusy(true)
    setMessage('')
    try {
      const { headers, token } = await getAuthHeaders()
      const res = await fetch(`/api/submissions/${submission.id}`, { 
        method: 'DELETE', 
        headers 
      })
      const data = await res.json().catch(() => ({}))
      
      if (!res.ok) {
        setMessage([data?.error, data?.code, data?.details].filter(Boolean).join(' | ') || 'Delete failed')
        return false
      }
      
      // Run cleanup
      try {
        const cleanupHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) cleanupHeaders['authorization'] = `Bearer ${token}`
        const run = await fetch('/api/cleanup/run', { method: 'POST', headers: cleanupHeaders })
        const rj = await run.json().catch(() => ({}))
        if (run.ok) {
          setMessage(`Deleted · Cleanup processed ${rj?.processed || 0}`)
        } else {
          setMessage(`Deleted · Cleanup failed`)
        }
      } catch {
        setMessage('Deleted · Cleanup failed')
      }
      
      onSuccess()
      return true
    } catch (e: any) {
      setMessage(e?.message || 'Delete failed')
      return false
    } finally {
      setBusy(false)
    }
  }, [getAuthHeaders, onSuccess])

  return {
    busy,
    message,
    setMessage,
    saveEdits,
    reject,
    approveAndMint,
    deleteSubmission,
  }
}
