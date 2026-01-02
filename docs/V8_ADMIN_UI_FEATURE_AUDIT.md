# V8 Contract → Admin UI Feature Audit
## Date: January 1, 2026

This document maps every V7/V8 smart contract feature to its corresponding admin UI control.
**Goal:** Ensure admins have full control over all contract features.

---

## 📊 Feature Matrix

| Contract Feature | V7 Status | Admin UI Control | Status |
|-----------------|-----------|------------------|--------|
| **Campaign Management** ||||
| Create Campaign | ✅ | Approve Campaign Modal | ✅ Exists |
| Edit Campaign Metadata | ✅ | Edit Modal | ✅ Exists |
| Close Campaign | ✅ | Campaign Card Actions | ❌ Missing |
| Reactivate Campaign | ✅ | Campaign Card Actions | ⚠️ Partial |
| Deactivate Campaign | ✅ | Campaign Card Actions | ❌ Missing |
| **Fund Distribution** ||||
| Immediate Payout (per campaign) | ✅ | Approval Modal Checkbox | ✅ Exists |
| Global Immediate Payout Toggle | ✅ | Settings Panel | ❌ Missing |
| Distribute Funds | ✅ | Fund Distribution Panel | ⚠️ Partial |
| View Raised Amount | ✅ | Fund Distribution Panel | ✅ Exists |
| View Tips Amount | ✅ | Fund Distribution Panel | ✅ Exists |
| Tip Split Config | ✅ | Tip Split Modal | ✅ Exists |
| **Token Management** ||||
| Freeze Token | ✅ | Token Management Panel | ❌ Missing |
| Unfreeze Token | ✅ | Token Management Panel | ❌ Missing |
| Batch Freeze | ✅ | Token Management Panel | ❌ Missing |
| Make Soulbound | ✅ | Token Management Panel | ❌ Missing |
| Admin Burn Token | ✅ | Token Management Panel | ❌ Missing |
| Fix Token URI | ✅ | Token Management Panel | ❌ Missing |
| **Security** ||||
| Blacklist Address | ✅ | Security Panel | ❌ Missing |
| Remove Blacklist | ✅ | Security Panel | ❌ Missing |
| Pause Contract | ✅ | Emergency Controls | ❌ Missing |
| Unpause Contract | ✅ | Emergency Controls | ❌ Missing |
| **Fee Configuration** ||||
| Set Platform Fee | ✅ | Settings Panel | ❌ Missing |
| Set Platform Treasury | ✅ | Settings Panel | ❌ Missing |
| Set Default Royalty | ✅ | Settings Panel | ❌ Missing |
| **Bug Bounty** ||||
| Fund Bug Bounty Pool | ✅ | Bug Bounty Panel | ❌ Missing |
| Pay Bug Bounty | ✅ | Bug Bounty Panel | ❌ Missing |
| View Pool Balance | ✅ | Bug Bounty Panel | ❌ Missing |
| **Emergency** ||||
| Emergency Withdraw | ✅ | Emergency Controls | ❌ Missing |

---

## 🎯 Priority Implementation Roadmap

### Phase 1: Critical (Before Mainnet) 🔴
1. **Close/Deactivate Campaign** - Campaigns need lifecycle control
2. **Pause/Unpause Contract** - Emergency stop capability
3. **Blacklist Address** - Security for bad actors
4. **Emergency Withdraw** - Fund recovery capability

### Phase 2: High Priority (Week 1 Post-Deploy) 🟠
5. **Token Freeze Controls** - Compliance requirements
6. **Fee Configuration Panel** - Platform fee management
7. **Platform Treasury Management** - Treasury address updates
8. **Fund Distribution Improvements** - Full distribution flow

### Phase 3: Medium Priority (Month 1) 🟡
9. **Bug Bounty Management** - On-chain bounty payments
10. **Soulbound Token Controls** - Non-transferable tokens
11. **Batch Operations Panel** - Bulk token management
12. **Token URI Fixer** - Metadata repair tool

### Phase 4: Nice-to-Have 🟢
13. **Analytics Dashboard** - On-chain metrics
14. **Event Log Viewer** - Contract event history
15. **Gas Estimation Tool** - Transaction cost preview
16. **Multi-sig Integration** - Gnosis Safe support

---

## 🏗️ Proposed Admin UI Structure

```
/admin
├── /campaigns          # Campaign management (EXISTS)
│   ├── List/Filter
│   ├── Approve Modal
│   ├── Edit Modal
│   ├── [NEW] Close/Deactivate
│   └── [NEW] Lifecycle Controls
│
├── /distributions      # Fund management (EXISTS - needs work)
│   ├── Balances Panel
│   ├── Tip Split Config
│   ├── Distribution History
│   └── [NEW] Execute Distribution
│
├── /tokens             # [NEW] Token management
│   ├── Token List
│   ├── Freeze/Unfreeze
│   ├── Soulbound Toggle
│   ├── Admin Burn
│   └── Fix URI
│
├── /security           # [NEW] Security controls
│   ├── Blacklist Management
│   ├── Pause/Unpause
│   └── Emergency Withdraw
│
├── /settings           # [NEW] Contract settings
│   ├── Fee Configuration
│   ├── Treasury Address
│   ├── Royalty Settings
│   └── Global Toggles
│
└── /bug-bounty         # [NEW] Bug bounty management
    ├── Pool Balance
    ├── Fund Pool
    └── Pay Bounty
```

---

## 📋 V8 Contract Changes (Planned)

V8 will add these features requiring admin UI:

| V8 Feature | Admin UI Needed |
|------------|-----------------|
| Native Tip Splitting On-Chain | Tip split in approval modal |
| Automated Distribution | Distribution scheduler |
| Multi-sig Requirement | Multi-sig flow integration |
| Timelocked Admin Actions | Pending action queue |
| Role-Based Access | Admin role management |

---

## ✅ Immediate Action Items

1. **Add ETH_DEPLOYER_KEY to Netlify** - Required for Sepolia approvals
2. **Fix Campaign Button** - Now uses multi-chain providers
3. **Fund Distribution Panel** - Now shows BlockDAG campaigns
4. **Create Token Management Panel** - New component needed
5. **Create Security Controls Panel** - New component needed

---

## 📝 Contract Function Reference

### Campaign Functions (Admin-Callable)
```solidity
function createCampaign(...) returns (uint256)      // Approve flow
function updateCampaignMetadata(uint256, string)    // Edit flow
function closeCampaign(uint256)                     // NEEDS UI
function deactivateCampaign(uint256)                // NEEDS UI
function reactivateCampaign(uint256)                // NEEDS UI
```

### Token Functions (Admin-Callable)
```solidity
function freezeToken(uint256)                       // NEEDS UI
function unfreezeToken(uint256)                     // NEEDS UI
function batchFreezeTokens(uint256[], bool)         // NEEDS UI
function makeSoulbound(uint256)                     // NEEDS UI
function removeSoulbound(uint256)                   // NEEDS UI
function adminBurn(uint256)                         // NEEDS UI
function fixTokenURI(uint256, string)               // NEEDS UI
```

### Security Functions (Admin-Callable)
```solidity
function blacklistAddress(address)                  // NEEDS UI
function removeBlacklist(address)                   // NEEDS UI
function pause()                                    // NEEDS UI
function unpause()                                  // NEEDS UI
```

### Fee Functions (Admin-Callable)
```solidity
function setFeeConfig(uint16, bool)                 // NEEDS UI
function setPlatformTreasury(address)               // NEEDS UI
function setDefaultRoyalty(uint96)                  // NEEDS UI
```

### Bug Bounty Functions
```solidity
function fundBugBountyPool() payable                // NEEDS UI
function payBugBounty(address, uint256, string)     // NEEDS UI
```

### Emergency Functions
```solidity
function emergencyWithdraw(address, uint256)        // NEEDS UI
```
