/**
 * Backfill email addresses in purchases table from events metadata
 * Run with: node scripts/backfill-purchase-emails.js
 */
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function main() {
  console.log('=== Backfill Purchase Emails ===\n')

  // 1. Get all purchases that don't have email
  console.log('1. Fetching purchases without email...')
  const { data: purchases, error: purchasesErr } = await supabaseAdmin
    .from('purchases')
    .select('id, tx_hash, wallet_address, campaign_id')
    .is('email', null)

  if (purchasesErr) {
    console.error('Error fetching purchases:', purchasesErr.message)
    return
  }

  console.log(`   Found ${purchases?.length || 0} purchases without email\n`)

  if (!purchases || purchases.length === 0) {
    console.log('All purchases already have email. Nothing to backfill.')
    return
  }

  // 2. Get all events with email in metadata
  console.log('2. Fetching events with buyer email...')
  const { data: events, error: eventsErr } = await supabaseAdmin
    .from('events')
    .select('tx_hash, wallet_address, campaign_id, metadata')
    .eq('event_type', 'bdag_purchase')

  if (eventsErr) {
    console.error('Error fetching events:', eventsErr.message)
    return
  }

  // Build lookup maps
  const emailByTxHash = new Map()
  const emailByWalletCampaign = new Map()
  
  for (const event of (events || [])) {
    const email = event.metadata?.buyerEmail
    if (email) {
      if (event.tx_hash) {
        emailByTxHash.set(event.tx_hash.toLowerCase(), email)
      }
      if (event.wallet_address && event.campaign_id) {
        const key = `${event.wallet_address.toLowerCase()}:${event.campaign_id}`
        emailByWalletCampaign.set(key, email)
      }
    }
  }

  console.log(`   Found ${emailByTxHash.size} events with email (by tx_hash)`)
  console.log(`   Found ${emailByWalletCampaign.size} events with email (by wallet+campaign)\n`)

  // 3. Update purchases with email
  console.log('3. Updating purchases with email...')
  let updated = 0
  let notFound = 0

  for (const purchase of purchases) {
    let email = null

    // Try to find email by tx_hash first
    if (purchase.tx_hash) {
      email = emailByTxHash.get(purchase.tx_hash.toLowerCase())
    }

    // If not found, try by wallet + campaign_id
    if (!email && purchase.wallet_address && purchase.campaign_id) {
      const key = `${purchase.wallet_address.toLowerCase()}:${purchase.campaign_id}`
      email = emailByWalletCampaign.get(key)
    }

    if (email) {
      const { error: updateErr } = await supabaseAdmin
        .from('purchases')
        .update({ email })
        .eq('id', purchase.id)

      if (updateErr) {
        console.error(`   Error updating purchase ${purchase.id}:`, updateErr.message)
      } else {
        updated++
        console.log(`   ✅ Updated: ${email.slice(0, 15)}... for tx ${purchase.tx_hash?.slice(0, 10) || 'N/A'}...`)
      }
    } else {
      notFound++
    }
  }

  console.log('\n=== Backfill Complete ===')
  console.log(`Updated: ${updated}`)
  console.log(`No email found: ${notFound}`)

  // 4. Verify
  console.log('\n4. Verifying...')
  const { data: withEmail } = await supabaseAdmin
    .from('purchases')
    .select('id')
    .not('email', 'is', null)

  const { data: withoutEmail } = await supabaseAdmin
    .from('purchases')
    .select('id')
    .is('email', null)

  console.log(`   Purchases with email: ${withEmail?.length || 0}`)
  console.log(`   Purchases without email: ${withoutEmail?.length || 0}`)
}

main().catch(console.error)
