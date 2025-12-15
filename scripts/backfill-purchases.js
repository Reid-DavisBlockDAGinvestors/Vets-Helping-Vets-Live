/**
 * Backfill script to populate purchases table from events table
 * This ensures existing on-chain purchases appear in "Your Campaigns"
 * 
 * Run with: node scripts/backfill-purchases.js
 */
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function main() {
  console.log('=== Backfill Purchases Table ===\n')

  // 1. Get all bdag_purchase events
  console.log('1. Fetching purchase events...')
  const { data: events, error: eventsErr } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('event_type', 'bdag_purchase')
    .order('created_at', { ascending: true })

  if (eventsErr) {
    console.error('Error fetching events:', eventsErr.message)
    return
  }

  console.log(`   Found ${events?.length || 0} purchase events\n`)

  if (!events || events.length === 0) {
    console.log('No purchase events to backfill.')
    return
  }

  // 2. Get all submissions for lookup
  console.log('2. Fetching submissions for lookup...')
  const { data: submissions } = await supabaseAdmin
    .from('submissions')
    .select('id, campaign_id, title')
    .eq('status', 'minted')

  const submissionByCampaignId = {}
  for (const sub of (submissions || [])) {
    if (sub.campaign_id != null) {
      submissionByCampaignId[sub.campaign_id] = sub
    }
  }
  console.log(`   Loaded ${Object.keys(submissionByCampaignId).length} submissions\n`)

  // 3. Get existing purchases to avoid duplicates
  console.log('3. Checking existing purchases...')
  const { data: existingPurchases } = await supabaseAdmin
    .from('purchases')
    .select('tx_hash')

  const existingTxHashes = new Set((existingPurchases || []).map(p => p.tx_hash).filter(Boolean))
  console.log(`   Found ${existingTxHashes.size} existing purchases\n`)

  // 4. Process each event
  console.log('4. Processing events...')
  let inserted = 0
  let skipped = 0
  let errors = 0

  for (const event of events) {
    const txHash = event.tx_hash
    const walletAddress = event.wallet_address
    const campaignId = event.campaign_id
    const metadata = event.metadata || {}

    // Skip if already exists
    if (txHash && existingTxHashes.has(txHash)) {
      skipped++
      continue
    }

    // Skip if no wallet address
    if (!walletAddress) {
      console.log(`   Skipping event ${event.id?.slice(0,8)}: no wallet_address`)
      skipped++
      continue
    }

    // Find submission
    const submission = submissionByCampaignId[campaignId]
    if (!submission) {
      console.log(`   Skipping event ${event.id?.slice(0,8)}: campaign_id ${campaignId} not found`)
      skipped++
      continue
    }

    // Get token ID from metadata (handle boolean "true" values from old events)
    let tokenId = metadata.editionMinted || 
                  (metadata.mintedTokenIds && metadata.mintedTokenIds[0]) || 
                  null
    // If tokenId is not a valid integer, set to null
    if (tokenId === true || tokenId === 'true' || (typeof tokenId === 'string' && isNaN(parseInt(tokenId)))) {
      tokenId = null
    }

    // Insert purchase record (includes email after column is added)
    const { error: insertErr } = await supabaseAdmin
      .from('purchases')
      .insert({
        wallet_address: walletAddress.toLowerCase(),
        campaign_id: campaignId,
        token_id: tokenId,
        tx_hash: txHash,
        amount_bdag: event.amount_bdag || null,
        amount_usd: event.amount_usd || null,
        email: metadata.buyerEmail || null
      })

    if (insertErr) {
      // Check if it's a duplicate key error (already exists)
      if (insertErr.message?.includes('duplicate') || insertErr.code === '23505') {
        skipped++
      } else {
        console.error(`   Error inserting for event ${event.id?.slice(0,8)}:`, insertErr.message)
        errors++
      }
    } else {
      inserted++
      console.log(`   ✅ Inserted: ${submission.title?.slice(0,30)}... wallet: ${walletAddress.slice(0,10)}...`)
    }
  }

  console.log('\n=== Backfill Complete ===')
  console.log(`Inserted: ${inserted}`)
  console.log(`Skipped:  ${skipped}`)
  console.log(`Errors:   ${errors}`)

  // 5. Verify
  console.log('\n5. Verifying purchases table...')
  const { data: finalPurchases } = await supabaseAdmin
    .from('purchases')
    .select('id')

  console.log(`   Total purchases in table: ${finalPurchases?.length || 0}`)
}

main().catch(console.error)
