# 🌐 Multi-Chain Treasury & Cross-Currency Roadmap

## PatriotPledge Enterprise Fund Management Strategy

> **Mission:** Build an enterprise-grade multi-chain infrastructure that can receive and manage funds from any blockchain ecosystem, with treasury wallets for each currency.

**Document Version:** 1.0  
**Created:** January 3, 2026  
**Status:** PLANNING  
**Priority:** HIGH - Strategic Growth Initiative

---

## 📊 Executive Summary

### Current State (Jan 3, 2026)
| Chain | Contract | Treasury Wallet | Status |
|-------|----------|-----------------|--------|
| Ethereum (1) | V8 | 0x4E8E445A9957cD251059cd52A00777A25f8cD53e | ✅ Live |
| Sepolia (11155111) | V8 | Same as above | ✅ Testing |
| BlockDAG (1043) | V5/V6 | Same as above | ✅ Live |

### Target State (Enterprise)
| Chain/Currency | Treasury Type | Status | Priority |
|----------------|---------------|--------|----------|
| Ethereum (ETH) | EVM Wallet | ✅ Live | - |
| BlockDAG (BDAG) | EVM Wallet | ✅ Live | - |
| Polygon (MATIC) | EVM Wallet | 🔜 Q1 2026 | High |
| Base (ETH L2) | EVM Wallet | 🔜 Q1 2026 | High |
| Arbitrum (ETH L2) | EVM Wallet | 🔜 Q2 2026 | Medium |
| Optimism (ETH L2) | EVM Wallet | 🔜 Q2 2026 | Medium |
| Bitcoin (BTC) | Native BTC Wallet | 🔜 Q2 2026 | High |
| XRP Ledger (XRP) | Native XRP Wallet | 🔜 Q3 2026 | Medium |
| Solana (SOL) | Solana Wallet | 🔜 Q3 2026 | Medium |
| USDC (Multi-chain) | Circle Account | 🔜 Q2 2026 | High |

---

## 🎛️ Phase 1: Enterprise Network Dropdown (UI)

### Current Network Switcher
The AppKit modal includes network switching, but we need an enterprise-grade dropdown in the navbar for quick access.

### Proposed UI Design

```
┌────────────────────────────────────────────────────────────────────┐
│  🎖️ PatriotPledge NFTs        [Network ▼]  [Connect Wallet]       │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Network Dropdown (Enterprise):                                    │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │  ⬢ Ethereum Mainnet          ✓ Connected                 │     │
│  │  ─────────────────────────────────────────────────────── │     │
│  │  🔷 Polygon                   Low Gas                     │     │
│  │  🔵 Base                      Coinbase Ecosystem          │     │
│  │  🔴 Arbitrum                  Fast & Cheap                │     │
│  │  🟣 Optimism                  OP Stack                    │     │
│  │  ─────────────────────────────────────────────────────── │     │
│  │  ⬡ BlockDAG Awakening        Testnet                     │     │
│  │  ⬡ Sepolia                   ETH Testnet                 │     │
│  │  ─────────────────────────────────────────────────────── │     │
│  │  🟠 Bitcoin (Coming Soon)                                 │     │
│  │  ⚪ XRP (Coming Soon)                                     │     │
│  │  🟣 Solana (Coming Soon)                                  │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Implementation Tasks
- [ ] Create `NetworkSelector` component with dropdown
- [ ] Group networks by category (Mainnet, L2s, Testnets, Coming Soon)
- [ ] Show gas estimates per network
- [ ] Show user's balance on each network
- [ ] Persist last selected network in localStorage
- [ ] Add network health indicators (green/yellow/red)

### Code Structure
```typescript
// lib/chains/registry.ts
export const CHAIN_REGISTRY = {
  // EVM Mainnets
  ethereum: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    icon: '⬢',
    category: 'mainnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://eth.llamarpc.com',
    explorer: 'https://etherscan.io',
    contractAddress: '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e',
    isLive: true,
    gasEstimate: 'high',
  },
  polygon: {
    chainId: 137,
    name: 'Polygon',
    icon: '🔷',
    category: 'l2',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrl: 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com',
    contractAddress: null, // TBD
    isLive: false,
    gasEstimate: 'low',
  },
  base: {
    chainId: 8453,
    name: 'Base',
    icon: '🔵',
    category: 'l2',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    contractAddress: null, // TBD
    isLive: false,
    gasEstimate: 'low',
  },
  // ... more chains
}
```

---

## 🏦 Phase 2: Multi-Chain EVM Treasury

### Single Wallet Strategy (Current)
All EVM chains can use the same wallet address:
- **Treasury Wallet:** `0x4E8E445A9957cD251059cd52A00777A25f8cD53e`
- Works on: Ethereum, Polygon, Base, Arbitrum, Optimism, BlockDAG

### Deployment Plan
| Chain | Contract Deploy | Treasury Setup | Timeline |
|-------|-----------------|----------------|----------|
| Polygon | Deploy V8 | Fund with MATIC for gas | Q1 2026 |
| Base | Deploy V8 | Fund with ETH for gas | Q1 2026 |
| Arbitrum | Deploy V8 | Fund with ETH for gas | Q2 2026 |
| Optimism | Deploy V8 | Fund with ETH for gas | Q2 2026 |

### Tasks
- [ ] Deploy V8 contract to Polygon
- [ ] Deploy V8 contract to Base
- [ ] Update frontend to support new chains
- [ ] Add chain-specific gas estimation
- [ ] Create multi-chain dashboard

---

## ₿ Phase 3: Bitcoin Treasury Integration

### Why Bitcoin?
- Largest cryptocurrency by market cap
- Many donors prefer BTC
- Institutional credibility
- Store of value for treasury reserves

### Implementation Options

#### Option A: Custodial (Recommended for Start)
| Provider | Fees | Features | Complexity |
|----------|------|----------|------------|
| **Coinbase Commerce** | 1% | Easy API, auto-conversion | Low |
| **BitPay** | 1% | Invoice system, accounting | Low |
| **OpenNode** | 1% | Lightning support | Medium |

#### Option B: Self-Custody (Future)
| Solution | Type | Security | Complexity |
|----------|------|----------|------------|
| **Hardware Wallet** | Cold storage | Highest | Medium |
| **Multi-sig (Gnosis Safe + Bitcoin)** | Hot/Warm | High | High |
| **Casa** | Managed multi-sig | High | Low |

### Bitcoin Treasury Wallet Setup
```
Treasury Bitcoin Address: bc1q... (TBD)
Backup: Hardware wallet (Ledger/Trezor)
Multi-sig: 2-of-3 signers recommended

Signers:
1. Primary Admin (hardware wallet)
2. Secondary Admin (hardware wallet)  
3. Recovery (cold storage)
```

### Integration Flow
```
┌─────────────────────────────────────────────────────────────────────┐
│                    BITCOIN DONATION FLOW                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Donor selects "Pay with Bitcoin"                                   │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Generate unique BTC address per donation                    │   │
│  │  (via Coinbase Commerce / BitPay API)                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Display QR code + address + amount in BTC                   │   │
│  │  Show live BTC/USD conversion rate                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Webhook receives payment confirmation (1-6 confirmations)   │   │
│  │  Record donation in Supabase                                 │   │
│  │  Mint NFT on selected EVM chain (paid by platform)           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Option A: Keep BTC in treasury                              │   │
│  │  Option B: Auto-convert to USD/USDC                          │   │
│  │  Option C: Auto-convert to ETH for submitter payout          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Tasks
- [ ] Set up Coinbase Commerce account
- [ ] Create Bitcoin treasury wallet (hardware wallet)
- [ ] Implement BitPay/Coinbase Commerce API integration
- [ ] Create "Pay with Bitcoin" UI component
- [ ] Handle webhook for payment confirmation
- [ ] Implement NFT minting after BTC payment confirmed

---

## ✖️ Phase 4: XRP Ledger Integration

### Why XRP?
- Fast settlement (3-5 seconds)
- Low fees ($0.0001 per transaction)
- Large community
- Cross-border payment use case

### Implementation Options

#### Option A: Custodial (Recommended)
| Provider | Features | Integration |
|----------|----------|-------------|
| **Ripple Payments** | Enterprise-grade | API |
| **Uphold** | Multi-currency | API |
| **Bitstamp** | Exchange integration | API |

#### Option B: Self-Custody
```
XRP Treasury Address: r... (TBD)
Destination Tag: Required for identification
Backup: Paper wallet + hardware backup
```

### XRP Payment Flow
```typescript
// API endpoint for XRP donations
// POST /api/payments/xrp/create-invoice
{
  campaignId: "uuid",
  amountUSD: 100,
  donorEmail: "donor@email.com"
}

// Response
{
  xrpAddress: "rXXXXXXXX...",
  destinationTag: 123456,
  amountXRP: 200, // Based on live XRP/USD rate
  expiresAt: "2026-01-03T12:00:00Z",
  qrCodeUrl: "https://..."
}
```

### Tasks
- [ ] Research XRP custody solutions
- [ ] Set up XRP treasury wallet
- [ ] Implement XRP payment API
- [ ] Create "Pay with XRP" UI component
- [ ] Handle XRP ledger webhooks
- [ ] Implement NFT minting after XRP payment

---

## 🟣 Phase 5: Solana Integration

### Why Solana?
- Fast (400ms finality)
- Low fees ($0.00025)
- NFT ecosystem (Magic Eden, Tensor)
- Growing DeFi presence

### Implementation Approach
Unlike EVM chains, Solana requires different:
- Wallet (Phantom, Solflare)
- Smart contract (Rust-based program)
- NFT standard (Metaplex)

### Solana Treasury Setup
```
Treasury Solana Address: (TBD - 44 characters)
Token Accounts:
- SOL (native)
- USDC (SPL token)
```

### Integration Options
1. **Payments Only:** Accept SOL, mint NFT on EVM
2. **Full Native:** Deploy Solana NFT program (Metaplex)
3. **Bridge:** Accept SOL, bridge to EVM via Wormhole

### Tasks
- [ ] Set up Solana treasury wallet
- [ ] Research Metaplex NFT program
- [ ] Implement Solana wallet connection (Phantom)
- [ ] Create Solana payment flow
- [ ] Decide: Bridge vs Native NFT

---

## 💵 Phase 6: Stablecoin Treasury (USDC/USDT)

### Why Stablecoins?
- No volatility risk
- Easy accounting
- Preferred by nonprofits
- Cross-chain (Circle CCTP)

### Multi-Chain USDC Support
| Chain | USDC Contract | Status |
|-------|---------------|--------|
| Ethereum | 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 | ✅ |
| Polygon | 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 | 🔜 |
| Base | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 | 🔜 |
| Arbitrum | 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 | 🔜 |
| Solana | EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v | 🔜 |

### Circle CCTP Integration
Cross-Chain Transfer Protocol allows USDC movement between chains:
```
Donor pays USDC on Polygon → Bridge to Ethereum → Submitter receives
```

### Tasks
- [ ] Add USDC payment option on Ethereum
- [ ] Deploy token approval flow
- [ ] Implement Circle CCTP for cross-chain
- [ ] Add USDC balance display in dashboard

---

## 📊 Phase 7: Treasury Dashboard

### Admin Treasury View
```
┌────────────────────────────────────────────────────────────────────────┐
│                    TREASURY DASHBOARD                                   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Total Treasury Value: $47,832.50 USD                                  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  ASSET BREAKDOWN                                                  │ │
│  ├──────────────────────────────────────────────────────────────────┤ │
│  │  ⬢ ETH      │ 12.5 ETH      │ $38,750.00  │ 81%  │ ████████████ │ │
│  │  🔷 MATIC   │ 5,000 MATIC   │ $4,500.00   │ 9%   │ █            │ │
│  │  ⬡ BDAG    │ 50,000 BDAG   │ $2,500.00   │ 5%   │ █            │ │
│  │  ₿ BTC     │ 0.02 BTC      │ $1,800.00   │ 4%   │ █            │ │
│  │  💵 USDC   │ 282.50 USDC   │ $282.50     │ 1%   │              │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  WALLET ADDRESSES                                                 │ │
│  ├──────────────────────────────────────────────────────────────────┤ │
│  │  EVM (All Chains): 0x4E8E445A9957cD251059cd52A00777A25f8cD53e    │ │
│  │  Bitcoin:          bc1qxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx            │ │
│  │  XRP:              rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX             │ │
│  │  Solana:           XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX  │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  [Refresh Balances]  [Export Report]  [Transfer Funds]                 │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Tasks
- [ ] Create TreasuryDashboard component
- [ ] Implement multi-chain balance fetching
- [ ] Add portfolio pie chart
- [ ] Create export functionality (CSV/PDF)
- [ ] Add transaction history per chain

---

## 🗓️ Implementation Timeline

### Q1 2026 (Immediate)
| Week | Focus | Deliverables |
|------|-------|--------------|
| 1-2 | EVM Expansion | Deploy V8 to Polygon, Base |
| 3-4 | Network UI | Enterprise network dropdown |

### Q2 2026
| Month | Focus | Deliverables |
|-------|-------|--------------|
| April | Bitcoin | Coinbase Commerce integration |
| May | USDC | Multi-chain stablecoin support |
| June | L2s | Arbitrum, Optimism deployment |

### Q3 2026
| Month | Focus | Deliverables |
|-------|-------|--------------|
| July | XRP | XRP Ledger integration |
| August | Solana | Solana payment support |
| September | Dashboard | Treasury management UI |

---

## 💰 Treasury Wallet Summary

### Required Wallets
| Currency | Wallet Type | Address | Setup Priority |
|----------|-------------|---------|----------------|
| ETH/EVM | MetaMask/Hardware | 0x4E8E...D53e | ✅ Done |
| BTC | Hardware (Ledger) | TBD | High |
| XRP | Xumm/Hardware | TBD | Medium |
| SOL | Phantom/Hardware | TBD | Medium |

### Security Requirements
1. **Hardware Wallets:** Ledger Nano X or Trezor Model T
2. **Multi-sig:** 2-of-3 for amounts > $10,000
3. **Cold Storage:** Paper backup for all seed phrases
4. **Insurance:** Smart contract insurance (Nexus Mutual)
5. **Audit Trail:** All transactions logged in Supabase

---

## 🔗 Integration Partners

### Payment Processors
| Provider | Currencies | Fees | Status |
|----------|------------|------|--------|
| Native EVM | ETH, MATIC, etc. | Gas only | ✅ Live |
| Coinbase Commerce | BTC, ETH, USDC | 1% | 🔜 Q2 |
| BitPay | BTC, BCH, ETH | 1% | Alternative |
| Stripe Crypto | USDC | 1.5% | Future |

### Bridges & Swaps
| Service | Use Case | Integration |
|---------|----------|-------------|
| Circle CCTP | USDC cross-chain | API |
| Wormhole | SOL ↔ EVM | SDK |
| Across Protocol | L2 ↔ L1 | SDK |

---

## ✅ Success Metrics

### Phase 1 (Network UI)
- [ ] Users can switch networks in < 2 clicks
- [ ] Network dropdown shows live gas estimates
- [ ] 95%+ of users successfully switch chains

### Phase 2 (Multi-Chain EVM)
- [ ] V8 deployed on 4+ EVM chains
- [ ] < 5 minute average for cross-chain NFT minting
- [ ] $10,000+ raised on non-Ethereum chains

### Phase 3+ (Multi-Currency)
- [ ] Accept donations in 5+ currencies
- [ ] < 24 hour settlement for non-EVM payments
- [ ] Zero security incidents

---

## 📝 Next Steps (Immediate)

1. **Create NetworkSelector Component** - Enterprise dropdown for quick network switching
2. **Deploy V8 to Polygon** - Lowest risk L2 expansion
3. **Set up Coinbase Commerce** - Bitcoin payment gateway
4. **Create Treasury Dashboard** - Unified view of all chain balances

---

*This roadmap is a living document. Updates tracked via git commits.*

**Last Updated:** January 3, 2026  
**Author:** PatriotPledge Engineering Team
