'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { BrowserProvider, formatEther } from 'ethers'
import EthereumProvider from '@walletconnect/ethereum-provider'

type WalletState = {
  address: string | null
  chainId: number | null
  balance: string | null
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  connectionType: 'injected' | 'walletconnect' | null
}

const BLOCKDAG_CHAIN_ID = 1043 // BlockDAG Awakening Testnet
const SEPOLIA_CHAIN_ID = 11155111 // Ethereum Sepolia Testnet

const CHAIN_CONFIGS: Record<number, {
  chainId: string
  chainName: string
  nativeCurrency: { name: string; symbol: string; decimals: number }
  rpcUrls: string[]
  blockExplorerUrls: string[]
}> = {
  [BLOCKDAG_CHAIN_ID]: {
    chainId: '0x413', // 1043 in hex
    chainName: 'BlockDAG Awakening Testnet',
    nativeCurrency: { name: 'BDAG', symbol: 'BDAG', decimals: 18 },
    rpcUrls: ['https://rpc.awakening.bdagscan.com'],
    blockExplorerUrls: ['https://awakening.bdagscan.com'],
  },
  [SEPOLIA_CHAIN_ID]: {
    chainId: '0xaa36a7', // 11155111 in hex
    chainName: 'Sepolia Testnet',
    nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  },
}

// Legacy alias
const BLOCKDAG_CHAIN_CONFIG = CHAIN_CONFIGS[BLOCKDAG_CHAIN_ID]

const WALLETCONNECT_PROJECT_ID = 'a86a6a0afc0849fdb0832b5ec288b5a2'
const DISCONNECTED_KEY = 'wallet_user_disconnected'

// MetaMask deep link helper - opens the current page in MetaMask's browser
// Uses native URL scheme which is more reliable than universal links
const openInMetaMaskBrowser = () => {
  if (typeof window === 'undefined') return
  const dappUrl = window.location.href.replace(/^https?:\/\//, '')
  
  // Try native URL scheme first (more reliable when MetaMask is installed)
  // Format: metamask://dapp/domain.com/path
  window.location.href = `metamask://dapp/${dappUrl}`
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    chainId: null,
    balance: null,
    isConnected: false,
    isConnecting: false,
    error: null,
    connectionType: null,
  })
  
  const wcProviderRef = useRef<EthereumProvider | null>(null)

  const getProvider = useCallback(() => {
    if (typeof window === 'undefined') return null
    
    // Use WalletConnect provider if available
    if (wcProviderRef.current) {
      return new BrowserProvider(wcProviderRef.current)
    }
    
    // Otherwise use injected provider
    const ethereum = (window as any).ethereum
    if (!ethereum) return null
    return new BrowserProvider(ethereum)
  }, [])

  const updateBalance = useCallback(async (address: string) => {
    const provider = getProvider()
    if (!provider) return
    try {
      const balance = await provider.getBalance(address)
      setState(prev => ({ ...prev, balance: formatEther(balance) }))
    } catch (e) {
      console.error('Failed to get balance:', e)
    }
  }, [getProvider])

  const connect = useCallback(async () => {
    const ethereum = (window as any).ethereum
    if (!ethereum) {
      setState(prev => ({ ...prev, error: 'No wallet found. Please install MetaMask.' }))
      return
    }

    // Clear disconnected flag when user explicitly connects
    if (typeof window !== 'undefined') {
      localStorage.removeItem(DISCONNECTED_KEY)
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }))

    try {
      // Request accounts
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
      const address = accounts[0]
      
      // Get chain ID
      const chainIdHex = await ethereum.request({ method: 'eth_chainId' })
      const chainId = parseInt(chainIdHex, 16)
      
      // Try to switch to BlockDAG if not already on it
      if (chainId !== BLOCKDAG_CHAIN_ID) {
        try {
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BLOCKDAG_CHAIN_CONFIG.chainId }],
          })
        } catch (switchError: any) {
          // Chain not added, try to add it
          if (switchError.code === 4902) {
            await ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [BLOCKDAG_CHAIN_CONFIG],
            })
          } else {
            throw switchError
          }
        }
      }

      // Get updated chain ID after switch
      const newChainIdHex = await ethereum.request({ method: 'eth_chainId' })
      const newChainId = parseInt(newChainIdHex, 16)

      setState(prev => ({
        ...prev,
        address,
        chainId: newChainId,
        isConnected: true,
        isConnecting: false,
        error: null,
        connectionType: 'injected',
      }))

      await updateBalance(address)
    } catch (e: any) {
      console.error('Wallet connect error:', e)
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: e?.message || 'Failed to connect wallet',
      }))
    }
  }, [updateBalance])

  // Connect via WalletConnect (for mobile browsers without injected wallet)
  // Uses Ethereum mainnet for initial pairing (MetaMask recognizes it), 
  // then we'll prompt user to add/switch to BlockDAG after connection
  const connectWalletConnect = useCallback(async () => {
    // Clear disconnected flag when user explicitly connects
    if (typeof window !== 'undefined') {
      localStorage.removeItem(DISCONNECTED_KEY)
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }))

    try {
      // Create WalletConnect provider
      // IMPORTANT: Use Ethereum mainnet (1) as required chain since MetaMask
      // doesn't recognize BlockDAG (1043) in WalletConnect pairing
      const provider = await EthereumProvider.init({
        projectId: WALLETCONNECT_PROJECT_ID,
        chains: [1], // Ethereum mainnet for initial pairing (MetaMask recognizes this)
        optionalChains: [BLOCKDAG_CHAIN_ID, 137], // BlockDAG and Polygon as optional
        showQrModal: true,
        metadata: {
          name: 'PatriotPledge NFTs',
          description: 'Support veterans through blockchain-powered fundraising',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://patriotpledgenfts.netlify.app',
          icons: ['https://patriotpledgenfts.netlify.app/favicon.ico'],
        },
        rpcMap: {
          1: 'https://eth.llamarpc.com', // Free Ethereum RPC for pairing
          [BLOCKDAG_CHAIN_ID]: 'https://rpc.awakening.bdagscan.com',
        },
      })

      // Store provider ref
      wcProviderRef.current = provider

      // Connect
      await provider.connect()

      // Get accounts and chain
      const accounts = await provider.request({ method: 'eth_accounts' }) as string[]
      const chainIdHex = await provider.request({ method: 'eth_chainId' }) as string
      const chainId = parseInt(chainIdHex, 16)
      const address = accounts[0]

      setState(prev => ({
        ...prev,
        address,
        chainId,
        isConnected: true,
        isConnecting: false,
        error: null,
        connectionType: 'walletconnect',
      }))

      // Get balance
      const ethersProvider = new BrowserProvider(provider)
      const balance = await ethersProvider.getBalance(address)
      setState(prev => ({ ...prev, balance: formatEther(balance) }))

      // Listen for disconnect
      provider.on('disconnect', () => {
        disconnect()
      })

      provider.on('accountsChanged', (accs: string[]) => {
        if (accs.length === 0) {
          disconnect()
        } else {
          setState(prev => ({ ...prev, address: accs[0] }))
        }
      })

    } catch (e: any) {
      console.error('WalletConnect error:', e)
      wcProviderRef.current = null
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: e?.message || 'Failed to connect via WalletConnect',
      }))
    }
  }, [])

  const disconnect = useCallback(async () => {
    // Set flag to prevent auto-reconnect
    if (typeof window !== 'undefined') {
      localStorage.setItem(DISCONNECTED_KEY, 'true')
    }

    // Disconnect WalletConnect if active
    if (wcProviderRef.current) {
      try {
        await wcProviderRef.current.disconnect()
      } catch (e) {
        console.error('WC disconnect error:', e)
      }
      wcProviderRef.current = null
    }

    // Try to revoke permissions for injected wallets (MetaMask 10.25+)
    const ethereum = (window as any).ethereum
    if (ethereum && ethereum.request) {
      try {
        await ethereum.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }]
        })
      } catch (e) {
        // wallet_revokePermissions not supported by this wallet, that's ok
        console.log('wallet_revokePermissions not supported, clearing local state only')
      }
    }
    
    setState({
      address: null,
      chainId: null,
      balance: null,
      isConnected: false,
      isConnecting: false,
      error: null,
      connectionType: null,
    })
  }, [])

  const switchToChain = useCallback(async (targetChainId: number) => {
    const ethereum = (window as any).ethereum
    if (!ethereum) return

    const chainConfig = CHAIN_CONFIGS[targetChainId]
    if (!chainConfig) {
      console.error(`No config for chain ${targetChainId}`)
      return
    }

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainConfig.chainId }],
      })
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [chainConfig],
        })
      }
    }
  }, [])

  const switchToBlockDAG = useCallback(async () => {
    return switchToChain(BLOCKDAG_CHAIN_ID)
  }, [switchToChain])

  const switchToSepolia = useCallback(async () => {
    return switchToChain(SEPOLIA_CHAIN_ID)
  }, [switchToChain])

  // Listen for account/chain changes
  useEffect(() => {
    const ethereum = (window as any).ethereum
    if (!ethereum) return

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect()
      } else if (state.isConnected) {
        setState(prev => ({ ...prev, address: accounts[0] }))
        updateBalance(accounts[0])
      }
    }

    const handleChainChanged = (chainIdHex: string) => {
      const chainId = parseInt(chainIdHex, 16)
      setState(prev => ({ ...prev, chainId }))
      if (state.address) {
        updateBalance(state.address)
      }
    }

    ethereum.on('accountsChanged', handleAccountsChanged)
    ethereum.on('chainChanged', handleChainChanged)

    return () => {
      ethereum.removeListener('accountsChanged', handleAccountsChanged)
      ethereum.removeListener('chainChanged', handleChainChanged)
    }
  }, [state.isConnected, state.address, disconnect, updateBalance])

  // Check if already connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      // Don't auto-reconnect if user explicitly disconnected
      if (typeof window !== 'undefined' && localStorage.getItem(DISCONNECTED_KEY)) {
        return
      }

      const ethereum = (window as any).ethereum
      if (!ethereum) return

      try {
        const accounts = await ethereum.request({ method: 'eth_accounts' })
        if (accounts.length > 0) {
          const chainIdHex = await ethereum.request({ method: 'eth_chainId' })
          const chainId = parseInt(chainIdHex, 16)
          setState(prev => ({
            ...prev,
            address: accounts[0],
            chainId,
            isConnected: true,
            connectionType: 'injected',
          }))
          await updateBalance(accounts[0])
        }
      } catch (e) {
        console.error('Check connection error:', e)
      }
    }

    checkConnection()
  }, [updateBalance])

  const isOnBlockDAG = state.chainId === BLOCKDAG_CHAIN_ID
  const isOnSepolia = state.chainId === SEPOLIA_CHAIN_ID
  const isOnSupportedChain = isOnBlockDAG || isOnSepolia

  // Detect if we're on mobile
  const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  
  // Check if injected wallet is available
  const hasInjectedWallet = typeof window !== 'undefined' && !!(window as any).ethereum

  // Smart connect - automatically chooses the best method
  // For desktop/mobile with wallet: Uses injected provider
  // For mobile without wallet: Opens MetaMask app directly
  // For desktop without wallet: Shows error with instructions
  const connectAuto = useCallback(async () => {
    // If we have an injected wallet (MetaMask extension or in-app browser), use it
    if (hasInjectedWallet) {
      return connect()
    }
    
    // On mobile without injected wallet, open in MetaMask's browser
    if (isMobile) {
      openInMetaMaskBrowser()
      return
    }
    
    // On desktop without wallet, show error suggesting MetaMask installation
    setState(prev => ({ 
      ...prev, 
      error: 'No wallet detected. Please install MetaMask.' 
    }))
  }, [hasInjectedWallet, isMobile, connect])

  return {
    ...state,
    isOnBlockDAG,
    isOnSepolia,
    isOnSupportedChain,
    isMobile,
    hasInjectedWallet,
    connect,
    connectAuto, // Smart connect that handles mobile automatically
    connectWalletConnect,
    openInMetaMaskBrowser, // Direct deep link to MetaMask app
    disconnect,
    switchToBlockDAG,
    switchToSepolia,
    switchToChain,
    updateBalance: () => state.address && updateBalance(state.address),
    BLOCKDAG_CHAIN_ID,
    SEPOLIA_CHAIN_ID,
  }
}

export type { WalletState }
