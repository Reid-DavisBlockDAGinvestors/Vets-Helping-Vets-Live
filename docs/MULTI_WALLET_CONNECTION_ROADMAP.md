# Multi-Wallet Connection Roadmap

## 🔴 PRIORITY 2 - HIGH PRIORITY

**Status:** Trust Wallet and other wallets failing to connect

---

## Executive Summary

This roadmap addresses wallet connectivity issues across multiple wallet providers. Currently, MetaMask works but Trust Wallet, Phantom, Base Wallet, and others fail to connect. The goal is to implement a robust multi-wallet solution using industry-standard libraries.

---

## 🔴 CURRENT ISSUES (Jan 3, 2026)

### Trust Wallet Issues
1. **Mobile In-App Browser**: "Failed to connect" error when clicking connect button
2. **Desktop Browser**: Trust Wallet extension not detected
3. **WalletConnect**: QR code scan connects but fails to execute transactions

### Other Wallet Issues
- **Phantom**: Not supported (Solana-first wallet, needs EVM adapter)
- **Base Wallet (Coinbase)**: Partial support via WalletConnect only
- **Rainbow**: Not tested
- **Zerion**: Not tested

### Root Cause Analysis
The current implementation in `hooks/useWallet.ts` has limitations:
1. Direct `window.ethereum` injection only works for MetaMask-like wallets
2. WalletConnect v2 configuration is minimal
3. No wallet discovery/detection for multiple installed wallets
4. No mobile deep linking for Trust Wallet, Phantom, etc.

---

## 🎯 SOLUTION: Implement Web3Modal / AppKit

### Recommended Stack
| Library | Purpose | Why |
|---------|---------|-----|
| **@reown/appkit** (Web3Modal v4) | Universal wallet connection | Industry standard, 300+ wallets |
| **wagmi** | React hooks for Ethereum | Type-safe, caching, auto-refresh |
| **viem** | Low-level Ethereum client | Fast, tree-shakeable, modern |

### Why Web3Modal/AppKit?
1. ✅ **300+ Wallets**: Trust Wallet, Phantom (EVM), Base Wallet, Rainbow, Zerion, etc.
2. ✅ **Mobile Deep Links**: Automatic deep linking to wallet apps
3. ✅ **WalletConnect v2**: Built-in support with QR codes
4. ✅ **Multi-Chain**: Native support for all EVM chains
5. ✅ **Email/Social Login**: Optional Web3Auth integration
6. ✅ **Beautiful UI**: Pre-built modal with customization

---

## 🛠️ IMPLEMENTATION PLAN

### Phase 1: Library Installation & Configuration
**Time Estimate:** 2-4 hours

#### Step 1: Install Dependencies
```bash
npm install @reown/appkit @reown/appkit-adapter-wagmi wagmi viem @tanstack/react-query
```

#### Step 2: Create Web3 Provider Configuration
Create `lib/web3/config.ts`:
```typescript
import { createAppKit } from '@reown/appkit'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, sepolia } from '@reown/appkit/networks'

// Custom BlockDAG network
const blockdag = {
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
}

// WalletConnect Project ID (already have one)
const projectId = 'a86a6a0afc0849fdb0832b5ec288b5a2'

// Supported networks
const networks = [mainnet, sepolia, blockdag]

// Wagmi adapter
const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks
})

// Metadata for wallet display
const metadata = {
  name: 'PatriotPledge NFTs',
  description: 'Support veterans through blockchain-powered fundraising',
  url: 'https://patriotpledgenfts.netlify.app',
  icons: ['https://patriotpledgenfts.netlify.app/favicon.ico']
}

// Create AppKit instance
export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,
  features: {
    analytics: true,
    email: false, // Disable email login for now
    socials: false // Disable social login for now
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#3B82F6', // Blue accent to match site
    '--w3m-border-radius-master': '8px'
  }
})

export { wagmiAdapter }
```

#### Step 3: Create Web3 Provider Component
Create `components/providers/Web3Provider.tsx`:
```typescript
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { wagmiAdapter } from '@/lib/web3/config'
import { ReactNode, useState } from 'react'

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
```

#### Step 4: Update Root Layout
Update `app/layout.tsx`:
```typescript
import { Web3Provider } from '@/components/providers/Web3Provider'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Web3Provider>
          {children}
        </Web3Provider>
      </body>
    </html>
  )
}
```

### Phase 2: Replace useWallet Hook
**Time Estimate:** 4-6 hours

#### Create New useWallet Hook
Create `hooks/useWalletV2.ts`:
```typescript
'use client'

import { useAccount, useConnect, useDisconnect, useBalance, useSwitchChain } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'

export function useWalletV2() {
  const { address, isConnected, isConnecting, chain } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { open } = useAppKit()
  
  const { data: balance } = useBalance({
    address,
    watch: true
  })

  // Open Web3Modal for wallet selection
  const connectWallet = () => {
    open()
  }

  // Chain helpers
  const isOnBlockDAG = chain?.id === 1043
  const isOnSepolia = chain?.id === 11155111
  const isOnEthereum = chain?.id === 1
  const isOnSupportedChain = isOnBlockDAG || isOnSepolia || isOnEthereum

  return {
    address,
    chainId: chain?.id ?? null,
    balance: balance?.formatted ?? null,
    isConnected,
    isConnecting,
    isOnBlockDAG,
    isOnSepolia,
    isOnEthereum,
    isOnSupportedChain,
    connect: connectWallet,
    disconnect,
    switchToChain: (chainId: number) => switchChain({ chainId }),
    switchToBlockDAG: () => switchChain({ chainId: 1043 }),
    switchToSepolia: () => switchChain({ chainId: 11155111 }),
    switchToEthereum: () => switchChain({ chainId: 1 }),
  }
}
```

### Phase 3: Update UI Components
**Time Estimate:** 4-6 hours

#### Update NavBar Connect Button
The `<w3m-button />` component provides:
- Connect button (when disconnected)
- Account info (when connected)
- Network switcher
- Transaction history

```typescript
// components/NavBar.tsx
import { useAppKit } from '@reown/appkit/react'

function NavBar() {
  const { open } = useAppKit()
  
  return (
    <nav>
      {/* Replace custom connect button with Web3Modal button */}
      <button onClick={() => open()} data-testid="connect-wallet-btn">
        Connect Wallet
      </button>
      {/* Or use the pre-built component */}
      <w3m-button />
    </nav>
  )
}
```

#### Update Purchase Panel
Update wallet connection in purchase flow to use new hooks.

### Phase 4: Mobile Optimization
**Time Estimate:** 2-4 hours

#### Trust Wallet Deep Linking
Web3Modal handles this automatically, but verify:
1. Test QR code scanning from Trust Wallet
2. Test deep link from mobile Safari/Chrome
3. Test in-app browser connection

#### Mobile Detection
```typescript
// Ensure mobile-friendly UX
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

// Show appropriate connection options
if (isMobile && !window.ethereum) {
  // Show QR code or deep link options
  open({ view: 'Connect' })
}
```

### Phase 5: Testing with Playwright
**Time Estimate:** 4-6 hours

#### Test Cases to Create
```typescript
// tests/wallet-connection.spec.ts

test.describe('Wallet Connection', () => {
  test('should show connect button when not connected', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('connect-wallet-btn')).toBeVisible()
  })

  test('should open Web3Modal on connect click', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('connect-wallet-btn').click()
    await expect(page.locator('w3m-modal')).toBeVisible()
  })

  test('should show wallet options in modal', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('connect-wallet-btn').click()
    // Check for popular wallet options
    await expect(page.getByText('MetaMask')).toBeVisible()
    await expect(page.getByText('Trust Wallet')).toBeVisible()
    await expect(page.getByText('WalletConnect')).toBeVisible()
  })

  test('should handle mobile detection', async ({ page }) => {
    // Emulate mobile device
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.getByTestId('connect-wallet-btn').click()
    // Mobile should show QR code or deep link options
    await expect(page.locator('w3m-modal')).toBeVisible()
  })
})
```

---

## 📋 WALLET COMPATIBILITY MATRIX

### After Implementation
| Wallet | Desktop Extension | Mobile App | WalletConnect | Status |
|--------|------------------|------------|---------------|--------|
| MetaMask | ✅ | ✅ | ✅ | Supported |
| Trust Wallet | ✅ | ✅ | ✅ | **Fixed** |
| Coinbase (Base) | ✅ | ✅ | ✅ | **Fixed** |
| Rainbow | ✅ | ✅ | ✅ | **New** |
| Phantom (EVM) | ❌ | ✅ | ✅ | **New** |
| Zerion | ✅ | ✅ | ✅ | **New** |
| Ledger | ✅ | N/A | ✅ | **New** |
| Trezor | ✅ | N/A | ✅ | **New** |
| OKX Wallet | ✅ | ✅ | ✅ | **New** |
| Rabby | ✅ | N/A | ✅ | **New** |

---

## 🚀 MIGRATION STRATEGY

### Backward Compatibility
1. Keep `useWallet.ts` as fallback for 2 weeks
2. Feature flag to toggle between old and new implementation
3. Gradual rollout: 10% → 50% → 100% of users

### Environment Variable
```env
NEXT_PUBLIC_USE_WEB3MODAL=true  # Enable new wallet system
```

### Feature Flag Check
```typescript
const useNewWalletSystem = process.env.NEXT_PUBLIC_USE_WEB3MODAL === 'true'
const wallet = useNewWalletSystem ? useWalletV2() : useWallet()
```

---

## 📊 SUCCESS METRICS

### Before (Current State)
- MetaMask: 100% success rate
- Trust Wallet: 0% success rate
- Other wallets: 0-20% success rate

### After (Target)
- All supported wallets: 95%+ success rate
- Mobile connection: 90%+ success rate
- Average connection time: < 5 seconds

---

## 🧪 TESTING CHECKLIST

### Desktop Testing
- [ ] MetaMask extension
- [ ] Trust Wallet extension
- [ ] Coinbase Wallet extension
- [ ] Rainbow extension
- [ ] Rabby extension
- [ ] Phantom (EVM mode)

### Mobile Testing
- [ ] MetaMask app (iOS)
- [ ] MetaMask app (Android)
- [ ] Trust Wallet app (iOS)
- [ ] Trust Wallet app (Android)
- [ ] Coinbase Wallet app (iOS)
- [ ] Rainbow app (iOS)

### WalletConnect Testing
- [ ] QR code scan from MetaMask mobile
- [ ] QR code scan from Trust Wallet mobile
- [ ] Deep link from Safari
- [ ] Deep link from Chrome mobile

### Transaction Testing (Post-Connection)
- [ ] NFT purchase on BlockDAG
- [ ] NFT purchase on Sepolia
- [ ] NFT purchase on Ethereum Mainnet
- [ ] Chain switching
- [ ] Disconnect and reconnect

---

## 📅 TIMELINE

| Phase | Task | Duration | Priority |
|-------|------|----------|----------|
| 1 | Library Installation | 2-4 hours | 🔴 High |
| 2 | Replace useWallet Hook | 4-6 hours | 🔴 High |
| 3 | Update UI Components | 4-6 hours | 🔴 High |
| 4 | Mobile Optimization | 2-4 hours | 🟡 Medium |
| 5 | Playwright Testing | 4-6 hours | 🟡 Medium |
| - | **Total** | **16-26 hours** | - |

---

## 🔗 RESOURCES

- [Web3Modal Documentation](https://docs.walletconnect.com/appkit/overview)
- [Wagmi Documentation](https://wagmi.sh/)
- [Viem Documentation](https://viem.sh/)
- [WalletConnect Cloud](https://cloud.walletconnect.com/) - Project ID management

---

*Last Updated: January 3, 2026*
*Priority: 2 (High)*
*Author: PatriotPledge Development Team*
