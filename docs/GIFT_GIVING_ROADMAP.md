# Gift Giving Roadmap

## Executive Summary

This roadmap outlines the implementation of a flexible gift giving system that allows supporters to contribute to campaigns without requiring an NFT purchase. The system will support multiple giving modes: with NFT, without NFT, with account, and anonymous.

---

## 📌 Current Status (Updated Jan 3, 2026)

| Item | Status | Notes |
|------|--------|-------|
| **Phase 1: UI Rename** | ✅ COMPLETE | Tips → Gifts in all UI components |
| **V8 Contract** | ✅ VERIFIED | [Etherscan](https://etherscan.io/address/0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e#code) |
| **V9 Contract** | 📝 DRAFT | `contracts/PatriotPledgeNFTV9.sol` - NOT DEPLOYED |
| **Tooling** | ✅ UPGRADED | Solidity 0.8.28, OpenZeppelin 5.1.0 |

### ⚠️ Important Notes

1. **V9 is a DRAFT** - The V9 contract exists in the codebase but is NOT deployed. We are still running on V8 for production.

2. **V9 may change** - Additional features may be added before deployment. The contract may be modified or replaced entirely based on requirements.

3. **Current Flow** - The purchase flow still uses V8's `mintWithTip()` function. The UI displays "Gift" but the underlying contract uses "tip" terminology.

4. **V9 Deployment Trigger** - Will deploy V9 when ready for the next fundraiser that needs the new gift distribution features.

5. **Admin Gift Distribution UI** - Will be built when V9 is deployed. Currently not needed since V8 sends tips immediately to submitter.

---

## 🎁 Current State vs. Desired State

### Current Behavior (V8 Contract)
| Feature | Current | Issue |
|---------|---------|-------|
| "Tips" naming | Tips | Confusing - sounds like tipping a service |
| Tip distribution | Immediate to submitter | Admin wanted manual control |
| Gift without NFT | ❌ Not supported | Users must buy NFT to contribute |
| Anonymous giving | ❌ Not supported | Account required |
| Direct wallet transfer | ❌ Not tracked | Funds sent directly bypass platform |

### Desired State
| Feature | Desired | Benefit |
|---------|---------|---------|
| "Gifts" naming | Gifts | Clearer intent - charitable giving |
| Gift distribution | Held for admin distribution | Control over fund disbursement |
| Gift without NFT | ✅ Supported | Lower barrier to entry |
| Anonymous giving | ✅ Supported | Privacy for donors |
| Direct wallet tracking | ⚠️ Explore carefully | Trust but verify |

---

## 📋 Implementation Phases

### Phase 1: Rename Tips to Gifts (Quick Win) ✅ COMPLETE
**Effort:** Low | **Impact:** Medium | **Timeline:** 1 day | **Completed:** Jan 3, 2026

#### UI Changes Required
- [x] `components/PurchasePanelV2.tsx` - Renamed "Tip" to "Gift"
- [x] `components/purchase/TipSelector.tsx` - Renamed to GiftSelector
- [x] `components/purchase-panel/hooks/usePurchaseConfig.ts` - tipAmount → giftAmount
- [x] `components/purchase-panel/hooks/useBdagPurchase.ts` - tipAmount → giftAmount
- [x] `components/purchase-panel/hooks/useEthPurchase.ts` - tipAmountUsd → giftAmountUsd
- [x] `components/purchase-panel/types.ts` - Updated all type definitions
- [x] `components/purchase/types.ts` - TipSelectorProps → GiftSelectorProps
- [ ] Admin dashboard - Update distribution UI labels (DEFERRED to V9 deployment)

#### Copy Changes
```
BEFORE: "Add a tip to show extra support"
AFTER:  "Add a gift to show extra support"

BEFORE: "Tip amount"
AFTER:  "Gift amount"

BEFORE: "$5 tip"
AFTER:  "$5 gift"
```

#### Database Considerations
- Consider renaming `tip_amount` → `gift_amount` (migration)
- Or keep `tip_amount` internally, display as "gift" in UI

---

### Phase 2: Gift Without NFT Purchase
**Effort:** Medium | **Impact:** High | **Timeline:** 1-2 weeks

#### User Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                     CAMPAIGN STORY PAGE                          │
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │  🖼️ Purchase NFT  │    │  🎁 Give a Gift   │                   │
│  │  ($20 + gift)    │    │  (Any amount)     │                   │
│  └────────┬─────────┘    └────────┬─────────┘                   │
│           │                       │                              │
│           ▼                       ▼                              │
│    NFT + Gift flow         Gift-only flow                       │
│    (existing)              (NEW)                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Smart Contract Options

**Option A: Use Existing Contract (Recommended for MVP)**
- Create a special "Gift-Only" campaign with $0 NFT price
- Gifts recorded as tips on this campaign
- No actual NFT minted (or mint a "Thank You" NFT)
- Pros: No contract changes needed
- Cons: Workaround, not elegant

**Option B: Add Gift Function to V9 Contract**
```solidity
// New function for V9
function giveGift(uint256 campaignId) external payable {
    require(msg.value > 0, "Gift must be > 0");
    Campaign storage c = campaigns[campaignId];
    c.giftsReceived += msg.value;
    c.grossRaised += msg.value;
    // Funds held on contract for admin distribution
    emit GiftReceived(campaignId, msg.sender, msg.value);
}
```
- Pros: Clean implementation, proper tracking
- Cons: Requires new contract deployment

**Option C: Separate Gift Contract**
```solidity
// Standalone gift contract
contract PatriotPledgeGifts {
    mapping(uint256 => uint256) public campaignGifts;
    
    function give(uint256 campaignId) external payable {
        campaignGifts[campaignId] += msg.value;
        emit GiftReceived(campaignId, msg.sender, msg.value);
    }
    
    function distribute(uint256 campaignId, address to) external onlyOwner {
        uint256 amount = campaignGifts[campaignId];
        campaignGifts[campaignId] = 0;
        payable(to).transfer(amount);
    }
}
```
- Pros: Separate concerns, easier to upgrade
- Cons: Multiple contracts to manage

#### Recommended Approach for Phase 2
1. Start with **Option A** (workaround) for quick launch
2. Plan **Option B** for V9 contract with proper gift function
3. Consider **Option C** if gift volume becomes significant

#### UI Components Needed
- [ ] `GiftOnlyPanel.tsx` - Standalone gift form
- [ ] `GiftAmountSelector.tsx` - Preset amounts ($5, $10, $25, $50, Custom)
- [ ] `GiftConfirmation.tsx` - Success message with thank you
- [ ] Update `CampaignCard.tsx` - Show "Give Gift" button

#### Database Schema Addition
```sql
CREATE TABLE gifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES submissions(id),
    user_id UUID REFERENCES auth.users(id), -- NULL for anonymous
    wallet_address VARCHAR(42),
    amount_native DECIMAL NOT NULL,
    amount_usd DECIMAL NOT NULL,
    chain_id INTEGER NOT NULL,
    tx_hash VARCHAR(66),
    is_anonymous BOOLEAN DEFAULT FALSE,
    donor_name VARCHAR(100), -- Optional display name
    donor_message TEXT, -- Optional message
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, distributed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    distributed_at TIMESTAMPTZ,
    distribution_tx_hash VARCHAR(66)
);

CREATE INDEX idx_gifts_campaign ON gifts(campaign_id);
CREATE INDEX idx_gifts_status ON gifts(status);
```

---

### Phase 3: Anonymous Gift Giving (No Account Required)
**Effort:** Medium | **Impact:** High | **Timeline:** 1-2 weeks

#### User Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                     GIFT GIVING FLOW                             │
│                                                                  │
│  Step 1: Choose Amount                                           │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌──────────┐                   │
│  │ $5  │ │ $10 │ │ $25 │ │ $50 │ │ Custom   │                   │
│  └─────┘ └─────┘ └─────┘ └─────┘ └──────────┘                   │
│                                                                  │
│  Step 2: Choose Identity                                         │
│  ┌─────────────────────┐  ┌─────────────────────┐               │
│  │ 👤 Give as myself    │  │ 🎭 Give anonymously  │               │
│  │ (Sign in/Create acct)│  │ (No account needed) │               │
│  └─────────────────────┘  └─────────────────────┘               │
│                                                                  │
│  Step 3 (Anonymous): Optional Info                               │
│  ┌─────────────────────────────────────────────┐                │
│  │ Display name: "A Patriot" (optional)        │                │
│  │ Message: "Thank you for your service"       │                │
│  └─────────────────────────────────────────────┘                │
│                                                                  │
│  Step 4: Connect Wallet & Pay                                    │
│  ┌─────────────────────────────────────────────┐                │
│  │ 🦊 Connect MetaMask                          │                │
│  │ 💳 Or pay with card (Stripe)                │                │
│  └─────────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

#### Technical Implementation

**API Endpoint: `/api/gifts/anonymous`**
```typescript
// No auth required
export async function POST(request: Request) {
    const { campaignId, amount, chainId, txHash, displayName, message } = await request.json()
    
    // Verify transaction on-chain
    const verified = await verifyTransaction(txHash, chainId, amount)
    if (!verified) return error('Transaction not found')
    
    // Record anonymous gift
    await supabase.from('gifts').insert({
        campaign_id: campaignId,
        user_id: null, // Anonymous
        wallet_address: txFrom,
        amount_native: amount,
        is_anonymous: true,
        donor_name: displayName || 'Anonymous Patriot',
        donor_message: message
    })
    
    return { success: true }
}
```

**Privacy Considerations**
- Wallet address is recorded (visible on-chain anyway)
- No email/personal info required
- Optional display name (can be pseudonym)
- Message is public on campaign page
- IP address NOT stored for anonymous gifts

**Display on Campaign Page**
```
Recent Supporters:
- Anonymous Patriot gave $25 - "Thank you for your service"
- John D. gave $50 - "Proud to support our veterans"
- Anonymous gave $10
- A Fellow Veteran gave $100 - "Semper Fi"
```

---

### Phase 4: Direct Wallet Transfer Analysis
**Effort:** Analysis only | **Impact:** TBD | **Timeline:** 1 week analysis

#### The Question
Should we allow users to see the submitter's wallet address and send funds directly, bypassing the platform?

#### Pros ✅
| Benefit | Description |
|---------|-------------|
| **Trust** | Some users don't trust smart contracts |
| **Simplicity** | No wallet connection to platform needed |
| **Lower fees** | No platform fee, just gas |
| **Privacy** | No platform tracking of donation |
| **Accessibility** | Works from any wallet, any platform |

#### Cons ❌
| Risk | Description |
|------|-------------|
| **No tracking** | Platform can't show accurate totals |
| **No receipts** | Donor gets no confirmation from us |
| **Fraud risk** | Someone could post fake wallet address |
| **No refunds** | Can't refund if campaign is fraudulent |
| **Tax issues** | No documentation for tax purposes |
| **Lost revenue** | No platform fee = no sustainability |
| **Support burden** | "I sent funds but it doesn't show up" |

#### Security Risks 🚨
| Risk | Severity | Mitigation |
|------|----------|------------|
| Wallet spoofing | HIGH | Only show verified submitter addresses |
| Phishing | HIGH | Clear warnings, verification badges |
| Man-in-middle | MEDIUM | HTTPS, signed messages |
| Social engineering | MEDIUM | Education, warnings |

#### Recommendation

**Option 1: Don't Show Wallet Address (Safest)**
- All contributions must go through platform
- Full tracking and accountability
- Platform fee sustains operations
- **Recommended for launch**

**Option 2: Show Address with Strong Warnings**
```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ ADVANCED: Direct Transfer                                    │
│                                                                  │
│ Submitter's verified wallet:                                     │
│ 0x8250...09C9 [Copy] [View on Etherscan]                        │
│                                                                  │
│ ⚠️ WARNING: Direct transfers are:                               │
│ • Not tracked by PatriotPledge                                  │
│ • Not eligible for refunds                                       │
│ • Not included in campaign totals                               │
│ • Not documented for tax purposes                               │
│                                                                  │
│ We recommend using the platform for your protection.            │
│                                                                  │
│ [I understand, show address]                                    │
└─────────────────────────────────────────────────────────────────┘
```

**Option 3: Track External Transfers (Complex)**
- Monitor submitter wallets for incoming transfers
- Attempt to match with platform visitors
- Display "External donations: ~$X,XXX"
- **Very complex, privacy concerns**

#### Verdict
**Start with Option 1** (don't show address). Consider Option 2 after platform is established and trusted. Avoid Option 3 due to complexity and privacy issues.

---

## 📊 Implementation Priority Matrix

| Feature | Effort | Impact | Priority | Timeline |
|---------|--------|--------|----------|----------|
| Rename Tips → Gifts | Low | Medium | 🔴 P1 | 1 day |
| Gift without NFT (Option A) | Medium | High | 🔴 P1 | 1 week |
| Anonymous giving | Medium | High | 🟡 P2 | 2 weeks |
| V9 gift function | High | High | 🟡 P2 | 1 month |
| Direct transfer analysis | Low | Medium | 🟢 P3 | Ongoing |

---

## 🔄 Contract Behavior: Tips vs Gifts

### Current V8 Behavior (Issue)
```solidity
// V8: Tips go immediately to submitter (NOT DESIRED)
function _distributeFunds(uint256 campaignId, uint256 contribution, uint256 tipAmount) internal {
    uint256 submitterAmount = contribution - platformFee + tipAmount; // ← Tips included
    c.submitter.call{value: submitterAmount}(""); // ← Sent immediately
}
```

### V9 Contract Specification (REQUIRED)

#### Fee Structure
| Fee Type | Percentage | Recipient | When Applied |
|----------|------------|-----------|---------------|
| **Platform Fee** | 1% | Platform Treasury | On gift receipt |
| **Nonprofit Fee** | 1% | Nonprofit Wallet | On gift receipt |
| **Net Gift** | 98% | Held on contract | Manual distribution |

#### Gift Distribution Flow
```
Gift Received: $100
    ↓
├─ Platform Fee (1%): $1.00 → Platform Treasury (immediate)
├─ Nonprofit Fee (1%): $1.00 → Nonprofit Wallet (immediate)  
└─ Net Gift (98%): $98.00 → Held on Contract
    ↓
Admin Manual Distribution:
├─ Submitter %: Configurable (default 80%)
└─ Platform %: Configurable (default 20%)
```

#### V9 Solidity Implementation
```solidity
// V9: Gifts held for admin distribution with fee deductions
uint256 public constant GIFT_PLATFORM_FEE_BPS = 100; // 1%
uint256 public constant GIFT_NONPROFIT_FEE_BPS = 100; // 1%

mapping(uint256 => uint256) public campaignGiftBalance; // Held gifts per campaign
mapping(uint256 => uint256) public campaignGiftsDistributed;

function _processGift(uint256 campaignId, uint256 giftAmount) internal {
    Campaign storage c = campaigns[campaignId];
    
    // Deduct fees immediately
    uint256 platformFee = (giftAmount * GIFT_PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
    uint256 nonprofitFee = (giftAmount * GIFT_NONPROFIT_FEE_BPS) / BPS_DENOMINATOR;
    uint256 netGift = giftAmount - platformFee - nonprofitFee;
    
    // Transfer fees immediately
    (bool s1,) = platformTreasury.call{value: platformFee}("");
    require(s1, "Platform fee transfer failed");
    
    (bool s2,) = c.nonprofit.call{value: nonprofitFee}("");
    require(s2, "Nonprofit fee transfer failed");
    
    // Hold net gift on contract for manual distribution
    campaignGiftBalance[campaignId] += netGift;
    c.grossRaised += giftAmount;
    c.tipsReceived += giftAmount; // Track separately
    
    emit GiftReceived(campaignId, msg.sender, giftAmount, platformFee, nonprofitFee, netGift);
}

// Admin distributes held gifts manually
function distributeGifts(
    uint256 campaignId, 
    uint256 submitterPercent // e.g., 8000 = 80%
) external onlyOwner {
    require(submitterPercent <= BPS_DENOMINATOR, "Invalid percent");
    
    uint256 balance = campaignGiftBalance[campaignId];
    require(balance > 0, "No gifts to distribute");
    
    Campaign storage c = campaigns[campaignId];
    
    uint256 toSubmitter = (balance * submitterPercent) / BPS_DENOMINATOR;
    uint256 toPlatform = balance - toSubmitter;
    
    campaignGiftBalance[campaignId] = 0;
    campaignGiftsDistributed[campaignId] += balance;
    
    (bool s1,) = c.submitter.call{value: toSubmitter}("");
    require(s1, "Submitter transfer failed");
    
    (bool s2,) = platformTreasury.call{value: toPlatform}("");
    require(s2, "Platform transfer failed");
    
    emit GiftsDistributed(campaignId, toSubmitter, toPlatform, submitterPercent);
}

// Gift-only function (no NFT purchase required)
function giveGift(uint256 campaignId) external payable {
    require(msg.value > 0, "Gift must be > 0");
    Campaign storage c = campaigns[campaignId];
    require(c.active && !c.closed && !c.paused, "Campaign not accepting gifts");
    
    _processGift(campaignId, msg.value);
}
```

#### V9 Events
```solidity
event GiftReceived(
    uint256 indexed campaignId, 
    address indexed donor, 
    uint256 totalAmount,
    uint256 platformFee,
    uint256 nonprofitFee,
    uint256 netGift
);

event GiftsDistributed(
    uint256 indexed campaignId,
    uint256 toSubmitter,
    uint256 toPlatform,
    uint256 submitterPercent
);
```

### Migration Path
1. **Phase 1:** Rename UI only (V8 unchanged)
2. **Phase 2:** Add gift-only option (workaround)
3. **Phase 3:** Deploy V9 with proper gift handling
4. **Phase 4:** Migrate campaigns to V9

---

## 🎯 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Gift conversion rate | 10% of visitors | Analytics |
| Anonymous gift % | 30% of gifts | Database |
| Avg gift amount | $25 | Database |
| Gift-only vs NFT+Gift | 40% / 60% | Database |
| User satisfaction | 4.5/5 | Survey |

---

## 📝 Next Steps

1. **Immediate:** Rename "Tips" to "Gifts" in UI
2. **Week 1:** Implement gift-only option (Option A workaround)
3. **Week 2:** Add anonymous giving flow
4. **Month 1:** Design and test V9 contract with proper gift handling
5. **Ongoing:** Monitor and decide on direct transfer option

---

*Last Updated: January 3, 2026*
*Author: PatriotPledge Development Team*
