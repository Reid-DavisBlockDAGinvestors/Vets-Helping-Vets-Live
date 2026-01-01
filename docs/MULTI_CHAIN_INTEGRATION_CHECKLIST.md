# Multi-Chain Integration Checklist

## Overview

This document tracks all integration points that need to be updated for multi-chain support (BlockDAG → Ethereum/Polygon/Base).

---

## ✅ Will Everything Still Work?

### YES - These features work EXACTLY the same:

| Feature | Status | Notes |
|---------|--------|-------|
| **Email Confirmations** | ✅ Same | Emails are off-chain, unaffected by network |
| **KYC/Identity Verification** | ✅ Same | Didit KYC is off-chain |
| **Stripe/Fiat Payments** | ✅ Same | Recorded via `recordContribution()` |
| **IPFS Metadata Storage** | ✅ Same | Pinata works for all chains |
| **Supabase Database** | ✅ Same | Just stores chain_id alongside data |
| **Campaign Submission Flow** | ✅ Same | Submit → Review → Approve → On-chain |
| **User Authentication** | ✅ Same | Supabase auth, chain-agnostic |
| **Community Hub** | ✅ Same | Off-chain social features |
| **Admin Dashboard** | ✅ Enhanced | Now shows which network |

### Flow Changes for Multi-Chain:

| Flow | Change Required |
|------|-----------------|
| **Campaign Approval** | Admin selects target network OR auto-selects based on config |
| **NFT Purchase** | User switches MetaMask to correct network |
| **View on Explorer** | Link changes based on chain (Etherscan vs BDAGscan) |
| **Transaction Confirmation** | Same logic, different block times |

---

## Database Changes

### New Migration: `20260101_multi_chain_support.sql`

- [x] Add `chain_id` to `submissions` table
- [x] Add `chain_name` to `submissions` table
- [x] Add `chain_id` to `purchases` table
- [x] Add `chain_id` to `events` table
- [x] Create `chain_configs` reference table
- [x] Create helper views and functions

### Run This SQL:
```bash
# Copy SQL from supabase/migrations/20260101_multi_chain_support.sql
# Run in Supabase SQL Editor
```

---

## Admin Panel Updates

### Campaign Card (`components/admin/campaigns/CampaignCard.tsx`)
- [ ] Show network badge (BlockDAG/Ethereum/Sepolia)
- [ ] Dynamic explorer link based on chain_id
- [ ] Network icon/color coding

### Campaign Filters (`components/admin/campaigns/CampaignFilters.tsx`)
- [ ] Add network filter dropdown
- [ ] Filter by: All Networks | BlockDAG | Ethereum | Sepolia

### Approval Modal (`components/admin/campaigns/modals/ApprovalModal.tsx`)
- [ ] Add network selector (which chain to deploy to)
- [ ] Show gas estimate for selected network
- [ ] Warning for mainnet deployments

### Campaign Types (`components/admin/campaigns/types.ts`)
- [ ] Add `chain_id: number` field
- [ ] Add `chain_name: string` field

---

## API Route Updates

### `/api/submissions/approve/route.ts`
- [ ] Accept `chain_id` parameter
- [ ] Store `chain_id` and `chain_name` in database
- [ ] Select correct contract based on chain
- [ ] Use correct RPC for the chain

### `/api/marketplace/fundraisers/route.ts`
- [ ] Include `chain_id` in response
- [ ] Filter by network if specified

### `/api/purchase/record/route.ts`
- [ ] Store `chain_id` with purchase
- [ ] Use correct explorer for receipt

### `/api/onchain/*` routes
- [ ] Accept `chain_id` parameter
- [ ] Create provider for correct chain

---

## Frontend Updates

### PurchasePanel (`components/PurchasePanel.tsx`)
- [ ] Check user is on correct network
- [ ] Prompt to switch if wrong network
- [ ] Show network badge on purchase button

### Story Page (`app/story/[id]/page.tsx`)
- [ ] Show which network the campaign is on
- [ ] Explorer links use correct chain

### Marketplace (`app/marketplace/page.tsx`)
- [ ] Network badge on cards
- [ ] Optional network filter

### ChainSwitcher Component (NEW)
- [x] Created `components/ChainSwitcher.tsx`
- [x] Shows current network
- [x] Gas price indicator
- [x] Network switching

---

## Contract Integration

### lib/contracts.ts
- [ ] Update to support multi-chain
- [ ] Get contract by chain + version
- [ ] V7 registration for Sepolia/Ethereum

### lib/onchain.ts
- [ ] Accept chain_id parameter
- [ ] Create provider for any supported chain
- [ ] Multi-chain provider factory

### lib/chains.ts
- [x] Chain configurations defined
- [x] Sepolia testnet added
- [x] Helper functions for chain data

---

## Security Considerations

### Gas Price Protection
- [x] `lib/ethereum-security.ts` - Gas limits
- [x] Max gas price configurable per chain
- [x] Transaction timeout handling

### Mainnet Safeguards
- [x] Confirmation prompt for mainnet deployment
- [x] Deployer balance check
- [x] Gas estimation before deploy

---

## Testing Plan

### Sepolia Testnet (First)
1. Deploy V7 to Sepolia
2. Create test campaign
3. Purchase test NFT
4. Verify all flows work
5. Check admin panel shows network

### Ethereum Mainnet (After Sepolia Success)
1. Deploy V7 to Ethereum
2. Create first real campaign
3. Test with small purchase
4. Monitor gas costs
5. Full audit

---

## Configuration Summary

### Environment Variables Added:
```bash
# Sepolia (Testnet)
ETHEREUM_SEPOLIA_RPC=https://rpc.sepolia.org
NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC=https://rpc.sepolia.org
V7_CONTRACT_SEPOLIA=                    # Set after deployment
NEXT_PUBLIC_V7_CONTRACT_SEPOLIA=        # Set after deployment

# Ethereum (Mainnet)
ETHEREUM_RPC=https://eth.llamarpc.com
NEXT_PUBLIC_ETHEREUM_RPC=https://eth.llamarpc.com
V7_CONTRACT_ETHEREUM=                   # Set after deployment
NEXT_PUBLIC_V7_CONTRACT_ETHEREUM=       # Set after deployment

# Deployer
ETH_DEPLOYER_KEY=0x...                  # Same key works on all EVM chains

# Treasury
TREASURY_WALLET=0x07b3c4BB8842a9eE0698F1A3c6778bcC456d9362

# Gas Safety
MAX_GAS_PRICE_GWEI=100
```

---

## Progress Tracker

| Phase | Status | Notes |
|-------|--------|-------|
| Infrastructure Setup | ✅ Complete | RPC, env vars, chain config |
| Security Utilities | ✅ Complete | Gas limits, tx signing |
| Database Migration | ✅ Created | Needs to be run in Supabase |
| Admin Panel Updates | 🔄 In Progress | Network display pending |
| V7 Sepolia Deployment | ⏳ Pending | After migration run |
| E2E Testing | ⏳ Pending | After deployment |
| Ethereum Mainnet | ⏳ Pending | After testnet success |

---

## Quick Reference: Chain IDs

| Network | Chain ID | Currency | Explorer |
|---------|----------|----------|----------|
| BlockDAG | 1043 | BDAG | bdagscan.com |
| Ethereum | 1 | ETH | etherscan.io |
| Sepolia | 11155111 | ETH | sepolia.etherscan.io |
| Polygon | 137 | MATIC | polygonscan.com |
| Base | 8453 | ETH | basescan.org |
