'use client'

import { useState, useEffect, useCallback } from 'react'
import { BrowserProvider, formatEther, parseEther } from 'ethers'

type WalletState = {
  address: string | null
  chainId: number | null
  balance: string | null
  isConnected: boolean
  isConnecting: boolean
  error: string | null
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

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    chainId: null,
    balance: null,
    isConnected: false,
    isConnecting: false,
    error: null,
  })

  const getProvider = useCallback(() => {
    if (typeof window === 'undefined') return null
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

  const disconnect = useCallback(() => {
    setState({
      address: null,
      chainId: null,
      balance: null,
      isConnected: false,
      isConnecting: false,
      error: null,
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
    disconnect,
    switchToBlockDAG,
    updateBalance: () => state.address && updateBalance(state.address),
    BLOCKDAG_CHAIN_ID,
  }
}

export type { WalletState }
