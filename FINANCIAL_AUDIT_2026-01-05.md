# Financial Audit Report - January 5, 2026

## Executive Summary

Comprehensive audit of all financial calculations across the PatriotPledge NFT platform, focusing on Ethereum Mainnet campaign "A Mother's Fight to Keep Her Family Together".

## On-Chain Ground Truth (Ethereum Mainnet)

**Contract:** `0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e`

| Metric | Value |
|--------|-------|
| Editions Minted | 29 |
| Gross Raised | $1,654.15 |
| Price Per Edition | $19.99 |
| Goal | $20,000 |
| Max Editions | 1000 |

**Calculated Breakdown:**
- NFT Sales: 29 × $19.99 = **$579.71**
- Tips/Gifts: $1,654.15 - $579.71 = **$1,074.44**

---

## Issues Found & Fixed

### 1. Missing Purchase Records in Database
**Issue:** 9 NFT purchases were on-chain but not recorded in Supabase purchases table.
**Root Cause:** Client-side purchase recording can fail if user closes browser or network issues occur.
**Fix:** Ran `scripts/backfill-mainnet-purchases.ts` to sync missing records.
**Status:** ✅ Fixed - 29 purchases now in database

### 2. Marketplace API Not Using On-Chain Data
**Issue:** Marketplace API only updated grossRaised when chainEditions > dbEditions.
**Root Cause:** Conditional logic prevented on-chain tips from being reflected.
**Fix:** Updated `app/api/marketplace/fundraisers/route.ts` to always use on-chain grossRaised when available.
**Status:** ✅ Fixed

### 3. Homepage Featured Campaign Using Database-Only Data
**Issue:** Homepage featured campaign showed $580 instead of $1,654.
**Root Cause:** Used database tips aggregation instead of on-chain grossRaised.
**Fix:** Added `getOnchainCampaignData()` function to fetch real-time blockchain data for mainnet campaigns.
**Status:** ✅ Fixed

### 4. Admin Distributions API Using Database-Only Data
**Issue:** Admin portal showed incorrect funds for distribution.
**Root Cause:** Calculated only from purchases table, missing on-chain tips.
**Fix:** Updated `app/api/admin/distributions/balances/route.ts` to fetch on-chain data for mainnet campaigns.
**Status:** ✅ Fixed

### 5. Email Notification totalRaised Calculation
**Issue:** Creator notifications showed incorrect total raised amount.
**Root Cause:** Hardcoded 100 copies assumption and didn't include tips.
**Fix:** Updated `app/api/purchase/record/route.ts` to fetch actual num_copies and include tips.
**Status:** ✅ Fixed

### 6. tips_distributed Column Always 0
**Issue:** `submissions.tips_distributed` column was 0 for all campaigns.
**Root Cause:** This column was never being updated - tips are stored in purchases table.
**Status:** ℹ️ By design - tips are aggregated from purchases table on-demand

---

## Data Consistency Verification

After fixes, all sources now show consistent data for Ethereum Mainnet campaign:

| Source | Raised | NFT Sales | Gifts | Editions |
|--------|--------|-----------|-------|----------|
| **On-Chain** | $1,654.15 | $580 | $1,074 | 29 |
| **Marketplace API** | $1,654.15 | $580 | $1,074 | 29 |
| **Story Page API** | $1,654.15 | - | - | 29 |
| **Homepage** | $1,654.15 | $580 | $1,074 | 29 |
| **Admin Distributions** | $1,654.15 | - | $1,074 | - |

---

## Files Modified

1. `app/api/marketplace/fundraisers/route.ts` - Always use on-chain grossRaised
2. `app/page.tsx` - Fetch on-chain data for mainnet featured campaign
3. `app/api/admin/distributions/balances/route.ts` - Add on-chain data for mainnet
4. `app/api/purchase/record/route.ts` - Fix totalRaised calculation in emails

---

## Commits

- `07e7ef6` - Fix marketplace API to always use on-chain grossRaised
- `e7f1462` - Fetch on-chain data for mainnet featured campaign
- `1cb6308` - Add on-chain data fetching to admin distributions API
- `c0e28bb` - Fix email totalRaised calculation

---

## Recommendations

1. **Run sync scripts periodically** - Execute `backfill-mainnet-purchases.ts` and `sync-sold-counts.ts` to catch any missed purchases.

2. **Monitor RPC reliability** - On-chain data fetching depends on Alchemy RPC availability.

3. **Consider event indexing** - Set up blockchain event listeners to capture purchases in real-time rather than relying on client-side recording.

4. **Add audit logging** - Log all financial calculations for debugging.

---

## Verification Commands

```bash
# Sync sold counts with on-chain
npx ts-node scripts/sync-sold-counts.ts

# Backfill missing mainnet purchases
npx ts-node scripts/backfill-mainnet-purchases.ts

# Verify on-chain data
node scripts/audit-onchain.js
```

---

*Audit completed by Cascade AI - January 5, 2026*
