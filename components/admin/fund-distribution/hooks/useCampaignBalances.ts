'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CampaignBalance, BalanceFilters, NativeCurrency } from '../types'

interface UseCampaignBalancesResult {
  balances: CampaignBalance[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  getBalance: (campaignId: string) => CampaignBalance | undefined
}

/**
 * Hook for fetching and managing campaign fund balances
 * Follows single responsibility - only handles balance data fetching
 */
export function useCampaignBalances(filters?: BalanceFilters): UseCampaignBalancesResult {
  const [balances, setBalances] = useState<CampaignBalance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBalances = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (filters?.chainId) params.set('chainId', filters.chainId.toString())
      if (filters?.isTestnet !== undefined) params.set('isTestnet', filters.isTestnet.toString())
      if (filters?.hasPendingFunds) params.set('hasPendingFunds', 'true')
      if (filters?.hasPendingTips) params.set('hasPendingTips', 'true')

      const response = await fetch(`/api/admin/distributions/balances?${params}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch balances: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Transform API response to CampaignBalance type
      const transformed: CampaignBalance[] = (data.balances || []).map((b: Record<string, unknown>) => ({
        campaignId: b.id as string,
        title: b.title as string,
        status: b.status as string,
        chainId: b.chain_id as number,
        chainName: b.chain_name as string,
        isTestnet: b.is_testnet as boolean,
        contractVersion: b.contract_version as string,
        immediatePayoutEnabled: b.immediate_payout_enabled as boolean,
        submitterWallet: b.creator_wallet as string | null,
        nonprofitWallet: null, // TODO: Add nonprofit wallet to schema
        tipSplitSubmitterPct: (b.tip_split_submitter_pct as number) || 100,
        tipSplitNonprofitPct: (b.tip_split_nonprofit_pct as number) || 0,
        grossRaisedUsd: Number(b.gross_raised_usd) || 0,
        grossRaisedNative: Number(b.gross_raised_native) || 0,
        tipsReceivedUsd: Number(b.tips_received_usd) || 0,
        tipsReceivedNative: Number(b.tips_received_native) || 0,
        totalDistributed: Number(b.total_distributed) || 0,
        tipsDistributed: Number(b.tips_distributed) || 0,
        lastDistributionAt: b.last_distribution_at as string | null,
        pendingDistributionNative: Number(b.pending_distribution_native) || 0,
        pendingTipsNative: Number(b.pending_tips_native) || 0,
        nativeCurrency: (b.native_currency as NativeCurrency) || 'BDAG',
        distributionCount: (b.distribution_count as number) || 0
      }))

      setBalances(transformed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balances')
    } finally {
      setIsLoading(false)
    }
  }, [filters?.chainId, filters?.isTestnet, filters?.hasPendingFunds, filters?.hasPendingTips])

  useEffect(() => {
    fetchBalances()
  }, [fetchBalances])

  const getBalance = useCallback((campaignId: string) => {
    return balances.find(b => b.campaignId === campaignId)
  }, [balances])

  return {
    balances,
    isLoading,
    error,
    refresh: fetchBalances,
    getBalance
  }
}

export default useCampaignBalances
