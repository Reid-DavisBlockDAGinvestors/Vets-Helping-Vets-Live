# Testnet vs Mainnet Funds Differentiation Roadmap

## 🟡 PRIORITY 3 - MEDIUM PRIORITY

**Status:** No visual distinction between testnet and mainnet funds across UI

---

## Executive Summary

This roadmap outlines a comprehensive plan to visually distinguish between **testnet funds** (BlockDAG, Sepolia - fauceted/test tokens) and **mainnet funds** (Ethereum Mainnet - real money with exchange value). This is critical for accurate financial reporting and user trust.

---

## 🔴 CURRENT PROBLEM

### The Issue
All fundraising amounts are displayed identically regardless of whether they represent:
- **Real money** (Ethereum Mainnet - ETH with USD exchange value)
- **Test tokens** (BlockDAG BDAG, Sepolia ETH - zero real-world value)

### Why This Matters
1. **Misleading Metrics**: Platform stats combine test and real funds
2. **User Confusion**: Donors may think testnet campaigns raised real money
3. **Regulatory Risk**: Financial reporting must distinguish real vs test funds
4. **Trust Issues**: Mixing test data with production undermines credibility

### Current State
| Chain | Currency | Real Value | UI Display | Status |
|-------|----------|------------|------------|--------|
| Ethereum Mainnet (1) | ETH | ✅ Yes (~$3,100/ETH) | "$X raised" | 🔴 No distinction |
| Sepolia (11155111) | ETH | ❌ No (test ETH) | "$X raised" | 🔴 No distinction |
| BlockDAG (1043) | BDAG | ❌ No (test BDAG) | "$X raised" | 🔴 No distinction |

---

## 🎯 SOLUTION OVERVIEW

### Visual Hierarchy
```
┌─────────────────────────────────────────────────────────────────┐
│  MAINNET CAMPAIGNS (Real Funds)                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 💎 A Mother's Fight to Keep Her Family                      ││
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ││
│  │ $150 raised of $5,000 goal                                  ││
│  │ 🟢 LIVE ON ETHEREUM MAINNET • Real Funds                    ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TESTNET CAMPAIGNS (Test Funds)                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🧪 Larry Odom Test Campaign                                 ││
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ││
│  │ ~$500 test value raised                                     ││
│  │ 🟠 TESTNET (BlockDAG) • Not Real Funds                      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ IMPLEMENTATION PLAN

### Phase 1: Data Model Updates
**Time Estimate:** 2-3 hours

#### Add Chain Classification to Database
```sql
-- Add is_mainnet column to submissions table
ALTER TABLE submissions ADD COLUMN is_mainnet BOOLEAN DEFAULT false;

-- Update existing records
UPDATE submissions SET is_mainnet = true WHERE chain_id = '1';
UPDATE submissions SET is_mainnet = false WHERE chain_id IN ('1043', '11155111');

-- Add index for filtering
CREATE INDEX idx_submissions_is_mainnet ON submissions(is_mainnet);
```

#### Chain Configuration Constants
Create `lib/chains/classification.ts`:
```typescript
export const CHAIN_CLASSIFICATION = {
  // Mainnets (real funds, exchange-listed)
  MAINNETS: [1, 137, 8453, 42161], // Ethereum, Polygon, Base, Arbitrum
  
  // Testnets (test funds, fauceted)
  TESTNETS: [1043, 11155111, 80001, 84531], // BlockDAG, Sepolia, Mumbai, Base Goerli
}

export function isMainnet(chainId: number): boolean {
  return CHAIN_CLASSIFICATION.MAINNETS.includes(chainId)
}

export function isTestnet(chainId: number): boolean {
  return CHAIN_CLASSIFICATION.TESTNETS.includes(chainId)
}

export function getChainBadge(chainId: number): {
  label: string
  color: 'green' | 'orange' | 'gray'
  icon: string
  tooltip: string
} {
  if (isMainnet(chainId)) {
    return {
      label: 'LIVE',
      color: 'green',
      icon: '💎',
      tooltip: 'Real funds on Ethereum Mainnet'
    }
  }
  return {
    label: 'TESTNET',
    color: 'orange',
    icon: '🧪',
    tooltip: 'Test funds - not real money'
  }
}
```

### Phase 2: UI Components for Distinction
**Time Estimate:** 4-6 hours

#### Create Chain Badge Component
Create `components/ui/ChainBadge.tsx`:
```typescript
'use client'

import { isMainnet, getChainBadge } from '@/lib/chains/classification'

interface ChainBadgeProps {
  chainId: number
  showTooltip?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function ChainBadge({ chainId, showTooltip = true, size = 'md' }: ChainBadgeProps) {
  const badge = getChainBadge(chainId)
  
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5'
  }
  
  const colorClasses = {
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    gray: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  return (
    <span 
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${sizeClasses[size]} ${colorClasses[badge.color]}`}
      title={showTooltip ? badge.tooltip : undefined}
      data-testid="chain-badge"
    >
      <span>{badge.icon}</span>
      <span>{badge.label}</span>
    </span>
  )
}
```

#### Create Funds Display Component
Create `components/ui/FundsDisplay.tsx`:
```typescript
'use client'

import { isMainnet } from '@/lib/chains/classification'
import { ChainBadge } from './ChainBadge'

interface FundsDisplayProps {
  amount: number
  currency: string
  chainId: number
  showBadge?: boolean
  prefix?: string
}

export function FundsDisplay({ 
  amount, 
  currency, 
  chainId, 
  showBadge = true,
  prefix = ''
}: FundsDisplayProps) {
  const isReal = isMainnet(chainId)
  
  // Format amount based on mainnet/testnet
  const formattedAmount = isReal 
    ? `$${amount.toLocaleString()}`
    : `~$${amount.toLocaleString()}`
  
  const label = isReal ? 'raised' : 'test value'

  return (
    <div className="flex items-center gap-2" data-testid="funds-display">
      <span className={isReal ? 'text-green-400 font-bold' : 'text-orange-400'}>
        {prefix}{formattedAmount}
      </span>
      <span className="text-white/60">{label}</span>
      {showBadge && <ChainBadge chainId={chainId} size="sm" />}
    </div>
  )
}
```

### Phase 3: Update All UI Locations
**Time Estimate:** 8-12 hours

#### Locations to Update (Playwright Audit Required)

##### 1. Homepage / Marketplace (`/marketplace`)
- [ ] Campaign cards: Add chain badge
- [ ] Funds raised: Use FundsDisplay component
- [ ] Progress bar: Different colors for mainnet/testnet
- [ ] Filter: Add "Show Mainnet Only" toggle

##### 2. Story Page (`/story/[id]`)
- [ ] Hero section: Chain badge next to title
- [ ] Progress bar: Color distinction
- [ ] Raised amount: FundsDisplay component
- [ ] Transaction history: Label each tx with chain

##### 3. NFT Card Component
- [ ] Badge overlay: "LIVE" or "TESTNET"
- [ ] Price display: Real vs test value

##### 4. Purchase Panel
- [ ] Header: Chain indicator
- [ ] Amount input: Currency with chain context
- [ ] Confirmation: Clear chain disclosure

##### 5. Admin Dashboard (`/admin`)
- [ ] Stats cards: Separate mainnet/testnet totals
- [ ] Campaigns table: Chain column with badges
- [ ] Distributions: Filter by mainnet/testnet

##### 6. Platform Stats (`/api/stats/platform`)
- [ ] Total raised (mainnet only)
- [ ] Total raised (testnet - separate)
- [ ] Combined total with breakdown

##### 7. User Profile
- [ ] NFT collection: Chain badges on each
- [ ] Donation history: Mainnet vs testnet sections
- [ ] Total donated: Split by chain type

##### 8. Receipt/Confirmation Pages
- [ ] Clear chain identification
- [ ] "Real funds" vs "Test transaction" labels

### Phase 4: API Updates
**Time Estimate:** 4-6 hours

#### Update Stats API
Update `/api/stats/platform/route.ts`:
```typescript
// Return separate totals
return NextResponse.json({
  mainnet: {
    totalRaised: mainnetTotal,
    campaigns: mainnetCampaigns,
    donors: mainnetDonors,
    label: 'Real Funds (Ethereum Mainnet)'
  },
  testnet: {
    totalRaised: testnetTotal,
    campaigns: testnetCampaigns,
    donors: testnetDonors,
    label: 'Test Funds (BlockDAG, Sepolia)'
  },
  combined: {
    totalRaised: mainnetTotal + testnetTotal,
    disclaimer: 'Combined total includes test funds'
  }
})
```

#### Update Marketplace API
Update `/api/marketplace/fundraisers/route.ts`:
```typescript
// Add is_mainnet to response
const fundraisers = campaigns.map(c => ({
  ...c,
  is_mainnet: isMainnet(parseInt(c.chain_id)),
  chain_badge: getChainBadge(parseInt(c.chain_id))
}))

// Add filter support
if (searchParams.get('mainnet_only') === 'true') {
  fundraisers = fundraisers.filter(f => f.is_mainnet)
}
```

### Phase 5: Playwright Testing
**Time Estimate:** 4-6 hours

#### Test Cases
```typescript
// tests/testnet-mainnet-distinction.spec.ts

test.describe('Testnet vs Mainnet Fund Distinction', () => {
  
  test('Homepage shows chain badges on campaign cards', async ({ page }) => {
    await page.goto('/marketplace')
    
    // Find mainnet campaign
    const mainnetCard = page.locator('[data-testid="campaign-card"]').filter({
      has: page.locator('[data-testid="chain-badge"]:has-text("LIVE")')
    })
    await expect(mainnetCard).toBeVisible()
    
    // Find testnet campaign
    const testnetCard = page.locator('[data-testid="campaign-card"]').filter({
      has: page.locator('[data-testid="chain-badge"]:has-text("TESTNET")')
    })
    await expect(testnetCard).toBeVisible()
  })

  test('Story page shows correct chain context', async ({ page }) => {
    // Navigate to Ethereum Mainnet campaign
    await page.goto('/story/mothers-fight') // Replace with actual slug
    
    await expect(page.getByTestId('chain-badge')).toContainText('LIVE')
    await expect(page.getByTestId('funds-display')).toContainText('$')
    await expect(page.getByTestId('funds-display')).toContainText('raised')
  })

  test('Testnet campaign shows test value disclaimer', async ({ page }) => {
    // Navigate to BlockDAG testnet campaign
    await page.goto('/story/larry-odom') // Replace with actual slug
    
    await expect(page.getByTestId('chain-badge')).toContainText('TESTNET')
    await expect(page.getByTestId('funds-display')).toContainText('~$')
    await expect(page.getByTestId('funds-display')).toContainText('test value')
  })

  test('Admin dashboard shows separate totals', async ({ page }) => {
    await page.goto('/admin')
    // Login...
    
    await expect(page.getByTestId('mainnet-total')).toBeVisible()
    await expect(page.getByTestId('testnet-total')).toBeVisible()
    await expect(page.getByTestId('mainnet-total')).toContainText('Real Funds')
    await expect(page.getByTestId('testnet-total')).toContainText('Test Funds')
  })

  test('Filter marketplace by mainnet only', async ({ page }) => {
    await page.goto('/marketplace')
    
    // Enable mainnet filter
    await page.getByTestId('mainnet-filter-toggle').click()
    
    // All visible cards should be mainnet
    const cards = page.locator('[data-testid="campaign-card"]')
    for (const card of await cards.all()) {
      await expect(card.locator('[data-testid="chain-badge"]')).toContainText('LIVE')
    }
  })
})
```

---

## 📍 UI LOCATIONS CHECKLIST

### Public Pages
| Location | Component | Current State | Action Required |
|----------|-----------|---------------|-----------------|
| `/marketplace` | Campaign Cards | No chain indicator | Add ChainBadge |
| `/marketplace` | Stats Header | Combined total | Split mainnet/testnet |
| `/story/[id]` | Hero Section | No chain indicator | Add ChainBadge |
| `/story/[id]` | Progress Bar | Generic blue | Green (mainnet) / Orange (testnet) |
| `/story/[id]` | Raised Amount | "$X raised" | FundsDisplay component |
| `/` | Homepage Stats | Combined total | Show "Real Funds: $X" prominently |
| `/nft/[id]` | NFT Detail | No chain indicator | Add ChainBadge |

### Admin Pages
| Location | Component | Current State | Action Required |
|----------|-----------|---------------|-----------------|
| `/admin` | Stats Dashboard | Combined totals | Separate cards |
| `/admin/campaigns` | Campaign Table | Chain ID column | Add badge column |
| `/admin/distributions` | Distribution List | No filter | Add mainnet/testnet filter |
| `/admin/tokens` | Token List | Chain column | Add badge |
| `/admin/settings` | Contract Settings | Chain dropdown | Add mainnet indicator |

### Components
| Component | File | Current State | Action Required |
|-----------|------|---------------|-----------------|
| NFTCard | `components/NFTCard.tsx` | No chain indicator | Add ChainBadge overlay |
| CampaignCard | `components/CampaignCard.tsx` | No chain indicator | Add ChainBadge |
| PurchasePanel | `components/PurchasePanelV2.tsx` | Chain in tabs | Add prominent badge |
| StatsCard | `components/StatsCard.tsx` | Generic | Split by chain type |

---

## 🎨 DESIGN SPECIFICATIONS

### Color Palette
| Element | Mainnet | Testnet |
|---------|---------|---------|
| Badge Background | `bg-green-500/20` | `bg-orange-500/20` |
| Badge Text | `text-green-400` | `text-orange-400` |
| Badge Border | `border-green-500/30` | `border-orange-500/30` |
| Progress Bar | `bg-green-500` | `bg-orange-500` |
| Amount Text | `text-green-400` | `text-orange-400` |

### Icons
| Chain Type | Icon | Alt Icon |
|------------|------|----------|
| Mainnet | 💎 | ✅ |
| Testnet | 🧪 | ⚠️ |

### Labels
| Context | Mainnet Label | Testnet Label |
|---------|---------------|---------------|
| Badge | "LIVE" | "TESTNET" |
| Funds | "$X raised" | "~$X test value" |
| Tooltip | "Real funds on Ethereum" | "Test funds - not real money" |
| Filter | "Mainnet Campaigns" | "All Campaigns" |

---

## 📊 SUCCESS METRICS

### Before Implementation
- 0% of UI locations distinguish mainnet vs testnet
- Users cannot filter by real campaigns
- Platform stats mix real and test funds

### After Implementation
- 100% of fund displays show chain context
- Filter available on marketplace
- Admin dashboard shows clear separation
- Progress bars visually distinct

---

## 📅 TIMELINE

| Phase | Task | Duration | Priority |
|-------|------|----------|----------|
| 1 | Data Model Updates | 2-3 hours | 🟡 Medium |
| 2 | UI Components | 4-6 hours | 🟡 Medium |
| 3 | Update All UI Locations | 8-12 hours | 🟡 Medium |
| 4 | API Updates | 4-6 hours | 🟡 Medium |
| 5 | Playwright Testing | 4-6 hours | 🟡 Medium |
| - | **Total** | **22-33 hours** | - |

---

## 🔗 RELATED DOCUMENTS

- `FUND_DISTRIBUTION_ROADMAP.md` - Priority 1 (Higher)
- `MULTI_WALLET_CONNECTION_ROADMAP.md` - Priority 2 (Higher)
- `ELITE_ROADMAP.md` - Master roadmap

---

*Last Updated: January 3, 2026*
*Priority: 3 (Medium)*
*Author: PatriotPledge Development Team*
