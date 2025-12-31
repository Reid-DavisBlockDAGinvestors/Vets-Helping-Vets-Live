#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  console.log('\n=== CHECKING SUBMISSIONS TABLE SCHEMA ===\n')
  
  // Get one row to see all columns
  const { data: sample, error } = await supabase
    .from('submissions')
    .select('*')
    .limit(1)
  
  if (error) {
    console.log('Error:', error.message)
    return
  }
  
  if (sample && sample.length > 0) {
    console.log('Columns in submissions table:')
    const cols = Object.keys(sample[0])
    cols.forEach(c => {
      const val = sample[0][c]
      const type = typeof val
      console.log('  - ' + c + ' (' + type + '): ' + JSON.stringify(val)?.slice(0, 50))
    })
  }

  // Now get all campaigns with basic fields
  console.log('\n=== ALL CAMPAIGNS WITH BASIC FIELDS ===\n')
  const { data: all } = await supabase
    .from('submissions')
    .select('id, title, campaign_id, status, sold_count')
    .order('campaign_id', { ascending: true, nullsFirst: false })
  
  console.log('Total rows: ' + (all?.length || 0))
  console.log('')
  
  for (const c of (all || []).slice(0, 15)) {
    console.log('#' + (c.campaign_id || 'NULL') + ' | ' + c.status + ' | sold=' + c.sold_count + ' | ' + (c.title || '').slice(0, 40))
  }
  
  if ((all?.length || 0) > 15) {
    console.log('... and ' + ((all?.length || 0) - 15) + ' more')
  }

  // Check purchases aggregation
  console.log('\n=== PURCHASES BY CAMPAIGN ===\n')
  const { data: purchases } = await supabase
    .from('purchases')
    .select('campaign_id, amount_usd, quantity')
  
  const byCampaign = new Map()
  for (const p of purchases || []) {
    const cid = p.campaign_id
    if (!byCampaign.has(cid)) {
      byCampaign.set(cid, { count: 0, qty: 0, usd: 0 })
    }
    const entry = byCampaign.get(cid)
    entry.count++
    entry.qty += p.quantity || 1
    entry.usd += p.amount_usd || 0
  }
  
  // Sort by USD descending
  const sorted = Array.from(byCampaign.entries()).sort((a, b) => b[1].usd - a[1].usd)
  
  for (const [cid, stats] of sorted.slice(0, 15)) {
    console.log('Campaign #' + cid + ': ' + stats.count + ' purchases, ' + stats.qty + ' NFTs, $' + stats.usd.toFixed(2))
  }
}

run().catch(console.error)
