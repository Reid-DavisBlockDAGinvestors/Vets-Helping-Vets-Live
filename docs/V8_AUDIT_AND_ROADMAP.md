# PatriotPledge NFT V8 - Audit & Roadmap

## Executive Summary

Based on extensive multi-chain testing between BlockDAG Testnet and Sepolia Testnet, we've identified critical issues in the V7 contract and frontend integration that V8 will address.

---

## Issues Discovered During V7 Multi-Chain Testing

### 1. ABI Signature Mismatch (CRITICAL)
**Problem:** The V7_ABI `getCampaign` function declared 10 return fields, but the contract actually returns 13 fields.

**Impact:** When reading campaign data:
- `active` was reading from position 9 (actually `nonprofit` address)
- `closed` was reading from position 10 (actually `submitter` address)
- Non-zero addresses were interpreted as `true` → ALL campaigns appeared closed

**Root Cause:** ABI was missing `nonprofit`, `submitter`, and `immediatePayoutEnabled` fields.

**V8 Fix:** Simplified `getCampaign` that returns a struct, making ABI mismatches impossible.

---

### 2. Legacy Function Naming (mintWithBDAG)
**Problem:** Functions named `mintWithBDAG` are confusing on Ethereum/Sepolia chains.

**Impact:** Developer confusion, code maintenance issues.

**V8 Fix:** Chain-agnostic naming: `mint()`, `mintWithTip()`, `batchMint()`.

---

### 3. Price Rate Inconsistency
**Problem:** Different parts of the system used different ETH/USD rates:
- Approve API: $2300 default
- Token API: $3100 default
- Frontend: Live CoinGecko rate (~$3100)

**Impact:** Campaigns created with price X, but frontend tries to pay price Y.

**V8 Fix:** 
- Store USD price on-chain alongside native price
- Add `priceUsd` field to Campaign struct
- View functions return both native and USD amounts

---

### 4. Immediate Payout Double-Condition
**Problem:** V7 requires BOTH `campaign.immediatePayoutEnabled` AND `feeConfig.immediatePayout` to be true.

**Impact:** Confusing configuration, unexpected behavior.

**V8 Fix:** Single per-campaign setting controls immediate payout.

---

### 5. Missing Campaign Pause
**Problem:** V7 has global `pause()` but no per-campaign pause.

**Impact:** Can't pause individual problematic campaigns without affecting all.

**V8 Fix:** Add `pauseCampaign()` / `unpauseCampaign()` functions.

---

### 6. Replay Protection Issues
**Problem:** Legacy mint functions don't have `onlyThisChain` modifier.

**Impact:** Potential cross-chain replay attacks on multi-chain deployments.

**V8 Fix:** All mint functions have `onlyThisChain` modifier.

---

## V8 New Features

### 1. Struct-Based View Functions
```solidity
struct CampaignView {
    uint256 id;
    string category;
    string baseURI;
    uint256 goalNative;
    uint256 goalUsd;
    uint256 grossRaised;
    uint256 netRaised;
    uint256 tipsReceived;
    uint256 editionsMinted;
    uint256 maxEditions;
    uint256 priceNative;
    uint256 priceUsd;
    address nonprofit;
    address submitter;
    bool active;
    bool paused;
    bool closed;
    bool refunded;
    bool immediatePayoutEnabled;
}

function getCampaign(uint256 id) external view returns (CampaignView memory);
```

### 2. USD Price Storage
- Store both native currency price AND USD equivalent
- Enables accurate reporting regardless of price fluctuations
- `priceUsd` stored at campaign creation time

### 3. Chain-Agnostic Function Names
| V7 Name | V8 Name |
|---------|---------|
| `mintWithBDAG` | `mint` |
| `mintWithBDAGAndTip` | `mintWithTip` |
| `mintBatchWithBDAG` | `batchMint` |
| `mintBatchWithBDAGAndTip` | `batchMintWithTip` |

### 4. Per-Campaign Pause
```solidity
function pauseCampaign(uint256 campaignId) external onlyOwner;
function unpauseCampaign(uint256 campaignId) external onlyOwner;
```

### 5. Simplified Immediate Payout
- Remove global `feeConfig.immediatePayout` flag
- Per-campaign `immediatePayoutEnabled` is the only control

### 6. Enhanced Events
```solidity
event CampaignPaused(uint256 indexed campaignId);
event CampaignUnpaused(uint256 indexed campaignId);
event PriceUpdated(uint256 indexed campaignId, uint256 oldPrice, uint256 newPrice, uint256 priceUsd);
```

---

## Migration Path

### For Existing Campaigns
1. Deploy V8 to Sepolia
2. Register in `lib/contracts.ts` as v8
3. Update `AVAILABLE_NETWORKS` in admin UI
4. New campaigns go to V8
5. Existing V7 campaigns continue working (no migration needed)

### Frontend Changes
1. Update `V8_ABI` in `lib/contracts.ts`
2. Update `useEthPurchase.ts` to use new function names
3. Update `verify-campaign/route.ts` to use V8 for new campaigns

---

## Deployment Checklist

- [ ] Deploy V8 to Sepolia testnet
- [ ] Verify contract on Etherscan
- [ ] Register in lib/contracts.ts
- [ ] Update admin UI network options
- [ ] Create test campaign on V8
- [ ] Test purchase flow end-to-end
- [ ] Verify dashboard shows V8 NFTs
- [ ] Test fund distribution

---

## Contract Addresses

| Version | Chain | Address |
|---------|-------|---------|
| V5 | BlockDAG Testnet (1043) | 0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890 |
| V6 | BlockDAG Testnet (1043) | 0xaE54e4E8A75a81780361570c17b8660CEaD27053 |
| V7 | Sepolia (11155111) | 0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e |
| V8 | Sepolia (11155111) | TBD - To be deployed |
| V8 | Ethereum Mainnet (1) | TBD - After Sepolia testing |

---

## Timeline

1. **Phase 1:** Write V8 contract (this session)
2. **Phase 2:** Deploy to Sepolia, test E2E
3. **Phase 3:** Fix any issues discovered
4. **Phase 4:** Deploy to Ethereum Mainnet

---

*Document created: January 3, 2026*
*Last updated: January 3, 2026*
