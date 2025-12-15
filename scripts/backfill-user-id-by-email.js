// Backfill user_id by matching purchase email to profile email
// Run with: node scripts/backfill-user-id-by-email.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function backfillUserIdByEmail() {
  console.log('🔄 BACKFILL USER_ID BY EMAIL MATCH')
  console.log('=' .repeat(70))

  // Get all data
  const { data: purchases } = await supabase.from('purchases').select('*')
  const { data: profiles } = await supabase.from('profiles').select('*')
  
  // Also get auth users for email matching
  const { data: authData } = await supabase.auth.admin.listUsers()
  const authUsers = authData?.users || []

  console.log(`\nPurchases: ${purchases?.length}`)
  console.log(`Profiles: ${profiles?.length}`)
  console.log(`Auth users: ${authUsers.length}`)

  // Build email -> user lookup
  const emailToUserId = {}
  
  // From profiles
  profiles?.forEach(p => {
    if (p.email) {
      emailToUserId[p.email.toLowerCase()] = p.id
    }
  })

  // From auth users
  authUsers.forEach(u => {
    if (u.email) {
      emailToUserId[u.email.toLowerCase()] = u.id
    }
  })

  console.log(`\nEmail to user mappings: ${Object.keys(emailToUserId).length}`)
  Object.entries(emailToUserId).forEach(([email, id]) => {
    console.log(`   ${email} -> ${id.slice(0, 8)}...`)
  })

  // Match purchases
  console.log('\n' + '-'.repeat(70))
  console.log('Matching purchases by email...\n')

  let updated = 0
  let skipped = 0
  let noMatch = 0

  for (const purchase of purchases || []) {
    if (purchase.user_id) {
      skipped++
      continue
    }

    if (!purchase.email) {
      noMatch++
      continue
    }

    const userId = emailToUserId[purchase.email.toLowerCase()]
    if (userId) {
      const { error } = await supabase
        .from('purchases')
        .update({ user_id: userId })
        .eq('id', purchase.id)

      if (!error) {
        updated++
        console.log(`   ✅ ${purchase.email} -> user ${userId.slice(0, 8)}...`)
      }
    } else {
      noMatch++
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log('SUMMARY')
  console.log('='.repeat(70))
  console.log(`   ✅ Updated: ${updated}`)
  console.log(`   ⏭️ Already had user_id: ${skipped}`)
  console.log(`   ⚠️ No email or no match: ${noMatch}`)

  // Verify
  const { data: finalPurchases } = await supabase.from('purchases').select('user_id')
  const withUserId = finalPurchases?.filter(p => p.user_id)?.length || 0
  console.log(`\n   Final: ${withUserId}/${finalPurchases?.length} purchases have user_id`)
}

backfillUserIdByEmail().catch(console.error)
