# Multi-Chain Architecture Audit Report
## Date: January 1, 2026

## Executive Summary

This audit identifies all components that need modification to support a true multi-chain, multi-contract platform. The current codebase has **BlockDAG hardcoded in many places**, causing the Sepolia campaign approval bug.

---

## 🚨 Critical Issues Found

### 1. `lib/onchain.ts` - BlockDAG Hardcoded
**Status:** NEEDS REFACTORING

```typescript
// Current: Only supports BlockDAG
export function getProvider(): ethers.JsonRpcProvider {
  const primaryRpc = process.env.BLOCKDAG_RPC || 'https://rpc.awakening.bdagscan.com'
  // ...BlockDAG only
}

export function getRelayerSigner() {
  const pk = process.env.BDAG_RELAYER_KEY  // BlockDAG key only
  return new ethers.Wallet(pk, getProvider())
}
```

**Required:** Create `getProviderForChain(chainId)` and `getSignerForChain(chainId)`

---

### 2. API Routes Using Hardcoded BlockDAG

| Route | Issue | Priority |
|-------|-------|----------|
| `/api/mint/route.ts` | Uses `getContract(signer)` - BlockDAG only | HIGH |
| `/api/mint/single/route.ts` | Uses `getRelayerSigner()` - BlockDAG only | HIGH |
| `/api/admin/verify-campaign/route.ts` | Uses `getActiveContractVersion()` | HIGH |
| `/api/admin/fix-campaign/route.ts` | Uses `getRelayerSigner()` | HIGH |
| `/api/admin/sync-onchain/route.ts` | Uses `getProvider()` | MEDIUM |
| `/api/admin/reactivate-campaign/route.ts` | Uses `getRelayerSigner()` | MEDIUM |
| `/api/admin/payout/route.ts` | Uses `getRelayerSigner()` | MEDIUM |
| `/api/onchain/tokens/route.ts` | Uses `getProvider()` | MEDIUM |
| `/api/cron/verify-campaigns/route.ts` | Uses `getActiveContractVersion()` | MEDIUM |

---

### 3. Database Schema - GOOD ✅

The Supabase schema is properly designed for multi-chain:

```sql
-- submissions table has:
chain_id INTEGER DEFAULT 1043
chain_name VARCHAR(50)
is_testnet BOOLEAN
contract_version VARCHAR(20)
contract_address VARCHAR(42)

-- chain_configs table:
chain_id, name, explorer_url, native_currency, is_testnet, is_active

-- contracts table:
version, address, chain_id, is_active, is_mintable, features
```

---

### 4. `lib/contracts.ts` - PARTIALLY FIXED ✅

V7 Sepolia is now registered with correct chain_id. But `getActiveContractVersion()` returns the FIRST active contract, not chain-aware.

**Required:** Add `getActiveContractForChain(chainId)` function.

---

## 📋 Required Changes for Future-Proof Multi-Chain

### Phase 1: Core Infrastructure (CRITICAL)

1. **Create `lib/chains.ts`** - Chain configuration registry
   ```typescript
   export interface ChainConfig {
     chainId: number
     name: string
     shortName: string
     nativeCurrency: string
     rpcUrl: string
     explorerUrl: string
     isTestnet: boolean
     signerKey: string  // env var name for private key
   }
   
   export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
     1043: { /* BlockDAG */ },
     11155111: { /* Sepolia */ },
     1: { /* Ethereum Mainnet */ },
     137: { /* Polygon */ },
     8453: { /* Base */ },
   }
   
   export function getProviderForChain(chainId: number): Provider
   export function getSignerForChain(chainId: number): Signer
   ```

2. **Refactor `lib/onchain.ts`**
   - Deprecate `getProvider()` → use `getProviderForChain(chainId)`
   - Deprecate `getRelayerSigner()` → use `getSignerForChain(chainId)`
   - Keep legacy functions for backwards compatibility with deprecation warnings

3. **Refactor `lib/contracts.ts`**
   - Add `getActiveContractForChain(chainId): ContractVersion`
   - Add `getContractByChainAndVersion(chainId, version): Contract`

### Phase 2: API Route Updates

All routes that interact with blockchain must:
1. Read `chain_id` from submission/campaign record
2. Use `getProviderForChain(chain_id)` instead of `getProvider()`
3. Use `getSignerForChain(chain_id)` instead of `getRelayerSigner()`

### Phase 3: Frontend Updates

1. Network selector in admin approval modal ✅ (already exists)
2. Display correct explorer links based on chain_id ✅ (already exists)
3. Purchase panel must detect campaign's chain and use correct wallet network

### Phase 4: Contract Registry

Store deployed contracts in Supabase `contracts` table:
```sql
INSERT INTO contracts (version, address, chain_id, is_active, is_mintable)
VALUES 
  ('v5', '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890', 1043, false, true),
  ('v6', '0xaE54e4E8A75a81780361570c17b8660CEaD27053', 1043, true, true),
  ('v7', '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e', 11155111, true, true);
```

---

## 🔧 Immediate Fixes Needed

1. **approve/route.ts** - FIXED ✅
   - Now reads targetChainId and creates chain-specific signer

2. **verify-campaign/route.ts** - NEEDS FIX
   - Must read submission's chain_id and use that network's provider

3. **fix-campaign/route.ts** - NEEDS FIX
   - Must read submission's chain_id and use that network's signer

4. **mint routes** - NEEDS REVIEW
   - Should these be multi-chain? Or just for current active chain?

---

## 📊 Environment Variables Needed

```bash
# BlockDAG (chain 1043)
BLOCKDAG_RPC=https://rpc.awakening.bdagscan.com
BDAG_RELAYER_KEY=0x...

# Sepolia (chain 11155111)  
ETHEREUM_SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com
ETH_DEPLOYER_KEY=0x...

# Ethereum Mainnet (chain 1)
ETHEREUM_RPC=https://eth.llamarpc.com
ETH_MAINNET_KEY=0x...  # Gnosis Safe multi-sig recommended

# Polygon (chain 137) - Future
POLYGON_RPC=
POLYGON_KEY=

# Base (chain 8453) - Future
BASE_RPC=
BASE_KEY=

# Price conversion
BDAG_USD_RATE=0.05
ETH_USD_RATE=2300
```

---

## ✅ Action Items

### Immediate (Today)
- [x] Fix approve route to use target network
- [ ] Fix verify-campaign route to use submission's chain_id
- [ ] Fix fix-campaign route to use submission's chain_id
- [ ] Check Netlify build failures

### Short-term (This Week)
- [ ] Create `lib/chains.ts` with multi-chain provider system
- [ ] Refactor `lib/onchain.ts` to use chain-aware functions
- [ ] Update all API routes to be chain-aware
- [ ] Add chain validation to purchase flow

### Medium-term (Before Mainnet)
- [ ] Deploy V8 with native tip splitting
- [ ] Set up Gnosis Safe multi-sig for mainnet
- [ ] Full E2E test on Sepolia
- [ ] Security audit of multi-chain flow
