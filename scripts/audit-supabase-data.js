/**
 * Audit Supabase Data for Admin Portal
 * Checks what data exists and why admin tabs might be empty
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function audit() {
  console.log('='.repeat(60))
  console.log('SUPABASE DATA AUDIT FOR ADMIN PORTAL')
  console.log('='.repeat(60))

  // 1. Check submissions table
  console.log('\n📋 SUBMISSIONS TABLE:')
  const { data: submissions, error: subError } = await supabase
    .from('submissions')
    .select('id, title, status, campaign_id, chain_id, chain_name, contract_version, creator_wallet, immediate_payout_enabled')
    .order('created_at', { ascending: false })
    .limit(20)

  if (subError) {
    console.error('  Error:', subError.message)
  } else {
    console.log(`  Total found: ${submissions?.length || 0}`)
    
    const minted = submissions?.filter(s => s.status === 'minted') || []
    const withCampaignId = minted.filter(s => s.campaign_id !== null)
    
    console.log(`  Status breakdown:`)
    const statusCounts = {}
    submissions?.forEach(s => {
      statusCounts[s.status] = (statusCounts[s.status] || 0) + 1
    })
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`    - ${status}: ${count}`)
    })
    
    console.log(`  Minted with campaign_id: ${withCampaignId.length}`)
    console.log(`  Minted WITHOUT campaign_id: ${minted.length - withCampaignId.length}`)
    
    if (submissions?.length > 0) {
      console.log('\n  Sample submissions:')
      submissions.slice(0, 5).forEach(s => {
        console.log(`    [${s.status}] "${s.title}" - campaign_id: ${s.campaign_id}, chain: ${s.chain_id}/${s.chain_name}`)
      })
    }
  }

  // 2. Check purchases table
  console.log('\n💰 PURCHASES TABLE:')
  const { data: purchases, error: purchError } = await supabase
    .from('purchases')
    .select('id, campaign_id, amount_usd, amount_bdag, tip_usd, tip_bdag, chain_id')
    .order('created_at', { ascending: false })
    .limit(20)

  if (purchError) {
    console.error('  Error:', purchError.message)
  } else {
    console.log(`  Total found: ${purchases?.length || 0}`)
    if (purchases?.length > 0) {
      console.log('  Sample purchases:')
      purchases.slice(0, 5).forEach(p => {
        console.log(`    campaign_id: ${p.campaign_id}, amount: $${p.amount_usd || 0} / ${p.amount_bdag || 0} BDAG`)
      })
    }
  }

  // 3. Check distributions table
  console.log('\n📊 DISTRIBUTIONS TABLE:')
  const { data: distributions, error: distError } = await supabase
    .from('distributions')
    .select('*')
    .limit(10)

  if (distError) {
    console.error('  Error:', distError.message)
  } else {
    console.log(`  Total found: ${distributions?.length || 0}`)
  }

  // 4. Check contracts table
  console.log('\n📜 CONTRACTS TABLE:')
  const { data: contracts, error: contrError } = await supabase
    .from('contracts')
    .select('*')

  if (contrError) {
    console.error('  Error:', contrError.message)
  } else {
    console.log(`  Total found: ${contracts?.length || 0}`)
    contracts?.forEach(c => {
      console.log(`    ${c.version} on chain ${c.chain_id}: ${c.address} (active: ${c.is_active})`)
    })
  }

  // 5. Check chain_configs table
  console.log('\n🔗 CHAIN_CONFIGS TABLE:')
  const { data: chains, error: chainError } = await supabase
    .from('chain_configs')
    .select('*')

  if (chainError) {
    console.error('  Error:', chainError.message)
  } else {
    console.log(`  Total found: ${chains?.length || 0}`)
    chains?.forEach(c => {
      console.log(`    ${c.chain_id}: ${c.name} (active: ${c.is_active}, testnet: ${c.is_testnet})`)
    })
  }

  // 6. Check blacklisted_addresses table
  console.log('\n🚫 BLACKLISTED_ADDRESSES TABLE:')
  const { data: blacklist, error: blError } = await supabase
    .from('blacklisted_addresses')
    .select('*')

  if (blError) {
    console.error('  Error:', blError.message)
  } else {
    console.log(`  Total found: ${blacklist?.length || 0}`)
  }

  // 7. Check tip_split_configs table
  console.log('\n💸 TIP_SPLIT_CONFIGS TABLE:')
  const { data: tipSplits, error: tipError } = await supabase
    .from('tip_split_configs')
    .select('*')

  if (tipError) {
    console.error('  Error:', tipError.message)
  } else {
    console.log(`  Total found: ${tipSplits?.length || 0}`)
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('DIAGNOSIS:')
  console.log('='.repeat(60))
  
  const mintedWithCampaignId = submissions?.filter(s => s.status === 'minted' && s.campaign_id !== null) || []
  
  if (mintedWithCampaignId.length === 0) {
    console.log('\n⚠️  NO MINTED CAMPAIGNS WITH campaign_id!')
    console.log('   The admin Distributions and Tokens tabs require:')
    console.log('   - status = "minted"')
    console.log('   - campaign_id IS NOT NULL (the on-chain campaign ID)')
    console.log('\n   SOLUTION: Backfill campaign_id for existing minted submissions')
  } else {
    console.log(`\n✅ Found ${mintedWithCampaignId.length} minted campaigns with campaign_id`)
    console.log('   Admin tabs should show data. Check:')
    console.log('   1. Admin authentication (must be admin/super_admin role)')
    console.log('   2. API calls in browser dev tools')
    console.log('   3. Console errors')
  }

  // Check if any submissions need backfilling
  const needsBackfill = submissions?.filter(s => s.status === 'minted' && s.campaign_id === null) || []
  if (needsBackfill.length > 0) {
    console.log(`\n📝 ${needsBackfill.length} minted submissions need campaign_id backfill:`)
    needsBackfill.forEach(s => {
      console.log(`   - "${s.title}" (id: ${s.id})`)
    })
  }
}

audit().catch(console.error)
