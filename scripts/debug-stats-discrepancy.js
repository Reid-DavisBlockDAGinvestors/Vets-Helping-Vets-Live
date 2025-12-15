// Debug script to understand the stats discrepancy
// Wallet 0x262f...3f41 shows 11 Purchases/NFTs but only 3 Campaigns Purchased
// Run with: node scripts/debug-stats-discrepancy.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debugStats() {
  const walletAddress = '0x262fe150bd74617139ecaf756ce849d6ecbd3f41'
  
  console.log('=== Debugging Stats Discrepancy ===')
  console.log('Wallet:', walletAddress)
  
  // 1. Check purchases table
  console.log('\n1. PURCHASES TABLE:')
  const { data: purchases, error: purchasesErr } = await supabase
    .from('purchases')
    .select('*')
    .ilike('wallet_address', walletAddress)
  
  if (purchasesErr) {
    console.error('Purchases error:', purchasesErr)
  } else {
    console.log(`Found ${purchases?.length || 0} purchase records`)
    if (purchases?.length > 0) {
      let totalUsd = 0
      purchases.forEach(p => {
        console.log(`  - Campaign ${p.campaign_id}: $${p.amount_usd || 0} (${p.amount_bdag || 0} BDAG)`)
        totalUsd += p.amount_usd || 0
      })
      console.log(`Total from purchases table: $${totalUsd}`)
    }
  }

  // 2. Check contributions table
  console.log('\n2. CONTRIBUTIONS TABLE:')
  const { data: contributions, error: contribErr } = await supabase
    .from('contributions')
    .select('*')
    .ilike('buyer_wallet', walletAddress)
  
  if (contribErr) {
    console.error('Contributions error:', contribErr)
  } else {
    console.log(`Found ${contributions?.length || 0} contribution records`)
    if (contributions?.length > 0) {
      let totalGross = 0
      contributions.forEach(c => {
        console.log(`  - Token ${c.token_id}: $${c.amount_gross || c.amount_net || 0}`)
        totalGross += parseFloat(c.amount_gross || c.amount_net || 0)
      })
      console.log(`Total from contributions table: $${totalGross}`)
    }
  }

  // 3. Check events table
  console.log('\n3. EVENTS TABLE:')
  const { data: events, error: eventsErr } = await supabase
    .from('events')
    .select('*')
    .ilike('wallet_address', walletAddress)
    .eq('event_type', 'purchase')
  
  if (eventsErr) {
    console.error('Events error:', eventsErr)
  } else {
    console.log(`Found ${events?.length || 0} purchase events`)
    if (events?.length > 0) {
      let totalUsd = 0
      events.forEach(e => {
        console.log(`  - Campaign ${e.campaign_id}: $${e.amount_usd || 0}`)
        totalUsd += e.amount_usd || 0
      })
      console.log(`Total from events table: $${totalUsd}`)
    }
  }

  // 4. Summary
  console.log('\n=== SUMMARY ===')
  console.log('Header stats (11 Purchases, $0.00) come from:')
  console.log('  - NFT count: Blockchain query (tokenByIndex + ownerOf)')
  console.log('  - Total spent: contributions table')
  console.log('')
  console.log('Campaigns Purchased (3) comes from:')
  console.log('  - purchases table')
  console.log('')
  console.log('The discrepancy means:')
  console.log('  - Blockchain shows 11 NFTs owned by this wallet')
  console.log('  - But purchases table only has', purchases?.length || 0, 'records')
  console.log('  - contributions table has', contributions?.length || 0, 'records')
  
  if ((purchases?.length || 0) < 11) {
    console.log('\n>>> ISSUE: Some NFT purchases were not recorded in purchases table!')
    console.log('>>> This could happen if purchases were made before the purchases table was implemented')
    console.log('>>> Or if the purchase recording API failed silently')
  }
}

debugStats().catch(console.error)
