# Netlify Environment Variables Audit

**Date:** January 3, 2026  
**Auditor:** Cascade AI

## Required Environment Variables for Production

The following variables MUST be set in Netlify for full functionality:

### 🔐 CRITICAL - Security Keys (NEVER expose publicly)

| Variable | Status | Description |
|----------|--------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ VERIFY | Admin access to Supabase - required for user management |
| `BDAG_RELAYER_KEY` | ⚠️ VERIFY | Relayer wallet private key for BlockDAG transactions |
| `ETH_DEPLOYER_KEY` | ⚠️ VERIFY | Deployer wallet private key for Sepolia |
| `ETH_MAINNET_KEY` | ⚠️ VERIFY | Mainnet signer for distributions (PRODUCTION) |
| `PINATA_JWT` | ⚠️ VERIFY | IPFS pinning service authentication |
| `OPENAI_API_KEY` | ⚠️ VERIFY | AI assistance features |
| `STRIPE_KEY` | ⚠️ VERIFY | Stripe secret key for payments |
| `STRIPE_WEBHOOK_SECRET` | ⚠️ VERIFY | Stripe webhook verification |
| `RESEND_API_KEY` | ⚠️ VERIFY | Email sending service |
| `ADMIN_SECRET` | ⚠️ VERIFY | Admin API authentication |
| `ADMIN_PASSWORD` | ⚠️ VERIFY | Admin portal password |
| `DIDIT_API_KEY` | ⚠️ VERIFY | KYC verification service |
| `DIDIT_WEBHOOK_SECRET` | ⚠️ VERIFY | KYC webhook verification |
| `CAPTCHA_SECRET_KEY` | ⚠️ VERIFY | Cloudflare Turnstile server key |
| `NOWNODES_API_KEY` | ⚠️ VERIFY | Fallback RPC service |

### 🌐 Public Variables (NEXT_PUBLIC_*)

| Variable | Value | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ecwqzakvbkdywnfsrsfs.supabase.co` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (JWT token) | Supabase anonymous key |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | `0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890` | V5 BlockDAG contract |
| `NEXT_PUBLIC_CONTRACT_ADDRESS_V6` | `0xaE54e4E8A75a81780361570c17b8660CEaD27053` | V6 BlockDAG contract |
| `NEXT_PUBLIC_V7_CONTRACT_SEPOLIA` | `0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e` | V7 Sepolia contract |
| `NEXT_PUBLIC_V8_CONTRACT_ETHEREUM` | `0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e` | V8 Mainnet contract |
| `NEXT_PUBLIC_BLOCKDAG_RPC` | `https://rpc.awakening.bdagscan.com` | BlockDAG RPC endpoint |
| `NEXT_PUBLIC_ETHEREUM_RPC` | `https://ethereum-rpc.publicnode.com` | Ethereum Mainnet RPC |
| `NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC` | `https://ethereum-sepolia-rpc.publicnode.com` | Sepolia RPC |
| `NEXT_PUBLIC_EXPLORER_BASE` | `https://awakening.bdagscan.com` | BlockDAG explorer |
| `NEXT_PUBLIC_BDAG_USD_RATE` | `0.05` | BDAG token price |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | (pk_test_...) | Stripe public key |
| `NEXT_PUBLIC_BASE_URL` | `https://patriotpledgenfts.netlify.app` | Production URL |
| `NEXT_PUBLIC_CAPTCHA_SITE_KEY` | (Turnstile key) | CAPTCHA public key |
| `NEXT_PUBLIC_DIDIT_APP_ID` | `0df5c330-0233-4643-8eab-b80f49649fe4` | KYC app ID |
| `NEXT_PUBLIC_BDAG_ONCHAIN` | `true` | Enable on-chain features |

### 🔧 Configuration Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `BDAG_ENABLE_ONCHAIN` | `true` | Enable on-chain transactions |
| `BLOCKDAG_RPC` | `https://rpc.awakening.bdagscan.com` | Server-side RPC |
| `BLOCKDAG_RPC_FALLBACK` | `https://bdag.nownodes.io` | Fallback RPC |
| `ETHEREUM_RPC` | `https://ethereum-rpc.publicnode.com` | Mainnet RPC |
| `ETHEREUM_SEPOLIA_RPC` | `https://ethereum-sepolia-rpc.publicnode.com` | Sepolia RPC |
| `CONTRACT_ADDRESS` | `0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890` | V5 contract |
| `CONTRACT_ADDRESS_V6` | `0xaE54e4E8A75a81780361570c17b8660CEaD27053` | V6 contract |
| `V7_CONTRACT_SEPOLIA` | `0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e` | V7 Sepolia |
| `V8_CONTRACT_ETHEREUM` | `0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e` | V8 Mainnet |
| `BDAG_NONPROFIT_ADDRESS` | `0xbFD14c5A940E783AEc1993598143B59D3C971eF1` | Nonprofit wallet |
| `TREASURY_WALLET` | `0xbFD14c5A940E783AEc1993598143B59D3C971eF1` | Platform treasury |
| `PLATFORM_FEE_BPS` | `100` | 1% platform fee |
| `IMMEDIATE_PAYOUT_ENABLED` | `false` | Immediate payout toggle |
| `MAX_GAS_PRICE_GWEI` | `100` | Gas price limit |
| `GAS_BUFFER_PERCENT` | `20` | Gas buffer |
| `BDAG_USD_RATE` | `0.05` | BDAG price |
| `PINATA_GATEWAY` | `gateway.pinata.cloud` | IPFS gateway |
| `FROM_EMAIL` | `PatriotPledgeNFTs@VetsHelpingVets.Life` | Sender email |
| `ADMIN_EMAIL` | `Reid@BlockDAGinvestors.com` | Admin email |
| `CAPTCHA_PROVIDER` | `turnstile` | CAPTCHA service |
| `CAPTCHA_ENFORCE` | `true` | Enforce in production |
| `DIDIT_WORKFLOW_ID` | `b0c84c76-d268-439c-9668-c02bcc141ee5` | KYC workflow |
| `DIDIT_WEBHOOK_URL` | `https://patriotpledgenfts.netlify.app/api/didit/webhook` | KYC webhook |

### ⚠️ Variables to UPDATE for Production

| Variable | Current | Should Be |
|----------|---------|-----------|
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:3001` | `https://patriotpledgenfts.netlify.app` |
| `CAPTCHA_ENFORCE` | `false` | `true` |
| `DIDIT_WEBHOOK_URL` | `https://vetshelpingvets.life/...` | Update if domain changes |

### 🚫 Variables NOT Needed in Netlify (Development Only)

- `ETHERSCAN_API_KEY` - Optional, for contract verification
- `STORACHA_*` - Optional alternative IPFS service

---

## Checklist for Netlify Setup

1. [ ] All CRITICAL security keys are set
2. [ ] All NEXT_PUBLIC_* variables are set
3. [ ] `NEXT_PUBLIC_BASE_URL` is set to production URL
4. [ ] `CAPTCHA_ENFORCE` is set to `true`
5. [ ] Stripe is in production mode (not test keys) when ready
6. [ ] All webhook URLs point to production domain
