# Admin Fund Distribution UI - Comprehensive Roadmap & Implementation Plan

> **Date**: January 1, 2026  
> **Author**: Cascade AI Architect  
> **Status**: Planning Phase  
> **Priority**: HIGH - Required for Ethereum Mainnet Launch

---

## Executive Summary

This document outlines the complete architecture and implementation plan for the Admin Fund Distribution UI. This feature allows administrators to:

1. **View fund balances** per campaign (gross, net, tips, distributed)
2. **Distribute funds** to submitters and nonprofits
3. **Split tips** between submitters and nonprofits (configurable)
4. **Track distribution history** with on-chain verification
5. **Handle multi-chain distributions** (BlockDAG, Sepolia, Ethereum)

---

## Part 1: V7 Contract Audit - Tip Splitting Capability

### Current State

The V7 contract (`PatriotPledgeNFTV7.sol`) currently handles tips as follows:

```solidity
// Line 721-760 in _distributeFunds()
function _distributeFunds(
    uint256 campaignId,
    uint256 contribution,
    uint256 tipAmount
) internal {
    // Calculate platform fee
    uint256 platformFee = (contribution * feeConfig.platformFeeBps) / BPS_DENOMINATOR;
    
    // Submitter receives: contribution - platform fee + ALL tips
    uint256 submitterAmount = contribution - platformFee + tipAmount;
    
    // ... sends to submitter
}
```

**Current Behavior**:
- Platform takes X% of contribution (configurable, default 1%)
- 100% of tips go to submitter
- Nonprofit receives 0% by default (no nonprofit fee)

### Required Contract Modification for Tip Splitting

To support tip splitting, we need to add a new function to V7:

```solidity
// Proposed addition to V7 contract

struct TipSplitConfig {
    uint16 submitterShareBps;  // e.g., 7000 = 70% to submitter
    uint16 nonprofitShareBps;  // e.g., 3000 = 30% to nonprofit
}

mapping(uint256 => TipSplitConfig) public campaignTipSplits;

function distributeTipsWithSplit(
    uint256 campaignId,
    uint16 submitterShareBps,
    uint16 nonprofitShareBps
) external onlyOwner nonReentrant {
    require(submitterShareBps + nonprofitShareBps == 10000, "Must total 100%");
    
    Campaign storage c = campaigns[campaignId];
    uint256 tips = c.tipsReceived;
    require(tips > 0, "No tips to distribute");
    
    uint256 submitterAmount = (tips * submitterShareBps) / 10000;
    uint256 nonprofitAmount = tips - submitterAmount;
    
    c.tipsReceived = 0; // Reset tips after distribution
    
    // Send to submitter
    (bool s1,) = c.submitter.call{value: submitterAmount}("");
    require(s1, "Submitter transfer failed");
    
    // Send to nonprofit
    (bool s2,) = c.nonprofit.call{value: nonprofitAmount}("");
    require(s2, "Nonprofit transfer failed");
    
    emit TipsDistributed(campaignId, submitterAmount, nonprofitAmount);
}
```

**Decision Required**: Should we:
A) Modify V7 contract to add tip splitting (requires redeployment)
B) Keep tip splitting in database and handle off-chain
C) Use V8 contract for new campaigns with tip splitting

---

## Part 2: Architecture Design (Following ISP & Modular Principles)

### Component Hierarchy

```
components/
└── admin/
    └── fund-distribution/
        ├── index.ts                           # Barrel exports
        ├── types.ts                           # ISP interfaces (< 50 lines each)
        │
        ├── hooks/
        │   ├── useFundDistribution.ts         # Main data hook (< 100 lines)
        │   ├── useCampaignBalances.ts         # Balance fetching (< 80 lines)
        │   ├── useDistributionActions.ts      # Action handlers (< 100 lines)
        │   └── useDistributionHistory.ts      # History fetching (< 80 lines)
        │
        ├── components/
        │   ├── FundDistributionPanel.tsx      # Main orchestrator (< 150 lines)
        │   ├── CampaignBalanceCard.tsx        # Single campaign balance (< 100 lines)
        │   ├── CampaignBalanceList.tsx        # List of campaigns (< 80 lines)
        │   ├── DistributionForm.tsx           # Distribution form (< 150 lines)
        │   ├── TipSplitSlider.tsx             # Tip split UI (< 80 lines)
        │   ├── DistributionHistory.tsx        # History list (< 100 lines)
        │   ├── DistributionConfirmModal.tsx   # Confirmation (< 100 lines)
        │   └── NetworkSelector.tsx            # Chain selection (< 60 lines)
        │
        └── utils/
            ├── formatters.ts                  # Display formatters (< 50 lines)
            └── validators.ts                  # Input validation (< 50 lines)
```

### Interface Segregation Principle (ISP)

Each interface is small, focused, and serves a single purpose:

```typescript
// types.ts - Following ISP

// 1. Balance Reading Interface
interface ICampaignBalanceReader {
  getCampaignBalance(campaignId: string): Promise<CampaignBalance>
  getAllCampaignBalances(): Promise<CampaignBalance[]>
}

// 2. Distribution Writing Interface
interface IFundDistributor {
  distributeFunds(campaignId: string, amount: number): Promise<DistributionResult>
  distributeTips(campaignId: string, split: TipSplit): Promise<DistributionResult>
}

// 3. History Reading Interface
interface IDistributionHistoryReader {
  getDistributionHistory(campaignId: string): Promise<Distribution[]>
  getAllDistributions(): Promise<Distribution[]>
}

// 4. Chain Interaction Interface
interface IChainDistributor {
  executeDistribution(chainId: number, campaignId: number, params: DistributionParams): Promise<TransactionResult>
  verifyDistribution(txHash: string): Promise<boolean>
}

// Data Types
interface CampaignBalance {
  campaignId: string
  chainId: number
  chainName: string
  isTestnet: boolean
  // Gross amounts
  grossRaised: number
  grossRaisedNative: number
  // Net amounts (after platform fee)
  netRaised: number
  netRaisedNative: number
  // Tips
  tipsReceived: number
  tipsReceivedNative: number
  tipsDistributed: number
  // Distribution status
  totalDistributed: number
  pendingDistribution: number
  // Addresses
  submitterWallet: string
  nonprofitWallet: string
  // Currency
  nativeCurrency: string
}

interface TipSplit {
  submitterPercent: number  // 0-100
  nonprofitPercent: number  // 0-100
}

interface Distribution {
  id: string
  campaignId: string
  chainId: number
  txHash: string
  timestamp: Date
  type: 'funds' | 'tips' | 'refund'
  // Amounts
  totalAmount: number
  submitterAmount: number
  nonprofitAmount: number
  platformFee: number
  // Status
  status: 'pending' | 'confirmed' | 'failed'
  confirmedAt?: Date
}

interface DistributionParams {
  campaignId: number
  amount: number
  tipSplit?: TipSplit
  recipient: 'submitter' | 'nonprofit' | 'both'
}

interface TransactionResult {
  success: boolean
  txHash?: string
  error?: string
}
```

---

## Part 3: Database Schema Changes

### New Tables Required

```sql
-- 1. Distribution History Table
CREATE TABLE public.distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES submissions(id),
  chain_id INTEGER NOT NULL,
  tx_hash VARCHAR(66),
  
  -- Distribution type
  distribution_type VARCHAR(20) NOT NULL, -- 'funds', 'tips', 'refund'
  
  -- Amounts (in native currency)
  total_amount DECIMAL(36,18) NOT NULL,
  submitter_amount DECIMAL(36,18) NOT NULL DEFAULT 0,
  nonprofit_amount DECIMAL(36,18) NOT NULL DEFAULT 0,
  platform_fee DECIMAL(36,18) NOT NULL DEFAULT 0,
  
  -- USD equivalents
  total_amount_usd DECIMAL(18,2),
  submitter_amount_usd DECIMAL(18,2),
  nonprofit_amount_usd DECIMAL(18,2),
  
  -- Tip split used
  tip_split_submitter_pct INTEGER, -- 0-100
  tip_split_nonprofit_pct INTEGER, -- 0-100
  
  -- Recipient addresses
  submitter_wallet VARCHAR(42),
  nonprofit_wallet VARCHAR(42),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, confirmed, failed
  
  -- Metadata
  initiated_by UUID REFERENCES auth.users(id),
  initiated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  -- Indexes
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_distributions_campaign ON distributions(campaign_id);
CREATE INDEX idx_distributions_status ON distributions(status);
CREATE INDEX idx_distributions_chain ON distributions(chain_id);

-- 2. Tip Split Configuration Table
CREATE TABLE public.tip_split_configs (
  id SERIAL PRIMARY KEY,
  campaign_id UUID REFERENCES submissions(id) UNIQUE,
  submitter_percent INTEGER NOT NULL DEFAULT 100 CHECK (submitter_percent >= 0 AND submitter_percent <= 100),
  nonprofit_percent INTEGER NOT NULL DEFAULT 0 CHECK (nonprofit_percent >= 0 AND nonprofit_percent <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT tip_split_total CHECK (submitter_percent + nonprofit_percent = 100)
);

-- 3. Add pending_distribution tracking to submissions
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS total_distributed DECIMAL(36,18) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_distribution DECIMAL(36,18) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_distribution_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tips_distributed DECIMAL(36,18) DEFAULT 0;

-- 4. Views for fund reporting
CREATE OR REPLACE VIEW campaign_fund_status AS
SELECT 
  s.id,
  s.title,
  s.chain_id,
  s.chain_name,
  s.is_testnet,
  s.creator_wallet,
  -- Gross amounts
  COALESCE(SUM(p.amount_usd), 0) as gross_raised_usd,
  COALESCE(SUM(p.amount_native), 0) as gross_raised_native,
  -- Tips
  COALESCE(SUM(p.tip_usd), 0) as tips_received_usd,
  COALESCE(SUM(p.tip_eth), COALESCE(SUM(p.tip_bdag), 0)) as tips_received_native,
  -- Distributed
  s.total_distributed,
  s.tips_distributed,
  -- Pending
  COALESCE(SUM(p.amount_usd), 0) - COALESCE(s.total_distributed, 0) as pending_distribution_usd,
  -- Native currency
  CASE 
    WHEN s.chain_id = 1043 THEN 'BDAG'
    WHEN s.chain_id IN (1, 11155111) THEN 'ETH'
    ELSE 'UNKNOWN'
  END as native_currency
FROM submissions s
LEFT JOIN purchases p ON s.id = p.submission_id
WHERE s.status = 'minted'
GROUP BY s.id, s.title, s.chain_id, s.chain_name, s.is_testnet, 
         s.creator_wallet, s.total_distributed, s.tips_distributed;
```

---

## Part 4: API Routes

### Route Structure

```
app/
└── api/
    └── admin/
        └── distributions/
            ├── route.ts                    # GET all, POST new distribution
            ├── [campaignId]/
            │   ├── route.ts                # GET campaign distributions
            │   └── balances/
            │       └── route.ts            # GET on-chain balances
            ├── execute/
            │   └── route.ts                # POST execute distribution
            ├── verify/
            │   └── route.ts                # POST verify tx
            └── tip-split/
                └── route.ts                # GET/POST tip split config
```

### API Contracts

```typescript
// GET /api/admin/distributions
// Response: Distribution[]

// GET /api/admin/distributions/[campaignId]/balances
// Response: CampaignBalance

// POST /api/admin/distributions/execute
// Request: { campaignId, type, amount, tipSplit? }
// Response: { txHash, status }

// POST /api/admin/distributions/tip-split
// Request: { campaignId, submitterPercent, nonprofitPercent }
// Response: { success }
```

---

## Part 5: UI Components Design

### FundDistributionPanel (Main Orchestrator)

```
┌─────────────────────────────────────────────────────────────────┐
│ 💰 Fund Distribution                                    [Refresh]│
├─────────────────────────────────────────────────────────────────┤
│ Network: [All ▼] [BlockDAG ▼] [Sepolia ▼] [Ethereum ▼]          │
│ Status:  [All ▼] [Pending ▼] [Distributed ▼]                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📊 Summary                                                   │ │
│ │ Total Pending: $12,450.00 (249 ETH + 50,000 BDAG)           │ │
│ │ Total Tips: $1,230.00 (ready to distribute)                  │ │
│ │ Testnet Funds: $8,200.00 (not real money)                    │ │
│ │ Mainnet Funds: $4,250.00 (REAL MONEY)                        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Campaign: Larry Odom Recovery                    🧪 TESTNET │ │
│ │ Chain: BlockDAG (1043)                                       │ │
│ │ ──────────────────────────────────────────────────────────── │ │
│ │ Gross Raised:      500 BDAG ($25.00)                         │ │
│ │ Tips Received:     100 BDAG ($5.00)                          │ │
│ │ Platform Fee:      5 BDAG ($0.25) - 1%                       │ │
│ │ ──────────────────────────────────────────────────────────── │ │
│ │ Pending:           595 BDAG ($29.75)                         │ │
│ │ Distributed:       0 BDAG ($0.00)                            │ │
│ │ ──────────────────────────────────────────────────────────── │ │
│ │ Submitter: 0x5204...4dd9                                     │ │
│ │ Nonprofit: 0x1234...5678                                     │ │
│ │                                                               │ │
│ │ Tip Split: [===⬤========] 70% Submitter / 30% Nonprofit      │ │
│ │                                                               │ │
│ │ [Distribute Funds] [Distribute Tips] [View History]          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Campaign: Ethereum Test Campaign                 💰 MAINNET │ │
│ │ Chain: Ethereum (1)                                          │ │
│ │ ...                                                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Distribution Confirmation Modal

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ Confirm Distribution                                    [X]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Campaign: Larry Odom Recovery                                    │
│ Network: BlockDAG (Testnet) 🧪                                   │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Distribution Summary                                         │ │
│ │                                                               │ │
│ │ Total Amount:     595 BDAG ($29.75)                          │ │
│ │                                                               │ │
│ │ → Submitter (70%):  416.50 BDAG ($20.83)                     │ │
│ │   Wallet: 0x5204...4dd9                                      │ │
│ │                                                               │ │
│ │ → Nonprofit (30%):  178.50 BDAG ($8.92)                      │ │
│ │   Wallet: 0x1234...5678                                      │ │
│ │                                                               │ │
│ │ Gas Estimate: ~0.001 BDAG ($0.00)                            │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ⚠️ This action cannot be undone. Funds will be sent to the     │
│    blockchain addresses shown above.                             │
│                                                                  │
│ [Cancel]                          [✅ Confirm Distribution]     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 6: TDD Test Plan

### E2E Tests (Playwright)

```typescript
// tests/e2e/admin-fund-distribution.spec.ts

describe('Admin Fund Distribution', () => {
  beforeEach(async () => {
    // Login as admin
    await loginAsAdmin(page)
    await page.goto('/admin')
    await page.getByTestId('fund-distribution-tab').click()
  })

  describe('Viewing Balances', () => {
    test('should display all campaigns with pending balances', async () => {
      await expect(page.getByTestId('campaign-balance-list')).toBeVisible()
      await expect(page.getByTestId('campaign-balance-card')).toHaveCount(greaterThan(0))
    })

    test('should show testnet/mainnet labels correctly', async () => {
      const testnetCard = page.getByTestId('campaign-balance-card').filter({ hasText: 'TESTNET' })
      await expect(testnetCard).toBeVisible()
    })

    test('should filter by network', async () => {
      await page.getByTestId('network-filter').selectOption('sepolia')
      const cards = page.getByTestId('campaign-balance-card')
      for (const card of await cards.all()) {
        await expect(card).toContainText('Sepolia')
      }
    })
  })

  describe('Tip Split Configuration', () => {
    test('should update tip split percentages', async () => {
      await page.getByTestId('tip-split-slider').fill('70')
      await expect(page.getByTestId('submitter-percent')).toContainText('70%')
      await expect(page.getByTestId('nonprofit-percent')).toContainText('30%')
    })

    test('should validate total equals 100%', async () => {
      // Slider should always maintain 100% total
    })
  })

  describe('Fund Distribution', () => {
    test('should open distribution confirmation modal', async () => {
      await page.getByTestId('distribute-funds-btn').first().click()
      await expect(page.getByTestId('distribution-confirm-modal')).toBeVisible()
    })

    test('should show correct amounts in confirmation', async () => {
      await page.getByTestId('distribute-funds-btn').first().click()
      await expect(page.getByTestId('total-amount')).toContainText(/\d+/)
      await expect(page.getByTestId('submitter-amount')).toContainText(/\d+/)
    })

    test('should not allow distribution for mainnet without extra confirmation', async () => {
      // Mainnet distributions require additional confirmation
      await page.getByTestId('network-filter').selectOption('ethereum')
      await page.getByTestId('distribute-funds-btn').first().click()
      await expect(page.getByTestId('mainnet-warning')).toBeVisible()
    })
  })

  describe('Distribution History', () => {
    test('should display past distributions', async () => {
      await page.getByTestId('view-history-btn').first().click()
      await expect(page.getByTestId('distribution-history')).toBeVisible()
    })

    test('should show tx hash links to explorer', async () => {
      await page.getByTestId('view-history-btn').first().click()
      const txLink = page.getByTestId('tx-hash-link').first()
      await expect(txLink).toHaveAttribute('href', /etherscan|bdagscan/)
    })
  })
})
```

### Unit Tests (Jest/Vitest)

```typescript
// tests/unit/fund-distribution/validators.test.ts

describe('Fund Distribution Validators', () => {
  describe('validateTipSplit', () => {
    test('should accept valid 100% total split', () => {
      expect(validateTipSplit(70, 30)).toBe(true)
      expect(validateTipSplit(100, 0)).toBe(true)
      expect(validateTipSplit(0, 100)).toBe(true)
    })

    test('should reject split not totaling 100%', () => {
      expect(validateTipSplit(70, 40)).toBe(false)
      expect(validateTipSplit(50, 40)).toBe(false)
    })

    test('should reject negative values', () => {
      expect(validateTipSplit(-10, 110)).toBe(false)
    })
  })

  describe('validateDistributionAmount', () => {
    test('should reject amount greater than balance', () => {
      expect(validateDistributionAmount(1000, 500)).toBe(false)
    })

    test('should accept amount equal to balance', () => {
      expect(validateDistributionAmount(500, 500)).toBe(true)
    })
  })
})

// tests/unit/fund-distribution/formatters.test.ts

describe('Fund Distribution Formatters', () => {
  describe('formatNativeAmount', () => {
    test('should format ETH amounts correctly', () => {
      expect(formatNativeAmount(1.5, 'ETH')).toBe('1.5000 ETH')
    })

    test('should format BDAG amounts correctly', () => {
      expect(formatNativeAmount(1000, 'BDAG')).toBe('1,000.00 BDAG')
    })
  })

  describe('calculateDistributionAmounts', () => {
    test('should calculate tip split correctly', () => {
      const result = calculateDistributionAmounts(100, { submitterPercent: 70, nonprofitPercent: 30 })
      expect(result.submitterAmount).toBe(70)
      expect(result.nonprofitAmount).toBe(30)
    })
  })
})
```

---

## Part 7: Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create database migration for distributions table
- [ ] Create types.ts with ISP interfaces
- [ ] Create useCampaignBalances hook
- [ ] Create CampaignBalanceCard component
- [ ] Write E2E test for viewing balances

### Phase 2: Balance Display (Week 1-2)
- [ ] Create FundDistributionPanel orchestrator
- [ ] Create CampaignBalanceList component
- [ ] Create NetworkSelector component
- [ ] Implement filtering by network/status
- [ ] Write unit tests for formatters

### Phase 3: Tip Split UI (Week 2)
- [ ] Create TipSplitSlider component
- [ ] Create tip_split_configs table
- [ ] Create POST /api/admin/distributions/tip-split route
- [ ] Write E2E tests for tip split

### Phase 4: Distribution Actions (Week 2-3)
- [ ] Create DistributionForm component
- [ ] Create DistributionConfirmModal component
- [ ] Create useDistributionActions hook
- [ ] Create POST /api/admin/distributions/execute route
- [ ] Integrate with V7 contract for on-chain distribution
- [ ] Write E2E tests for distribution flow

### Phase 5: History & Verification (Week 3)
- [ ] Create DistributionHistory component
- [ ] Create useDistributionHistory hook
- [ ] Create verification endpoint
- [ ] Link tx hashes to block explorers
- [ ] Write E2E tests for history

### Phase 6: Multi-Chain Support (Week 3-4)
- [ ] Handle BlockDAG distribution (V5/V6)
- [ ] Handle Sepolia distribution (V7)
- [ ] Handle Ethereum Mainnet distribution (V7)
- [ ] Add mainnet safety confirmations
- [ ] Full integration testing

---

## Part 8: Security Considerations

### On-Chain Distribution
1. **Re-entrancy Protection**: All distribution functions use `nonReentrant` modifier
2. **Access Control**: Only contract owner can initiate distributions
3. **Balance Checks**: Verify contract has sufficient balance before distribution

### Admin UI Security
1. **Role-Based Access**: Only admins with `fund_distribution` permission
2. **Mainnet Confirmation**: Extra confirmation step for real money
3. **Transaction Signing**: Use relayer wallet with limited funds
4. **Audit Trail**: All distributions logged with initiator ID

### Rate Limiting
1. **API Rate Limits**: Max 10 distributions per minute
2. **Cooldown Period**: 1 minute between distributions for same campaign

---

## Part 9: File Size Compliance

Per global rules, all files must be < 300-400 lines:

| File | Max Lines | Purpose |
|------|-----------|---------|
| types.ts | 100 | ISP interfaces only |
| useCampaignBalances.ts | 80 | Data fetching only |
| useDistributionActions.ts | 100 | Actions only |
| useDistributionHistory.ts | 80 | History fetching only |
| FundDistributionPanel.tsx | 150 | Orchestration only |
| CampaignBalanceCard.tsx | 100 | Single card UI only |
| CampaignBalanceList.tsx | 80 | List container only |
| DistributionForm.tsx | 150 | Form UI only |
| TipSplitSlider.tsx | 80 | Slider UI only |
| DistributionHistory.tsx | 100 | History list only |
| DistributionConfirmModal.tsx | 100 | Confirmation only |
| NetworkSelector.tsx | 60 | Dropdown only |
| formatters.ts | 50 | Formatting utils only |
| validators.ts | 50 | Validation utils only |

---

## Part 10: Decision Points

### Question 1: Contract Modification for Tip Splitting

**Options**:
A) **Modify V7 contract** - Add `distributeTipsWithSplit` function
   - Pros: On-chain enforcement, trustless
   - Cons: Requires redeployment, gas costs

B) **Off-chain tip splitting** - Calculate split in backend, make 2 separate transfers
   - Pros: No contract changes
   - Cons: Requires admin wallet to hold funds temporarily

C) **V8 contract** - Create new version with tip splitting
   - Pros: Clean implementation
   - Cons: Migration complexity

**Recommendation**: Option A (modify V7) for new deployments, Option B for existing V7 instances.

### Question 2: Default Tip Split

**Options**:
- 100% to Submitter (current)
- 70/30 Submitter/Nonprofit
- 50/50 Submitter/Nonprofit
- Configurable per campaign (recommended)

### Question 3: Immediate vs Batch Distribution

**Options**:
- Distribute on each purchase (gas intensive)
- Batch distribute daily (gas efficient)
- Manual distribution by admin (current)
- Threshold-based distribution (e.g., every $100)

---

## Appendix: Data Test IDs

Per global UI rules, all interactive elements must have `data-testid`:

```
fund-distribution-tab
campaign-balance-list
campaign-balance-card
campaign-balance-card-{id}
network-filter
status-filter
tip-split-slider
submitter-percent
nonprofit-percent
distribute-funds-btn
distribute-tips-btn
view-history-btn
distribution-confirm-modal
distribution-confirm-btn
distribution-cancel-btn
mainnet-warning
total-amount
submitter-amount
nonprofit-amount
tx-hash-link
distribution-history
distribution-history-item
```

---

## Summary

This roadmap provides a complete plan for implementing the Admin Fund Distribution UI following all Windsurf global rules:

1. ✅ **TDD** - E2E and unit tests defined before implementation
2. ✅ **ISP** - Small, focused interfaces
3. ✅ **Modular** - Each file < 300 lines
4. ✅ **Data Test IDs** - All interactive elements have testids
5. ✅ **Semantic HTML** - Proper elements used
6. ✅ **Multi-chain** - BlockDAG, Sepolia, Ethereum support
7. ✅ **Testnet/Mainnet** - Clear visual distinction

**Estimated Total Effort**: 3-4 weeks
**Priority**: HIGH (required for Ethereum Mainnet launch)
