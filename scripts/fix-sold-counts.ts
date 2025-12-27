/**
 * Fix sold_count mismatches in submissions table
 * Also adds V6 contract to marketplace_contracts if missing
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ecwqzakvbkdywnfsrsfs.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const V6_CONTRACT = '0xaE54e4E8A75a81780361570c17b8660CEaD27053'
const V5_CONTRACT = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

async function fixSoldCounts() {
  console.log('🔧 Fixing sold_count mismatches...\n')
  
  // Get all minted submissions
  const { data: submissions } = await supabase
    .from('submissions')
    .select('id, campaign_id, sold_count')
    .eq('status', 'minted')
  
  // Get all purchases grouped by campaign_id
  const { data: purchases } = await supabase
    .from('purchases')
    .select('campaign_id')
  
  if (!submissions || !purchases) {
    console.error('Failed to fetch data')
    return
  }
  
  // Count purchases per campaign
  const purchaseCountByCampaign: Record<number, number> = {}
  for (const p of purchases) {
    if (p.campaign_id != null) {
      purchaseCountByCampaign[p.campaign_id] = (purchaseCountByCampaign[p.campaign_id] || 0) + 1
    }
  }
  
  let fixed = 0
  for (const s of submissions) {
    if (s.campaign_id == null) continue
    
    const dbCount = s.sold_count || 0
    const actualCount = purchaseCountByCampaign[s.campaign_id] || 0
    
    if (dbCount !== actualCount) {
      console.log(`📌 Campaign ${s.campaign_id}: ${dbCount} → ${actualCount}`)
      
      const { error } = await supabase
        .from('submissions')
        .update({ sold_count: actualCount })
        .eq('id', s.id)
      
      if (error) {
        console.error(`  ❌ Failed to update: ${error.message}`)
      } else {
        console.log(`  ✅ Updated`)
        fixed++
      }
    }
  }
  
  console.log(`\n✅ Fixed ${fixed} sold_count mismatches`)
}

async function addV6Contract() {
  console.log('\n🔧 Checking V6 contract in marketplace_contracts...\n')
  
  // Check if V6 already exists
  const { data: existing } = await supabase
    .from('marketplace_contracts')
    .select('*')
    .ilike('contract_address', V6_CONTRACT)
  
  if (existing && existing.length > 0) {
    console.log('✅ V6 contract already in marketplace_contracts')
    return
  }
  
  // Add V6 contract
  const { error } = await supabase
    .from('marketplace_contracts')
    .insert({
      contract_address: V6_CONTRACT,
      name: 'PatriotPledgeNFT V6',
      version: 'v6',
      enabled: true,
      created_at: new Date().toISOString()
    })
  
  if (error) {
    console.error(`❌ Failed to add V6 contract: ${error.message}`)
  } else {
    console.log('✅ Added V6 contract to marketplace_contracts')
  }
}

async function main() {
  console.log('🔧 DATABASE FIX SCRIPT')
  console.log('═'.repeat(50))
  
  await fixSoldCounts()
  await addV6Contract()
  
  console.log('\n' + '═'.repeat(50))
  console.log('✅ Done!')
}

main().catch(console.error)
