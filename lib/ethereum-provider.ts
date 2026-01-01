/**
 * Ethereum Provider Utilities
 * 
 * Multi-chain provider management with:
 * - Chain switching
 * - Network detection
 * - Wallet connection handling
 * - RPC fallback support
 */

import { ethers, BrowserProvider, JsonRpcProvider, Network } from 'ethers'
import { CHAIN_CONFIGS, ChainId, getChainConfig } from './chains'

// ============ Types ============

export interface WalletState {
  connected: boolean
  address: string | null
  chainId: ChainId | null
  isCorrectChain: boolean
  balance: bigint
}

export interface ChainSwitchResult {
  success: boolean
  chainId: ChainId
  error?: string
}

// ============ Provider Factory ============

/**
 * Create a JSON-RPC provider for a specific chain
 */
export function createJsonRpcProvider(chainId: ChainId): JsonRpcProvider {
  const config = getChainConfig(chainId)
  
  // Handle NowNodes API key for BlockDAG
  if (chainId === 1043 && process.env.NOWNODES_API_KEY) {
    return new JsonRpcProvider(config.rpcUrl, {
      chainId: config.chainId,
      name: config.name,
    }, {
      staticNetwork: true,
      batchMaxCount: 1,
    })
  }
  
  return new JsonRpcProvider(config.rpcUrl, {
    chainId: config.chainId,
    name: config.name,
  })
}

/**
 * Get browser provider (MetaMask, etc.)
 */
export function getBrowserProvider(): BrowserProvider | null {
  if (typeof window === 'undefined') return null
  
  const ethereum = (window as any).ethereum
  if (!ethereum) return null
  
  return new BrowserProvider(ethereum)
}

/**
 * Get provider for chain (browser or RPC)
 */
export function getProviderForChain(chainId: ChainId, useBrowser: boolean = false): ethers.Provider {
  if (useBrowser) {
    const browserProvider = getBrowserProvider()
    if (browserProvider) return browserProvider
  }
  
  return createJsonRpcProvider(chainId)
}

// ============ Wallet Connection ============

/**
 * Connect to wallet and get state
 */
export async function connectWallet(): Promise<WalletState> {
  const provider = getBrowserProvider()
  
  if (!provider) {
    return {
      connected: false,
      address: null,
      chainId: null,
      isCorrectChain: false,
      balance: BigInt(0),
    }
  }
  
  try {
    // Request accounts
    await provider.send('eth_requestAccounts', [])
    
    const signer = await provider.getSigner()
    const address = await signer.getAddress()
    const network = await provider.getNetwork()
    const chainId = Number(network.chainId) as ChainId
    const balance = await provider.getBalance(address)
    
    // Check if chain is supported
    const isCorrectChain = Object.keys(CHAIN_CONFIGS).includes(chainId.toString())
    
    return {
      connected: true,
      address,
      chainId,
      isCorrectChain,
      balance,
    }
  } catch (error) {
    console.error('Wallet connection error:', error)
    return {
      connected: false,
      address: null,
      chainId: null,
      isCorrectChain: false,
      balance: BigInt(0),
    }
  }
}

/**
 * Get current wallet state without prompting
 */
export async function getWalletState(): Promise<WalletState> {
  const provider = getBrowserProvider()
  
  if (!provider) {
    return {
      connected: false,
      address: null,
      chainId: null,
      isCorrectChain: false,
      balance: BigInt(0),
    }
  }
  
  try {
    const accounts = await provider.send('eth_accounts', [])
    
    if (!accounts || accounts.length === 0) {
      return {
        connected: false,
        address: null,
        chainId: null,
        isCorrectChain: false,
        balance: BigInt(0),
      }
    }
    
    const address = accounts[0]
    const network = await provider.getNetwork()
    const chainId = Number(network.chainId) as ChainId
    const balance = await provider.getBalance(address)
    const isCorrectChain = Object.keys(CHAIN_CONFIGS).includes(chainId.toString())
    
    return {
      connected: true,
      address,
      chainId,
      isCorrectChain,
      balance,
    }
  } catch {
    return {
      connected: false,
      address: null,
      chainId: null,
      isCorrectChain: false,
      balance: BigInt(0),
    }
  }
}

// ============ Chain Switching ============

/**
 * Switch to a specific chain
 */
export async function switchChain(targetChainId: ChainId): Promise<ChainSwitchResult> {
  const provider = getBrowserProvider()
  
  if (!provider) {
    return {
      success: false,
      chainId: targetChainId,
      error: 'No wallet provider found',
    }
  }
  
  const config = getChainConfig(targetChainId)
  const chainIdHex = `0x${targetChainId.toString(16)}`
  
  try {
    // Try to switch to the chain
    await provider.send('wallet_switchEthereumChain', [{ chainId: chainIdHex }])
    
    return {
      success: true,
      chainId: targetChainId,
    }
  } catch (switchError: any) {
    // Chain not added - try to add it
    if (switchError.code === 4902) {
      try {
        await provider.send('wallet_addEthereumChain', [{
          chainId: chainIdHex,
          chainName: config.name,
          nativeCurrency: config.nativeCurrency,
          rpcUrls: [config.rpcUrl],
          blockExplorerUrls: [config.explorerUrl],
        }])
        
        return {
          success: true,
          chainId: targetChainId,
        }
      } catch (addError: any) {
        return {
          success: false,
          chainId: targetChainId,
          error: addError.message || 'Failed to add chain',
        }
      }
    }
    
    return {
      success: false,
      chainId: targetChainId,
      error: switchError.message || 'Failed to switch chain',
    }
  }
}

/**
 * Add custom chain to wallet
 */
export async function addChainToWallet(chainId: ChainId): Promise<boolean> {
  const provider = getBrowserProvider()
  if (!provider) return false
  
  const config = getChainConfig(chainId)
  const chainIdHex = `0x${chainId.toString(16)}`
  
  try {
    await provider.send('wallet_addEthereumChain', [{
      chainId: chainIdHex,
      chainName: config.name,
      nativeCurrency: config.nativeCurrency,
      rpcUrls: [config.rpcUrl],
      blockExplorerUrls: [config.explorerUrl],
    }])
    return true
  } catch {
    return false
  }
}

// ============ Network Monitoring ============

/**
 * Subscribe to chain changes
 */
export function onChainChange(callback: (chainId: ChainId) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  
  const ethereum = (window as any).ethereum
  if (!ethereum) return () => {}
  
  const handler = (chainIdHex: string) => {
    const chainId = parseInt(chainIdHex, 16) as ChainId
    callback(chainId)
  }
  
  ethereum.on('chainChanged', handler)
  
  // Return cleanup function
  return () => {
    ethereum.removeListener('chainChanged', handler)
  }
}

/**
 * Subscribe to account changes
 */
export function onAccountChange(callback: (accounts: string[]) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  
  const ethereum = (window as any).ethereum
  if (!ethereum) return () => {}
  
  ethereum.on('accountsChanged', callback)
  
  return () => {
    ethereum.removeListener('accountsChanged', callback)
  }
}

/**
 * Subscribe to disconnect
 */
export function onDisconnect(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  
  const ethereum = (window as any).ethereum
  if (!ethereum) return () => {}
  
  ethereum.on('disconnect', callback)
  
  return () => {
    ethereum.removeListener('disconnect', callback)
  }
}

// ============ Gas Estimation ============

/**
 * Estimate transaction cost in native currency and USD
 */
export async function estimateTransactionCost(
  chainId: ChainId,
  gasUnits: number
): Promise<{
  gasPrice: bigint
  gasPriceGwei: number
  estimatedCost: bigint
  estimatedCostFormatted: string
  estimatedCostUsd: number
}> {
  const provider = createJsonRpcProvider(chainId)
  const config = getChainConfig(chainId)
  
  const feeData = await provider.getFeeData()
  const gasPrice = feeData.gasPrice || BigInt(0)
  const gasPriceGwei = Number(ethers.formatUnits(gasPrice, 'gwei'))
  
  const estimatedCost = gasPrice * BigInt(gasUnits)
  const estimatedCostFormatted = `${ethers.formatEther(estimatedCost)} ${config.nativeCurrency.symbol}`
  
  // Rough USD estimates
  const tokenPrices: Record<string, number> = {
    BDAG: 0.05,
    ETH: 2300,
    MATIC: 0.80,
  }
  const tokenPrice = tokenPrices[config.nativeCurrency.symbol] || 1
  const estimatedCostUsd = Number(ethers.formatEther(estimatedCost)) * tokenPrice
  
  return {
    gasPrice,
    gasPriceGwei,
    estimatedCost,
    estimatedCostFormatted,
    estimatedCostUsd,
  }
}

// ============ Default Export ============

export default {
  createJsonRpcProvider,
  getBrowserProvider,
  getProviderForChain,
  connectWallet,
  getWalletState,
  switchChain,
  addChainToWallet,
  onChainChange,
  onAccountChange,
  onDisconnect,
  estimateTransactionCost,
}
