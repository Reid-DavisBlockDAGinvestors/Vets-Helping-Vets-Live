'use client'

/**
 * Web3 Context Provider
 * 
 * Initializes AppKit (Web3Modal) with Ethers adapter
 * Must wrap the entire application in the root layout
 */

import { createAppKit } from '@reown/appkit/react'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { mainnet, sepolia } from '@reown/appkit/networks'
import { ReactNode, useEffect } from 'react'
import { 
  blockdag, 
  WALLETCONNECT_PROJECT_ID, 
  appMetadata
} from './config'

// Create ethers adapter
const ethersAdapter = new EthersAdapter()

// Initialize AppKit (Web3Modal)
// This is done outside the component to avoid re-initialization
let appKitInitialized = false

function initializeAppKit() {
  if (appKitInitialized || typeof window === 'undefined') return
  
  createAppKit({
    adapters: [ethersAdapter],
    networks: [mainnet, sepolia, blockdag],
    defaultNetwork: mainnet,
    projectId: WALLETCONNECT_PROJECT_ID,
    metadata: appMetadata,
    features: {
      analytics: true,
      email: false,
      socials: false,
    },
    themeMode: 'dark',
    themeVariables: {
      '--w3m-accent': '#EF4444', // Patriotic red
      '--w3m-border-radius-master': '8px',
    },
  })
  
  appKitInitialized = true
}

interface Web3ProviderProps {
  children: ReactNode
}

export function Web3Provider({ children }: Web3ProviderProps) {
  // Initialize AppKit on client side
  useEffect(() => {
    initializeAppKit()
  }, [])

  return <>{children}</>
}
