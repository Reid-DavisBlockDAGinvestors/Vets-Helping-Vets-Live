// Backfill script to copy tip data from events.metadata to purchases table
// Run AFTER the SQL migration that adds tip columns
// Run with: node scripts/backfill-tips.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function backfillTips() {
  console.log('🔄 BACKFILL TIPS FROM EVENTS TO PURCHASES')
  console.log('=' .repeat(60))
  console.log('Date:', new Date().toISOString())
  console.log('')

  // 1. Get all events with tip data
  console.log('1. Fetching events with tip data...')
  const { data: events, error: eventsErr } = await supabase
    .from('events')
    .select('*')
    .not('metadata', 'is', null)

  if (eventsErr) {
    console.error('Failed to fetch events:', eventsErr)
    return
  }

  const eventsWithTips = events.filter(e => 
    e.metadata && (e.metadata.tipUSD > 0 || e.metadata.tipBDAG > 0)
  )

  console.log(`   Total events: ${events.length}`)
  console.log(`   Events with tips: ${eventsWithTips.length}`)

  if (eventsWithTips.length === 0) {
    console.log('\n❌ No events with tips found to backfill')
    return
  }

  // 2. Get all purchases
  console.log('\n2. Fetching purchases...')
  const { data: purchases, error: purchasesErr } = await supabase
    .from('purchases')
    .select('*')

  if (purchasesErr) {
    console.error('Failed to fetch purchases:', purchasesErr)
    return
  }

  console.log(`   Total purchases: ${purchases.length}`)

  // Create lookup by tx_hash
  const purchasesByTxHash = {}
  purchases.forEach(p => {
    purchasesByTxHash[p.tx_hash] = p
  })

  // 3. Match and update
  console.log('\n3. Matching events to purchases and updating...')
  
  let updated = 0
  let skipped = 0
  let notFound = 0
  const updateResults = []

  for (const event of eventsWithTips) {
    const purchase = purchasesByTxHash[event.tx_hash]
    
    if (!purchase) {
      console.log(`   ⚠️ No purchase found for tx: ${event.tx_hash?.slice(0, 20)}...`)
      notFound++
      continue
    }

    // Check if already has tip data
    if (purchase.tip_usd > 0 || purchase.tip_bdag > 0) {
      console.log(`   ⏭️ Already has tips: ${event.tx_hash?.slice(0, 20)}...`)
      skipped++
      continue
    }

    // Update the purchase with tip data
    const tipUsd = event.metadata.tipUSD || 0
    const tipBdag = event.metadata.tipBDAG || 0
    const quantity = event.metadata.quantity || 1

    const { error: updateErr } = await supabase
      .from('purchases')
      .update({
        tip_usd: tipUsd,
        tip_bdag: tipBdag,
        quantity: quantity
      })
      .eq('id', purchase.id)

    if (updateErr) {
      console.error(`   ❌ Failed to update purchase ${purchase.id}:`, updateErr)
      continue
    }

    console.log(`   ✅ Updated: ${event.tx_hash?.slice(0, 20)}... tip=$${tipUsd} qty=${quantity}`)
    updated++
    updateResults.push({
      tx_hash: event.tx_hash,
      wallet: event.wallet_address,
      campaign_id: event.campaign_id,
      tip_usd: tipUsd,
      tip_bdag: tipBdag,
      quantity
    })
  }

  // 4. Summary
  console.log('\n' + '='.repeat(60))
  console.log('BACKFILL SUMMARY')
  console.log('='.repeat(60))
  console.log(`   ✅ Updated: ${updated}`)
  console.log(`   ⏭️ Skipped (already had tips): ${skipped}`)
  console.log(`   ⚠️ Not found in purchases: ${notFound}`)
  
  if (updated > 0) {
    const totalTipsBackfilled = updateResults.reduce((sum, r) => sum + r.tip_usd, 0)
    console.log(`\n   Total tips backfilled: $${totalTipsBackfilled.toFixed(2)}`)
    
    console.log('\n   Updated records:')
    updateResults.forEach(r => {
      console.log(`     - Campaign ${r.campaign_id}: $${r.tip_usd} tip, qty ${r.quantity}`)
    })
  }

  // 5. Verify
  console.log('\n4. Verifying backfill...')
  const { data: verifyPurchases } = await supabase
    .from('purchases')
    .select('*')
    .gt('tip_usd', 0)

  console.log(`   Purchases with tips after backfill: ${verifyPurchases?.length || 0}`)
  
  const totalTipsInDb = verifyPurchases?.reduce((sum, p) => sum + (p.tip_usd || 0), 0) || 0
  console.log(`   Total tip USD in purchases table: $${totalTipsInDb.toFixed(2)}`)

  console.log('\n✅ Backfill complete!')
}

backfillTips().catch(console.error)
