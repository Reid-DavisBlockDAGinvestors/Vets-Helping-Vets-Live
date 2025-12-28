# 🔍 Campaign Submission Flow Audit

**Date:** December 27, 2025  
**Auditor:** Cascade AI  
**Status:** Active Investigation

---

## Executive Summary

### Issues Identified

| Issue | Severity | Status | Root Cause |
|-------|----------|--------|------------|
| Orphan campaigns (24 total) | HIGH | Partially Fixed | RPC duplication during creation |
| Campaign #38 untracked | HIGH | ✅ FIXED | Missing DB record for 100-sale campaign |
| Domain expired (patriotpledge.org) | CRITICAL | User Action Needed | GoDaddy parking |
| Creator wallet null on Campaign #39 | MEDIUM | Investigating | Missing wallet during submission |

---

## Pending Submissions

### Gurhan Kiziloz Campaign
- **ID:** `6ff64004-05b9-4d89-8e04-027ab771ab0f`
- **Title:** "Gurhan Kiziloz is NOT Welcome at BlockDAG!!!!!"
- **Status:** pending
- **Creator:** reid@blockdaginvestors.com
- **Wallet:** 0x52042B1e...
- **Campaign ID:** NOT SET (awaiting approval)
- **Created:** 2025-12-27T23:57:50.517137+00:00

This campaign is ready for admin approval. When approved:
1. On-chain campaign will be created via `createCampaign()`
2. Campaign ID will be assigned (next available: ~57)
3. Submission status → `minted`
4. Campaign appears on marketplace

---

## Orphan Campaign Analysis

### Root Cause: RPC Duplication
During campaign creation, RPC instability caused:
1. Transaction submitted but no confirmation received
2. Retry logic submits another transaction
3. Both transactions succeed → duplicate campaigns

### Statistics
- **Total On-Chain Campaigns:** 56
- **Database Submissions:** 33 (including new #38 record)
- **Orphan Campaigns:** 23 remaining
  - Zero sales: 17 (safe to ignore)
  - With sales: 6 (need tracking if significant)

### Campaign #38 Fix Applied
```
Submission ID: 71e3feab-bdb9-4b9f-a994-07746aa8efc0
Campaign ID: 38
Status: minted
Visible: false (hidden duplicate)
Sales: 100 NFTs
Raised: 98,100 BDAG (~$4,905 USD)
```

---

## Submission Flow Analysis

### Current Flow
```
1. User fills StoryForm
   ├─ CAPTCHA verification ✅ (Fixed multiple widget issue)
   ├─ Image upload to IPFS
   └─ Metadata generation

2. POST /api/submissions
   ├─ Auth verification
   ├─ Email verification check
   ├─ Insert to Supabase
   ├─ Send confirmation email
   └─ Notify admins

3. Admin approves via /admin dashboard
   └─ POST /api/submissions/approve
       ├─ Predict next campaign ID
       ├─ Create on-chain campaign
       ├─ Update DB with campaign_id
       ├─ Mark as minted
       └─ Send approval email
```

### Known Issues in Flow

#### Issue 1: RPC Timeout During Approval
**Location:** `/api/submissions/approve/route.ts`
**Problem:** Netlify has 10-second timeout, BlockDAG RPC can be slow
**Current Mitigation:** 
- Predict campaign ID before tx
- Don't wait for confirmation
- Background verification

**Recommendation:** Add webhook/background job for confirmation

#### Issue 2: Missing Creator Wallet
**Location:** Campaign #39 has `creator_wallet: null`
**Problem:** Wallet not captured during submission
**Root Cause:** User may not have connected wallet

**Recommendation:** Make wallet connection required for submission

#### Issue 3: Duplicate Campaign Creation
**Location:** Retry logic in approval flow
**Problem:** Multiple campaigns created for same submission
**Root Cause:** Nonce/RPC issues trigger retries that all succeed

**Recommendation:** 
- Add idempotency key to submissions
- Check if campaign with same metadata exists before creating

---

## Recommended Fixes

### Priority 1: Idempotency for Campaign Creation
```typescript
// Before creating campaign, check if one exists with same metadata
async function findExistingCampaign(metadataUri: string): Promise<number | null> {
  const total = await contract.totalCampaigns()
  for (let i = 0; i < total; i++) {
    const camp = await contract.getCampaign(i)
    if (camp.baseURI === metadataUri) return i
  }
  return null
}
```

### Priority 2: Required Wallet Connection
```typescript
// In StoryForm validation
if (!address) {
  setError('Please connect your wallet before submitting')
  return
}
```

### Priority 3: Background Verification Job
Create a cron/scheduled function to:
1. Find submissions with status='minted' but campaign_id=null
2. Search blockchain for matching campaigns
3. Update database with correct campaign_id

---

## Test Plan (TDD Approach)

### E2E Test: Campaign Approval Flow
```typescript
test('admin can approve pending campaign', async ({ page }) => {
  // 1. Login as admin
  // 2. Navigate to admin dashboard
  // 3. Find pending submission
  // 4. Click approve
  // 5. Verify on-chain campaign created
  // 6. Verify DB updated
  // 7. Verify email sent
})
```

### E2E Test: Duplicate Prevention
```typescript
test('should not create duplicate campaign on retry', async ({ page }) => {
  // 1. Create submission
  // 2. Approve (simulate RPC timeout)
  // 3. Retry approval
  // 4. Verify only ONE campaign exists
})
```

---

## Action Items

- [x] Create DB record for Campaign #38
- [ ] Investigate domain expiration (patriotpledge.org)
- [ ] Add wallet requirement to submission form
- [ ] Implement idempotency check in approval flow
- [ ] Create E2E tests for approval flow
- [ ] Add background verification job

---

*Audit in progress - December 27, 2025*
