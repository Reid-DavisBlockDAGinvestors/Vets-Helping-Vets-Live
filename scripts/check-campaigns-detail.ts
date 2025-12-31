#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  console.log('\n=== CAMPAIGN CONTRACT DETAILS ===\n')
  
  const { data: campaigns } = await supabase
    .from('submissions')
    .select('campaign_id, title, contract_address, contract_version, sold_count, status, goal')
    .not('campaign_id', 'is', null)
    .order('campaign_id')
  
  for (const c of campaigns || []) {
    console.log('#' + c.campaign_id + ': ' + (c.title || '').slice(0, 35))
    console.log('   Contract: ' + (c.contract_address || 'NOT SET'))
    console.log('   Version: ' + (c.contract_version || 'NOT SET'))
    console.log('   Sold: ' + (c.sold_count || 0) + ' | Goal: $' + (c.goal || 0))
    console.log('   Status: ' + c.status)
    console.log('')
  }

  // Calculate totals
  console.log('\n=== TOTALS FROM SUBMISSIONS ===')
  let totalSold = 0
  for (const c of campaigns || []) {
    totalSold += c.sold_count || 0
  }
  console.log('Total sold_count sum: ' + totalSold)

  // Check purchases
  console.log('\n=== TOTALS FROM PURCHASES ===')
  const { data: purchases } = await supabase
    .from('purchases')
    .select('amount_usd, tip_usd, quantity')
  
  let totalUSD = 0
  let totalQty = 0
  for (const p of purchases || []) {
    totalUSD += (p.amount_usd || 0) + (p.tip_usd || 0)
    totalQty += p.quantity || 1
  }
  console.log('Total purchases: ' + (purchases?.length || 0))
  console.log('Total USD: $' + totalUSD.toFixed(2))
  console.log('Total quantity: ' + totalQty)

  // Check specific campaigns
  console.log('\n=== SPECIFIC CAMPAIGNS ===')
  
  // Larry Odom #4
  const larry = campaigns?.find((c: any) => c.campaign_id === 4)
  console.log('\nLarry Odom (#4):')
  console.log('  sold_count: ' + (larry?.sold_count || 0))
  console.log('  goal: $' + (larry?.goal || 0))
  console.log('  contract: ' + (larry?.contract_address || 'NOT SET'))
  
  // Antonty Turner #38
  const antonty = campaigns?.find((c: any) => c.campaign_id === 38)
  console.log('\nAntonty Turner (#38):')
  console.log('  sold_count: ' + (antonty?.sold_count || 0))
  console.log('  goal: $' + (antonty?.goal || 0))
  console.log('  contract: ' + (antonty?.contract_address || 'NOT SET'))
  console.log('  version: ' + (antonty?.contract_version || 'NOT SET'))

  // Check homepage stats source
  console.log('\n=== WHAT HOMEPAGE SHOULD SHOW ===')
  console.log('Total USD raised: $' + totalUSD.toFixed(2))
  console.log('Total NFTs sold: ' + totalQty)
  console.log('Total campaigns: ' + (campaigns?.length || 0))
}

run().catch(console.error)
