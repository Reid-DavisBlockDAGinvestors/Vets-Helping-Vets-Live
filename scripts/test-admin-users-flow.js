// Test the complete admin users flow - users list + purchases API
// Run with: node scripts/test-admin-users-flow.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testFlow() {
  console.log('=== Testing Admin Users Flow ===\n')

  // 1. Find a wallet user like the admin users API does
  console.log('1. Simulating admin users API - finding wallet users...')
  
  // Get NFT owners from purchases (simplified version of what admin/users does)
  const { data: purchases } = await supabase
    .from('purchases')
    .select('wallet_address')
    .not('wallet_address', 'is', null)
  
  // Build user stats by wallet (like admin users API)
  const userPurchaseStats = {}
  for (const p of (purchases || [])) {
    const key = p.wallet_address?.toLowerCase()
    if (!key) continue
    if (!userPurchaseStats[key]) {
      userPurchaseStats[key] = {
        count: 0,
        wallet_address: p.wallet_address  // Original case
      }
    }
    userPurchaseStats[key].count++
  }

  // Find wallet 0xd393...b66e
  const targetKey = Object.keys(userPurchaseStats).find(k => k.includes('d393'))
  if (!targetKey) {
    console.log('Target wallet not found!')
    return
  }

  const targetStats = userPurchaseStats[targetKey]
  console.log('Found wallet user:')
  console.log(`  Key (lowercase): "${targetKey}"`)
  console.log(`  Original wallet: "${targetStats.wallet_address}"`)
  console.log(`  Purchase count: ${targetStats.count}`)

  // The admin users API sets id to the lowercase key
  const userId = targetKey
  console.log(`\n  User ID that gets passed to purchases API: "${userId}"`)

  // 2. Now simulate the purchases API call
  console.log('\n2. Simulating purchases API with this userId...')
  
  const isWalletId = userId.startsWith('0x')
  console.log(`  isWalletId: ${isWalletId}`)

  if (isWalletId) {
    // Query like the API does
    const { data: userPurchases, error } = await supabase
      .from('purchases')
      .select('*')
      .ilike('wallet_address', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('  Query error:', error)
      return
    }

    console.log(`  Purchases found: ${userPurchases?.length || 0}`)

    // Get campaign titles
    const campaignIds = [...new Set(userPurchases?.map(p => p.campaign_id).filter(Boolean))]
    console.log(`  Campaign IDs: ${campaignIds.join(', ')}`)

    let campaignTitles = {}
    if (campaignIds.length > 0) {
      const { data: campaigns } = await supabase
        .from('submissions')
        .select('campaign_id, title')
        .in('campaign_id', campaignIds)
      
      for (const c of (campaigns || [])) {
        campaignTitles[c.campaign_id] = c.title
      }
    }

    // Format purchases
    const formattedPurchases = userPurchases.map(p => ({
      id: p.id,
      campaign_id: p.campaign_id,
      campaign_title: campaignTitles[p.campaign_id] || `Campaign #${p.campaign_id}`,
      amount_usd: p.amount_usd || 0,
      quantity: p.quantity || 1
    }))

    // Get purchased campaigns
    let purchasedCampaigns = []
    if (campaignIds.length > 0) {
      const { data: campaigns } = await supabase
        .from('submissions')
        .select('id, campaign_id, title, image_uri, status, goal, category')
        .in('campaign_id', campaignIds)
      
      purchasedCampaigns = (campaigns || []).map(c => ({
        id: c.id,
        campaign_id: c.campaign_id,
        title: c.title,
        image_uri: c.image_uri,
        status: c.status,
        purchase_count: formattedPurchases.filter(p => p.campaign_id === c.campaign_id).length,
        total_spent: formattedPurchases.filter(p => p.campaign_id === c.campaign_id).reduce((sum, p) => sum + (p.amount_usd || 0), 0)
      }))
    }

    console.log('\n3. API Response would be:')
    console.log(`  purchases: ${formattedPurchases.length}`)
    console.log(`  purchasedCampaigns: ${purchasedCampaigns.length}`)
    console.log(`  createdCampaigns: 0 (wallet users don't create campaigns)`)

    if (purchasedCampaigns.length > 0) {
      console.log('\n  Purchased campaigns:')
      purchasedCampaigns.forEach(c => {
        console.log(`    - [${c.campaign_id}] ${c.title}`)
      })
      console.log('\n✅ Data is correct - if still showing 0, check if Netlify deployed')
    } else {
      console.log('\n❌ No purchased campaigns found!')
    }
  }
}

testFlow().catch(console.error)
