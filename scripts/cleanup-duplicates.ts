#!/usr/bin/env node
/**
 * Cleanup duplicate campaigns
 */
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  console.log('\n🧹 CLEANING UP DUPLICATE CAMPAIGNS\n')
  
  // 1. Fix campaign #38 - remove "[ORPHAN DUPLICATE]" prefix
  console.log('=== Fixing Campaign #38 Title ===')
  
  const { data: campaign38 } = await supabase
    .from('submissions')
    .select('id, title')
    .eq('campaign_id', 38)
    .single()
  
  if (campaign38) {
    const newTitle = campaign38.title.replace('[ORPHAN DUPLICATE] ', '')
    const { error } = await supabase
      .from('submissions')
      .update({ title: newTitle })
      .eq('id', campaign38.id)
    
    if (error) {
      console.log('  ❌ Failed:', error.message)
    } else {
      console.log(`  ✅ Updated title: "${newTitle}"`)
    }
  }
  
  // 2. Handle campaign #39 - mark as duplicate/inactive
  console.log('\n=== Handling Campaign #39 (Duplicate with 0 sales) ===')
  
  const { data: campaign39 } = await supabase
    .from('submissions')
    .select('id, title, status')
    .eq('campaign_id', 39)
    .single()
  
  if (campaign39) {
    // Mark as rejected with reason
    const { error } = await supabase
      .from('submissions')
      .update({ 
        status: 'rejected',
        rejection_reason: 'Duplicate campaign - merged with campaign #38'
      })
      .eq('id', campaign39.id)
    
    if (error) {
      console.log('  ❌ Failed:', error.message)
    } else {
      console.log(`  ✅ Marked campaign #39 as rejected (duplicate)`)
    }
  }
  
  // 3. Verify changes
  console.log('\n=== Verification ===')
  
  const { data: turnerCampaigns } = await supabase
    .from('submissions')
    .select('campaign_id, title, status, sold_count')
    .ilike('title', '%antonty%turner%')
  
  for (const c of turnerCampaigns || []) {
    console.log(`  Campaign #${c.campaign_id}: ${c.status} | Sold: ${c.sold_count} | "${c.title?.slice(0, 50)}"`)
  }
  
  console.log('\n✅ Cleanup complete!\n')
}

run().catch(console.error)
