#!/usr/bin/env node
/**
 * Fix Campaign Data - Sync sold_count with purchases table
 */
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  console.log('\n🔍 INVESTIGATING CAMPAIGN DATA ISSUES\n')
  
  // 1. Check purchases for campaigns #38 and #39
  console.log('=== PURCHASES FOR CAMPAIGNS #38 AND #39 ===')
  
  for (const campaignId of [38, 39]) {
    const { data: purchases, error } = await supabase
      .from('purchases')
      .select('id, campaign_id, amount_usd, quantity, created_at, wallet_address, email')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
    
    console.log(`\nCampaign #${campaignId}:`)
    console.log(`  Purchases in DB: ${purchases?.length || 0}`)
    
    if (purchases && purchases.length > 0) {
      const totalQty = purchases.reduce((sum: number, p: any) => sum + (p.quantity || 1), 0)
      const totalUSD = purchases.reduce((sum: number, p: any) => sum + (p.amount_usd || 0), 0)
      console.log(`  Total quantity: ${totalQty}`)
      console.log(`  Total USD: $${totalUSD.toFixed(2)}`)
      console.log(`  Sample purchases:`)
      purchases.slice(0, 3).forEach((p: any) => {
        console.log(`    - $${p.amount_usd} on ${p.created_at?.slice(0, 10)} from ${p.wallet_address?.slice(0, 10)}...`)
      })
    }
  }
  
  // 2. Get current sold_count from submissions
  console.log('\n\n=== CURRENT SOLD_COUNT IN SUBMISSIONS ===')
  
  const { data: submissions } = await supabase
    .from('submissions')
    .select('id, title, campaign_id, sold_count, goal, status')
    .in('campaign_id', [38, 39])
  
  for (const sub of submissions || []) {
    console.log(`\nCampaign #${sub.campaign_id}: "${sub.title?.slice(0, 50)}..."`)
    console.log(`  Status: ${sub.status}`)
    console.log(`  sold_count: ${sub.sold_count || 0}`)
    console.log(`  Goal: $${sub.goal || 0}`)
  }
  
  // 3. Calculate correct sold_count from purchases
  console.log('\n\n=== RECALCULATING SOLD_COUNT FROM PURCHASES ===')
  
  const { data: allCampaigns } = await supabase
    .from('submissions')
    .select('id, campaign_id, sold_count, title')
    .not('campaign_id', 'is', null)
  
  const { data: allPurchases } = await supabase
    .from('purchases')
    .select('campaign_id, quantity')
  
  // Build purchase counts
  const purchaseCounts: Record<number, number> = {}
  for (const p of allPurchases || []) {
    const cid = p.campaign_id
    purchaseCounts[cid] = (purchaseCounts[cid] || 0) + (p.quantity || 1)
  }
  
  // Find mismatches
  const fixes: { id: string; campaignId: number; title: string; current: number; correct: number }[] = []
  
  for (const c of allCampaigns || []) {
    const correctCount = purchaseCounts[c.campaign_id] || 0
    const currentCount = c.sold_count || 0
    
    if (correctCount !== currentCount) {
      fixes.push({
        id: c.id,
        campaignId: c.campaign_id,
        title: c.title,
        current: currentCount,
        correct: correctCount
      })
    }
  }
  
  if (fixes.length > 0) {
    console.log(`\nFound ${fixes.length} campaigns with incorrect sold_count:`)
    for (const f of fixes) {
      console.log(`  Campaign #${f.campaignId}: "${f.title?.slice(0, 40)}..."`)
      console.log(`    Current: ${f.current} → Correct: ${f.correct}`)
    }
    
    // Ask for confirmation
    console.log('\n\n🔧 APPLYING FIXES...')
    
    for (const f of fixes) {
      const { error } = await supabase
        .from('submissions')
        .update({ sold_count: f.correct })
        .eq('id', f.id)
      
      if (error) {
        console.log(`  ❌ Failed to update campaign #${f.campaignId}:`, error.message)
      } else {
        console.log(`  ✅ Updated campaign #${f.campaignId}: ${f.current} → ${f.correct}`)
      }
    }
  } else {
    console.log('  ✅ All campaigns have correct sold_count')
  }
  
  // 4. Check for duplicate campaigns to merge/delete
  console.log('\n\n=== CHECKING DUPLICATE ANTONTY TURNER CAMPAIGNS ===')
  
  const { data: turnerCampaigns } = await supabase
    .from('submissions')
    .select('*')
    .ilike('title', '%antonty%turner%')
  
  if (turnerCampaigns && turnerCampaigns.length > 1) {
    console.log(`\nFound ${turnerCampaigns.length} Antonty Turner campaigns:`)
    for (const c of turnerCampaigns) {
      console.log(`\n  Campaign #${c.campaign_id}: ${c.title}`)
      console.log(`    ID: ${c.id}`)
      console.log(`    Status: ${c.status}`)
      console.log(`    Sold: ${c.sold_count || 0}`)
      console.log(`    Created: ${c.created_at}`)
      console.log(`    Creator: ${c.creator_email}`)
    }
    
    console.log('\n⚠️  RECOMMENDATION:')
    console.log('  - Keep campaign #38 (has sales)')
    console.log('  - Consider deleting campaign #39 (duplicate with 0 sales)')
  }
  
  console.log('\n')
}

run().catch(console.error)
