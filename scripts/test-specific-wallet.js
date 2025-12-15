// Test script to debug specific wallet from screenshot
// The wallet 0xd393...b66e has 5 purchases but shows 0 campaigns
// Run with: node scripts/test-specific-wallet.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testSpecificWallet() {
  // The wallet from the screenshot (lowercase as stored in admin users)
  const walletId = '0xd393798c098ffe3d64d4ca531158d3562d00b66e'
  
  console.log('=== Testing Specific Wallet ===')
  console.log('Wallet ID:', walletId)
  console.log('Starts with 0x:', walletId.startsWith('0x'))
  
  // 1. Check what's in the purchases table for this wallet
  console.log('\n1. Checking purchases table...')
  const { data: purchases, error: purchasesErr } = await supabase
    .from('purchases')
    .select('*')
    .ilike('wallet_address', walletId)
  
  if (purchasesErr) {
    console.error('Purchases error:', purchasesErr)
    return
  }
  
  console.log(`Found ${purchases?.length || 0} purchases with ilike`)
  
  if (purchases?.length > 0) {
    console.log('Sample purchase:', JSON.stringify(purchases[0], null, 2))
    console.log('All wallet_addresses in results:')
    purchases.forEach(p => console.log(`  - "${p.wallet_address}"`))
  }
  
  // 2. Try exact match
  console.log('\n2. Trying exact match...')
  const { data: exactPurchases } = await supabase
    .from('purchases')
    .select('*')
    .eq('wallet_address', walletId)
  
  console.log(`Found ${exactPurchases?.length || 0} purchases with exact eq`)
  
  // 3. Try with different case
  console.log('\n3. Checking case variations...')
  const { data: allPurchases } = await supabase
    .from('purchases')
    .select('wallet_address')
    .limit(50)
  
  const matchingWallets = allPurchases?.filter(p => 
    p.wallet_address?.toLowerCase().includes('d393')
  )
  console.log('Wallets containing "d393":')
  matchingWallets?.forEach(p => console.log(`  - "${p.wallet_address}"`))
  
  // 4. Simulate the API response
  console.log('\n4. Simulating API response...')
  const campaignIds = [...new Set(purchases?.map(p => p.campaign_id).filter(Boolean))]
  console.log('Campaign IDs from purchases:', campaignIds)
  
  if (campaignIds.length > 0) {
    const { data: campaigns } = await supabase
      .from('submissions')
      .select('id, campaign_id, title, image_uri, status, goal, category')
      .in('campaign_id', campaignIds)
    
    console.log('\nCampaigns found:', campaigns?.length || 0)
    campaigns?.forEach(c => {
      console.log(`  - [${c.campaign_id}] ${c.title} (${c.status})`)
    })
    
    // Format like the API does
    const formattedPurchases = purchases.map(p => ({
      id: p.id,
      campaign_id: p.campaign_id,
      amount_usd: p.amount_usd || 0,
      quantity: p.quantity || 1
    }))
    
    const purchasedCampaigns = campaigns?.map(c => ({
      id: c.id,
      campaign_id: c.campaign_id,
      title: c.title,
      purchase_count: formattedPurchases.filter(p => p.campaign_id === c.campaign_id).length,
      total_spent: formattedPurchases.filter(p => p.campaign_id === c.campaign_id).reduce((sum, p) => sum + (p.amount_usd || 0), 0)
    }))
    
    console.log('\n5. Final API response would be:')
    console.log(`purchases: ${formattedPurchases.length}`)
    console.log(`purchasedCampaigns: ${purchasedCampaigns?.length || 0}`)
    console.log(JSON.stringify({ purchasedCampaigns }, null, 2))
  } else {
    console.log('\n❌ No campaign IDs found in purchases!')
  }
}

testSpecificWallet().catch(console.error)
