// Debug script to investigate user purchase data structure
// Run with: node scripts/debug-user-purchases.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debugUserPurchases() {
  console.log('=== Debugging User Purchases ===\n')

  // 1. Check purchases table structure
  console.log('1. Sample purchases (first 5):')
  const { data: purchases, error: purchasesErr } = await supabase
    .from('purchases')
    .select('*')
    .limit(5)
  
  if (purchasesErr) {
    console.error('Error fetching purchases:', purchasesErr)
  } else {
    console.log(JSON.stringify(purchases, null, 2))
  }

  // 2. Check purchases for wallet user 0x70f8...cab0
  const testWallet = '0x70f8cab0' // partial match
  console.log('\n2. Purchases for wallet containing "0x70f8":')
  const { data: walletPurchases, error: walletErr } = await supabase
    .from('purchases')
    .select('*')
    .ilike('wallet_address', '%70f8%')
    .limit(10)
  
  if (walletErr) {
    console.error('Error:', walletErr)
  } else {
    console.log(`Found ${walletPurchases?.length || 0} purchases`)
    if (walletPurchases?.length > 0) {
      console.log('Sample:', JSON.stringify(walletPurchases[0], null, 2))
      console.log('Campaign IDs:', walletPurchases.map(p => p.campaign_id))
    }
  }

  // 3. Check how admin users API gets purchase counts
  console.log('\n3. Checking how purchase counts are calculated...')
  const { data: allPurchases } = await supabase
    .from('purchases')
    .select('wallet_address, campaign_id, user_id, email')
  
  console.log(`Total purchases in DB: ${allPurchases?.length || 0}`)
  
  // Group by wallet
  const byWallet = {}
  allPurchases?.forEach(p => {
    const key = p.wallet_address || 'no-wallet'
    if (!byWallet[key]) byWallet[key] = []
    byWallet[key].push(p)
  })
  
  console.log('\nPurchases by wallet (top 5):')
  Object.entries(byWallet)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)
    .forEach(([wallet, purchases]) => {
      console.log(`  ${wallet}: ${purchases.length} purchases`)
      console.log(`    campaign_ids: ${[...new Set(purchases.map(p => p.campaign_id))].join(', ')}`)
      console.log(`    has user_id: ${purchases.some(p => p.user_id)}`)
      console.log(`    has email: ${purchases.some(p => p.email)}`)
    })

  // 4. Check the specific user detail API logic
  console.log('\n4. Testing the API query logic for a wallet user...')
  
  // Find a wallet with purchases
  const walletWithPurchases = Object.keys(byWallet).find(w => w !== 'no-wallet' && byWallet[w].length > 10)
  if (walletWithPurchases) {
    console.log(`Testing with wallet: ${walletWithPurchases}`)
    
    // The API queries by user_id - but wallet users may not have a profile!
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('wallet_address', walletWithPurchases)
      .maybeSingle()
    
    console.log(`Profile found: ${profile ? 'YES' : 'NO'}`)
    if (profile) {
      console.log(`Profile ID: ${profile.id}`)
      console.log(`Profile email: ${profile.email}`)
    }
    
    // The current API uses user_id to query purchases
    // But wallet-only users may have purchases with wallet_address but no user_id match!
    const { data: purchasesByUserId } = await supabase
      .from('purchases')
      .select('*')
      .eq('user_id', profile?.id || 'non-existent')
    
    console.log(`Purchases found by user_id: ${purchasesByUserId?.length || 0}`)
    
    // Query by wallet_address instead
    const { data: purchasesByWallet } = await supabase
      .from('purchases')
      .select('*')
      .eq('wallet_address', walletWithPurchases)
    
    console.log(`Purchases found by wallet_address: ${purchasesByWallet?.length || 0}`)
    
    if (purchasesByWallet?.length > 0) {
      console.log('\n>>> ISSUE IDENTIFIED: Purchases are stored by wallet_address, not user_id!')
      console.log('>>> The API needs to also query by wallet_address for wallet users.')
    }
  }

  // 5. Check submissions table for campaign data
  console.log('\n5. Sample submissions (campaign data):')
  const { data: submissions } = await supabase
    .from('submissions')
    .select('id, campaign_id, title, status')
    .limit(5)
  
  console.log(JSON.stringify(submissions, null, 2))
}

debugUserPurchases().catch(console.error)
