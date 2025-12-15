/**
 * Backfill purchase emails by matching wallet addresses to user profiles
 * Also checks auth.users for email by wallet patterns
 */
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function main() {
  console.log('=== Backfill Purchase Emails from Profiles ===\n')

  // 1. Get all purchases
  console.log('1. Fetching all purchases...')
  const { data: purchases } = await supabaseAdmin
    .from('purchases')
    .select('id, wallet_address, email')

  console.log(`   Found ${purchases?.length || 0} total purchases`)
  const withoutEmail = purchases?.filter(p => !p.email) || []
  console.log(`   ${withoutEmail.length} without email\n`)

  // 2. Get unique wallet addresses
  const uniqueWallets = [...new Set(purchases?.map(p => p.wallet_address?.toLowerCase()).filter(Boolean) || [])]
  console.log(`2. Found ${uniqueWallets.length} unique wallet addresses\n`)

  // 3. Try to get profiles with wallet_address
  console.log('3. Checking profiles table for wallet_address column...')
  const { data: profiles, error: profilesErr } = await supabaseAdmin
    .from('profiles')
    .select('id, email, wallet_address')
    .limit(5)

  if (profilesErr) {
    console.log('   profiles query error:', profilesErr.message)
  } else {
    console.log('   profiles sample:', profiles)
  }

  // 4. Check community_profiles
  console.log('\n4. Checking community_profiles...')
  const { data: communityProfiles, error: cpErr } = await supabaseAdmin
    .from('community_profiles')
    .select('*')
    .limit(5)

  if (cpErr) {
    console.log('   community_profiles error:', cpErr.message)
  } else {
    console.log('   community_profiles columns:', communityProfiles?.[0] ? Object.keys(communityProfiles[0]) : 'empty')
  }

  // 5. Check if there's a wallet_links or similar table
  console.log('\n5. Checking for wallet linking tables...')
  
  // Try contributions table - it might have buyer info
  const { data: contributions, error: contribErr } = await supabaseAdmin
    .from('contributions')
    .select('*')
    .limit(5)

  if (contribErr) {
    console.log('   contributions error:', contribErr.message)
  } else if (contributions?.length > 0) {
    console.log('   contributions columns:', Object.keys(contributions[0]))
    console.log('   sample:', contributions[0])
  }

  // 6. Check auth.users for known wallets (admin only)
  console.log('\n6. Getting all users with their emails...')
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers()
  
  if (authErr) {
    console.log('   auth error:', authErr.message)
  } else {
    const users = authData?.users || []
    console.log(`   Found ${users.length} users`)
    
    // Show some user emails for reference
    for (const user of users.slice(0, 10)) {
      console.log(`   - ${user.email}`)
    }
  }

  // 7. Show wallet addresses we're trying to match
  console.log('\n7. Wallet addresses needing email match:')
  for (const wallet of uniqueWallets.slice(0, 15)) {
    const count = purchases?.filter(p => p.wallet_address?.toLowerCase() === wallet).length || 0
    console.log(`   ${wallet} (${count} purchases)`)
  }

  console.log('\n=== Summary ===')
  console.log('The events table does not store buyerEmail in metadata.')
  console.log('Email was not previously captured during purchases.')
  console.log('\nGoing forward, new purchases WILL capture email.')
  console.log('For historical data, you could manually match known wallet addresses to emails.')
}

main().catch(console.error)
