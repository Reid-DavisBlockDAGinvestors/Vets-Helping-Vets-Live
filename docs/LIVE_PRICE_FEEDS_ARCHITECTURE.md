# 💰 Live Price Feeds Architecture

## Overview

PatriotPledge requires real-time cryptocurrency price data to calculate the correct amount of native currency to collect for USD-denominated NFT purchases across multiple blockchain networks.

---

## Supported Chains & Native Currencies

| Chain | Chain ID | Native Currency | Symbol | Status | Price Feed Source |
|-------|----------|-----------------|--------|--------|-------------------|
| Ethereum Mainnet | 1 | Ether | ETH | 🟢 Ready | Chainlink/CoinGecko |
| Sepolia Testnet | 11155111 | Sepolia ETH | ETH | 🧪 Testnet | Use mainnet ETH price |
| BlockDAG Testnet | 1043 | BDAG | BDAG | 🧪 Testnet | Fixed rate ($0.05) |
| BlockDAG Mainnet | TBD | BDAG | BDAG | 🟡 Planned | DEX/CEX when live |
| Polygon | 137 | MATIC | MATIC | 🟡 Planned | Chainlink/CoinGecko |
| Base | 8453 | Ether | ETH | 🟡 Planned | Use mainnet ETH price |
| Arbitrum | 42161 | Ether | ETH | 🟡 Planned | Use mainnet ETH price |
| Optimism | 10 | Ether | ETH | 🟡 Planned | Use mainnet ETH price |
| BNB Chain | 56 | BNB | BNB | 🟡 Planned | Chainlink/CoinGecko |
| Avalanche | 43114 | AVAX | AVAX | 🟡 Planned | Chainlink/CoinGecko |
| Solana | - | SOL | SOL | 🟡 Planned | CoinGecko/Pyth |
| Bitcoin (Lightning) | - | BTC | BTC | 🟡 Planned | Chainlink/CoinGecko |
| XRP Ledger | - | XRP | XRP | 🟡 Planned | CoinGecko |

---

## Price Feed Sources (Priority Order)

### 1. Chainlink (Primary for EVM Chains)
- **Pros:** Decentralized, battle-tested, on-chain verification possible
- **Cons:** Requires smart contract calls, gas costs
- **Use for:** ETH, BTC, MATIC, BNB, AVAX, LINK

**Chainlink Price Feed Addresses (Mainnet):**
```
ETH/USD: 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
BTC/USD: 0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c
MATIC/USD: 0x7bAC85A8a13A4BcD8abb3eB7d6b4d632c5a57676
BNB/USD: 0x14e613AC84a31f709eadbdF89C6CC390fDc9540A
AVAX/USD: 0xFF3EEb22B22c7c95D78E4b7E9e1f4bB8d3d5D6E7 (example)
```

### 2. CoinGecko API (Primary for Non-EVM, Fallback for EVM)
- **Pros:** Free tier available, covers all coins, simple REST API
- **Cons:** Rate limits (10-50 calls/min free), centralized
- **Use for:** SOL, XRP, all chains as fallback

**Endpoints:**
```
Simple Price: GET /api/v3/simple/price?ids=ethereum,bitcoin,solana&vs_currencies=usd
With 24h Change: GET /api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true
```

### 3. Pyth Network (For Solana)
- **Pros:** Low latency, decentralized
- **Cons:** Solana-native, requires SDK
- **Use for:** SOL when on Solana chain

### 4. DEX Price (For New/Illiquid Tokens)
- **Pros:** Real market price
- **Cons:** Requires liquidity, can be manipulated
- **Use for:** BDAG when mainnet launches

---

## Architecture Design

```
┌─────────────────────────────────────────────────────────────┐
│                      Purchase Flow                          │
├─────────────────────────────────────────────────────────────┤
│  User selects NFT ($10 USD) → User selects chain (ETH)     │
│  → Get live ETH/USD price → Calculate ETH amount            │
│  → Display to user → User confirms → Execute transaction    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Price Service Layer                        │
├─────────────────────────────────────────────────────────────┤
│  lib/prices/                                                 │
│  ├── index.ts          # Main export                        │
│  ├── types.ts          # Price types                        │
│  ├── cache.ts          # Redis/memory cache                 │
│  ├── chainlink.ts      # Chainlink provider                 │
│  ├── coingecko.ts      # CoinGecko provider                 │
│  ├── pyth.ts           # Pyth provider (Solana)             │
│  └── fallback.ts       # Env var fallback rates             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Endpoints                           │
├─────────────────────────────────────────────────────────────┤
│  GET /api/prices/current                                     │
│    → Returns all supported currency prices                   │
│    → Cached for 60 seconds                                   │
│                                                              │
│  GET /api/prices/:symbol                                     │
│    → Returns single currency price                           │
│    → Cached for 30 seconds                                   │
│                                                              │
│  POST /api/prices/convert                                    │
│    → Body: { fromUsd: 10, toCurrency: "ETH" }               │
│    → Returns: { amount: "0.00322581", rate: 3100 }          │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)
- [ ] Create `lib/prices/` module structure
- [ ] Implement CoinGecko provider (covers all coins)
- [ ] Implement memory cache with TTL
- [ ] Create `/api/prices/current` endpoint
- [ ] Create `/api/prices/convert` endpoint
- [ ] Add env var fallback rates

### Phase 2: Integration (Week 2)
- [ ] Update `PurchasePanelV2` to fetch live prices
- [ ] Update `verify-campaign` to use live prices
- [ ] Update `useEthPurchase` hook with live price conversion
- [ ] Add price display in purchase UI ("$10 = 0.00322 ETH @ $3,100")
- [ ] Add price refresh button/auto-refresh

### Phase 3: Chainlink Integration (Week 3)
- [ ] Implement Chainlink provider for EVM chains
- [ ] Add on-chain price verification option
- [ ] Implement provider priority/fallback logic
- [ ] Add health monitoring for price feeds

### Phase 4: Multi-Chain Expansion (Week 4+)
- [ ] Add Pyth provider for Solana
- [ ] Add Bitcoin price feed
- [ ] Add XRP price feed
- [ ] Implement DEX price aggregation for new tokens

---

## Data Types

```typescript
// lib/prices/types.ts

export interface PriceData {
  symbol: string           // "ETH", "BTC", "SOL"
  priceUsd: number         // 3100.50
  change24h?: number       // -2.5 (percentage)
  lastUpdated: number      // Unix timestamp
  source: PriceSource      // "chainlink" | "coingecko" | "pyth" | "fallback"
  confidence?: number      // 0-1 confidence score
}

export type PriceSource = 'chainlink' | 'coingecko' | 'pyth' | 'dex' | 'fallback'

export interface PriceCache {
  prices: Map<string, PriceData>
  lastFetch: number
  ttlMs: number
}

export interface ConversionResult {
  fromUsd: number
  toCurrency: string
  amount: string           // Native currency amount as string (precision)
  rate: number             // USD rate used
  source: PriceSource
  timestamp: number
}

// Supported currencies with their CoinGecko IDs
export const CURRENCY_IDS: Record<string, string> = {
  ETH: 'ethereum',
  BTC: 'bitcoin',
  SOL: 'solana',
  MATIC: 'matic-network',
  BNB: 'binancecoin',
  AVAX: 'avalanche-2',
  XRP: 'ripple',
  BDAG: 'blockdag', // When listed
}

// Chain ID to native currency mapping
export const CHAIN_CURRENCIES: Record<number, string> = {
  1: 'ETH',        // Ethereum Mainnet
  11155111: 'ETH', // Sepolia
  137: 'MATIC',    // Polygon
  56: 'BNB',       // BNB Chain
  43114: 'AVAX',   // Avalanche
  42161: 'ETH',    // Arbitrum
  10: 'ETH',       // Optimism
  8453: 'ETH',     // Base
  1043: 'BDAG',    // BlockDAG Testnet
}
```

---

## Caching Strategy

```typescript
// Cache TTLs by use case
const CACHE_TTL = {
  DISPLAY: 60_000,      // 60 seconds for UI display
  PURCHASE: 30_000,     // 30 seconds for purchase calculations
  ADMIN: 300_000,       // 5 minutes for admin dashboard
}

// Cache invalidation triggers
// 1. TTL expiry
// 2. Price change > 5% (fetch fresh)
// 3. Manual refresh request
// 4. New purchase initiated
```

---

## Fallback Chain

```
1. Chainlink (EVM chains)
   ↓ (if fails or unavailable)
2. CoinGecko API
   ↓ (if rate limited or fails)
3. Environment Variable Override
   ↓ (if not set)
4. Hardcoded Defaults (last resort, with warning)
```

---

## Environment Variables

```bash
# Price Feed Configuration
PRICE_FEED_CACHE_TTL=60000           # Cache TTL in ms (default 60s)
PRICE_FEED_PRIMARY=coingecko         # Primary source: chainlink | coingecko
COINGECKO_API_KEY=                   # Optional: Pro API key for higher limits

# Fallback Rates (used when all feeds fail)
ETH_USD_RATE=3100
BTC_USD_RATE=95000
SOL_USD_RATE=180
MATIC_USD_RATE=0.85
BNB_USD_RATE=680
AVAX_USD_RATE=35
XRP_USD_RATE=2.20
BDAG_USD_RATE=0.05                   # Testnet only

# Chainlink RPC (for on-chain price feeds)
CHAINLINK_RPC=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
```

---

## Error Handling

```typescript
// Price fetch errors should:
// 1. Log to structured logger with context
// 2. Fall back to next provider
// 3. Use cached value if recent enough (< 5 min)
// 4. Use env fallback with warning to user
// 5. Block purchase if no valid price (safety)

interface PriceError {
  code: 'FETCH_FAILED' | 'RATE_LIMITED' | 'INVALID_RESPONSE' | 'TIMEOUT'
  source: PriceSource
  message: string
  retryAfter?: number  // seconds
}
```

---

## Security Considerations

1. **Price Manipulation Protection**
   - Use multiple sources and compare
   - Reject prices that deviate > 10% from cached
   - Alert on suspicious price movements

2. **Slippage Protection**
   - Add configurable slippage buffer (1-3%)
   - Warn user if price changed during confirmation
   - Allow price refresh before final confirmation

3. **Rate Limiting**
   - Cache aggressively to minimize API calls
   - Implement request queuing for batch fetches
   - Use API keys for production

---

## Monitoring & Alerts

- [ ] Log price fetch success/failure rates
- [ ] Alert if price feed is stale (> 5 min)
- [ ] Alert if price deviates significantly (> 10%)
- [ ] Dashboard showing current prices and sources
- [ ] Track API rate limit usage

---

## Future Enhancements

1. **WebSocket Price Feeds** - Real-time updates for trading-heavy UX
2. **Historical Price Charts** - Show price trends on purchase page
3. **Price Prediction** - ML-based short-term predictions
4. **Multi-Currency Display** - Show price in user's preferred fiat
5. **Gas Price Optimization** - Factor in gas costs for total cost calculation
