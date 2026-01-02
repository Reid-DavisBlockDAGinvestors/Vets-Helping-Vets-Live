'use client'

import { useState, useCallback } from 'react'
import type { DistributionParams, TipDistributionParams, DistributionResult } from '../types'

interface UseDistributionActionsResult {
  isDistributing: boolean
  error: string | null
  lastResult: DistributionResult | null
  distributeFunds: (params: DistributionParams) => Promise<DistributionResult>
  distributeTips: (params: TipDistributionParams) => Promise<DistributionResult>
  clearError: () => void
}

/**
 * Hook for executing fund and tip distributions
 * Single responsibility: Execute distribution actions via API
 */
export function useDistributionActions(): UseDistributionActionsResult {
  const [isDistributing, setIsDistributing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<DistributionResult | null>(null)

  const distributeFunds = useCallback(async (params: DistributionParams): Promise<DistributionResult> => {
    setIsDistributing(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/distributions/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'funds',
          campaignId: params.campaignId,
          amount: params.amount,
          recipient: params.recipient
        })
      })

      const data = await response.json()

      if (!response.ok) {
        const result: DistributionResult = {
          success: false,
          error: data.error || 'Distribution failed'
        }
        setError(result.error || null)
        setLastResult(result)
        return result
      }

      const result: DistributionResult = {
        success: true,
        distributionId: data.distributionId,
        txHash: data.txHash
      }
      setLastResult(result)
      return result

    } catch (err) {
      const result: DistributionResult = {
        success: false,
        error: err instanceof Error ? err.message : 'Distribution failed'
      }
      setError(result.error || null)
      setLastResult(result)
      return result
    } finally {
      setIsDistributing(false)
    }
  }, [])

  const distributeTips = useCallback(async (params: TipDistributionParams): Promise<DistributionResult> => {
    setIsDistributing(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/distributions/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'tips',
          campaignId: params.campaignId,
          tipSplit: params.tipSplit
        })
      })

      const data = await response.json()

      if (!response.ok) {
        const result: DistributionResult = {
          success: false,
          error: data.error || 'Tip distribution failed'
        }
        setError(result.error || null)
        setLastResult(result)
        return result
      }

      const result: DistributionResult = {
        success: true,
        distributionId: data.distributionId,
        txHash: data.txHash
      }
      setLastResult(result)
      return result

    } catch (err) {
      const result: DistributionResult = {
        success: false,
        error: err instanceof Error ? err.message : 'Tip distribution failed'
      }
      setError(result.error || null)
      setLastResult(result)
      return result
    } finally {
      setIsDistributing(false)
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    isDistributing,
    error,
    lastResult,
    distributeFunds,
    distributeTips,
    clearError
  }
}

export default useDistributionActions
