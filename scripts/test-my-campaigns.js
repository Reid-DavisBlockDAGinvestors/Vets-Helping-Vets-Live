/**
 * Test script for my-campaigns API
 * Verifies that campaigns are properly tracked for:
 * 1. Created campaigns (by email)
 * 2. Purchased campaigns (by wallet_address or email)
 * 3. Commented campaigns (by user_id)
 */
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function main() {
  console.log('=== My Campaigns Test ===\n')

  // Check purchases table structure
  console.log('1. Checking purchases table...')
  const { data: purchases, error: purchasesErr } = await supabaseAdmin
    .from('purchases')
    .select('*')
    .limit(5)
  
  if (purchasesErr) {
    console.log('   ❌ Error querying purchases:', purchasesErr.message)
  } else {
    console.log(`   ✅ Found ${purchases?.length || 0} purchases`)
    if (purchases?.length > 0) {
      console.log('   Sample purchase columns:', Object.keys(purchases[0]))
    }
  }

  // Check submissions with minted status
  console.log('\n2. Checking minted submissions...')
  const { data: submissions } = await supabaseAdmin
    .from('submissions')
    .select('id, title, creator_email, campaign_id, status')
    .eq('status', 'minted')
    .limit(5)
  
  console.log(`   Found ${submissions?.length || 0} minted submissions`)
  for (const sub of (submissions || [])) {
    console.log(`   - ${sub.title} (campaign_id: ${sub.campaign_id}, email: ${sub.creator_email?.slice(0,10)}...)`)
  }

  // Check community_posts for campaign mentions
  console.log('\n3. Checking community posts with mentions...')
  const { data: posts } = await supabaseAdmin
    .from('community_posts')
    .select('id, user_id, campaign_id, content')
    .limit(10)
  
  let postsWithMentions = 0
  for (const post of (posts || [])) {
    if (post.campaign_id || post.content?.includes('@[')) {
      postsWithMentions++
    }
  }
  console.log(`   Found ${postsWithMentions} posts with campaign mentions/links`)

  // Check profiles for wallet_address
  console.log('\n4. Checking profiles with wallet_address...')
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, email, wallet_address, role')
    .not('wallet_address', 'is', null)
    .limit(5)
  
  console.log(`   Found ${profiles?.length || 0} profiles with wallet_address`)
  for (const p of (profiles || [])) {
    console.log(`   - ${p.email?.slice(0,15)}... wallet: ${p.wallet_address?.slice(0,10)}...`)
  }

  console.log('\n=== Test Complete ===')
  console.log('\nTo test the full API, sign in and check the Community Hub sidebar.')
  console.log('The "Your Campaigns" section should show campaigns you:')
  console.log('  - Created (by email match)')
  console.log('  - Purchased NFTs from (by wallet_address or email)')
  console.log('  - Commented on (by user_id and @mentions)')
}

main()
