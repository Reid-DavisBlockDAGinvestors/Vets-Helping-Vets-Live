# Fund Distribution Implementation Rules & Decisions

> **Created**: January 1, 2026  
> **Status**: ACTIVE - Follow these rules throughout implementation

---

## ⚠️ CRITICAL RULES - READ BEFORE EVERY PHASE

### Rule 1: V8 Ethereum Mainnet Deployment Gate
**DO NOT deploy V8 to Ethereum Mainnet until:**
- [ ] Full E2E test on Sepolia testnet completed
- [ ] At least 1 complete submission → approval → mint → distribution cycle tested on Sepolia
- [ ] Tip splitting tested on Sepolia with V7 (off-chain)
- [ ] V8 contract deployed and tested on Sepolia first
- [ ] All E2E Playwright tests passing on Sepolia
- [ ] User explicitly approves mainnet deployment

### Rule 2: Contract Version Strategy
| Network | Contract | Tip Splitting |
|---------|----------|---------------|
| BlockDAG (1043) | V5/V6 | Off-chain (admin distributes) |
| Sepolia (11155111) | V7 | **Off-chain** (calculated in UI, 2 transfers) |
| Ethereum Mainnet (1) | **V8** | **Native** (on-chain splitting) |

### Rule 3: Tip Split Configuration
- Tip splits are **configurable per campaign**
- Default: 100% to submitter
- Admin can adjust 0-100% split between submitter and nonprofit
- Stored in `tip_split_configs` table
- Split is enforced at distribution time, not mint time

### Rule 4: Off-Chain Splitting for V7 (Sepolia)
Since V7 contract sends all tips to submitter, off-chain splitting means:
1. Admin UI calculates split percentages
2. Contract distributes full amount to one address (platform treasury)
3. Platform makes 2 separate transfers: one to submitter, one to nonprofit
4. This requires platform treasury to hold funds temporarily

**Alternative approach** (preferred):
1. Do NOT use contract's immediate payout for tips
2. Tips accumulate in contract
3. Admin triggers `withdraw()` to platform treasury
4. Platform treasury makes split distributions off-chain

---

## Approved Decisions

| Decision | Choice | Date |
|----------|--------|------|
| Tip split default | Configurable per campaign | 2026-01-01 |
| V7 tip handling | Off-chain splitting | 2026-01-01 |
| V8 for Ethereum | Native on-chain splitting | 2026-01-01 |
| Testnet before mainnet | Required - Sepolia E2E | 2026-01-01 |

---

## Implementation Phases

### Phase 1: Foundation (Current)
- [x] Create implementation rules document
- [ ] Database migration for `distributions` + `tip_split_configs`
- [ ] Create `types.ts` with ISP interfaces
- [ ] Create `useCampaignBalances` hook
- [ ] Create `CampaignBalanceCard` component

### Phase 2: Balance Display
- [ ] Create `FundDistributionPanel` orchestrator
- [ ] Create `CampaignBalanceList` component
- [ ] Implement filtering by network/status

### Phase 3: Tip Split UI
- [ ] Create `TipSplitSlider` component
- [ ] Create tip split API routes
- [ ] Per-campaign configuration

### Phase 4: Distribution Actions
- [ ] Create `DistributionForm` component
- [ ] Create `DistributionConfirmModal`
- [ ] Off-chain distribution for V7
- [ ] Contract integration for distribution

### Phase 5: History & Verification
- [ ] Create `DistributionHistory` component
- [ ] Transaction verification
- [ ] Explorer links

### Phase 6: V8 Contract
- [ ] Create V8 contract with native tip splitting
- [ ] Deploy V8 to Sepolia
- [ ] Full E2E testing on Sepolia
- [ ] **GATE**: All tests pass before mainnet

### Phase 7: Ethereum Mainnet
- [ ] **VERIFY**: Sepolia E2E complete
- [ ] Deploy V8 to Ethereum Mainnet
- [ ] Configure mainnet in admin portal
- [ ] Production testing

---

## File Size Limits (Per Global Rules)

| File Type | Max Lines |
|-----------|-----------|
| Component | 150 |
| Hook | 100 |
| Utility | 50 |
| Types | 100 |

---

## Testing Requirements (TDD)

Before implementing each component:
1. Write the E2E test first (Playwright)
2. Write unit tests for utilities
3. Implement component
4. Verify tests pass

---

## Reminders for Future Sessions

1. **Always check this document** at the start of each session
2. **Do not skip Sepolia testing** for V8
3. **Off-chain splitting for V7** - do not modify V7 contract
4. **V8 has native splitting** - implement in contract
5. **Configurable per campaign** - not global tip split
