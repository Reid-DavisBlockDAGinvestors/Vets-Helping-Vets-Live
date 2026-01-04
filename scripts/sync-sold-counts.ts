/**
 * Sync Supabase sold_count with On-Chain Data
 * 
 * This script updates Supabase submissions to match on-chain editionsMinted values.
 * Ensures 100% accuracy between database and blockchain.
 * 
 * Run with: npx ts-node scripts/sync-sold-counts.ts
 */

import { ethers } from 'ethers'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

// V8 ABI
const V8_ABI = [
  'function getCampaign(uint256 campaignId) view returns (tuple(address beneficiary, string metadataURI, uint256 priceWei, uint256 priceUSD, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 withdrawn, uint256 editionsMinted, uint256 maxEditions, uint256 platformFee, uint256 nonprofitFee, uint256 createdAt, uint256 pausedAt, bool active, bool paused, bool closed))'
]

// V6 ABI
const V6_ABI = [
  'function getCampaign(uint256 campaignId) view returns (address, string, uint256, uint256, uint256, uint256, uint256, uint256, bool, bool)'
]

// Contract configs
const CONTRACTS: Record<number, { rpcUrl: string; abi: any[] }> = {
  1: { 
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
    abi: V8_ABI 
  },
  11155111: { 
    rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/demo',
    abi: V8_ABI 
  },
  1043: { 
    rpcUrl: 'https://rpc.awakening.bdagscan.com',
    abi: V6_ABI 
  }
}

async function syncSoldCounts() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('         SYNC SUPABASE SOLD_COUNT WITH ON-CHAIN DATA')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )

  // Get all submissions with contract data
  const { data: submissions, error } = await supabase
    .from('submissions')
    .select('id, title, campaign_id, contract_address, chain_id, sold_count')
    .not('campaign_id', 'is', null)
    .not('contract_address', 'is', null)

  if (error) {
    console.error('Supabase error:', error)
    return
  }

  console.log(`📊 Found ${submissions?.length || 0} submissions with on-chain data`)
  console.log()

  let updated = 0
  let skipped = 0
  let errors = 0

  for (const sub of submissions || []) {
    const chainId = sub.chain_id || 1043
    const config = CONTRACTS[chainId]
    
    if (!config) {
      console.log(`⚠️  Unknown chain ${chainId} for "${sub.title}"`)
      errors++
      continue
    }

    try {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl)
      const contract = new ethers.Contract(sub.contract_address, config.abi, provider)
      
      const campaignData = await contract.getCampaign(BigInt(sub.campaign_id))
      
      let editionsMinted: number
      if (chainId === 1 || chainId === 11155111) {
        editionsMinted = Number(campaignData.editionsMinted ?? campaignData[8] ?? 0)
      } else {
        editionsMinted = Number(campaignData[5] ?? 0)
      }
      
      const currentSoldCount = sub.sold_count || 0
      
      if (editionsMinted !== currentSoldCount) {
        console.log(`🔄 "${sub.title}"`)
        console.log(`   Chain ${chainId} | Campaign #${sub.campaign_id}`)
        console.log(`   Supabase: ${currentSoldCount} → On-chain: ${editionsMinted}`)
        
        // Update Supabase
        const { error: updateError } = await supabase
          .from('submissions')
          .update({ sold_count: editionsMinted })
          .eq('id', sub.id)
        
        if (updateError) {
          console.log(`   ❌ Update failed: ${updateError.message}`)
          errors++
        } else {
          console.log(`   ✅ Updated successfully`)
          updated++
        }
        console.log()
      } else {
        skipped++
      }
    } catch (e: any) {
      console.log(`❌ Failed to query "${sub.title}": ${e.message}`)
      errors++
    }
  }

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('                         SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log()
  console.log(`   ✅ Updated: ${updated}`)
  console.log(`   ⏭️  Skipped (already in sync): ${skipped}`)
  console.log(`   ❌ Errors: ${errors}`)
  console.log()
  console.log('═══════════════════════════════════════════════════════════════')
}

syncSoldCounts().catch(console.error)
