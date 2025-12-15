/**
 * Check what metadata is stored in events table
 */
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function main() {
  console.log('=== Checking Events Metadata ===\n')

  const { data: events, error } = await supabaseAdmin
    .from('events')
    .select('id, event_type, wallet_address, metadata')
    .eq('event_type', 'bdag_purchase')
    .limit(10)

  if (error) {
    console.error('Error:', error.message)
    return
  }

  console.log(`Found ${events?.length || 0} events\n`)

  for (const event of (events || [])) {
    console.log(`Event ${event.id?.slice(0,8)}:`)
    console.log(`  wallet: ${event.wallet_address}`)
    console.log(`  metadata keys: ${Object.keys(event.metadata || {}).join(', ')}`)
    console.log(`  metadata:`, JSON.stringify(event.metadata, null, 2).slice(0, 200))
    console.log('')
  }
}

main().catch(console.error)
