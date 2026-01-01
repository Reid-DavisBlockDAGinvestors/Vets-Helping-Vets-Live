# 🚀 Ethereum Mainnet Launch Roadmap

## PatriotPledge Multi-Chain Production Deployment

> **Mission:** Launch a fully production-ready fundraising platform on Ethereum Mainnet, enabling real fundraising with immediate fund distribution, while maintaining our existing BlockDAG infrastructure.

**Document Version:** 1.0  
**Created:** January 1, 2026  
**Status:** ACTIVE DEVELOPMENT  
**Priority:** CRITICAL - First Live Fundraiser Pending

---

## 📊 Executive Summary

### Current State
| Chain | Contract | Status | NFTs Minted |
|-------|----------|--------|-------------|
| BlockDAG (1043) | V5 | Production | 371+ |
| BlockDAG (1043) | V6 | Ready | 0 |
| Ethereum Mainnet | - | Not Deployed | - |

### Target State
| Chain | Contract | Status | Purpose |
|-------|----------|--------|---------|
| BlockDAG (1043) | V5/V6 | Production | BDAG-native campaigns |
| Ethereum Mainnet | V7 | Production | ETH campaigns + high-value |
| Polygon (137) | V7 | Production | Low-gas campaigns |
| Base (8453) | V7 | Production | Coinbase ecosystem |

---

## 🔍 V6 Contract Audit Results

### Multi-Chain Compatibility Assessment

#### ✅ What V6 Has (Chain-Agnostic Features)
- Standard ERC-721 with Enumerable, URIStorage, Royalty
- OpenZeppelin 5.x patterns (Ownable, Pausable, ReentrancyGuard)
- EIP-2981 Royalties (marketplace compatible)
- EIP-4906 Metadata Refresh events
- Batch minting (up to 50 per tx)
- Token freezing, soulbound, blacklisting
- Campaign editing functions
- Treasury management

#### ❌ What V6 Lacks for Multi-Chain Production

| Missing Feature | Priority | Reason |
|-----------------|----------|--------|
| **Immediate Payout** | CRITICAL | Submitters need instant fund access |
| **Fee Distribution** | CRITICAL | Platform fee + nonprofit fee splitting |
| **Chain ID Awareness** | HIGH | Prevent cross-chain replay attacks |
| **Configurable Fee Rates** | HIGH | Different chains = different economics |
| **Bug Bounty Pool** | MEDIUM | On-chain bounty payments |
| **Cross-Chain Messaging** | LOW | Future: unified campaign state |
| **Gas Optimization** | MEDIUM | ETH gas is expensive |

#### 🚨 Critical for Ethereum Mainnet
1. **Gas costs are ~100x higher than BlockDAG** - need optimization
2. **MEV protection** - front-running protection for mints
3. **Chainlink price feeds** - accurate USD conversion
4. **Timelocks on admin functions** - DAO readiness
5. **Multi-sig treasury** - security requirement

---

## 🏗️ V7 Contract Architecture

### Core Design Principles
1. **Multi-Chain First** - Deploy to any EVM chain with same codebase
2. **Immediate Payouts** - Submitters receive funds instantly
3. **Fee Transparency** - Clear platform/nonprofit/submitter splits
4. **Gas Optimized** - Efficient for Ethereum Mainnet
5. **Upgradeable** - Proxy pattern for future improvements

### V7 Contract Structure

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PatriotPledgeNFTV7
 * @notice Multi-chain production NFT with immediate payouts
 * 
 * NEW IN V7:
 * - Immediate fund distribution on mint
 * - Configurable fee splitting (platform/nonprofit/submitter)
 * - Chain-aware deployment
 * - Gas optimizations for Ethereum
 * - Bug bounty pool
 * - Chainlink price feed integration (optional)
 * - Multi-sig admin controls
 * - Timelock on critical functions
 */
```

### Fee Distribution Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DONATION FLOW (V7)                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Donor Pays: $100 + $10 tip = $110 total                    │
│                                                             │
│  ┌─────────────┐                                            │
│  │  Contract   │                                            │
│  │  Receives   │ ───────────────────────────────────────┐   │
│  │   $110      │                                        │   │
│  └─────────────┘                                        │   │
│        │                                                │   │
│        ▼                                                │   │
│  ┌─────────────────────────────────────────────────┐   │   │
│  │            IMMEDIATE DISTRIBUTION                │   │   │
│  ├─────────────────────────────────────────────────┤   │   │
│  │                                                 │   │   │
│  │  Platform Fee (3%):     $3.00  → Treasury       │   │   │
│  │  Nonprofit Fee (5%):    $5.00  → Nonprofit      │   │   │
│  │  Submitter Net (92%):   $92.00 → Submitter      │   │   │
│  │  Tip (optional):        $10.00 → Nonprofit*     │   │   │
│  │                                                 │   │   │
│  │  *Nonprofit can forward tips to submitter       │   │   │
│  └─────────────────────────────────────────────────┘   │   │
│                                                        │   │
│  Total Gas Estimate: ~250,000 gas (~$5-15 on ETH)      │   │
│                                                        │   │
└────────────────────────────────────────────────────────┴───┘
```

### V7 New Functions

```solidity
// ============ IMMEDIATE PAYOUT FUNCTIONS ============

/**
 * @notice Distribute funds immediately on campaign approval
 * @dev Called by admin when approving a campaign with immediate payout option
 */
function distributeFundsImmediately(
    uint256 campaignId
) external onlyOwner nonReentrant;

/**
 * @notice Mint with immediate fund distribution
 * @dev Funds are split and sent in the same transaction
 */
function mintWithImmediatePayout(
    uint256 campaignId
) external payable returns (uint256);

/**
 * @notice Batch mint with immediate payout
 */
function mintBatchWithImmediatePayout(
    uint256 campaignId,
    uint256 quantity
) external payable returns (uint256[] memory);

// ============ FEE CONFIGURATION ============

struct FeeConfig {
    uint16 platformFeeBps;     // Platform fee (e.g., 300 = 3%)
    uint16 nonprofitFeeBps;    // Nonprofit fee (e.g., 500 = 5%)
    uint16 maxTotalFeeBps;     // Maximum total fee cap
    address platformTreasury;  // Platform fee recipient
    bool immediatePayout;      // Enable immediate payouts
}

function setFeeConfig(FeeConfig calldata config) external onlyOwner;

// ============ BUG BOUNTY POOL ============

uint256 public bugBountyPool;

function fundBugBountyPool() external payable onlyOwner;

function payBugBounty(
    address recipient,
    uint256 amount,
    string calldata reportId
) external onlyOwner nonReentrant;

// ============ CHAIN AWARENESS ============

uint256 public immutable deploymentChainId;

modifier onlyThisChain() {
    require(block.chainid == deploymentChainId, "Wrong chain");
    _;
}
```

---

## 📋 Implementation Phases

### Phase 0: Pre-Launch Preparation (Week 1)
**Status: IN PROGRESS**

#### 0.1 Infrastructure Setup
- [ ] Set up Ethereum Mainnet RPC (Alchemy/Infura)
- [ ] Create production deployer wallet (hardware wallet)
- [ ] Set up multi-sig for treasury (Gnosis Safe)
- [ ] Configure gas price oracle integration
- [ ] Set up monitoring (Tenderly/OpenZeppelin Defender)

#### 0.2 Contract Development
- [ ] Create PatriotPledgeNFTV7.sol with immediate payouts
- [ ] Add fee distribution logic
- [ ] Add bug bounty pool functions
- [ ] Add chain-awareness checks
- [ ] Gas optimization pass

#### 0.3 Testing
- [ ] Unit tests for all V7 functions
- [ ] Integration tests on Goerli/Sepolia
- [ ] Gas benchmarking (target: <300k gas per mint)
- [ ] Fuzz testing for edge cases
- [ ] Formal verification of fund flows

### Phase 1: Contract Deployment (Week 2)

#### 1.1 Testnet Deployment
- [ ] Deploy V7 to Sepolia (Ethereum testnet)
- [ ] Test all functions end-to-end
- [ ] Verify contract on Etherscan
- [ ] Test immediate payout flows
- [ ] Test fee distribution accuracy

#### 1.2 Security Audit
- [ ] Internal security review
- [ ] External audit (Slither, Mythril)
- [ ] Gas optimization review
- [ ] Access control verification

#### 1.3 Mainnet Deployment
- [ ] Deploy V7 to Ethereum Mainnet
- [ ] Verify contract on Etherscan
- [ ] Configure fee structure
- [ ] Set up treasury multi-sig
- [ ] Transfer ownership to multi-sig

### Phase 2: Frontend Integration (Week 3)

#### 2.1 Multi-Chain Support
- [ ] Add Ethereum Mainnet to chain registry
- [ ] Update wallet connection for multi-chain
- [ ] Add chain switcher UI
- [ ] Implement gas estimation display
- [ ] Add ETH balance checks

#### 2.2 Dashboard Updates
- [ ] Remove "testnet only" messaging
- [ ] Add chain indicator badges
- [ ] Show gas estimates before transactions
- [ ] Add immediate payout toggle in admin

#### 2.3 Admin Panel Updates
- [ ] Add "Immediate Payout" checkbox on approval
- [ ] Add fee preview calculator
- [ ] Add chain selection for new campaigns
- [ ] Add multi-chain analytics

### Phase 3: Production Hardening (Week 4)

#### 3.1 Monitoring & Alerts
- [ ] Set up transaction monitoring
- [ ] Configure error alerting
- [ ] Add balance monitoring for treasury
- [ ] Set up gas price alerts

#### 3.2 Documentation
- [ ] Update user documentation
- [ ] Create admin guides
- [ ] Document emergency procedures
- [ ] Create runbooks for operations

#### 3.3 Legal & Compliance
- [ ] Terms of Service update
- [ ] Privacy Policy update
- [ ] Donation receipts system
- [ ] Tax documentation preparation

---

## 🔧 Technical Specifications

### Chain Configuration

```typescript
// lib/chains.ts
export const SUPPORTED_CHAINS = {
  // Current
  blockdag: {
    chainId: 1043,
    name: 'BlockDAG Mainnet',
    rpcUrl: process.env.BLOCKDAG_RPC,
    explorer: 'https://awakening.bdagscan.com',
    nativeCurrency: { name: 'BDAG', symbol: 'BDAG', decimals: 18 },
    contracts: {
      v5: '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890',
      v6: 'TBD',
      v7: 'TBD'
    },
    gasEstimate: 'low',
    immediatePayoutSupported: false // V5/V6 don't support
  },
  
  // NEW
  ethereum: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: process.env.ETHEREUM_RPC,
    explorer: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    contracts: {
      v7: 'TBD' // Deploy address
    },
    gasEstimate: 'high',
    immediatePayoutSupported: true
  },
  
  // FUTURE
  polygon: {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: process.env.POLYGON_RPC,
    explorer: 'https://polygonscan.com',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    contracts: { v7: 'TBD' },
    gasEstimate: 'low',
    immediatePayoutSupported: true
  },
  
  base: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: process.env.BASE_RPC,
    explorer: 'https://basescan.org',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    contracts: { v7: 'TBD' },
    gasEstimate: 'low',
    immediatePayoutSupported: true
  }
}
```

### Environment Variables (New)

```bash
# .env.local additions

# Ethereum Mainnet
ETHEREUM_RPC=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
ETHEREUM_CHAIN_ID=1

# Multi-sig Treasury (Gnosis Safe)
TREASURY_MULTISIG=0x...

# Fee Configuration
PLATFORM_FEE_BPS=300          # 3%
NONPROFIT_FEE_BPS=500         # 5%
IMMEDIATE_PAYOUT_ENABLED=true

# Contract Addresses
V7_CONTRACT_ETHEREUM=0x...
V7_CONTRACT_POLYGON=0x...
V7_CONTRACT_BASE=0x...

# Gas Settings
MAX_GAS_PRICE_GWEI=100        # Don't transact above this
GAS_BUFFER_PERCENT=20         # Add 20% buffer to estimates
```

### Database Schema Updates

```sql
-- Add chain tracking to submissions
ALTER TABLE submissions 
ADD COLUMN chain_id INTEGER DEFAULT 1043,
ADD COLUMN chain_name VARCHAR(50) DEFAULT 'blockdag',
ADD COLUMN immediate_payout BOOLEAN DEFAULT false,
ADD COLUMN payout_tx_hash VARCHAR(66),
ADD COLUMN payout_timestamp TIMESTAMPTZ;

-- Add multi-chain contract registry
CREATE TABLE contract_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id INTEGER NOT NULL,
  chain_name VARCHAR(50) NOT NULL,
  contract_version VARCHAR(10) NOT NULL,
  contract_address VARCHAR(42) NOT NULL,
  deployer_address VARCHAR(42) NOT NULL,
  deploy_tx_hash VARCHAR(66) NOT NULL,
  deploy_timestamp TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  abi_hash VARCHAR(66),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chain_id, contract_address)
);

-- Add fee tracking
CREATE TABLE fee_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES submissions(id),
  purchase_id UUID REFERENCES purchases(id),
  chain_id INTEGER NOT NULL,
  tx_hash VARCHAR(66) NOT NULL,
  platform_fee_amount DECIMAL(20,8),
  nonprofit_fee_amount DECIMAL(20,8),
  submitter_amount DECIMAL(20,8),
  tip_amount DECIMAL(20,8),
  gas_used BIGINT,
  gas_price_gwei DECIMAL(10,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 💰 Fee Structure

### Default Fee Configuration

| Recipient | Percentage | Notes |
|-----------|------------|-------|
| Platform (Treasury) | 3% | Operations, development |
| Nonprofit Partner | 5% | Verification, support |
| Submitter | 92% | Direct to fundraiser |
| Tips | 100% to Nonprofit* | *Can forward to submitter |

### Chain-Specific Considerations

| Chain | Gas Cost Est. | Min Donation | Notes |
|-------|---------------|--------------|-------|
| BlockDAG | ~$0.01 | $1 | Current, cheap |
| Ethereum | ~$5-15 | $50 | High gas, high-value |
| Polygon | ~$0.05 | $5 | Low gas, accessible |
| Base | ~$0.10 | $10 | Coinbase ecosystem |

---

## 🖥️ UI/UX Changes

### Dashboard Updates

```
BEFORE (Current):
┌─────────────────────────────────────────────┐
│  ⚠️ TESTNET PHASE                           │
│  This is a testnet deployment for testing   │
└─────────────────────────────────────────────┘

AFTER (Production):
┌─────────────────────────────────────────────┐
│  🟢 LIVE ON ETHEREUM MAINNET                │
│  ┌─────┐ ┌─────┐ ┌─────┐                   │
│  │ ETH │ │ BDAG│ │ POLY│  ← Chain selector │
│  └─────┘ └─────┘ └─────┘                   │
└─────────────────────────────────────────────┘
```

### Admin Campaign Approval

```
┌─────────────────────────────────────────────────────────────┐
│  APPROVE CAMPAIGN: "Help Veteran John"                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Target Chain: [Ethereum Mainnet ▼]                         │
│                                                             │
│  Fee Structure:                                             │
│  ├── Platform Fee: 3% ($3.00 per $100)                      │
│  ├── Nonprofit Fee: 5% ($5.00 per $100)                     │
│  └── Submitter Receives: 92% ($92.00 per $100)              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ [✓] Enable Immediate Payout                         │    │
│  │                                                     │    │
│  │ When enabled, funds are sent directly to the        │    │
│  │ submitter's wallet immediately after each donation. │    │
│  │                                                     │    │
│  │ Submitter Wallet: 0x1234...5678                     │    │
│  │ Estimated Gas: ~250,000 (~$8.50 at current prices)  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  [Cancel]                        [Approve & Deploy ✓]       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Considerations

### Multi-Sig Requirements
- Treasury: 2-of-3 multi-sig minimum
- Contract ownership: Transfer to multi-sig after deployment
- Emergency pause: Single admin can pause, multi-sig to unpause

### Audit Checklist
- [ ] Reentrancy protection on all fund transfers
- [ ] Integer overflow checks (Solidity 0.8+ handles this)
- [ ] Access control on all admin functions
- [ ] Gas griefing prevention
- [ ] Front-running protection
- [ ] Chainlink oracle manipulation protection

### Emergency Procedures
1. **Pause contract** - Stop all minting immediately
2. **Freeze suspicious tokens** - Prevent transfers
3. **Emergency withdraw** - Move funds to multi-sig
4. **Blacklist addresses** - Block malicious actors

---

## 📅 Timeline

| Week | Focus | Deliverables |
|------|-------|--------------|
| Week 1 | V7 Contract | Contract code, unit tests, testnet deploy |
| Week 2 | Integration | Frontend multi-chain, admin updates |
| Week 3 | Testing | Full E2E testing, security review |
| Week 4 | Launch | Mainnet deploy, first campaign live |

---

## ✅ Success Criteria

### Technical
- [ ] V7 deployed to Ethereum Mainnet
- [ ] Immediate payout working correctly
- [ ] Fee distribution accurate to basis point
- [ ] Gas costs within estimates
- [ ] All tests passing

### Business
- [ ] First real fundraiser live
- [ ] At least $1,000 raised in first month
- [ ] Zero security incidents
- [ ] Submitter receives funds within 1 block

### User Experience
- [ ] Chain switching seamless
- [ ] Gas estimates accurate
- [ ] Transaction confirmations fast
- [ ] Clear fee breakdown shown

---

## 📝 Next Steps (Immediate)

1. **Create V7 Contract** - Add immediate payout logic
2. **Set up Ethereum RPC** - Alchemy or Infura account
3. **Create Multi-Sig** - Gnosis Safe on Ethereum
4. **Update Dashboard** - Remove testnet messaging
5. **Deploy to Sepolia** - Test on Ethereum testnet first

---

*This roadmap is a living document. Updates will be tracked via git commits.*

**Last Updated:** January 1, 2026  
**Author:** PatriotPledge Engineering Team
