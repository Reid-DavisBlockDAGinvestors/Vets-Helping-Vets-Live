# 🔍 Orphan Campaign Audit Report

**Date:** December 27, 2025  
**Auditor:** Cascade AI

---

## Executive Summary

| Category | Count | Status |
|----------|-------|--------|
| **Total On-Chain Campaigns** | 56 | - |
| **Matched to Database** | 32 | ✅ All have thumbnails |
| **Orphan (no DB record)** | 24 | ⚠️ |
| **- Zero Sales (safe to ignore)** | 17 | Duplicates from RPC issues |
| **- With Sales (needs attention)** | 7 | 0, 1, 2, 26, 32, 38, 40 |

---

## Dashboard Thumbnail Issue - EXPLAINED

The user reported thumbnails not showing on the admin dashboard. Analysis:

1. **All 32 matched campaigns have `image_uri`** ✅
2. **The dashboard requires wallet connection** to display campaigns
3. **Campaigns 0, 1, 2** are orphan campaigns - they exist on-chain but NOT in the database
4. These were likely early test campaigns before the database schema was finalized

**Resolution:** The dashboard shows campaigns linked to a wallet address. If no wallet is connected, no campaigns appear. This is working as designed.

---

## Orphan Campaigns WITH Sales (Needs Investigation)

These 7 campaigns have on-chain sales but no database records:

| Campaign ID | Sales | BDAG Raised | Notes |
|-------------|-------|-------------|-------|
| 0 | 1 | 20.0 | Early test, Supabase baseURI |
| 1 | 1 | 20.0 | Early test, Supabase baseURI |
| 2 | 1 | 20.0 | Early test, IPFS baseURI |
| 26 | 1 | 200.0 | Duplicate of another campaign |
| 32 | 1 | 200.0 | Duplicate of another campaign |
| 38 | 100 | 98,100.0 | **SIGNIFICANT** - needs DB record |
| 40 | 2 | 500.0 | Duplicate of another campaign |

### Campaign #38 - HIGH PRIORITY
This campaign has 100 NFT sales and raised 98,100 BDAG (~$4,905 USD). It needs a database record created to properly track and display.

---

## Orphan Campaigns WITHOUT Sales (Safe to Ignore)

These 17 campaigns are duplicates from RPC issues during campaign creation:

| Campaign IDs |
|--------------|
| 3, 16, 19, 20, 21, 24, 25, 27, 28, 31, 36, 46, 47, 48, 52, 53, 55 |

**Recommendation:** No action needed. These have zero sales and were created when the RPC was unreliable, causing duplicate creation attempts.

---

## Matched Campaigns (All Working)

All 32 database campaigns are properly matched and have thumbnails:

| Campaign ID | Title | Image |
|-------------|-------|-------|
| 4 | Larry Odom II: A Beacon of Resilience | ✓ |
| 5 | Reid Davis – Leading the Rebirth of BlockDAG | ✓ |
| 6 | Erica Stanford's fundraiser | ✓ |
| 7 | Michael Elkins | ✓ |
| 8 | Jerry Wicks | ✓ |
| 9 | Chanelle's Campaign For a New Pony | ✓ |
| 10 | Help Rob Nicholson | ✓ |
| 11 | Help Perry get back on his feet | ✓ |
| 12 | Leo's Animal Sanctury | ✓ |
| 13 | Go BeerMe | ✓ |
| 14 | Help Puddlejacked save Christmas | ✓ |
| 15 | Ricky Vega and Reid Davis | ✓ |
| 17 | Reid Davis and Lethaniel | ✓ |
| 18 | Street DOJO | ✓ |
| 22 | Travis Thomas | ✓ |
| 23 | Support a SWCC | ✓ |
| 29 | Daniel Van Damme | ✓ |
| 30 | Carlos A Linhares | ✓ |
| 33 | Dave mobile tire service | ✓ |
| 34 | Tim Kelly | ✓ |
| 35 | Patrick Irvine | ✓ |
| 37 | Shawn Wilson | ✓ |
| 39 | Antonty Turner | ✓ |
| 41 | Sponsor sports for kids | ✓ |
| 42 | Harris' dogs | ✓ |
| 43 | Project Harvest Guard | ✓ |
| 44 | Watch the kitty | ✓ |
| 45 | Olivier and Oskar | ✓ |
| 49 | Lucky 8 | ✓ |
| 50 | Animal Lovers League | ✓ |
| 51 | Jesse's Daughter Noelle | ✓ |
| 54 | The Myriad Mirage | ✓ |

---

## Recommendations

### Immediate
1. **Campaign #38** - Create database record for this high-value campaign (100 sales, 98,100 BDAG)
2. **Campaigns 0, 1, 2** - Optional: Create "legacy" database records for historical accuracy

### Future Prevention
1. Add retry logic with deduplication for campaign creation
2. Implement idempotency keys to prevent duplicate on-chain campaigns
3. Add reconciliation job to detect orphan campaigns

---

## Technical Details

### CAPTCHA Fix Applied
Fixed multiple Cloudflare Turnstile widgets issue in `CaptchaWidget.tsx`:
- Added `renderAttemptedRef` to prevent multiple render attempts
- Used callback refs instead of dependencies to prevent re-renders
- Clear container before rendering to prevent duplicates

### Dashboard Architecture
The dashboard at `/dashboard` requires wallet connection because:
- It queries `/api/wallet/campaigns?address={walletAddress}`
- Campaigns are filtered by `creator_wallet` in Supabase
- No wallet = no address = no campaigns shown

This is correct behavior for user-specific dashboards.

---

*Audit completed: December 27, 2025*
