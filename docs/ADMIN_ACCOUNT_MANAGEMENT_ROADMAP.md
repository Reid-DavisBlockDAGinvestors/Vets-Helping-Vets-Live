# Admin Account Management Roadmap

**Date:** January 3, 2026  
**Status:** Implementation Plan

## Overview

This roadmap outlines the comprehensive admin account management system for PatriotPledge NFTs. The goal is to give admins full control over user accounts from the admin portal.

---

## Phase 1: Core Account Actions (Priority: HIGH) ✅ IMPLEMENTING

### 1.1 Password Management
- [x] Backend API: `/api/admin/user-audit` with `set_password` action
- [ ] **UI: Add "Reset Password" button in UserDetailModal**
- [ ] **UI: Password reset dialog with new password input**
- [ ] **UI: "Send Recovery Email" button**
- [ ] Audit log for password changes

### 1.2 Email Confirmation
- [x] Backend API: `confirm_email` action
- [ ] **UI: "Confirm Email" button for unconfirmed users**
- [ ] **UI: "Resend Confirmation" button**
- [ ] Display confirmation status clearly

### 1.3 Account Status
- [ ] **UI: Show account status (active, banned, locked)**
- [ ] **UI: "Ban User" / "Unban User" buttons**
- [ ] Ban duration selection (temporary or permanent)
- [ ] Ban reason input
- [ ] Ban audit log

---

## Phase 2: User Lookup & Search (Priority: HIGH)

### 2.1 Enhanced Search
- [ ] Search by email (exact and partial)
- [ ] Search by user ID
- [ ] Search by wallet address
- [ ] Search by display name
- [ ] Search by phone number

### 2.2 Quick Lookup Panel
- [ ] Dedicated "Find User" panel in admin
- [ ] Real-time search suggestions
- [ ] Recent lookups history
- [ ] Bookmarked/flagged users

---

## Phase 3: Account Details & Audit (Priority: MEDIUM)

### 3.1 Full Account Audit View
- [ ] **Auth metadata display:**
  - Email confirmed status
  - Last sign-in date
  - Sign-in count
  - Recovery sent timestamp
  - Account creation date
  - Provider info (email, OAuth, etc.)
  
- [ ] **Security info:**
  - MFA status (enabled/disabled)
  - MFA factors list
  - Active sessions
  - Login history (if available)

### 3.2 Profile Management
- [ ] View/edit display name
- [ ] View/edit avatar
- [ ] View/edit bio
- [ ] View/edit social links
- [ ] View wallet connections

### 3.3 Activity Timeline
- [ ] Login events
- [ ] Password changes
- [ ] Email changes
- [ ] Account actions by admin
- [ ] Purchases and donations

---

## Phase 4: Account Actions Panel (Priority: HIGH)

### 4.1 Actions Tab in UserDetailModal

```
┌─────────────────────────────────────────────────┐
│  User Detail Modal                              │
├─────────────────────────────────────────────────┤
│  [Purchased] [Created] [History] [⚙️ Actions]   │
├─────────────────────────────────────────────────┤
│                                                 │
│  🔐 Password & Access                           │
│  ├─ [Reset Password]  [Send Recovery Email]     │
│  └─ Last password change: Never                 │
│                                                 │
│  📧 Email                                       │
│  ├─ Status: ✅ Confirmed                        │
│  ├─ [Resend Confirmation]  [Change Email]       │
│  └─ Confirmed at: Dec 13, 2025                  │
│                                                 │
│  🔒 Account Status                              │
│  ├─ Status: ✅ Active                           │
│  ├─ [Ban User]  [Suspend User]                  │
│  └─ No bans on record                           │
│                                                 │
│  🛡️ Security                                    │
│  ├─ MFA: ❌ Not enabled                         │
│  ├─ [Reset MFA]                                 │
│  └─ Active sessions: 2                          │
│                                                 │
│  ⚠️ Danger Zone                                 │
│  ├─ [Delete Account]                            │
│  └─ [Export User Data]                          │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Phase 5: Supabase Integration Requirements

### 5.1 Required Database Tables

```sql
-- Already exists: community_profiles
-- Already exists: profiles
-- Already exists: purchases

-- NEW: Admin action audit log
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES auth.users(id),
  target_user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NEW: User bans table
CREATE TABLE user_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  banned_by UUID REFERENCES auth.users(id),
  reason TEXT,
  banned_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  lifted_at TIMESTAMPTZ,
  lifted_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT TRUE
);
```

### 5.2 Required API Endpoints

| Endpoint | Method | Action |
|----------|--------|--------|
| `/api/admin/user-audit` | GET | Get user details |
| `/api/admin/user-audit` | POST | Perform action |
| `/api/admin/users/ban` | POST | Ban user |
| `/api/admin/users/unban` | POST | Unban user |
| `/api/admin/users/sessions` | GET | List active sessions |
| `/api/admin/users/sessions` | DELETE | Revoke session |
| `/api/admin/audit-log` | GET | Get audit log |

### 5.3 Supabase Admin API Capabilities

The following actions are available via `supabase.auth.admin`:

| Action | Method | Status |
|--------|--------|--------|
| List users | `listUsers()` | ✅ Implemented |
| Get user by ID | `getUserById()` | ✅ Available |
| Update user | `updateUserById()` | ✅ Implemented |
| Delete user | `deleteUser()` | ✅ Available |
| Set password | `updateUserById({ password })` | ✅ Implemented |
| Confirm email | `updateUserById({ email_confirm: true })` | ✅ Implemented |
| Ban user | `updateUserById({ ban_duration })` | ✅ Available |
| Generate recovery link | `generateLink({ type: 'recovery' })` | ✅ Implemented |
| Invite user | `inviteUserByEmail()` | ✅ Available |

---

## Phase 6: Implementation Order

### Sprint 1 (Today - Priority)
1. ✅ Create `/api/admin/user-audit` endpoint with actions
2. ⏳ Add "Actions" tab to UserDetailModal
3. ⏳ Implement Reset Password UI
4. ⏳ Implement Send Recovery Email UI
5. ⏳ Test with Playwright

### Sprint 2 (Next)
1. Add Confirm Email button
2. Add Ban/Unban functionality
3. Create audit log table and API
4. Show account status in user list

### Sprint 3 (Future)
1. Enhanced search/lookup
2. Session management
3. MFA management
4. Activity timeline
5. Data export

---

## Testing Requirements

### Playwright Tests
- [ ] Can search for user by email
- [ ] Can open user detail modal
- [ ] Can navigate to Actions tab
- [ ] Can reset password
- [ ] Can send recovery email
- [ ] Can confirm email
- [ ] Can ban/unban user
- [ ] Actions are logged

---

## Security Considerations

1. **All actions require admin authentication**
2. **All actions are logged with admin ID and timestamp**
3. **Cannot ban/delete super_admin accounts**
4. **Password resets require confirmation dialog**
5. **Account deletion requires double confirmation**
6. **Rate limiting on sensitive actions**
