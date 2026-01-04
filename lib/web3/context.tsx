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
import { ReactNode, useState, useEffect } from 'react'
import { 
  blockdag, 
  WALLETCONNECT_PROJECT_ID, 
  appMetadata
} from './config'

// Create ethers adapter (only on client)
let ethersAdapter: EthersAdapter | null = null
let appKitInstance: ReturnType<typeof createAppKit> | null = null

// Initialize AppKit synchronously on client side
function getAppKit() {
  if (typeof window === 'undefined') return null
  
  if (!appKitInstance) {
    ethersAdapter = new EthersAdapter()
    appKitInstance = createAppKit({
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
  }
  
  return appKitInstance
}

// Initialize on module load (client-side only)
if (typeof window !== 'undefined') {
  getAppKit()
}

interface Web3ProviderProps {
  children: ReactNode
}

export function Web3Provider({ children }: Web3ProviderProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Ensure AppKit is initialized on mount
    getAppKit()
    setMounted(true)
  }, [])

  // Don't render children until mounted to prevent SSR mismatch
  if (!mounted) {
    return null
  }

  return <>{children}</>
}
