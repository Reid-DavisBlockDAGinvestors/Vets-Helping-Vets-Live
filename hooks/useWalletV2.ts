'use client'

/**
 * useWalletV2 - Modern Wallet Hook using AppKit (Ethers adapter)
 * 
 * Provides universal wallet connection supporting 300+ wallets:
 * - MetaMask, Trust Wallet, Coinbase Wallet, Rainbow, Phantom (EVM), etc.
 * - WalletConnect QR codes for mobile
 * - Automatic deep linking on mobile devices
 * 
 * This replaces the legacy useWallet.ts hook.
 */

import { useAppKit, useAppKitAccount, useAppKitNetwork, useDisconnect } from '@reown/appkit/react'
import { useCallback, useMemo, useState, useEffect } from 'react'
import { BrowserProvider, formatEther } from 'ethers'
import { CHAIN_IDS } from '@/lib/web3/config'

export function useWalletV2() {
  // AppKit hooks for modal control
  const { open } = useAppKit()
  const { address, isConnected, status } = useAppKitAccount()
  const { chainId } = useAppKitNetwork()
  const { disconnect: appKitDisconnect } = useDisconnect()
  
  // Local state for balance
  const [balance, setBalance] = useState<string | null>(null)

  // Fetch balance when connected
  useEffect(() => {
    const fetchBalance = async () => {
      if (!isConnected || !address) {
        setBalance(null)
        return
      }
      
      try {
        const ethereum = (window as any).ethereum
        if (ethereum) {
          const provider = new BrowserProvider(ethereum)
          const bal = await provider.getBalance(address)
          setBalance(formatEther(bal))
        }
      } catch (e) {
        console.error('Failed to fetch balance:', e)
        setBalance(null)
      }
    }
    
    fetchBalance()
    // Refresh balance every 30 seconds
    const interval = setInterval(fetchBalance, 30000)
    return () => clearInterval(interval)
  }, [isConnected, address, chainId])

  // Derived state
  const isConnecting = status === 'connecting'
  
  // Chain detection - handle both number and string chainId
  const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId
  const isOnBlockDAG = numericChainId === CHAIN_IDS.BLOCKDAG
  const isOnSepolia = numericChainId === CHAIN_IDS.SEPOLIA
  const isOnEthereum = numericChainId === CHAIN_IDS.ETHEREUM
  const isOnSupportedChain = isOnBlockDAG || isOnSepolia || isOnEthereum

  // Mobile detection
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  }, [])

  // Check for injected wallet
  const hasInjectedWallet = useMemo(() => {
    if (typeof window === 'undefined') return false
    return !!(window as any).ethereum
  }, [])

  // Connect - Opens AppKit modal with wallet options
  const connect = useCallback(() => {
    open({ view: 'Connect' })
  }, [open])

  // Connect with auto-detection (alias for connect)
  const connectAuto = useCallback(() => {
    open({ view: 'Connect' })
  }, [open])

  // Open account modal (when connected)
  const openAccountModal = useCallback(() => {
    open({ view: 'Account' })
  }, [open])

  // Open network switcher
  const openNetworkModal = useCallback(() => {
    open({ view: 'Networks' })
  }, [open])

  // Disconnect
  const disconnect = useCallback(() => {
    appKitDisconnect()
  }, [appKitDisconnect])

  // Switch to specific chain using window.ethereum
  const switchToChain = useCallback(async (targetChainId: number) => {
    const ethereum = (window as any).ethereum
    if (!ethereum) return
    
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      })
    } catch (error: any) {
      // Chain not added, try to add it
      if (error.code === 4902 && targetChainId === CHAIN_IDS.BLOCKDAG) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x413',
            chainName: 'BlockDAG Awakening',
            nativeCurrency: { name: 'BDAG', symbol: 'BDAG', decimals: 18 },
            rpcUrls: ['https://rpc.awakening.bdagscan.com'],
            blockExplorerUrls: ['https://awakening.bdagscan.com'],
          }],
        })
      }
    }
  }, [])

  const switchToBlockDAG = useCallback(() => {
    switchToChain(CHAIN_IDS.BLOCKDAG)
  }, [switchToChain])

  const switchToSepolia = useCallback(() => {
    switchToChain(CHAIN_IDS.SEPOLIA)
  }, [switchToChain])

  const switchToEthereum = useCallback(() => {
    switchToChain(CHAIN_IDS.ETHEREUM)
  }, [switchToChain])

  // Refresh balance manually
  const updateBalance = useCallback(async () => {
    if (!isConnected || !address) return
    
    try {
      const ethereum = (window as any).ethereum
      if (ethereum) {
        const provider = new BrowserProvider(ethereum)
        const bal = await provider.getBalance(address)
        setBalance(formatEther(bal))
      }
    } catch (e) {
      console.error('Failed to update balance:', e)
    }
  }, [isConnected, address])

  return {
    // State
    address: address ?? null,
    chainId: numericChainId ?? null,
    balance,
    isConnected,
    isConnecting,
    error: null, // Errors handled by AppKit modal
    connectionType: isConnected ? 'appkit' : null,

    // Chain detection
    isOnBlockDAG,
    isOnSepolia,
    isOnEthereum,
    isOnSupportedChain,

    // Device detection
    isMobile,
    hasInjectedWallet,

    // Actions
    connect,
    connectAuto,
    connectWalletConnect: connect, // All handled by AppKit
    openInMetaMaskBrowser: connect, // AppKit handles deep links
    disconnect,
    openAccountModal,
    openNetworkModal,

    // Chain switching
    switchToBlockDAG,
    switchToSepolia,
    switchToEthereum,
    switchToChain,
    updateBalance,

    // Constants (for backward compatibility)
    BLOCKDAG_CHAIN_ID: CHAIN_IDS.BLOCKDAG,
    SEPOLIA_CHAIN_ID: CHAIN_IDS.SEPOLIA,
    ETHEREUM_CHAIN_ID: CHAIN_IDS.ETHEREUM,
  }
}

// Type for the hook return value
export type WalletV2State = ReturnType<typeof useWalletV2>
