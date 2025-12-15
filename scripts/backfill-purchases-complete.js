// Complete backfill script for purchases table
// Populates user_id, payment_method, and any other data from existing sources
// Run with: node scripts/backfill-purchases-complete.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function backfillPurchases() {
  console.log('🔄 COMPLETE PURCHASES BACKFILL')
  console.log('=' .repeat(70))
  console.log('Date:', new Date().toISOString())
  console.log('')

  // ===== 1. CURRENT STATE ANALYSIS =====
  console.log('1. ANALYZING CURRENT STATE')
  console.log('-'.repeat(70))

  const { data: purchases } = await supabase.from('purchases').select('*')
  const { data: events } = await supabase.from('events').select('*')
  const { data: profiles } = await supabase.from('profiles').select('*')

  console.log(`   Total purchases: ${purchases?.length || 0}`)
  console.log(`   Total events: ${events?.length || 0}`)
  console.log(`   Total profiles: ${profiles?.length || 0}`)

  // Analyze what's missing
  const missingUserId = purchases?.filter(p => !p.user_id)?.length || 0
  const missingPaymentMethod = purchases?.filter(p => !p.payment_method)?.length || 0
  const missingQuantity = purchases?.filter(p => !p.quantity || p.quantity === 0)?.length || 0
  const missingTips = purchases?.filter(p => p.tip_usd === null || p.tip_usd === undefined)?.length || 0

  console.log(`\n   Missing data:`)
  console.log(`     user_id: ${missingUserId}`)
  console.log(`     payment_method: ${missingPaymentMethod}`)
  console.log(`     quantity: ${missingQuantity}`)
  console.log(`     tips: ${missingTips}`)

  // ===== 2. BUILD LOOKUP TABLES =====
  console.log('\n2. BUILDING LOOKUP TABLES')
  console.log('-'.repeat(70))

  // Create wallet -> profile lookup
  const walletToProfile = {}
  profiles?.forEach(p => {
    if (p.wallet_address) {
      walletToProfile[p.wallet_address.toLowerCase()] = p
    }
  })
  console.log(`   Profiles with wallets: ${Object.keys(walletToProfile).length}`)

  // Create tx_hash -> event lookup
  const txHashToEvent = {}
  events?.forEach(e => {
    if (e.tx_hash) {
      txHashToEvent[e.tx_hash] = e
    }
  })
  console.log(`   Events by tx_hash: ${Object.keys(txHashToEvent).length}`)

  // ===== 3. BACKFILL USER_ID FROM WALLET MATCHES =====
  console.log('\n3. BACKFILLING USER_ID FROM WALLET MATCHES')
  console.log('-'.repeat(70))

  let userIdUpdates = 0
  let userIdSkipped = 0

  for (const purchase of purchases || []) {
    if (purchase.user_id) {
      userIdSkipped++
      continue
    }

    const wallet = purchase.wallet_address?.toLowerCase()
    const matchedProfile = walletToProfile[wallet]

    if (matchedProfile) {
      const { error } = await supabase
        .from('purchases')
        .update({ user_id: matchedProfile.id })
        .eq('id', purchase.id)

      if (!error) {
        userIdUpdates++
        console.log(`   ✅ Matched wallet ${wallet?.slice(0, 10)}... to user ${matchedProfile.email || matchedProfile.id?.slice(0, 8)}`)
      }
    }
  }

  console.log(`\n   user_id backfill: ${userIdUpdates} updated, ${userIdSkipped} already had data`)

  // ===== 4. BACKFILL PAYMENT_METHOD =====
  console.log('\n4. BACKFILLING PAYMENT_METHOD')
  console.log('-'.repeat(70))

  let paymentMethodUpdates = 0

  for (const purchase of purchases || []) {
    if (purchase.payment_method) continue

    // All existing purchases are crypto BDAG (that's all we had before)
    const { error } = await supabase
      .from('purchases')
      .update({ payment_method: 'crypto_bdag' })
      .eq('id', purchase.id)

    if (!error) paymentMethodUpdates++
  }

  console.log(`   payment_method backfill: ${paymentMethodUpdates} set to 'crypto_bdag'`)

  // ===== 5. BACKFILL FROM EVENTS METADATA =====
  console.log('\n5. BACKFILLING FROM EVENTS METADATA')
  console.log('-'.repeat(70))

  let metadataUpdates = 0
  let quantityUpdates = 0
  let tipUpdates = 0

  for (const purchase of purchases || []) {
    const event = txHashToEvent[purchase.tx_hash]
    if (!event?.metadata) continue

    const updates = {}
    let needsUpdate = false

    // Backfill quantity if missing or 0
    if ((!purchase.quantity || purchase.quantity === 0) && event.metadata.quantity) {
      updates.quantity = event.metadata.quantity
      quantityUpdates++
      needsUpdate = true
    }

    // Backfill tips if not already done
    if ((purchase.tip_usd === null || purchase.tip_usd === undefined || purchase.tip_usd === 0) && event.metadata.tipUSD > 0) {
      updates.tip_usd = event.metadata.tipUSD
      updates.tip_bdag = event.metadata.tipBDAG || 0
      tipUpdates++
      needsUpdate = true
    }

    // Backfill token_id from editionMinted if missing
    if (!purchase.token_id && typeof event.metadata.editionMinted === 'number') {
      updates.token_id = event.metadata.editionMinted
      needsUpdate = true
    }

    // Backfill from mintedTokenIds array
    if (!purchase.token_id && event.metadata.mintedTokenIds?.length > 0) {
      updates.token_id = event.metadata.mintedTokenIds[0]
      needsUpdate = true
    }

    if (needsUpdate) {
      const { error } = await supabase
        .from('purchases')
        .update(updates)
        .eq('id', purchase.id)

      if (!error) metadataUpdates++
    }
  }

  console.log(`   From events.metadata:`)
  console.log(`     - quantity updates: ${quantityUpdates}`)
  console.log(`     - tip updates: ${tipUpdates}`)
  console.log(`     - total records updated: ${metadataUpdates}`)

  // ===== 6. VERIFY RESULTS =====
  console.log('\n6. VERIFYING RESULTS')
  console.log('-'.repeat(70))

  const { data: updatedPurchases } = await supabase.from('purchases').select('*')

  const stats = {
    total: updatedPurchases?.length || 0,
    withUserId: updatedPurchases?.filter(p => p.user_id)?.length || 0,
    withPaymentMethod: updatedPurchases?.filter(p => p.payment_method)?.length || 0,
    withQuantity: updatedPurchases?.filter(p => p.quantity && p.quantity > 0)?.length || 0,
    withTips: updatedPurchases?.filter(p => p.tip_usd > 0)?.length || 0,
    withTokenId: updatedPurchases?.filter(p => p.token_id)?.length || 0,
    withEmail: updatedPurchases?.filter(p => p.email)?.length || 0,
  }

  console.log(`\n   Final field coverage:`)
  console.log(`     user_id:        ${stats.withUserId}/${stats.total} (${((stats.withUserId/stats.total)*100).toFixed(1)}%)`)
  console.log(`     payment_method: ${stats.withPaymentMethod}/${stats.total} (${((stats.withPaymentMethod/stats.total)*100).toFixed(1)}%)`)
  console.log(`     quantity:       ${stats.withQuantity}/${stats.total} (${((stats.withQuantity/stats.total)*100).toFixed(1)}%)`)
  console.log(`     tips:           ${stats.withTips}/${stats.total} (${((stats.withTips/stats.total)*100).toFixed(1)}%)`)
  console.log(`     token_id:       ${stats.withTokenId}/${stats.total} (${((stats.withTokenId/stats.total)*100).toFixed(1)}%)`)
  console.log(`     email:          ${stats.withEmail}/${stats.total} (${((stats.withEmail/stats.total)*100).toFixed(1)}%)`)

  // Calculate totals
  const totalNft = updatedPurchases?.reduce((sum, p) => sum + (p.amount_usd || 0), 0) || 0
  const totalTips = updatedPurchases?.reduce((sum, p) => sum + (p.tip_usd || 0), 0) || 0

  console.log(`\n   Financial totals:`)
  console.log(`     NFT purchases: $${totalNft.toFixed(2)}`)
  console.log(`     Tips:          $${totalTips.toFixed(2)}`)
  console.log(`     Grand total:   $${(totalNft + totalTips).toFixed(2)}`)

  // ===== SUMMARY =====
  console.log('\n' + '='.repeat(70))
  console.log('BACKFILL SUMMARY')
  console.log('='.repeat(70))
  console.log(`   ✅ user_id backfilled: ${userIdUpdates}`)
  console.log(`   ✅ payment_method set: ${paymentMethodUpdates}`)
  console.log(`   ✅ metadata updates: ${metadataUpdates}`)
  console.log(`\n✅ Backfill complete!`)
}

backfillPurchases().catch(console.error)
