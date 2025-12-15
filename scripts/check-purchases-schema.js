/**
 * Check the actual schema of purchases table
 */
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function main() {
  console.log('Checking purchases table schema...\n')
  
  // Try to insert a minimal record to see what columns are required
  const testData = { wallet_address: 'test' }
  
  const { data, error } = await supabaseAdmin
    .from('purchases')
    .insert(testData)
    .select()
  
  if (error) {
    console.log('Insert error (expected):', error.message)
    console.log('Error details:', error.details)
    console.log('Error hint:', error.hint)
  }
  
  // Try to get column info by selecting with *
  const { data: sample, error: selectErr } = await supabaseAdmin
    .from('purchases')
    .select('*')
    .limit(1)
  
  if (selectErr) {
    console.log('\nSelect error:', selectErr.message)
  } else if (sample && sample.length > 0) {
    console.log('\nExisting record columns:', Object.keys(sample[0]))
  } else {
    console.log('\nNo existing records. Trying to infer schema...')
    
    // Try individual column inserts to find what exists
    const testCols = ['id', 'wallet_address', 'campaign_id', 'token_id', 'tx_hash', 
                      'amount_bdag', 'amount_usd', 'user_id', 'created_at']
    
    for (const col of testCols) {
      const testRow = { [col]: col === 'wallet_address' ? 'test' : 1 }
      const { error: colErr } = await supabaseAdmin
        .from('purchases')
        .insert(testRow)
      
      if (colErr && colErr.message.includes('Could not find')) {
        console.log(`  ❌ Column '${col}' does NOT exist`)
      } else if (colErr) {
        console.log(`  ✅ Column '${col}' exists (error: ${colErr.message.slice(0,50)}...)`)
      } else {
        console.log(`  ✅ Column '${col}' exists`)
      }
    }
  }
}

main().catch(console.error)
