/**
 * Script to enable V7 Sepolia contract in marketplace
 * Run with: node scripts/enable-v7-marketplace.js
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function main() {
  const V7_ADDRESS = '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e'
  
  console.log('Adding V7 Sepolia contract to marketplace_contracts...')
  
  // Add to marketplace_contracts
  const { data: contract, error: contractErr } = await supabase
    .from('marketplace_contracts')
    .upsert({
      contract_address: V7_ADDRESS,
      enabled: true,
      label: 'PatriotPledgeNFT V7 (Sepolia)'
    }, { onConflict: 'contract_address' })
    .select()
    .single()
  
  if (contractErr) {
    console.error('Failed to add contract:', contractErr.message)
  } else {
    console.log('✅ Contract added:', contract)
  }
  
  // Update submissions to be visible
  console.log('Updating V7 submissions to be visible on marketplace...')
  
  const { data: updated, error: updateErr } = await supabase
    .from('submissions')
    .update({ visible_on_marketplace: true })
    .eq('contract_address', V7_ADDRESS)
    .eq('status', 'minted')
    .select('id, title, visible_on_marketplace')
  
  if (updateErr) {
    console.error('Failed to update submissions:', updateErr.message)
  } else {
    console.log('✅ Updated submissions:', updated?.length || 0)
    if (updated) updated.forEach(s => console.log(`  - ${s.title} (${s.id.slice(0,8)})`))
  }
  
  // List all enabled contracts
  console.log('\nCurrently enabled marketplace contracts:')
  const { data: contracts } = await supabase
    .from('marketplace_contracts')
    .select('*')
    .eq('enabled', true)
  
  contracts?.forEach(c => console.log(`  - ${c.label || c.contract_address}`))
}

main().catch(console.error)
