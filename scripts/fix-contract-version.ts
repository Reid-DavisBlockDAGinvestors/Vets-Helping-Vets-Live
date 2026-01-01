#!/usr/bin/env node
/**
 * Fix Contract Version for Specific Campaigns
 * 
 * This script updates campaigns that are incorrectly showing as V5
 * when they should be V6 (e.g., Reed and Gravy's Trip)
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const V5_CONTRACT = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const V6_CONTRACT = '0xaE54e4E8A75a81780361570c17b8660CEaD27053'

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  console.log('=== Contract Version Fix Script ===\n')

  // Search for campaigns with "Reed" or "Gravy" in the title
  const { data: campaigns, error } = await supabase
    .from('submissions')
    .select('id, title, contract_address, campaign_id, status')
    .or('title.ilike.%reed%,title.ilike.%gravy%')

  if (error) {
    console.error('Error fetching campaigns:', error.message)
    return
  }

  if (!campaigns || campaigns.length === 0) {
    console.log('No campaigns found matching "Reed" or "Gravy"')
    
    // Let's also list all campaigns to help identify the issue
    const { data: allCampaigns } = await supabase
      .from('submissions')
      .select('id, title, contract_address, campaign_id, status')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(20)
    
    console.log('\nRecent approved campaigns:')
    allCampaigns?.forEach(c => {
      const version = c.contract_address === V6_CONTRACT ? 'V6' : 
                      c.contract_address === V5_CONTRACT ? 'V5' : 'Unknown'
      console.log(`  - ${c.title} (ID: ${c.campaign_id}, ${version})`)
    })
    return
  }

  console.log(`Found ${campaigns.length} matching campaign(s):\n`)

  for (const campaign of campaigns) {
    const currentVersion = campaign.contract_address === V6_CONTRACT ? 'V6' : 
                           campaign.contract_address === V5_CONTRACT ? 'V5' : 'Unknown'
    
    console.log(`Campaign: ${campaign.title}`)
    console.log(`  ID: ${campaign.id}`)
    console.log(`  Campaign ID: ${campaign.campaign_id}`)
    console.log(`  Current Contract: ${campaign.contract_address}`)
    console.log(`  Current Version: ${currentVersion}`)
    console.log(`  Status: ${campaign.status}`)

    // If it's showing as V5 but should be V6, update it
    if (campaign.contract_address === V5_CONTRACT) {
      console.log(`\n  ⚠️  This campaign is set to V5 but may need to be V6`)
      console.log(`  To fix, run: UPDATE_TO_V6=true npx ts-node scripts/fix-contract-version.ts`)
      
      if (process.env.UPDATE_TO_V6 === 'true') {
        const { error: updateError } = await supabase
          .from('submissions')
          .update({ contract_address: V6_CONTRACT })
          .eq('id', campaign.id)
        
        if (updateError) {
          console.log(`  ❌ Failed to update: ${updateError.message}`)
        } else {
          console.log(`  ✅ Updated to V6 contract!`)
        }
      }
    } else if (campaign.contract_address === V6_CONTRACT) {
      console.log(`  ✅ Already set to V6 - correct!`)
    }
    
    console.log('')
  }

  console.log('=== Done ===')
}

main().catch(console.error)
