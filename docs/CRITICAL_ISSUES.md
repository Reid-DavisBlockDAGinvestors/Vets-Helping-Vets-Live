# Critical Issues & Audit Findings

## Last Updated: January 3, 2026

---

## ✅ RESOLVED: V8 Mainnet Fund Distribution Audit

**Date:** January 3, 2026  
**Contract:** `0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e`  
**Chain:** Ethereum Mainnet (1)

### Initial Concern
User reported that funds sent to the V8 Mainnet contract appeared to be missing and campaign data appeared corrupted.

### Investigation Findings

**ROOT CAUSE:** ABI struct mismatch when reading `getCampaign()` data. The V8 contract returns a `CampaignView` struct with 19 fields. Earlier debugging scripts used an incorrect field order, causing all values to be decoded incorrectly.

**CORRECT ABI for getCampaign:**
```solidity
function getCampaign(uint256 campaignId) external view returns (
  tuple(
    uint256 id,
    string category,
    string baseURI,
    uint256 goalNative,
    uint256 goalUsd,
    uint256 grossRaised,
    uint256 netRaised,
    uint256 tipsReceived,
    uint256 editionsMinted,
    uint256 maxEditions,
    uint256 priceNative,
    uint256 priceUsd,
    address nonprofit,
    address submitter,
    bool active,
    bool paused,
    bool closed,
    bool refunded,
    bool immediatePayoutEnabled
  )
)
```

### Actual Campaign 0 Data (Correct)

| Field | Value |
|-------|-------|
| ID | 0 |
| Category | community |
| BaseURI | ipfs://bafkreidzdmipkkmalihx25nu4kl5aoqvyneqvucxihbdf4czdeh5aniihu |
| Goal Native | 6.45 ETH |
| Goal USD | $20,000 |
| Gross Raised | 0.1267 ETH |
| Net Raised | 0.1031 ETH |
| Tips Received | 0.0226 ETH |
| Editions Minted | 16 |
| Max Editions | 1000 |
| Price Native | 0.00645 ETH |
| Price USD | $19.98 |
| Nonprofit | 0x82500890533fA86d8bD11e66Aeb6EC33501809C9 |
| Submitter | 0x82500890533fA86d8bD11e66Aeb6EC33501809C9 |
| Active | true |
| Paused | false |
| Closed | false |
| Refunded | false |
| **Immediate Payout** | **true** ✅ |

### Fund Flow Verification

| Location | Balance/Amount | Status |
|----------|----------------|--------|
| Contract Balance | 0.0 ETH | ✅ Correct (immediate payout enabled) |
| Submitter Wallet | 0.324 ETH | ✅ Received distributions + pre-existing |
| Platform Treasury | 0.034 ETH | ✅ Received platform fees |
| Campaign Distributed | 0.1267 ETH | ✅ Confirmed |
| Platform Fee Rate | 1% (100 bps) | ✅ |

### Resolution
- **All funds are accounted for**
- **Immediate payout IS working** - funds go directly to submitter on each mint
- **No funds are lost or missing**
- **ABI mismatch was in debugging scripts, not production code**

---

## 🔶 OPEN: Supabase Purchase Records Incomplete

**Date:** January 3, 2026  
**Priority:** Medium

### Issue
Contract shows 16 NFTs minted, but Supabase `purchases` table only has 8 records for chain_id=1.

### Possible Causes
1. Some purchases completed on-chain but API record failed
2. Network issues during purchase recording
3. Duplicate prevention blocked re-recording

### Impact
- Analytics will show fewer purchases than actual
- Submitter notifications may have been missed for some purchases

### Recommended Actions
1. Run backfill script to sync on-chain mints with Supabase
2. Check for any EditionMinted events not recorded
3. Add retry logic to purchase recording API

---

## ✅ RESOLVED: Immediate Payout Default Behavior

**Date:** January 3, 2026

### Issue
New campaigns on mainnet were defaulting to `immediatePayoutEnabled = false`, requiring manual distribution.

### Fix Applied
Updated `/api/submissions/approve/route.ts` to:
- Default `immediatePayoutEnabled = true` for mainnet chains (1, 137, 8453, 42161)
- Default `immediatePayoutEnabled = false` for testnets (safety measure)

---

## Security Note: Private Keys

**NEVER share or expose private keys**, even to the deployer wallet. The deployer wallet address is:
- `0x4E8E445A9957cD251059cd52A00777A25f8cD53e`

This can be viewed on Etherscan for balance/transaction history. Private keys are stored securely in `.env.local` and should never be displayed or transmitted.

---

## Audit Commands

### Check Campaign Status
```bash
npx ts-node scripts/audit-mainnet-campaign.ts
```

### Check All Token Owners
```javascript
// In node console
const{ethers}=require('ethers');
const p=new ethers.JsonRpcProvider('https://eth.llamarpc.com');
const c=new ethers.Contract('0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e',['function ownerOf(uint256) view returns (address)'],p);
for(let i=0;i<16;i++){console.log(i,await c.ownerOf(i));}
```

### Verify Fund Distribution
```javascript
const c=new ethers.Contract(CONTRACT,['function campaignDistributed(uint256) view returns (uint256)'],p);
console.log('Distributed:', ethers.formatEther(await c.campaignDistributed(0)), 'ETH');
```
