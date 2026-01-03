# PatriotPledge Database Schema Audit
> Complete audit of Supabase database schema - Jan 2, 2026

## Overview

This document provides a comprehensive audit of all database tables, their relationships, and the data flow throughout the PatriotPledge NFT platform.

---

## Fee Structure (Current vs Planned)

### Current State (V5/V6 on BlockDAG Testnet)
| Fee Type | Percentage | Implementation |
|----------|-----------|----------------|
| Nonprofit Fee | 1% | Displayed on UI, **NOT auto-deducted on-chain** |
| Platform Fee | 0% | Not currently charged |
| Submitter | 99% | After manual distribution |

### Planned State (V7/V8)
| Fee Type | Percentage | Implementation |
|----------|-----------|----------------|
| Platform Fee | 1% | Auto-deducted on-chain at mint |
| Nonprofit Fee | 1% | Auto-deducted on-chain at mint |
| Submitter | 98% | Immediate or batched distribution |

**IMPORTANT:** The UI must reflect the actual fee structure being used!

---

## Database Tables (38 Migrations)

### Core Tables

#### 1. `profiles`
**Purpose:** User profile data extending Supabase auth.users
```sql
- id: UUID (FK to auth.users)
- username: VARCHAR (unique)
- display_name: VARCHAR
- first_name: VARCHAR
- last_name: VARCHAR
- avatar_url: TEXT
- wallet_address: VARCHAR(42)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```
**Migrations:** `20251115_add_username_profiles.sql`, `20251215_user_name_fields.sql`, `20251216_add_profile_names.sql`

---

#### 2. `submissions`
**Purpose:** Campaign/fundraiser submissions from users
```sql
- id: UUID (PK)
- user_id: UUID (FK to auth.users)
- title: VARCHAR
- story: TEXT
- category: VARCHAR
- goal: DECIMAL (USD)
- num_copies: INTEGER
- price_per_copy: DECIMAL
- image_uri: TEXT (IPFS URI)
- status: VARCHAR (pending/approved/minted/rejected)
- campaign_id: INTEGER (on-chain ID)
- contract_address: VARCHAR(42)
- contract_version: VARCHAR (v5/v6/v7)
- chain_id: INTEGER
- chain_name: VARCHAR
- tx_hash: VARCHAR(66)
- creator_name: VARCHAR
- creator_wallet: VARCHAR(42)
- creator_email: VARCHAR
- creator_phone: VARCHAR
- nonprofit_name: VARCHAR
- nonprofit_wallet: VARCHAR(42)
- uses_platform_wallet: BOOLEAN
- sold_count: INTEGER
- slug: VARCHAR (unique)
- short_code: VARCHAR (unique)
- hashtag: VARCHAR
- visibility: VARCHAR (public/private)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```
**Key Migrations:**
- `20251116_add_submissions_pricing_benchmarks.sql`
- `20251118_add_contracts_and_visibility.sql`
- `20251128_v5_campaign_id.sql`
- `20251211_submissions_contact_fields.sql`
- `20251213_campaign_identifiers.sql`
- `20251215_add_user_id_to_submissions.sql`
- `20251216_add_tx_hash_to_submissions.sql`
- `20251219_multi_contract_support.sql`
- `20251230_platform_wallet_tracking.sql`

---

#### 3. `purchases`
**Purpose:** NFT purchase records
```sql
- id: UUID (PK)
- campaign_id: INTEGER
- token_id: INTEGER
- buyer_wallet: VARCHAR(42)
- buyer_email: VARCHAR
- amount_bdag: DECIMAL
- amount_usd: DECIMAL
- tip_bdag: DECIMAL
- tip_usd: DECIMAL
- quantity: INTEGER
- tx_hash: VARCHAR(66)
- chain_id: INTEGER
- user_id: UUID (FK to auth.users)
- payment_method: VARCHAR
- ip_address: VARCHAR
- user_agent: TEXT
- referrer: TEXT
- created_at: TIMESTAMPTZ
```
**Migrations:** `20251213_purchase_tracking.sql`, `20251215_purchases_enhanced.sql`, `20251215_purchases_tips.sql`

---

#### 4. `contributions`
**Purpose:** Off-chain payment tracking (Stripe, PayPal, etc.)
```sql
- id: UUID (PK)
- token_id: INTEGER
- contract_address: TEXT
- amount_gross: DECIMAL
- amount_net: DECIMAL
- card_fees: DECIMAL
- nonprofit_fee: DECIMAL
- is_onchain: BOOLEAN
- buyer_wallet: TEXT
- payment_method: TEXT
- payment_ref: TEXT
- created_at: TIMESTAMPTZ
```
**Migration:** `20251125_contributions.sql`

---

#### 5. `distributions`
**Purpose:** Fund distribution records from contract to recipients
```sql
- id: UUID (PK)
- campaign_id: INTEGER
- submission_id: UUID
- distribution_type: VARCHAR (funds/tips)
- amount: DECIMAL
- currency: VARCHAR (BDAG/ETH)
- recipient_wallet: VARCHAR(42)
- recipient_type: VARCHAR (submitter/nonprofit)
- tx_hash: VARCHAR(66)
- chain_id: INTEGER
- status: VARCHAR (pending/completed/failed)
- distributed_by: UUID (admin user)
- created_at: TIMESTAMPTZ
```
**Note:** This table may need to be created if not exists

---

#### 6. `tokens` (NEW - Pending Migration)
**Purpose:** Cache of minted NFT tokens for fast admin queries
```sql
- id: SERIAL (PK)
- token_id: INTEGER
- campaign_id: INTEGER
- chain_id: INTEGER
- contract_address: VARCHAR(42)
- contract_version: VARCHAR
- owner_wallet: VARCHAR(42)
- edition_number: INTEGER
- total_editions: INTEGER
- is_frozen: BOOLEAN
- is_soulbound: BOOLEAN
- metadata_uri: TEXT
- mint_tx_hash: VARCHAR(66)
- minted_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
- UNIQUE(token_id, chain_id, contract_address)
```
**Migration:** `20260102_tokens_cache.sql` (PENDING)

---

### Supporting Tables

#### 7. `campaign_updates`
**Purpose:** Updates/milestones posted by campaign creators
```sql
- id: UUID (PK)
- submission_id: UUID (FK)
- title: VARCHAR
- content: TEXT
- image_url: TEXT
- created_at: TIMESTAMPTZ
```
**Migration:** `20251211_campaign_updates.sql`

---

#### 8. `events`
**Purpose:** Analytics event tracking
```sql
- id: UUID (PK)
- event_type: VARCHAR
- campaign_id: INTEGER
- wallet_address: VARCHAR(42)
- amount_bdag: DECIMAL
- amount_usd: DECIMAL
- metadata: JSONB
- created_at: TIMESTAMPTZ
```
**Migration:** `20251210_events.sql`

---

#### 9. `bug_reports`
**Purpose:** Bug bounty submissions
```sql
- id: UUID (PK)
- user_id: UUID (FK)
- title: VARCHAR
- description: TEXT
- severity: VARCHAR (low/medium/high/critical)
- category: VARCHAR
- steps_to_reproduce: TEXT
- expected_behavior: TEXT
- actual_behavior: TEXT
- environment: JSONB
- status: VARCHAR (new/triaging/confirmed/fixed/closed/duplicate/wontfix)
- resolution: TEXT
- bounty_amount: DECIMAL
- bounty_paid: BOOLEAN
- bounty_tx_hash: VARCHAR(66)
- wallet_address: VARCHAR(42)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```
**Migration:** `20251215_bug_reports.sql`

---

#### 10. `bug_report_messages`
**Purpose:** Messages/comments on bug reports
```sql
- id: UUID (PK)
- bug_report_id: UUID (FK)
- user_id: UUID (FK)
- content: TEXT
- is_admin: BOOLEAN
- created_at: TIMESTAMPTZ
```
**Migration:** `20251220_bug_report_messages.sql`

---

#### 11. `governance_proposals`
**Purpose:** Community governance proposals
```sql
- id: UUID (PK)
- title: VARCHAR
- description: TEXT
- category: VARCHAR
- status: VARCHAR (draft/active/passed/rejected/executed)
- created_by: UUID (FK)
- voting_ends_at: TIMESTAMPTZ
- yes_votes: INTEGER
- no_votes: INTEGER
- required_quorum: INTEGER
- created_at: TIMESTAMPTZ
```
**Migration:** `20251212_governance_proposals.sql`

---

#### 12. `admin_requests`
**Purpose:** Admin access requests
```sql
- id: UUID (PK)
- user_id: UUID (FK)
- email: VARCHAR
- reason: TEXT
- status: VARCHAR (pending/approved/rejected)
- reviewed_by: UUID
- reviewed_at: TIMESTAMPTZ
- created_at: TIMESTAMPTZ
```
**Migration:** `20251213_admin_requests.sql`

---

### Community Hub Tables

#### 13. `community_posts`
**Purpose:** Community discussion posts
```sql
- id: UUID (PK)
- user_id: UUID (FK)
- content: TEXT
- media_urls: TEXT[]
- campaign_id: UUID (optional)
- parent_id: UUID (for replies)
- likes_count: INTEGER
- replies_count: INTEGER
- created_at: TIMESTAMPTZ
```
**Migration:** `20251213_community_hub.sql`

---

#### 14. `community_reactions`
**Purpose:** Reactions on community posts
```sql
- id: UUID (PK)
- post_id: UUID (FK)
- user_id: UUID (FK)
- reaction_type: VARCHAR (like/love/support/celebrate)
- created_at: TIMESTAMPTZ
```
**Migration:** `20251227_community_reactions.sql`

---

#### 15. `campaign_followers`
**Purpose:** Users following campaigns for updates
```sql
- id: UUID (PK)
- campaign_id: UUID (FK)
- user_id: UUID (FK)
- created_at: TIMESTAMPTZ
```
**Migration:** `20251213_community_hub.sql`

---

### Verification Tables

#### 16. `verification_documents`
**Purpose:** KYC verification document uploads
```sql
- id: UUID (PK)
- user_id: UUID (FK)
- document_type: VARCHAR
- storage_path: TEXT
- status: VARCHAR
- verified_at: TIMESTAMPTZ
- created_at: TIMESTAMPTZ
```
**Migration:** `20251211_verification_documents.sql`

---

### Configuration Tables

#### 17. `nft_settings`
**Purpose:** Per-campaign NFT display settings
```sql
- id: UUID (PK)
- submission_id: UUID (FK)
- show_edition_number: BOOLEAN
- show_qr_code: BOOLEAN
- animation_style: VARCHAR
- frame_style: VARCHAR
```
**Migration:** `20251211_nft_settings.sql`

---

#### 18. `email_templates`
**Purpose:** Customizable email templates
```sql
- id: UUID (PK)
- name: VARCHAR
- subject: VARCHAR
- body_html: TEXT
- variables: TEXT[]
- active: BOOLEAN
```
**Migration:** `20251214_email_templates.sql`

---

#### 19. `tip_splits`
**Purpose:** Per-campaign tip split configuration
```sql
- id: UUID (PK)
- submission_id: UUID (FK)
- submitter_percent: INTEGER
- nonprofit_percent: INTEGER
- updated_by: UUID
- updated_at: TIMESTAMPTZ
```
**Note:** Used by distribution system

---

## Data Flow Diagrams

### Purchase Flow
```
User clicks "Buy NFT"
    ↓
Connect wallet (MetaMask)
    ↓
Submit transaction (mintWithBDAG/mintWithBDAGAndTip)
    ↓
Wait for confirmation
    ↓
API: /api/purchase/record
    ↓
Insert into `purchases` table
    ↓
Upsert into `tokens` table (NEW)
    ↓
Send email receipt
    ↓
Update `submissions.sold_count`
```

### Distribution Flow
```
Admin opens Distribution Panel
    ↓
API: /api/admin/distributions/balances
    ↓
Read `submissions` + calculate from `purchases`
    ↓
Admin clicks "Distribute Funds/Tips"
    ↓
API: /api/admin/distributions/execute
    ↓
Call contract.withdraw(to, amount)
    ↓
Wait for confirmation
    ↓
Insert into `distributions` table
    ↓
Send email notifications
```

---

## Indexes Summary

| Table | Index | Columns |
|-------|-------|---------|
| submissions | idx_submissions_status | status |
| submissions | idx_submissions_campaign_id | campaign_id |
| submissions | idx_submissions_chain_id | chain_id |
| purchases | idx_purchases_campaign_id | campaign_id |
| purchases | idx_purchases_user_id | user_id |
| purchases | idx_purchases_created_at | created_at |
| tokens | idx_tokens_chain_id | chain_id |
| tokens | idx_tokens_campaign_id | campaign_id |
| tokens | idx_tokens_owner_wallet | owner_wallet |
| contributions | contributions_token_id_idx | token_id |

---

## Row Level Security (RLS)

| Table | Policy |
|-------|--------|
| profiles | Users can read/update own profile |
| submissions | Public read, authenticated create |
| purchases | Public read for transparency |
| bug_reports | User can see own reports, admins see all |
| tokens | Public read (on-chain data is public) |

---

## Pending Migrations

### 1. `20260102_tokens_cache.sql`
**Status:** Ready to run
**Purpose:** Cache minted tokens for fast admin panel queries

### 2. `distributions` table
**Status:** May need creation
**Purpose:** Track fund/tip distributions

---

## Future Considerations

### Multi-Chain Support
- All relevant tables have `chain_id` column
- Contract addresses stored per-submission
- Support for BlockDAG (1043), Sepolia (11155111), Ethereum (1)

### Fee Tracking
- Add `platform_fee` and `nonprofit_fee` columns to distributions
- Track actual fees deducted per transaction
- Support for adjustable fees in V8

### Analytics Enhancement
- Consider materialized views for stats
- Add more event types to `events` table
- Real-time dashboard with websockets

---

## Roadmap for Database

### Phase 1 (Immediate)
- [ ] Run `20260102_tokens_cache.sql` migration
- [ ] Verify `distributions` table exists
- [ ] Add missing indexes

### Phase 2 (V8 Preparation)
- [ ] Add `platform_fee_bps` to submissions
- [ ] Add `nonprofit_fee_bps` to submissions  
- [ ] Add fee tracking columns to distributions

### Phase 3 (Production)
- [ ] Set up database backups
- [ ] Configure connection pooling
- [ ] Add monitoring/alerting

---

*Last Updated: January 2, 2026*
