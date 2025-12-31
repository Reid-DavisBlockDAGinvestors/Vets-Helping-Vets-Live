# API Key Rotation Guide

## Overview

This document outlines the API key rotation schedule and procedures for PatriotPledge to maintain security best practices.

## API Keys Inventory

| Service | Environment Variable | Rotation Schedule | Last Rotated |
|---------|---------------------|-------------------|--------------|
| Supabase | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 90 days | - |
| Supabase Service | `SUPABASE_SERVICE_ROLE_KEY` | 90 days | - |
| NowNodes RPC | `NOWNODES_API_KEY` | 180 days | - |
| Stripe | `STRIPE_SECRET_KEY` | 90 days | - |
| Stripe Publishable | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | 90 days | - |
| Pinata IPFS | `PINATA_JWT` | 180 days | - |
| Platform Wallet | `PLATFORM_WALLET_PRIVATE_KEY` | As needed | - |

## Rotation Procedures

### 1. Supabase Keys

**Steps:**
1. Log into [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to Project Settings → API
3. Generate new API keys
4. Update `.env.local` and Netlify environment variables
5. Deploy and verify functionality
6. Old keys remain valid for 24 hours (grace period)

**Verification:**
```bash
# Test authentication
curl -X GET "https://your-project.supabase.co/rest/v1/" \
  -H "apikey: YOUR_NEW_ANON_KEY"
```

### 2. NowNodes API Key

**Steps:**
1. Log into [NowNodes Dashboard](https://nownodes.io/dashboard)
2. Generate new API key
3. Update `NOWNODES_API_KEY` in `.env.local` and Netlify
4. Test blockchain connectivity
5. Revoke old key after verification

**Verification:**
```bash
# Test RPC connection
curl -X POST "https://bdag.nownodes.io" \
  -H "Content-Type: application/json" \
  -H "api-key: YOUR_NEW_KEY" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### 3. Stripe Keys

**Steps:**
1. Log into [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to Developers → API Keys
3. Roll the secret key (Stripe handles this gracefully)
4. Update environment variables
5. Test payment flow in test mode first

**Verification:**
```bash
# Test API connectivity
curl https://api.stripe.com/v1/customers \
  -u YOUR_NEW_SECRET_KEY:
```

### 4. Pinata JWT

**Steps:**
1. Log into [Pinata Dashboard](https://app.pinata.cloud)
2. Navigate to API Keys
3. Generate new JWT
4. Update `PINATA_JWT` environment variable
5. Test IPFS upload functionality

**Verification:**
```bash
# Test authentication
curl -X GET "https://api.pinata.cloud/data/testAuthentication" \
  -H "Authorization: Bearer YOUR_NEW_JWT"
```

### 5. Platform Wallet (Emergency Only)

**⚠️ CRITICAL: Only rotate if compromised**

**Steps:**
1. Generate new wallet using secure method
2. Transfer any remaining funds from old wallet
3. Update `PLATFORM_WALLET_PRIVATE_KEY`
4. Update contract owner if applicable
5. Revoke old wallet access

## Automated Rotation Script

Run the rotation check script to verify key ages:

```bash
npm run security:check-keys
```

## Environment Variable Locations

### Local Development
- `.env.local` (not committed to git)

### Production (Netlify)
1. Go to Netlify Dashboard → Site Settings → Environment Variables
2. Update the variable value
3. Trigger a new deploy

### Staging (if applicable)
- Same process as production, different Netlify site

## Emergency Procedures

### If a Key is Compromised

1. **Immediate:** Rotate the compromised key
2. **Audit:** Check logs for unauthorized access
3. **Notify:** Alert team members
4. **Document:** Record incident and response

### Rollback Procedure

If new key causes issues:
1. Revert to previous key (if still valid)
2. Investigate the issue
3. Fix and re-rotate

## Rotation Calendar

| Month | Keys to Rotate |
|-------|---------------|
| January | Supabase, Stripe |
| April | Supabase, Stripe, NowNodes, Pinata |
| July | Supabase, Stripe |
| October | Supabase, Stripe, NowNodes, Pinata |

## Monitoring

Set up alerts for:
- [ ] API key expiration warnings (30 days before)
- [ ] Unusual API usage patterns
- [ ] Failed authentication attempts

## Compliance Notes

- All key rotations should be logged
- Two-person verification for production changes
- Keys must never be committed to version control
- Use secret scanning tools (GitHub, GitGuardian)
