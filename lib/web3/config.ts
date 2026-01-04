'use client'

/**
 * Web3 Configuration for PatriotPledge NFTs
 * 
 * Uses @reown/appkit (Web3Modal v4) for universal wallet connection
 * Supports 300+ wallets including MetaMask, Trust Wallet, Coinbase, etc.
 */

// Custom BlockDAG network definition (AppKit format)
export const blockdag = {
  id: 1043,
  name: 'BlockDAG Awakening',
  nativeCurrency: { name: 'BDAG', symbol: 'BDAG', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.awakening.bdagscan.com'] }
  },
  blockExplorers: {
    default: { name: 'BDAGScan', url: 'https://awakening.bdagscan.com' }
  },
  testnet: true
} as const

// WalletConnect Project ID (from existing useWallet.ts)
export const WALLETCONNECT_PROJECT_ID = 'a86a6a0afc0849fdb0832b5ec288b5a2'

// Chain IDs for easy reference
export const CHAIN_IDS = {
  ETHEREUM: 1,
  SEPOLIA: 11155111,
  BLOCKDAG: 1043,
} as const

// Metadata for wallet display
export const appMetadata = {
  name: 'PatriotPledge NFTs',
  description: 'Support veterans through blockchain-powered fundraising',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://patriotpledgenfts.netlify.app',
  icons: ['https://patriotpledgenfts.netlify.app/favicon.ico']
}

// RPC URLs for each chain
export const rpcUrls = {
  [CHAIN_IDS.ETHEREUM]: 'https://eth.llamarpc.com',
  [CHAIN_IDS.SEPOLIA]: 'https://ethereum-sepolia-rpc.publicnode.com',
  [CHAIN_IDS.BLOCKDAG]: 'https://rpc.awakening.bdagscan.com',
}
