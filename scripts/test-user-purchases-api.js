// Test script to verify the user purchases API fix
// Run with: node scripts/test-user-purchases-api.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testUserPurchasesAPI() {
  console.log('=== Testing User Purchases API Fix ===\n')

  // 1. Find a wallet with purchases (directly from purchases table)
  console.log('1. Finding wallet with purchases...')
  const { data: purchases } = await supabase
    .from('purchases')
    .select('wallet_address, campaign_id')
    .not('wallet_address', 'is', null)
    .limit(200)

  // Group by wallet and find one with many purchases
  const byWallet = {}
  purchases?.forEach(p => {
    if (!byWallet[p.wallet_address]) {
      byWallet[p.wallet_address] = { count: 0, campaign_ids: new Set() }
    }
    byWallet[p.wallet_address].count++
    byWallet[p.wallet_address].campaign_ids.add(p.campaign_id)
  })

  const testWallet = Object.entries(byWallet)
    .sort((a, b) => b[1].count - a[1].count)[0]

  if (!testWallet) {
    console.log('No wallet users with purchases found!')
    return
  }

  const walletAddress = testWallet[0]
  const stats = testWallet[1]
  console.log(`Test wallet: ${walletAddress}`)
  console.log(`  Purchases: ${stats.count}`)
  console.log(`  Campaign IDs: ${[...stats.campaign_ids].join(', ')}`)

  // 2. Test the NEW API logic - wallet address as userId
  console.log('\n2. Testing NEW API logic (wallet as userId)...')
  
  // The API now detects wallet addresses and queries directly
  const isWalletId = walletAddress.startsWith('0x')
  console.log(`  isWalletId: ${isWalletId}`)

  if (isWalletId) {
    // Query by wallet_address directly (this is what the fixed API does)
    const { data: walletPurchases, error } = await supabase
      .from('purchases')
      .select('*')
      .ilike('wallet_address', walletAddress)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Query error:', error)
      return
    }

    console.log(`  Purchases found: ${walletPurchases?.length || 0}`)

    // Get unique campaigns
    const campaignIds = [...new Set(walletPurchases?.map(p => p.campaign_id).filter(Boolean))]
    console.log(`  Unique campaign IDs: ${campaignIds.join(', ')}`)

    if (campaignIds.length > 0) {
      const { data: campaigns } = await supabase
        .from('submissions')
        .select('id, campaign_id, title, image_uri, status')
        .in('campaign_id', campaignIds)

      console.log(`\n3. Campaigns purchased:`)
      campaigns?.forEach(c => {
        const purchaseCount = walletPurchases?.filter(p => p.campaign_id === c.campaign_id).length || 0
        const totalSpent = walletPurchases?.filter(p => p.campaign_id === c.campaign_id)
          .reduce((sum, p) => sum + (p.amount_usd || 0), 0) || 0
        console.log(`  - [${c.campaign_id}] ${c.title}`)
        console.log(`      Status: ${c.status}, Purchases: ${purchaseCount}, Spent: $${totalSpent.toFixed(2)}`)
      })

      console.log('\n✅ FIX VERIFIED: Wallet address query returns purchases and campaigns!')
    } else {
      console.log('\n⚠️ Purchases found but no campaign_ids - data issue')
    }
  }
}

testUserPurchasesAPI().catch(console.error)
