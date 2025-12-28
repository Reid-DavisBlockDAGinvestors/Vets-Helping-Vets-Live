/**
 * Create Database Record for Orphan Campaign #38
 * 
 * Campaign #38 has the same baseURI as Campaign #39 (Antonty Turner)
 * This was a duplicate created due to RPC issues but has 100 sales
 * We need to track it in the database for proper auditing
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function createCampaign38Record() {
  console.log('=== CREATING DATABASE RECORD FOR CAMPAIGN #38 ===\n')
  
  // First, get Campaign #39's submission details (same baseURI)
  const { data: campaign39, error: err39 } = await supabase
    .from('submissions')
    .select('*')
    .eq('campaign_id', 39)
    .single()
  
  if (err39 || !campaign39) {
    console.error('Could not find Campaign #39 to copy details from:', err39)
    return
  }
  
  console.log('Found Campaign #39 (source):', campaign39.title)
  console.log('Creator:', campaign39.creator_email)
  console.log('Wallet:', campaign39.creator_wallet)
  
  // Check if Campaign #38 record already exists
  const { data: existing } = await supabase
    .from('submissions')
    .select('id')
    .eq('campaign_id', 38)
    .single()
  
  if (existing) {
    console.log('\n⚠️ Campaign #38 already has a database record:', existing.id)
    return
  }
  
  // Create a new submission record for Campaign #38
  // Mark it as a duplicate/orphan for tracking purposes
  // Use only columns that exist in the submissions table
  const newRecord = {
    title: `[ORPHAN DUPLICATE] ${campaign39.title}`,
    story: `This is an orphan on-chain campaign (duplicate of Campaign #39) created due to RPC issues. It has 100 NFT sales totaling 98,100 BDAG raised.`,
    category: campaign39.category || 'general',
    goal: 1000,
    creator_wallet: campaign39.creator_wallet,
    creator_email: campaign39.creator_email,
    creator_name: campaign39.creator_name,
    image_uri: campaign39.image_uri,
    metadata_uri: 'ipfs://bafkreigu3zie46b45ar6unwb3lq3mfjs5sgfvr2m65j745oq3k53ljtogq',
    status: 'minted',
    campaign_id: 38,
    contract_address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890',
    visible_on_marketplace: false,
    num_copies: 100,
    sold_count: 100,
  }
  
  console.log('\nCreating database record for Campaign #38...')
  
  const { data: inserted, error: insertErr } = await supabase
    .from('submissions')
    .insert(newRecord)
    .select()
    .single()
  
  if (insertErr) {
    console.error('Failed to create record:', insertErr)
    return
  }
  
  console.log('\n✅ SUCCESS: Created database record for Campaign #38')
  console.log('New submission ID:', inserted.id)
  console.log('Campaign ID:', inserted.campaign_id)
  console.log('Status:', inserted.status)
  console.log('Visible on marketplace:', inserted.visible_on_marketplace)
  
  // Also log all 7 orphan campaigns with sales for reference
  console.log('\n=== ALL ORPHAN CAMPAIGNS WITH SALES ===')
  console.log('Campaign 0: 1 sale, 20 BDAG - early test')
  console.log('Campaign 1: 1 sale, 20 BDAG - early test')
  console.log('Campaign 2: 1 sale, 20 BDAG - early test')
  console.log('Campaign 26: 1 sale, 200 BDAG - duplicate')
  console.log('Campaign 32: 1 sale, 200 BDAG - duplicate')
  console.log('Campaign 38: 100 sales, 98,100 BDAG - ✅ NOW TRACKED')
  console.log('Campaign 40: 2 sales, 500 BDAG - duplicate')
}

createCampaign38Record().catch(console.error)
