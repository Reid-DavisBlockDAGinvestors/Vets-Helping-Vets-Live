# 🗄️ Database Migrations Tracker

## Overview
All database migrations for PatriotPledge NFT platform, tracked chronologically.

---

## Migration History

| Date | File | Description | Status |
|------|------|-------------|--------|
| 2025-11-15 | `20251115_add_username_profiles.sql` | Add username field to profiles | ✅ Applied |
| 2025-11-15 | `20251115_cleanup_tasks.sql` | Cleanup tasks table | ✅ Applied |
| 2025-11-16 | `20251116_add_submissions_pricing_benchmarks.sql` | Pricing and benchmarks | ✅ Applied |
| 2025-11-18 | `20251118_add_contracts_and_visibility.sql` | Contract visibility | ✅ Applied |
| 2025-11-24 | `20251124_marketplace_contracts.sql` | Marketplace contracts table | ✅ Applied |
| 2025-11-25 | `20251125_contributions.sql` | Contributions tracking | ✅ Applied |
| 2025-11-26 | `20251126_add_sold_count_to_submissions.sql` | Sold count tracking | ✅ Applied |
| 2025-11-26 | `20251126_add_v4_contract.sql` | V4 contract support | ✅ Applied |
| 2025-11-27 | `20251127_add_v4_with_contribute.sql` | V4 contribute function | ✅ Applied |
| 2025-11-28 | `20251128_v5_campaign_id.sql` | V5 campaign ID support | ✅ Applied |
| 2025-12-10 | `20251210_events.sql` | Analytics events table | ✅ Applied |
| 2025-12-11 | `20251211_campaign_updates.sql` | Living NFT updates | ✅ Applied |
| 2025-12-11 | `20251211_didit_verification.sql` | Didit KYC integration | ✅ Applied |
| 2025-12-11 | `20251211_nft_settings.sql` | NFT configuration | ✅ Applied |
| 2025-12-11 | `20251211_submissions_contact_fields.sql` | Creator contact info | ✅ Applied |
| 2025-12-11 | `20251211_verification_documents.sql` | Verification docs | ✅ Applied |
| 2025-12-11 | `20251211_verification_storage.sql` | Storage for verification | ✅ Applied |
| 2025-12-12 | `20251212_governance_proposals.sql` | DAO governance | ✅ Applied |
| 2025-12-13 | `20251213_admin_permission_levels.sql` | Admin roles | ✅ Applied |
| 2025-12-13 | `20251213_admin_requests.sql` | Admin request system | ✅ Applied |
| 2025-12-13 | `20251213_campaign_identifiers.sql` | Slug, short_code, hashtag | ✅ Applied |
| 2025-12-13 | `20251213_community_hub.sql` | Community features | ✅ Applied |
| 2025-12-13 | `20251213_community_storage.sql` | Community file storage | ✅ Applied |
| 2025-12-13 | `20251213_purchase_tracking.sql` | Purchase records | ✅ Applied |
| 2025-12-14 | `20251214_email_templates.sql` | Email templates | ✅ Applied |
| 2025-12-15 | `20251215_add_user_id_to_submissions.sql` | User ID linking | ✅ Applied |
| 2025-12-15 | `20251215_bug_reports.sql` | Bug reporting system | ✅ Applied |
| 2025-12-15 | `20251215_fix_creator_wallet_nullable.sql` | Nullable wallet fix | ✅ Applied |
| 2025-12-15 | `20251215_purchases_enhanced.sql` | Enhanced purchases | ✅ Applied |
| 2025-12-15 | `20251215_purchases_tips.sql` | Tip tracking | ✅ Applied |
| 2025-12-15 | `20251215_user_name_fields.sql` | User name fields | ✅ Applied |
| 2025-12-16 | `20251216_add_profile_names.sql` | Profile names | ✅ Applied |
| 2025-12-16 | `20251216_add_tx_hash_to_submissions.sql` | Transaction hash | ✅ Applied |
| 2025-12-19 | `20251219_multi_contract_support.sql` | Multi-contract | ✅ Applied |
| 2025-12-20 | `20251220_bug_report_messages.sql` | Bug report threads | ✅ Applied |
| 2025-12-27 | `scripts/sql/enable-rls-policies.sql` | RLS on 7 tables | ✅ Applied |
| 2025-12-27 | `scripts/sql/create-audit-table.sql` | Admin audit logs | ✅ Applied |

---

## RLS-Protected Tables

| Table | RLS Enabled | Policies |
|-------|-------------|----------|
| `submissions` | ✅ | View own, admin full |
| `profiles` | ✅ | View own, admin full |
| `purchases` | ✅ | View own |
| `campaign_updates` | ✅ | View approved, auth view all |
| `cleanup_tasks` | ✅ | Service role only |
| `contributions` | ✅ | Public read |
| `marketplace_contracts` | ✅ | Public read enabled |
| `nft_contracts` | ✅ | Public read |
| `proposal_votes` | ✅ | Public read, auth create |
| `proposals` | ✅ | Public read, auth create/update |
| `admin_audit_logs` | ✅ | Admin read, service write |

---

## Pending Migrations

| Priority | Description | File |
|----------|-------------|------|
| Medium | Email preferences table | TBD |
| Medium | Notification settings | TBD |
| Low | Analytics aggregates | TBD |
| Low | Multi-chain support | TBD |

---

## Migration Naming Convention

```
YYYYMMDD_description.sql

Examples:
20251227_add_email_preferences.sql
20251228_create_notifications_table.sql
```

---

## How to Apply Migrations

### Via Supabase Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Copy migration file contents
3. Run in SQL Editor
4. Update this document with ✅ Applied

### Via Supabase CLI (Future)
```bash
supabase db push
```

---

## Rollback Procedures

Each migration should have a rollback script:

```sql
-- Migration: 20251227_example.sql

-- UP
CREATE TABLE example (...);

-- DOWN (save separately)
DROP TABLE IF EXISTS example;
```

---

*Last Updated: December 27, 2025*
