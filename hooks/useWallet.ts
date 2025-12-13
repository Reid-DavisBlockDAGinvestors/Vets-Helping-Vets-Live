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
const BLOCKDAG_CHAIN_CONFIG = {
  chainId: '0x413', // 1043 in hex
  chainName: 'BlockDAG Awakening Testnet',
  nativeCurrency: {
    name: 'BDAG',
    symbol: 'BDAG',
    decimals: 18,
  },
  rpcUrls: ['https://rpc.awakening.bdagscan.com'],
  blockExplorerUrls: ['https://awakening.bdagscan.com'],
}

const WALLETCONNECT_PROJECT_ID = 'a86a6a0afc0849fdb0832b5ec288b5a2'

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

  // Detect if on mobile
  const isMobile = useCallback(() => {
    if (typeof window === 'undefined') return false
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  }, [])

  // Connect via WalletConnect (for mobile browsers without injected wallet)
  const connectWalletConnect = useCallback(async () => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }))

    try {
      const onMobile = isMobile()
      console.log('[WalletConnect] Starting connection, mobile:', onMobile)

      // Create WalletConnect provider
      const provider = await EthereumProvider.init({
        projectId: WALLETCONNECT_PROJECT_ID,
        chains: [BLOCKDAG_CHAIN_ID],
        optionalChains: [1], // Ethereum mainnet as fallback
        showQrModal: true, // Show modal - it has wallet selection for mobile
        metadata: {
          name: 'PatriotPledge NFTs',
          description: 'Support veterans through blockchain-powered fundraising',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://patriotpledgenfts.netlify.app',
          icons: ['https://patriotpledgenfts.netlify.app/favicon.ico'],
        },
        rpcMap: {
          [BLOCKDAG_CHAIN_ID]: 'https://rpc.awakening.bdagscan.com',
          1: 'https://eth.llamarpc.com',
        },
      })

      // Store provider ref
      wcProviderRef.current = provider

      // Set up event listener for URI
      provider.on('display_uri', (uri: string) => {
        console.log('[WalletConnect] URI generated:', uri.substring(0, 50))
        
        // On mobile, try to open MetaMask with a delay to let modal render first
        if (onMobile) {
          const encodedUri = encodeURIComponent(uri)
          
          // Try multiple approaches with delays
          setTimeout(() => {
            // First try universal link
            const link = document.createElement('a')
            link.href = `https://metamask.app.link/wc?uri=${encodedUri}`
            link.target = '_self'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            console.log('[WalletConnect] Opened MetaMask via universal link')
          }, 1000)
        }
      })

      // Connect - this will trigger the display_uri event
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
  }, [isMobile])

  const disconnect = useCallback(async () => {
    // Disconnect WalletConnect if active
    if (wcProviderRef.current) {
      try {
        await wcProviderRef.current.disconnect()
      } catch (e) {
        console.error('WC disconnect error:', e)
      }
      wcProviderRef.current = null
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

  const switchToBlockDAG = useCallback(async () => {
    const ethereum = (window as any).ethereum
    if (!ethereum) return

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BLOCKDAG_CHAIN_CONFIG.chainId }],
      })
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [BLOCKDAG_CHAIN_CONFIG],
        })
      }
    }
  }, [])

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

  return {
    ...state,
    isOnBlockDAG,
    connect,
    connectWalletConnect,
    disconnect,
    switchToBlockDAG,
    updateBalance: () => state.address && updateBalance(state.address),
    BLOCKDAG_CHAIN_ID,
  }
}

export type { WalletState }
