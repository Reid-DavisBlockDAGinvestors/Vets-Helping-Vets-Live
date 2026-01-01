/**
 * useEthereumChain Hook
 * 
 * React hook for managing Ethereum chain state:
 * - Chain detection and switching
 * - Wallet connection state
 * - Gas price monitoring
 * - Transaction preparation
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { 
  ChainId, 
  CHAIN_CONFIGS, 
  getChainConfig, 
  getActiveChains,
  ChainConfig 
} from '@/lib/chains'
import {
  WalletState,
  connectWallet,
  getWalletState,
  switchChain,
  onChainChange,
  onAccountChange,
  onDisconnect,
  estimateTransactionCost,
  getBrowserProvider,
} from '@/lib/ethereum-provider'

// ============ Types ============

export interface UseEthereumChainState {
  // Wallet state
  wallet: WalletState
  isConnecting: boolean
  
  // Chain state
  currentChain: ChainConfig | null
  supportedChains: ChainConfig[]
  isTestnet: boolean
  
  // Gas state
  gasPrice: number | null
  isGasHigh: boolean
  
  // Loading states
  isSwitching: boolean
  error: string | null
}

export interface UseEthereumChainActions {
  connect: () => Promise<void>
  disconnect: () => void
  switchToChain: (chainId: ChainId) => Promise<boolean>
  refreshGasPrice: () => Promise<void>
  estimateCost: (gasUnits: number) => Promise<{ eth: string; usd: number } | null>
  getSigner: () => Promise<ethers.Signer | null>
}

// ============ Hook ============

export function useEthereumChain(): UseEthereumChainState & UseEthereumChainActions {
  // State
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: null,
    chainId: null,
    isCorrectChain: false,
    balance: BigInt(0),
  })
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const [gasPrice, setGasPrice] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Derived state
  const currentChain = wallet.chainId ? CHAIN_CONFIGS[wallet.chainId] || null : null
  const supportedChains = getActiveChains()
  const isTestnet = currentChain?.isTestnet || false
  const isGasHigh = gasPrice !== null && gasPrice > 50 // Consider > 50 gwei as high
  
  // ============ Actions ============
  
  const connect = useCallback(async () => {
    setIsConnecting(true)
    setError(null)
    
    try {
      const state = await connectWallet()
      setWallet(state)
      
      if (!state.connected) {
        setError('Failed to connect wallet')
      }
    } catch (err: any) {
      setError(err.message || 'Connection failed')
    } finally {
      setIsConnecting(false)
    }
  }, [])
  
  const disconnect = useCallback(() => {
    setWallet({
      connected: false,
      address: null,
      chainId: null,
      isCorrectChain: false,
      balance: BigInt(0),
    })
    setGasPrice(null)
  }, [])
  
  const switchToChain = useCallback(async (chainId: ChainId): Promise<boolean> => {
    setIsSwitching(true)
    setError(null)
    
    try {
      const result = await switchChain(chainId)
      
      if (!result.success) {
        setError(result.error || 'Failed to switch chain')
        return false
      }
      
      // Refresh wallet state after switch
      const state = await getWalletState()
      setWallet(state)
      
      return true
    } catch (err: any) {
      setError(err.message || 'Chain switch failed')
      return false
    } finally {
      setIsSwitching(false)
    }
  }, [])
  
  const refreshGasPrice = useCallback(async () => {
    if (!wallet.chainId) return
    
    try {
      const cost = await estimateTransactionCost(wallet.chainId, 21000)
      setGasPrice(cost.gasPriceGwei)
    } catch (err) {
      console.error('Failed to fetch gas price:', err)
    }
  }, [wallet.chainId])
  
  const estimateCost = useCallback(async (gasUnits: number) => {
    if (!wallet.chainId) return null
    
    try {
      const cost = await estimateTransactionCost(wallet.chainId, gasUnits)
      return {
        eth: cost.estimatedCostFormatted,
        usd: cost.estimatedCostUsd,
      }
    } catch {
      return null
    }
  }, [wallet.chainId])
  
  const getSigner = useCallback(async (): Promise<ethers.Signer | null> => {
    const provider = getBrowserProvider()
    if (!provider) return null
    
    try {
      return await provider.getSigner()
    } catch {
      return null
    }
  }, [])
  
  // ============ Effects ============
  
  // Initial wallet state check
  useEffect(() => {
    getWalletState().then(setWallet)
  }, [])
  
  // Subscribe to wallet events
  useEffect(() => {
    const unsubChain = onChainChange(async (chainId) => {
      const state = await getWalletState()
      setWallet(state)
    })
    
    const unsubAccount = onAccountChange(async (accounts) => {
      if (accounts.length === 0) {
        disconnect()
      } else {
        const state = await getWalletState()
        setWallet(state)
      }
    })
    
    const unsubDisconnect = onDisconnect(() => {
      disconnect()
    })
    
    return () => {
      unsubChain()
      unsubAccount()
      unsubDisconnect()
    }
  }, [disconnect])
  
  // Refresh gas price periodically
  useEffect(() => {
    if (!wallet.connected || !wallet.chainId) return
    
    refreshGasPrice()
    const interval = setInterval(refreshGasPrice, 30000) // Every 30 seconds
    
    return () => clearInterval(interval)
  }, [wallet.connected, wallet.chainId, refreshGasPrice])
  
  // ============ Return ============
  
  return {
    // State
    wallet,
    isConnecting,
    currentChain,
    supportedChains,
    isTestnet,
    gasPrice,
    isGasHigh,
    isSwitching,
    error,
    
    // Actions
    connect,
    disconnect,
    switchToChain,
    refreshGasPrice,
    estimateCost,
    getSigner,
  }
}

export default useEthereumChain
