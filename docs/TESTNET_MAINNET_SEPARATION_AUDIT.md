# Testnet vs Mainnet Separation - Comprehensive Audit & Implementation Plan

> **Date**: January 1, 2026
> **Author**: Cascade AI Architect
> **Status**: Planning Phase

---

## Executive Summary

PatriotPledge is transitioning from testnet-only operations (BlockDAG Awakening, Sepolia) to include **real money** mainnet deployments (Ethereum Mainnet). This document provides a comprehensive audit of the current system and a detailed implementation plan to:

1. **Distinguish testnet funds from mainnet funds** in the database and UI
2. **Enable admin network selection** when approving campaigns
3. **Prevent cross-network purchases** (testnet campaigns can't accept mainnet funds)
4. **Add testnet warnings** to all testnet networks (BlockDAG + Sepolia)
5. **Prepare for Ethereum mainnet launch** with real fundraising

---

## Part 1: Current State Audit

### 1.1 Database Tables Affected

| Table | Current State | Testnet/Mainnet Issues |
|-------|--------------|------------------------|
| `submissions` | Has `chain_id`, `chain_name`, `contract_version` | No `is_testnet` flag, no explicit network binding at approval |
| `purchases` | Has `chain_id`, `chain_name`, `contract_version` | No `is_testnet` flag, funds not categorized |
| `events` | Has `chain_id`, `contract_version` | No `is_testnet` flag |
| `contracts` | Has `chain_id`, `is_active`, `is_mintable` | Missing `is_testnet` flag |
| `chain_configs` | Has `is_testnet` column | ✅ Already has testnet distinction |

### 1.2 Current Chain Configuration (`lib/chains.ts`)

| Chain ID | Name | isTestnet | Status |
|----------|------|-----------|--------|
| 1043 | BlockDAG | `false` ❌ **INCORRECT** | Should be `true` (Awakening is testnet) |
| 11155111 | Sepolia | `true` ✅ | Correct |
| 1 | Ethereum | `false` ✅ | Correct (mainnet) |
| 137 | Polygon | `false` ✅ | Correct (not active) |
| 8453 | Base | `false` ✅ | Correct (not active) |

### 1.3 Current Admin Approval Flow

**File**: `app/api/submissions/approve/route.ts`

**Current Behavior**:
- Uses `getActiveContractVersion()` to determine contract
- Contract version determines chain implicitly
- **No admin choice of network** at approval time
- All campaigns go to the "active" contract (currently V6 on BlockDAG)

**Problem**: Admin cannot choose which network/contract to deploy a campaign on.

### 1.4 Current Purchase Flow

**File**: `components/PurchasePanelV2.tsx`

**Current Behavior**:
- User selects network (BlockDAG or Sepolia)
- Any campaign can be purchased on any network
- **No validation** that the campaign's network matches the payment network

**Problem**: A BlockDAG campaign could theoretically be purchased with Sepolia ETH (cross-network issue).

### 1.5 Funds Tracking

**Current State**:
- All purchases recorded with `amount_bdag`, `amount_usd`
- No distinction between testnet and mainnet funds
- `purchases.chain_id` exists but not used for fund categorization

**Problem**: Cannot separate "play money" from "real money" in reporting.

---

## Part 2: Required Schema Changes

### 2.1 New Columns Needed

```sql
-- submissions table
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS is_testnet BOOLEAN DEFAULT true;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS target_chain_id INTEGER;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS target_contract_version VARCHAR(20);

-- purchases table  
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS is_testnet BOOLEAN DEFAULT true;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS amount_native DECIMAL(36,18); -- Native token amount (BDAG, ETH, etc)
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS native_currency VARCHAR(10); -- 'BDAG', 'ETH', 'MATIC'

-- contracts table
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS is_testnet BOOLEAN DEFAULT false;

-- Update existing data
UPDATE contracts SET is_testnet = true WHERE chain_id IN (1043, 11155111);
UPDATE contracts SET is_testnet = false WHERE chain_id IN (1, 137, 8453);
```

### 2.2 New Views for Fund Reporting

```sql
-- Testnet funds summary
CREATE OR REPLACE VIEW testnet_funds_summary AS
SELECT 
  chain_id,
  chain_name,
  COUNT(*) as total_purchases,
  SUM(amount_usd) as total_usd,
  SUM(amount_bdag) as total_bdag
FROM purchases 
WHERE is_testnet = true
GROUP BY chain_id, chain_name;

-- Mainnet funds summary (real money)
CREATE OR REPLACE VIEW mainnet_funds_summary AS
SELECT 
  chain_id,
  chain_name,
  COUNT(*) as total_purchases,
  SUM(amount_usd) as total_usd,
  SUM(amount_native) as total_native,
  native_currency
FROM purchases 
WHERE is_testnet = false
GROUP BY chain_id, chain_name, native_currency;
```

### 2.3 Backfill Strategy

All existing data is testnet (BlockDAG Awakening + Sepolia testing):

```sql
-- Mark all existing submissions as testnet
UPDATE submissions SET is_testnet = true WHERE is_testnet IS NULL;

-- Mark all existing purchases as testnet
UPDATE purchases SET is_testnet = true WHERE is_testnet IS NULL;

-- Mark all existing events as testnet  
UPDATE events SET is_testnet = true WHERE is_testnet IS NULL;
```

---

## Part 3: Implementation Plan

### Phase 1: Database Migration (Priority: HIGH)

1. **Create migration file**: `20260101_testnet_mainnet_separation.sql`
2. **Add columns** to submissions, purchases, events, contracts
3. **Backfill existing data** as testnet
4. **Create reporting views**
5. **Update chain_configs** with correct testnet flags

### Phase 2: Fix Chain Configuration (Priority: HIGH)

**File**: `lib/chains.ts`

1. Mark BlockDAG (1043) as `isTestnet: true`
2. Add helper function `isTestnetChain(chainId)`
3. Add helper function `canAcceptPaymentsFrom(campaignChainId, paymentChainId)`

### Phase 3: Admin Portal - Network Selection (Priority: HIGH)

**Files to modify**:
- `components/admin/submissions/SubmissionReviewModal.tsx`
- `components/admin/submissions/hooks/useSubmissionActions.ts`
- `app/api/submissions/approve/route.ts`

**Changes**:
1. Add network/contract selector dropdown in approval modal
2. Show available networks based on active contracts
3. Pass selected `target_chain_id` and `target_contract_version` to API
4. API creates campaign on the specified network

### Phase 4: Purchase Flow - Network Validation (Priority: HIGH)

**Files to modify**:
- `components/PurchasePanelV2.tsx`
- `components/purchase-panel/hooks/useEthPurchase.ts`
- `components/purchase-panel/hooks/useBdagPurchase.ts`
- `app/api/purchase/record/route.ts`

**Changes**:
1. Pass campaign's `chain_id` to purchase panel
2. Only show compatible networks for payment
3. Validate payment network matches campaign network
4. Record `is_testnet` flag on purchases

### Phase 5: UI - Testnet Warnings (Priority: MEDIUM)

**Files to modify**:
- `components/purchase-panel/CryptoPaymentSection.tsx`
- `components/PurchasePanelV2.tsx`

**Changes**:
1. Add testnet warning banner for ALL testnet networks
2. Show "⚠️ TESTNET - Uses test tokens only" for BlockDAG AND Sepolia
3. Hide testnet networks when purchasing mainnet campaigns

### Phase 6: Reporting & Dashboard (Priority: MEDIUM)

**Files to modify**:
- `components/admin/Dashboard.tsx` (if exists)
- `app/api/admin/stats/route.ts`

**Changes**:
1. Separate testnet vs mainnet stats
2. Show "Real Funds Raised" vs "Test Funds Raised"
3. Add filter toggle for testnet/mainnet view

---

## Part 4: Detailed File Changes

### 4.1 `lib/chains.ts` Changes

```typescript
// CHANGE: BlockDAG is a testnet (Awakening phase)
1043: {
  chainId: 1043,
  name: 'BlockDAG Testnet',  // Renamed from "Mainnet"
  shortName: 'BDAG',
  isTestnet: true,  // CHANGED from false
  // ... rest unchanged
}

// ADD: Helper functions
export function isTestnetChain(chainId: ChainId): boolean {
  return CHAIN_CONFIGS[chainId]?.isTestnet ?? true
}

export function getTestnetChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter(c => c.isTestnet && c.isActive)
}

export function getMainnetChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter(c => !c.isTestnet && c.isActive)
}

export function canPurchaseWith(campaignChainId: ChainId, paymentChainId: ChainId): boolean {
  // Campaigns must be purchased on the same network they were created on
  return campaignChainId === paymentChainId
}
```

### 4.2 Admin Approval Modal Changes

Add network selector:

```tsx
// In SubmissionReviewModal.tsx
const [targetNetwork, setTargetNetwork] = useState<{
  chainId: number
  contractVersion: string
} | null>(null)

// Get available networks from active contracts
const availableNetworks = [
  { chainId: 1043, name: 'BlockDAG (Testnet)', contractVersion: 'v6', isTestnet: true },
  { chainId: 11155111, name: 'Sepolia (Testnet)', contractVersion: 'v7', isTestnet: true },
  { chainId: 1, name: 'Ethereum (Mainnet)', contractVersion: 'v7', isTestnet: false },
]

// Render network selector
<label>Deploy to Network</label>
<select onChange={(e) => setTargetNetwork(JSON.parse(e.target.value))}>
  <option value="">Select Network...</option>
  {availableNetworks.filter(n => n.isActive).map(n => (
    <option key={n.chainId} value={JSON.stringify(n)}>
      {n.name} {n.isTestnet ? '⚠️ Testnet' : '💰 Mainnet'}
    </option>
  ))}
</select>

// Warning for mainnet
{!targetNetwork?.isTestnet && (
  <div className="bg-green-500/20 border border-green-500 p-3 rounded">
    💰 MAINNET DEPLOYMENT - This campaign will raise REAL FUNDS
  </div>
)}
```

### 4.3 API Approval Route Changes

```typescript
// In app/api/submissions/approve/route.ts

// Accept network selection from admin
const targetChainId = body.targetChainId || 1043 // Default to BlockDAG
const targetContractVersion = body.targetContractVersion || 'v6'

// Validate the target network has an active contract
const contractConfig = await getContractByChainAndVersion(targetChainId, targetContractVersion)
if (!contractConfig) {
  return NextResponse.json({ error: 'INVALID_TARGET_NETWORK' }, { status: 400 })
}

// Get chain config to determine testnet status
const chainConfig = CHAIN_CONFIGS[targetChainId]
const isTestnet = chainConfig?.isTestnet ?? true

// Save with network binding
await supabaseAdmin.from('submissions').update({
  chain_id: targetChainId,
  chain_name: chainConfig?.name,
  contract_version: targetContractVersion,
  is_testnet: isTestnet,
  // ... rest
}).eq('id', id)
```

### 4.4 Purchase Panel Changes

```tsx
// In PurchasePanelV2.tsx

// Get campaign's target network
const campaignChainId = submission?.chain_id || 1043
const campaignIsTestnet = submission?.is_testnet ?? true

// Only show compatible networks
const availableNetworks = campaignIsTestnet 
  ? getTestnetChains() 
  : getMainnetChains()

// Filter to only the campaign's specific network
const compatibleNetwork = availableNetworks.find(n => n.chainId === campaignChainId)

// If mainnet campaign, don't show testnet options at all
{campaignIsTestnet ? (
  // Show all testnet options
  <NetworkSelector networks={getTestnetChains()} />
) : (
  // Mainnet - only show the specific network
  <div className="bg-green-500/20 p-3 rounded">
    💰 This campaign accepts {compatibleNetwork?.name} only
  </div>
)}
```

---

## Part 5: Testing Strategy

### Unit Tests

```typescript
// tests/chains.test.ts
describe('Chain Configuration', () => {
  it('should mark BlockDAG as testnet', () => {
    expect(isTestnetChain(1043)).toBe(true)
  })
  
  it('should mark Ethereum as mainnet', () => {
    expect(isTestnetChain(1)).toBe(false)
  })
  
  it('should prevent cross-network purchases', () => {
    expect(canPurchaseWith(1, 1043)).toBe(false) // ETH mainnet campaign, BDAG payment
    expect(canPurchaseWith(1, 1)).toBe(true) // Same network
  })
})
```

### E2E Tests

```typescript
// tests/e2e/mainnet-campaign.spec.ts
test('mainnet campaign cannot be purchased with testnet tokens', async ({ page }) => {
  // Create mainnet campaign via admin
  await adminCreateCampaign({ chainId: 1, isTestnet: false })
  
  // Navigate to campaign
  await page.goto('/story/123')
  
  // Verify testnet options are not shown
  await expect(page.getByTestId('network-bdag-btn')).not.toBeVisible()
  await expect(page.getByTestId('network-sepolia-btn')).not.toBeVisible()
  
  // Only Ethereum mainnet should be shown
  await expect(page.getByText('Ethereum (Mainnet)')).toBeVisible()
})
```

---

## Part 6: Migration Checklist

### Before Going Live with Mainnet

- [ ] Run database migration for testnet/mainnet columns
- [ ] Backfill all existing data as testnet
- [ ] Update `lib/chains.ts` to mark BlockDAG as testnet
- [ ] Add testnet warnings to BlockDAG network selector
- [ ] Implement admin network selection in approval modal
- [ ] Add network validation to purchase flow
- [ ] Deploy V7 contract to Ethereum mainnet
- [ ] Update `.env` with mainnet contract address
- [ ] Enable Ethereum mainnet in chain configs
- [ ] Test full flow: admin approval → campaign creation → mainnet purchase
- [ ] Verify fund reporting separates testnet/mainnet

### Post-Launch Monitoring

- [ ] Monitor mainnet transactions for any issues
- [ ] Verify funds are going to correct wallets
- [ ] Check reporting accuracy
- [ ] Monitor gas costs on Ethereum

---

## Part 7: Rollback Plan

If issues are discovered after mainnet launch:

1. **Disable Ethereum mainnet** in `chain_configs` (set `is_active = false`)
2. **Revert admin UI** to not show mainnet option
3. **Keep testnet operations running** as before
4. **Investigate and fix** issues in staging
5. **Re-enable mainnet** after verification

---

## Appendix A: SQL Migration Script

```sql
-- See: supabase/migrations/20260101_testnet_mainnet_separation.sql
```

## Appendix B: Environment Variables

```bash
# Mainnet (add when ready)
ETHEREUM_RPC=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
V7_CONTRACT_ETHEREUM=0x... # After mainnet deployment
NEXT_PUBLIC_V7_CONTRACT_ETHEREUM=0x...

# Enable mainnet in chain configs
ENABLE_ETHEREUM_MAINNET=true
```

---

**Document Version**: 1.0
**Last Updated**: January 1, 2026
