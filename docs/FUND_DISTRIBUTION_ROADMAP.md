# Fund Distribution Roadmap

## 🚨 PRIORITY 1 - HIGHEST PRIORITY

**Status:** CRITICAL - Immediate Payout NOT Enabled on Mainnet Campaign

---

## Executive Summary

This document outlines the complete strategy for distributing funds to campaign submitters. The V8 contract on Ethereum Mainnet supports **automatic immediate payout** on every NFT mint, but this feature must be explicitly enabled per campaign.

---

## 🔴 CRITICAL ISSUE IDENTIFIED (Jan 3, 2026)

### Problem
The `immediatePayoutEnabled` flag defaults to `false` in `app/api/submissions/approve/route.ts`:
```typescript
const immediatePayoutEnabled = body.updates?.immediate_payout_enabled ?? false
```

This means **"A Mother's Fight to Keep Her Family"** on Ethereum Mainnet is NOT automatically distributing funds to the submitter when NFTs are minted.

### Impact
- Funds accumulate in the contract instead of going to the submitter
- Manual distribution required via admin panel or `distributePendingFunds()`
- Poor UX for campaign creators expecting immediate payouts

### Solution Required
1. **Immediate Fix**: Enable immediate payout for existing Mainnet campaign
2. **Default Change**: Make `immediatePayoutEnabled = true` the default for production chains
3. **Admin UI**: Add toggle in campaign approval to enable/disable immediate payout
4. **Dashboard**: Show distribution status on campaign cards

---

## Current State (Jan 3, 2026)

### Contract Distribution Capabilities

| Contract | Chain | Withdraw Function | Immediate Payout | Status |
|----------|-------|-------------------|------------------|--------|
| **V5** | BlockDAG (1043) | `withdraw(to, amount)` | ❌ No | ✅ Active |
| **V6** | BlockDAG (1043) | `withdraw(to, amount)` + `emergencyWithdraw()` | ❌ No | ✅ Active |
| **V7** | Sepolia (11155111) | `withdraw(to, amount)` + `distributePendingFunds(campaignId)` | ✅ Yes | ✅ Testing |
| **V7** | Ethereum (1) | Same as Sepolia V7 | ✅ Yes | ⏳ Deprecated |
| **V8** | Sepolia (11155111) | `withdraw()` + `distributePendingFunds()` + `_distributeFunds()` | ✅ Yes (per-campaign) | ✅ Testing |
| **V8** | Ethereum (1) | Same as Sepolia V8 | ✅ Yes (per-campaign) | 🔴 LIVE - Payout Disabled |

### V8 Contract Distribution Features
```solidity
// Automatic distribution on mint (when immediatePayoutEnabled = true)
function _distributeFunds(uint256 campaignId, uint256 contribution, uint256 tipAmount) internal {
    uint256 platformFee = (contribution * platformFeeBps) / BPS_DENOMINATOR;
    uint256 submitterAmount = contribution - platformFee + tipAmount;
    
    // Sends platformFee to platformTreasury
    // Sends submitterAmount to campaign.submitter
}

// Manual distribution for campaigns with immediatePayoutEnabled = false
function distributePendingFunds(uint256 campaignId) external onlyOwner
```

### What Works Now
1. ✅ Distribution API calls contract `withdraw()` function on-chain
2. ✅ Transaction hash recorded in `distributions` table
3. ✅ Campaign totals updated after successful distribution
4. ✅ Tip splitting configurable per campaign
5. ✅ Multi-chain support (BlockDAG + Sepolia)

### Current Issues
1. 🔴 **CRITICAL**: `immediatePayoutEnabled` defaults to `false` - Mainnet campaign NOT auto-distributing
2. ❌ No UI to enable/disable immediate payout during campaign approval
3. ❌ No way to enable immediate payout on existing campaigns from admin UI
4. ❌ BlockDAG RPC can be unreliable (NowNodes DNS issues) - FIXED in commit ce164e5
5. ❌ No retry logic for failed transactions
6. ❌ No batch distribution (one campaign at a time)

---

## 🛠️ IMPLEMENTATION PLAN

### Phase 0: EMERGENCY FIX (Do First)
**Goal:** Enable immediate payout for existing Mainnet campaign

#### Step 1: Call `setCampaignImmediatePayout` on V8 Mainnet Contract
```typescript
// Contract: 0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e (Ethereum Mainnet)
// Function: setCampaignImmediatePayout(uint256 campaignId, bool enabled)
// Arguments: campaignId = 0 (first campaign), enabled = true

const contract = getContractByVersion('v8', signer)
await contract.setCampaignImmediatePayout(0, true)
```

#### Step 2: Create Admin API to Toggle Immediate Payout
- [ ] Create `/api/admin/campaigns/[id]/immediate-payout` endpoint
- [ ] Accept `enabled: boolean` in request body
- [ ] Call `contract.setCampaignImmediatePayout(campaignId, enabled)`
- [ ] Return transaction hash

#### Step 3: Add Toggle to Admin Campaign Management UI
- [ ] Add "Immediate Payout" toggle switch in campaign detail modal
- [ ] Show current status (enabled/disabled)
- [ ] Require confirmation before changing

### Phase 1: Default Behavior Change
**Goal:** Make immediate payout the default for production chains

#### Code Changes Required
```typescript
// app/api/submissions/approve/route.ts - Line 348
// BEFORE:
const immediatePayoutEnabled = body.updates?.immediate_payout_enabled ?? false

// AFTER:
// Default to TRUE for mainnet chains (1, 137, 8453), FALSE for testnets
const isMainnet = [1, 137, 8453].includes(parseInt(chainId))
const immediatePayoutEnabled = body.updates?.immediate_payout_enabled ?? isMainnet
```

#### Admin UI for Campaign Approval
- [ ] Add checkbox: "Enable Immediate Payout" (checked by default for mainnet)
- [ ] Add tooltip explaining: "When enabled, funds are sent directly to submitter on each NFT purchase"
- [ ] Show warning for testnet: "Testnet campaigns default to manual distribution"

### Phase 2: Distribution Dashboard
**Goal:** Full visibility into fund distribution status

#### Dashboard Components
- [ ] **Campaign Distribution Status Card**
  - Total raised (gross)
  - Platform fees collected
  - Net to submitter
  - Amount distributed
  - Amount pending
  - Immediate payout status
  
- [ ] **Distribution History Table**
  - Date/time
  - Amount
  - Recipient
  - Transaction hash (link to explorer)
  - Status (pending/completed/failed)

- [ ] **Quick Actions**
  - "Distribute Pending Funds" button
  - "Toggle Immediate Payout" button
  - "View on Explorer" link

### Phase 3: Automated Distribution
**Goal:** Reduce manual admin work

- [ ] Auto-distribute when campaign reaches goal
- [ ] Scheduled weekly distribution for non-immediate campaigns
- [ ] Notification system for pending distributions
- [ ] Multi-sig approval for distributions over $10,000

---

## Distribution Flow

### Current Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ADMIN UI                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │ Campaigns    │    │ Distributions│    │ Tokens       │          │
│  └──────────────┘    └──────┬───────┘    └──────────────┘          │
│                             │                                        │
│                     Click "Distribute Funds"                         │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   /api/admin/distributions/execute                   │
│                                                                      │
│  1. Authenticate admin user                                          │
│  2. Validate campaign & amount                                       │
│  3. Create distribution record (status: pending)                     │
│  4. Get signer for chain (BDAG_RELAYER_KEY or ETH_DEPLOYER_KEY)     │
│  5. Call contract.withdraw(submitterWallet, amountWei)              │
│  6. Wait for transaction confirmation                                │
│  7. Update record with tx_hash (status: completed)                   │
│  8. Update campaign funds_distributed                                │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SMART CONTRACT                                  │
│                                                                      │
│  function withdraw(address to, uint256 amount) external onlyOwner   │
│      → Transfers funds from contract to submitter wallet            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Roadmap: Phases

### Phase 1: Stability (Current Sprint) ✅
**Goal:** Make distribution reliable on all chains

- [x] Audit V5, V6, V7 contracts for withdraw functions
- [x] Add withdraw/distributePendingFunds to V7 ABI  
- [x] Update distribution API to call contract on-chain
- [x] Fix BlockDAG RPC fallback (use public RPC as default)
- [x] Update modal message to show on-chain execution
- [ ] Add error handling with retry logic
- [ ] Test distribution on live Netlify (BlockDAG + Sepolia)

### Phase 2: Enhanced UX (Next Sprint)
**Goal:** Make distribution easier for admins

- [ ] **Batch Distribution:** Select multiple campaigns, distribute all at once
- [ ] **Distribution Queue:** Queue distributions for processing
- [ ] **Gas Estimation:** Show estimated gas cost before confirming
- [ ] **Status Tracking:** Real-time status updates during distribution
- [ ] **Email Notifications:** Notify submitters when funds are distributed

### Phase 3: Automation (Future)
**Goal:** Reduce manual admin work

- [ ] **Auto-distribute on Goal Reached:** Automatically distribute when campaign hits goal
- [ ] **Scheduled Distributions:** Set up weekly/monthly distribution batches
- [ ] **Minimum Threshold:** Auto-distribute when balance exceeds threshold
- [ ] **Multi-sig Support:** Require multiple admin approvals for large distributions

### Phase 4: Advanced Features (V8+)
**Goal:** Native on-chain distribution

- [ ] **V8 Contract:** Native tip splitting in contract (no off-chain calculation)
- [ ] **Immediate Payout Mode:** Funds sent to submitter on each mint
- [ ] **Split Payout:** Configurable splits (submitter/nonprofit/platform)
- [ ] **Refund Support:** Return funds to donors if campaign fails

---

## Chain-Specific Configuration

### BlockDAG (Chain 1043)
```typescript
{
  chainId: 1043,
  rpcUrl: 'https://rpc.awakening.bdagscan.com',  // Public RPC (reliable)
  rpcFallback: 'https://bdag.nownodes.io',       // NowNodes (requires API key)
  signerKey: 'BDAG_RELAYER_KEY',
  contracts: {
    v5: '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890',
    v6: '0xaE54e4E8A75a81780361570c17b8660CEaD27053'
  },
  isTestnet: true,
  nativeCurrency: 'BDAG'
}
```

### Sepolia (Chain 11155111)
```typescript
{
  chainId: 11155111,
  rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
  signerKey: 'ETH_DEPLOYER_KEY',
  contracts: {
    v7: '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e'
  },
  isTestnet: true,
  nativeCurrency: 'ETH'
}
```

### Ethereum Mainnet (Chain 1) - Future
```typescript
{
  chainId: 1,
  rpcUrl: 'https://eth.llamarpc.com',
  signerKey: 'ETH_MAINNET_KEY',
  contracts: {
    v7: 'TBD'
  },
  isTestnet: false,
  nativeCurrency: 'ETH'
}
```

---

## Database Schema

### distributions Table
```sql
CREATE TABLE distributions (
  id UUID PRIMARY KEY,
  campaign_id UUID REFERENCES submissions(id),
  chain_id INTEGER NOT NULL,
  distribution_type VARCHAR(20) NOT NULL, -- 'funds' or 'tips'
  total_amount DECIMAL NOT NULL,
  submitter_amount DECIMAL NOT NULL,
  nonprofit_amount DECIMAL DEFAULT 0,
  platform_fee DECIMAL DEFAULT 0,
  tip_split_submitter_pct INTEGER DEFAULT 100,
  tip_split_nonprofit_pct INTEGER DEFAULT 0,
  submitter_wallet VARCHAR(42),
  nonprofit_wallet VARCHAR(42),
  status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
  tx_hash VARCHAR(66),
  error_message TEXT,
  initiated_by UUID REFERENCES profiles(id),
  native_currency VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

---

## Environment Variables Required

### For BlockDAG Distribution
```env
BLOCKDAG_RPC=https://rpc.awakening.bdagscan.com
BDAG_RELAYER_KEY=0x...  # Private key with contract owner permissions
```

### For Sepolia Distribution
```env
ETHEREUM_SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com
ETH_DEPLOYER_KEY=0x...  # Private key with contract owner permissions
```

### For Ethereum Mainnet (Future)
```env
ETHEREUM_RPC=https://eth.llamarpc.com
ETH_MAINNET_KEY=0x...  # Private key with contract owner permissions
```

---

## Testing Checklist

### Before Each Distribution
- [ ] Verify contract has sufficient balance
- [ ] Verify submitter wallet address is valid
- [ ] Verify admin has correct permissions
- [ ] Check RPC connection is working

### After Distribution
- [ ] Verify tx hash on block explorer
- [ ] Verify submitter received funds
- [ ] Verify database record updated
- [ ] Verify campaign totals updated

---

## Logging & Monitoring

All distribution events are logged:
```typescript
logger.info(`[Distribution] Executing withdraw: ${amount} ${currency} to ${wallet}`)
logger.info(`[Distribution] Contract: ${address}, Chain: ${chainId}, Version: ${version}`)
logger.info(`[Distribution] Transaction submitted: ${txHash}`)
logger.info(`[Distribution] Transaction confirmed in block ${blockNumber}`)
logger.error(`[Distribution] Transaction failed: ${error}`)
```

---

## Summary

The fund distribution system is now fully functional with on-chain execution. Key improvements made:

1. **On-Chain Execution:** API calls contract `withdraw()` directly
2. **Multi-Chain Support:** Works on BlockDAG (V5/V6) and Sepolia (V7)
3. **Reliable RPC:** Uses public BlockDAG RPC as default
4. **Full Audit Trail:** All distributions recorded with tx hashes

Next steps focus on batch distribution, automation, and V8 native features.

---

*Last Updated: January 2, 2026*
*Author: PatriotPledge Development Team*
