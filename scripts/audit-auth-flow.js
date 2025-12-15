/**
 * Audit script to verify authentication requirements in submission and purchase flows
 * Run with: node scripts/audit-auth-flow.js
 */
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function main() {
  console.log('=== Auth Flow Audit ===\n')

  // 1. Check submissions for auth tracking
  console.log('1. SUBMISSIONS - Checking auth tracking...')
  const { data: submissions } = await supabaseAdmin
    .from('submissions')
    .select('id, creator_email, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  console.log(`   Found ${submissions?.length || 0} recent submissions`)
  
  // Check if submissions have associated user accounts
  let submissionsWithAuth = 0
  let submissionsWithoutAuth = 0
  
  for (const sub of (submissions || [])) {
    // Check if creator_email has a verified account
    const { data: users } = await supabaseAdmin.auth.admin.listUsers()
    const matchingUser = users?.users?.find(u => u.email?.toLowerCase() === sub.creator_email?.toLowerCase())
    
    if (matchingUser) {
      submissionsWithAuth++
      const verified = matchingUser.email_confirmed_at ? 'VERIFIED' : 'NOT VERIFIED'
      console.log(`   ✅ ${sub.creator_email?.slice(0, 20)}... - Has account (${verified})`)
    } else {
      submissionsWithoutAuth++
      console.log(`   ⚠️ ${sub.creator_email?.slice(0, 20)}... - NO USER ACCOUNT`)
    }
  }
  
  console.log(`\n   Summary: ${submissionsWithAuth} with accounts, ${submissionsWithoutAuth} without`)

  // 2. Check purchases for auth tracking
  console.log('\n2. PURCHASES - Checking auth tracking...')
  const { data: purchases } = await supabaseAdmin
    .from('purchases')
    .select('id, wallet_address, email, campaign_id, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  console.log(`   Found ${purchases?.length || 0} recent purchases`)
  
  let purchasesWithEmail = 0
  let purchasesWithoutEmail = 0
  let purchasesWithVerifiedEmail = 0
  
  const { data: authData } = await supabaseAdmin.auth.admin.listUsers()
  const allUsers = authData?.users || []
  
  for (const purchase of (purchases || [])) {
    if (purchase.email) {
      purchasesWithEmail++
      const matchingUser = allUsers.find(u => u.email?.toLowerCase() === purchase.email?.toLowerCase())
      if (matchingUser?.email_confirmed_at) {
        purchasesWithVerifiedEmail++
        console.log(`   ✅ ${purchase.email?.slice(0, 20)}... - Verified account`)
      } else if (matchingUser) {
        console.log(`   ⚠️ ${purchase.email?.slice(0, 20)}... - Unverified account`)
      } else {
        console.log(`   ❓ ${purchase.email?.slice(0, 20)}... - Email but no account`)
      }
    } else {
      purchasesWithoutEmail++
      console.log(`   ❌ wallet ${purchase.wallet_address?.slice(0, 10)}... - NO EMAIL`)
    }
  }
  
  console.log(`\n   Summary: ${purchasesWithEmail} with email, ${purchasesWithoutEmail} without`)
  console.log(`   Verified emails: ${purchasesWithVerifiedEmail}`)

  // 3. Check all users for email verification status
  console.log('\n3. USER ACCOUNTS - Email verification status...')
  let verifiedCount = 0
  let unverifiedCount = 0
  
  for (const user of allUsers) {
    if (user.email_confirmed_at) {
      verifiedCount++
    } else {
      unverifiedCount++
      console.log(`   ⚠️ UNVERIFIED: ${user.email} (created: ${user.created_at?.slice(0, 10)})`)
    }
  }
  
  console.log(`\n   Total users: ${allUsers.length}`)
  console.log(`   Verified: ${verifiedCount}`)
  console.log(`   Unverified: ${unverifiedCount}`)

  // 4. Code audit - check what's currently enforced
  console.log('\n4. CODE AUDIT - Current enforcement...')
  console.log(`
   ┌─────────────────────────────────────────────────────────────────┐
   │ ENDPOINT/COMPONENT       │ AUTH REQUIRED │ EMAIL VERIFIED REQ  │
   ├─────────────────────────────────────────────────────────────────┤
   │ /api/submissions POST    │ ❌ NO         │ ❌ NO               │
   │ PurchasePanel (crypto)   │ ✅ YES        │ ❌ NO               │
   │ PurchasePanel (card)     │ ❓ UNKNOWN    │ ❓ UNKNOWN          │
   │ /api/purchase/record     │ ❌ NO (public)│ ❌ NO               │
   │ /api/community/my-camps  │ ✅ YES        │ ❌ NO               │
   └─────────────────────────────────────────────────────────────────┘
  `)

  console.log('\n5. RECOMMENDATIONS:')
  console.log(`
   1. SUBMISSIONS: Should require authenticated user with verified email
      - Add auth check to /api/submissions POST
      - Link submission to user_id, not just email
   
   2. PURCHASES: Currently requires login but not email verification
      - Add email_confirmed_at check before allowing purchase
      - Show clear message: "Please verify your email to purchase"
   
   3. ERROR MESSAGES: Need to clearly indicate WHY action is blocked
      - "Please log in" ✅ (exists)
      - "Please verify your email" ❌ (missing)
      - "Create an account to submit" ❌ (missing)
  `)
}

main().catch(console.error)
