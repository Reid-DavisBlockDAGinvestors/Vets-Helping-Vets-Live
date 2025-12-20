/**
 * Deep Audit Script - Identify Data Inconsistencies
 * 
 * This script audits:
 * 1. Submissions without contract_address (orphaned)
 * 2. Campaigns that exist on-chain but not in DB
 * 3. Campaigns in DB but not on-chain
 * 4. Stats calculation methodology differences
 */

import { createClient } from '@supabase/supabase-js'
import { ethers } from 'ethers'

const V5_CONTRACT = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const V6_CONTRACT = '0xaE54e4E8A75a81780361570c17b8660CEaD27053'
const BDAG_USD_RATE = 0.05

const V5_ABI = [
  'function totalSupply() view returns (uint256)',
  'function totalCampaigns() view returns (uint256)',
  'function getCampaign(uint256 campaignId) view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)',
]

async function main() {
  console.log('=== DATA AUDIT STARTED ===\n')

  // Connect to Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // 1. Check all submissions
  console.log('--- 1. SUBMISSIONS AUDIT ---')
  const { data: allSubmissions, error } = await supabase
    .from('submissions')
    .select('id, campaign_id, title, status, contract_address, contract_version, goal, num_copies')
    .order('campaign_id', { ascending: true })

  if (error) {
    console.error('Error fetching submissions:', error)
    process.exit(1)
  }

  console.log(`Total submissions: ${allSubmissions?.length || 0}`)

  // Categorize submissions
  const minted = allSubmissions?.filter(s => s.status === 'minted') || []
  const withCampaignId = minted.filter(s => s.campaign_id != null)
  const withContractAddr = withCampaignId.filter(s => s.contract_address && s.contract_address.trim() !== '')
  const orphaned = withCampaignId.filter(s => !s.contract_address || s.contract_address.trim() === '')

  console.log(`\nMinted submissions: ${minted.length}`)
  console.log(`  With campaign_id: ${withCampaignId.length}`)
  console.log(`  With contract_address: ${withContractAddr.length}`)
  console.log(`  ORPHANED (no contract_address): ${orphaned.length}`)

  if (orphaned.length > 0) {
    console.log('\n  ORPHANED SUBMISSIONS (have campaign_id but no contract_address):')
    for (const s of orphaned) {
      console.log(`    - Campaign #${s.campaign_id}: "${s.title?.slice(0, 40)}..."`)
    }
    console.log('\n  *** These submissions will NOT be counted in stats! ***')
  }

  // Group by contract
  const byV5 = withContractAddr.filter(s => s.contract_address?.toLowerCase() === V5_CONTRACT.toLowerCase())
  const byV6 = withContractAddr.filter(s => s.contract_address?.toLowerCase() === V6_CONTRACT.toLowerCase())
  const byOther = withContractAddr.filter(s => 
    s.contract_address?.toLowerCase() !== V5_CONTRACT.toLowerCase() && 
    s.contract_address?.toLowerCase() !== V6_CONTRACT.toLowerCase()
  )

  console.log(`\nBy contract:`)
  console.log(`  V5 (${V5_CONTRACT.slice(0, 10)}...): ${byV5.length} campaigns`)
  console.log(`  V6 (${V6_CONTRACT.slice(0, 10)}...): ${byV6.length} campaigns`)
  if (byOther.length > 0) {
    console.log(`  OTHER: ${byOther.length} campaigns (UNKNOWN CONTRACTS!)`)
    for (const s of byOther) {
      console.log(`    - ${s.contract_address}: Campaign #${s.campaign_id}`)
    }
  }

  // 2. Check on-chain data
  console.log('\n--- 2. ON-CHAIN AUDIT ---')
  
  const rpcUrl = process.env.NOWNODES_RPC_URL || 'https://bdag-rpc.nownodes.io'
  const provider = new ethers.JsonRpcProvider(rpcUrl)

  for (const [name, addr] of [['V5', V5_CONTRACT], ['V6', V6_CONTRACT]]) {
    console.log(`\n${name} Contract (${addr.slice(0, 10)}...):`)
    
    try {
      const contract = new ethers.Contract(addr, V5_ABI, provider)
      
      const totalSupply = await contract.totalSupply()
      console.log(`  totalSupply: ${Number(totalSupply)} NFTs`)
      
      const totalCampaigns = await contract.totalCampaigns()
      console.log(`  totalCampaigns: ${Number(totalCampaigns)}`)

      // Check each campaign
      let totalRaisedBDAG = 0
      let totalEditionsMinted = 0
      
      const campaignCount = Number(totalCampaigns)
      const dbCampaignIds = (name === 'V5' ? byV5 : byV6).map(s => s.campaign_id)
      
      for (let i = 1; i <= campaignCount; i++) {
        try {
          const camp = await contract.getCampaign(i)
          const grossRaisedWei = BigInt(camp.grossRaised ?? camp[3] ?? 0n)
          const grossRaisedBDAG = Number(grossRaisedWei) / 1e18
          const editionsMinted = Number(camp.editionsMinted ?? camp[5] ?? 0)
          
          totalRaisedBDAG += grossRaisedBDAG
          totalEditionsMinted += editionsMinted
          
          const inDb = dbCampaignIds.includes(i)
          if (!inDb && editionsMinted > 0) {
            console.log(`    Campaign #${i}: ${editionsMinted} minted, $${(grossRaisedBDAG * BDAG_USD_RATE).toFixed(2)} raised - NOT IN DB!`)
          }
        } catch (e: any) {
          // Campaign doesn't exist
        }
      }
      
      console.log(`  Total raised on-chain: ${totalRaisedBDAG.toFixed(2)} BDAG = $${(totalRaisedBDAG * BDAG_USD_RATE).toFixed(2)} USD`)
      console.log(`  Total editions minted on-chain: ${totalEditionsMinted}`)
      
    } catch (e: any) {
      console.error(`  Error: ${e?.message}`)
    }
  }

  // 3. Summary
  console.log('\n--- 3. EXPECTED VS ACTUAL ---')
  console.log(`\nIF all orphaned submissions were on V5 (likely), stats should be higher by:`)
  
  let orphanedGoals = 0
  for (const s of orphaned) {
    orphanedGoals += Number(s.goal || 0)
  }
  console.log(`  ${orphaned.length} campaigns with $${orphanedGoals} total goals`)
  console.log('\nRECOMMENDATION: Backfill contract_address for orphaned submissions')

  console.log('\n=== AUDIT COMPLETE ===')
}

main().catch(console.error)
