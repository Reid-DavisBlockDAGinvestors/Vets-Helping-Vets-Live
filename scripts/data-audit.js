// Comprehensive Data Audit Script
// Audits all tables to identify data gaps and find existing tip data
// Run with: node scripts/data-audit.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function auditTable(tableName, options = {}) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`TABLE: ${tableName}`)
  console.log('='.repeat(60))
  
  const { data, error, count } = await supabase
    .from(tableName)
    .select('*', { count: 'exact' })
    .limit(options.limit || 5)
  
  if (error) {
    console.log(`  ❌ Error: ${error.message}`)
    return null
  }
  
  console.log(`  Total rows: ${count}`)
  
  if (data && data.length > 0) {
    const columns = Object.keys(data[0])
    console.log(`  Columns: ${columns.join(', ')}`)
    
    // Analyze null/empty values
    const nullCounts = {}
    columns.forEach(col => nullCounts[col] = 0)
    
    // Get all data for null analysis
    const { data: allData } = await supabase.from(tableName).select('*')
    allData?.forEach(row => {
      columns.forEach(col => {
        if (row[col] === null || row[col] === '' || row[col] === undefined) {
          nullCounts[col]++
        }
      })
    })
    
    console.log(`\n  Column analysis (nulls out of ${allData?.length || 0}):`)
    columns.forEach(col => {
      const nullPct = allData?.length ? ((nullCounts[col] / allData.length) * 100).toFixed(1) : 0
      const status = nullPct > 50 ? '⚠️' : nullPct > 0 ? '⚡' : '✅'
      console.log(`    ${status} ${col}: ${nullCounts[col]} nulls (${nullPct}%)`)
    })
    
    if (options.showSample) {
      console.log(`\n  Sample row:`)
      console.log(JSON.stringify(data[0], null, 4).split('\n').map(l => '    ' + l).join('\n'))
    }
    
    return { count, columns, nullCounts, data: allData }
  }
  
  return { count: 0, columns: [], nullCounts: {}, data: [] }
}

async function findTipData() {
  console.log('\n' + '='.repeat(60))
  console.log('SEARCHING FOR EXISTING TIP DATA')
  console.log('='.repeat(60))
  
  // Check events table for tip metadata
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .not('metadata', 'is', null)
  
  console.log(`\n1. Events table with metadata: ${events?.length || 0} rows`)
  
  let eventsWithTips = 0
  let totalTipUSD = 0
  let totalTipBDAG = 0
  
  events?.forEach(e => {
    if (e.metadata && (e.metadata.tipUSD > 0 || e.metadata.tipBDAG > 0)) {
      eventsWithTips++
      totalTipUSD += e.metadata.tipUSD || 0
      totalTipBDAG += e.metadata.tipBDAG || 0
    }
  })
  
  console.log(`   Events with tips: ${eventsWithTips}`)
  console.log(`   Total tip USD in events: $${totalTipUSD.toFixed(2)}`)
  console.log(`   Total tip BDAG in events: ${totalTipBDAG.toFixed(2)}`)
  
  if (eventsWithTips > 0) {
    console.log('\n   Sample event with tip:')
    const sampleTip = events.find(e => e.metadata?.tipUSD > 0)
    if (sampleTip) {
      console.log(`     tx_hash: ${sampleTip.tx_hash}`)
      console.log(`     wallet: ${sampleTip.wallet_address}`)
      console.log(`     campaign_id: ${sampleTip.campaign_id}`)
      console.log(`     metadata: ${JSON.stringify(sampleTip.metadata)}`)
    }
  }
  
  // Check contributions table
  const { data: contributions } = await supabase
    .from('contributions')
    .select('*')
  
  console.log(`\n2. Contributions table: ${contributions?.length || 0} rows`)
  if (contributions?.length > 0) {
    console.log('   Sample:', JSON.stringify(contributions[0], null, 2))
  }
  
  // Check purchases table current state
  const { data: purchases } = await supabase
    .from('purchases')
    .select('*')
  
  console.log(`\n3. Purchases table: ${purchases?.length || 0} rows`)
  
  let purchasesWithTips = 0
  purchases?.forEach(p => {
    if (p.tip_usd > 0 || p.tip_bdag > 0) purchasesWithTips++
  })
  console.log(`   Purchases with tip data: ${purchasesWithTips}`)
  
  return { events, eventsWithTips, totalTipUSD, totalTipBDAG, purchases }
}

async function analyzeDataFlow() {
  console.log('\n' + '='.repeat(60))
  console.log('USER FLOW DATA CAPTURE ANALYSIS')
  console.log('='.repeat(60))
  
  console.log('\n📱 USER REGISTRATION/LOGIN')
  console.log('   → profiles table: stores user info, wallet, role')
  console.log('   → auth.users: Supabase auth records')
  
  console.log('\n📝 CAMPAIGN SUBMISSION')
  console.log('   → submissions table: stores campaign details')
  
  console.log('\n💰 PURCHASE FLOW')
  console.log('   → events table: stores purchase events with metadata')
  console.log('   → purchases table: stores purchase records')
  console.log('   → contributions table: (appears empty) for off-chain contributions')
  console.log('   → submissions.sold_count: incremented on purchase')
  
  console.log('\n🔗 ON-CHAIN DATA')
  console.log('   → Blockchain: NFT ownership, campaign data')
  console.log('   → tx_hash in events/purchases links to blockchain')
  
  // Check for orphaned data
  const { data: purchases } = await supabase.from('purchases').select('campaign_id')
  const { data: submissions } = await supabase.from('submissions').select('campaign_id')
  
  const submissionCampaignIds = new Set(submissions?.map(s => s.campaign_id).filter(Boolean))
  const orphanedPurchases = purchases?.filter(p => !submissionCampaignIds.has(p.campaign_id))
  
  console.log('\n⚠️  DATA INTEGRITY CHECK')
  console.log(`   Purchases with invalid campaign_id: ${orphanedPurchases?.length || 0}`)
  
  if (orphanedPurchases?.length > 0) {
    console.log('   Orphaned campaign_ids:', [...new Set(orphanedPurchases.map(p => p.campaign_id))])
  }
}

async function generateBackfillPlan(tipData) {
  console.log('\n' + '='.repeat(60))
  console.log('BACKFILL PLAN FOR TIPS')
  console.log('='.repeat(60))
  
  if (tipData.eventsWithTips === 0) {
    console.log('\n❌ No tip data found in events table to backfill')
    return
  }
  
  console.log(`\n✅ Found ${tipData.eventsWithTips} events with tip data`)
  console.log(`   Total: $${tipData.totalTipUSD.toFixed(2)} USD / ${tipData.totalTipBDAG.toFixed(2)} BDAG`)
  
  console.log('\n📋 BACKFILL STRATEGY:')
  console.log('   1. Match events to purchases by tx_hash')
  console.log('   2. Copy tipUSD/tipBDAG from events.metadata to purchases.tip_usd/tip_bdag')
  console.log('   3. Copy quantity from events.metadata to purchases.quantity')
  
  // Check matchability
  const { data: events } = await supabase
    .from('events')
    .select('tx_hash, metadata')
    .not('metadata', 'is', null)
  
  const { data: purchases } = await supabase
    .from('purchases')
    .select('tx_hash')
  
  const purchaseTxHashes = new Set(purchases?.map(p => p.tx_hash))
  const matchableEvents = events?.filter(e => purchaseTxHashes.has(e.tx_hash) && (e.metadata?.tipUSD > 0 || e.metadata?.tipBDAG > 0))
  
  console.log(`\n   Events with tips that match purchases: ${matchableEvents?.length || 0}`)
  
  if (matchableEvents?.length > 0) {
    console.log('\n   Sample matches:')
    matchableEvents.slice(0, 3).forEach(e => {
      console.log(`     tx: ${e.tx_hash?.slice(0, 20)}... tip: $${e.metadata?.tipUSD || 0}`)
    })
  }
  
  return matchableEvents
}

async function main() {
  console.log('🚀 COMPREHENSIVE DATA AUDIT - PatriotPledge NFTs')
  console.log('=' .repeat(60))
  console.log('Date:', new Date().toISOString())
  console.log('')
  
  // Audit all key tables
  const tables = [
    'profiles',
    'submissions',
    'purchases',
    'events',
    'contributions',
    'bug_reports',
    'community_posts',
    'community_comments',
    'campaign_follows'
  ]
  
  const tableData = {}
  for (const table of tables) {
    try {
      tableData[table] = await auditTable(table, { showSample: table === 'events' })
    } catch (e) {
      console.log(`  ⚠️ Table ${table} may not exist: ${e.message}`)
    }
  }
  
  // Find tip data
  const tipData = await findTipData()
  
  // Analyze data flow
  await analyzeDataFlow()
  
  // Generate backfill plan
  const matchableEvents = await generateBackfillPlan(tipData)
  
  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY & RECOMMENDATIONS')
  console.log('='.repeat(60))
  
  console.log('\n🔴 CRITICAL ISSUES:')
  if (tipData.eventsWithTips > 0 && tableData.purchases?.count > 0) {
    console.log('   • Tips stored in events.metadata but not in purchases table')
    console.log('   • Need to backfill purchases.tip_usd and purchases.tip_bdag')
  }
  
  console.log('\n🟡 DATA GAPS:')
  for (const [table, data] of Object.entries(tableData)) {
    if (data?.nullCounts) {
      const highNullCols = Object.entries(data.nullCounts)
        .filter(([col, count]) => count > 0 && data.count > 0 && (count / data.count) > 0.5)
        .map(([col]) => col)
      if (highNullCols.length > 0) {
        console.log(`   • ${table}: high nulls in [${highNullCols.join(', ')}]`)
      }
    }
  }
  
  console.log('\n🟢 NEXT STEPS:')
  console.log('   1. Run SQL migration to add tip columns to purchases')
  console.log('   2. Run backfill script to populate tips from events')
  console.log('   3. Verify all data is properly captured going forward')
  
  console.log('\n✅ Audit complete!')
}

main().catch(console.error)
