# PatriotPledge V8 Deployment Roadmap
## Path to ETH Mainnet Live Fundraising

**Created:** January 2, 2026  
**Target:** V8 Contract on Ethereum Mainnet  
**Goal:** Production-ready multi-chain NFT fundraising platform

---

## 📊 Current Status Overview

| Component | Status | Notes |
|-----------|--------|-------|
| V5 Contract (BlockDAG) | ✅ Live | Production, 6+ campaigns |
| V6 Contract (BlockDAG) | ✅ Deployed | Batch minting, royalties |
| V7 Contract (Sepolia) | ✅ Deployed | Immediate payout, multi-chain |
| Multi-chain Infrastructure | ✅ Complete | lib/chains.ts |
| Admin Campaign Management | ✅ Complete | Approve, edit, verify |
| Admin Fund Distribution | ⚠️ Partial | Needs execution flow |
| Admin Token Management | ❌ Missing | Freeze, soulbound, burn |
| Admin Security Controls | ❌ Missing | Blacklist, pause |
| Admin Settings Panel | ❌ Missing | Fees, treasury |
| V8 Contract | 📋 Planned | Native tip splitting |

---

## 🗓️ Phase 1: Admin UI Completion (Week 1-2)

### 1.1 Token Management Panel
**Priority:** 🔴 Critical  
**Files to create:**
- `components/admin/tokens/TokenManagementPanel.tsx`
- `components/admin/tokens/TokenList.tsx`
- `components/admin/tokens/TokenActions.tsx`
- `app/api/admin/tokens/freeze/route.ts`
- `app/api/admin/tokens/burn/route.ts`
- `app/api/admin/tokens/soulbound/route.ts`

**Features:**
- [ ] View all tokens with campaign info
- [ ] Freeze/unfreeze individual tokens
- [ ] Batch freeze tokens
- [ ] Make tokens soulbound
- [ ] Admin burn tokens
- [ ] Fix token URI

### 1.2 Security Controls Panel
**Priority:** 🔴 Critical  
**Files to create:**
- `components/admin/security/SecurityPanel.tsx`
- `components/admin/security/BlacklistManager.tsx`
- `components/admin/security/ContractControls.tsx`
- `app/api/admin/security/blacklist/route.ts`
- `app/api/admin/security/pause/route.ts`

**Features:**
- [ ] Blacklist address management
- [ ] View blacklisted addresses
- [ ] Pause/unpause contract (emergency)
- [ ] Emergency withdraw capability
- [ ] Contract status indicator

### 1.3 Settings Panel
**Priority:** 🟠 High  
**Files to create:**
- `components/admin/settings/SettingsPanel.tsx`
- `components/admin/settings/FeeConfiguration.tsx`
- `components/admin/settings/TreasurySettings.tsx`
- `app/api/admin/settings/fees/route.ts`
- `app/api/admin/settings/treasury/route.ts`

**Features:**
- [ ] View current fee configuration
- [ ] Update platform fee percentage
- [ ] Update platform treasury address
- [ ] Update default royalty
- [ ] Global immediate payout toggle

### 1.4 Campaign Lifecycle Controls
**Priority:** 🟠 High  
**Files to modify:**
- `components/admin/campaigns/CampaignCard.tsx` (add buttons)
- `app/api/admin/campaigns/close/route.ts`
- `app/api/admin/campaigns/deactivate/route.ts`
- `app/api/admin/campaigns/reactivate/route.ts`

**Features:**
- [ ] Close campaign (no more minting)
- [ ] Deactivate campaign (hide from marketplace)
- [ ] Reactivate campaign
- [ ] Campaign status lifecycle display

---

## 🗓️ Phase 2: Sepolia E2E Testing (Week 2-3)

### 2.1 Fix & Verify Current Issues
- [ ] Test "Fix" button on campaigns
- [ ] Re-approve Campaign #3 on Sepolia V7
- [ ] Verify Fund Distribution shows all campaigns
- [ ] Test image display in approval modal

### 2.2 Full Purchase Flow Test
- [ ] Connect wallet to Sepolia
- [ ] Purchase NFT with test ETH
- [ ] Verify immediate payout (if enabled)
- [ ] Check NFT appears in wallet
- [ ] Verify purchase recorded in Supabase
- [ ] Test tip functionality

### 2.3 Admin Flow Test
- [ ] Approve new campaign on Sepolia
- [ ] Edit campaign metadata
- [ ] Close campaign
- [ ] Distribute funds
- [ ] Freeze token
- [ ] Blacklist test address
- [ ] Pause/unpause contract

---

## 🗓️ Phase 3: V8 Contract Development (Week 3-4)

### 3.1 V8 New Features
```solidity
// Native on-chain tip splitting
function setTipSplitConfig(uint256 campaignId, uint16 submitterPct) 

// Automated distribution triggers
function autoDistributeOnMilestone(uint256 campaignId)

// Multi-sig requirement for large withdrawals
function proposeWithdrawal(uint256 amount) returns (bytes32 proposalId)
function approveWithdrawal(bytes32 proposalId)
function executeWithdrawal(bytes32 proposalId)

// Timelocked admin actions
function scheduleAdminAction(bytes calldata action, uint256 delay)
function executeScheduledAction(bytes32 actionId)

// Role-based access control
function grantRole(bytes32 role, address account)
function revokeRole(bytes32 role, address account)
```

### 3.2 V8 Admin UI Updates
- [ ] Tip split configuration in approval modal
- [ ] Milestone distribution settings
- [ ] Multi-sig proposal queue
- [ ] Scheduled action viewer
- [ ] Role management panel

---

## 🗓️ Phase 4: V8 Sepolia Deployment (Week 4-5)

### 4.1 Deploy & Configure
- [ ] Deploy V8 to Sepolia
- [ ] Configure fee settings
- [ ] Set up test treasury
- [ ] Update lib/chains.ts with V8 address
- [ ] Update admin UI for V8 features

### 4.2 Full Regression Test
- [ ] All Phase 2 tests on V8
- [ ] New V8 feature tests
- [ ] Multi-sig flow test
- [ ] Tip splitting test
- [ ] Gas optimization verification

---

## 🗓️ Phase 5: Mainnet Preparation (Week 5-6)

### 5.1 Security Audit
- [ ] Internal code review
- [ ] External audit (if budget allows)
- [ ] Bug bounty program activation
- [ ] Penetration testing

### 5.2 Infrastructure
- [ ] Set up Ethereum Mainnet RPC (Alchemy/Infura)
- [ ] Create Gnosis Safe multi-sig wallet
- [ ] Configure mainnet environment variables
- [ ] Set up monitoring (Tenderly/OpenZeppelin Defender)

### 5.3 Legal & Compliance
- [ ] Terms of service update
- [ ] Privacy policy update
- [ ] Nonprofit verification process
- [ ] KYC/AML considerations

---

## 🗓️ Phase 6: V8 Mainnet Deployment (Week 6-7)

### 6.1 Deployment
- [ ] Deploy V8 to Ethereum Mainnet
- [ ] Transfer ownership to multi-sig
- [ ] Configure production fees
- [ ] Set production treasury
- [ ] Update lib/chains.ts

### 6.2 Launch
- [ ] Enable Ethereum network in UI
- [ ] First production campaign approval
- [ ] Monitor first purchases
- [ ] 24/7 monitoring for first week

---

## 📋 Checklist Summary

### Before Mainnet Deploy
- [ ] All admin UI panels complete
- [ ] Full E2E test on Sepolia passed
- [ ] V8 contract deployed and tested on Sepolia
- [ ] Multi-sig wallet created
- [ ] Security audit complete
- [ ] Legal review complete
- [ ] Monitoring set up

### Environment Variables Required
```
# Mainnet
ETHEREUM_RPC=https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY
ETH_MAINNET_KEY=<gnosis_safe_executor_key>
NEXT_PUBLIC_V8_CONTRACT_ADDRESS=0x...

# Existing
ETH_DEPLOYER_KEY=<in_netlify>
ETHEREUM_SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com
BLOCKDAG_RPC=https://bdag.nownodes.io
```

---

## 🎯 Success Metrics

| Metric | Target |
|--------|--------|
| Admin UI Coverage | 100% of contract functions |
| E2E Test Pass Rate | 100% |
| Gas per Mint (ETH) | < 0.005 ETH |
| Time to First Mainnet Campaign | < 7 days post-deploy |
| Zero Critical Bugs | 30 days post-launch |

---

## 📞 Escalation Path

1. **Bug Found:** Create issue in GitHub, tag priority
2. **Security Issue:** Immediate pause, notify team
3. **Fund Issue:** Multi-sig emergency withdraw
4. **User Complaint:** Check on-chain status, verify Supabase

---

*This roadmap is a living document. Update as milestones are completed.*
