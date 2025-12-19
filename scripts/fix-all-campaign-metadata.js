#!/usr/bin/env node
/**
 * Fix All Campaign Metadata - Batch update all campaigns with empty token URIs
 * 
 * This script:
 * 1. Identifies all campaigns with broken tokens (empty URIs)
 * 2. Gets the correct URI from Supabase
 * 3. Calls updateCampaignMetadata() to fix all tokens in each campaign
 * 
 * Usage: PRIVATE_KEY=0x... node scripts/fix-all-campaign-metadata.js
 */
require('dotenv').config({ path: '.env.local' })
const { ethers } = require('ethers')
const { createClient } = require('@supabase/supabase-js')

const CONTRACT_ADDRESS = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'

const ABI = [
  'function updateCampaignMetadata(uint256 campaignId, string calldata newBaseURI) external',
  'function getCampaign(uint256 campaignId) view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function totalCampaigns() view returns (uint256)',
  'function owner() view returns (address)'
]

// Campaigns with broken tokens (from audit)
const BROKEN_CAMPAIGNS = [0, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 18, 23, 26, 35, 37, 38, 40, 42, 45, 50, 51]

function getProvider() {
  const rpc = process.env.BLOCKDAG_RPC || 'https://rpc.awakening.bdagscan.com'
  const nowNodesKey = process.env.NOWNODES_API_KEY
  
  if (rpc.includes('nownodes.io') && nowNodesKey) {
    const fetchReq = new ethers.FetchRequest(rpc)
    fetchReq.setHeader('api-key', nowNodesKey)
    return new ethers.JsonRpcProvider(fetchReq, undefined, { staticNetwork: true })
  }
  
  return new ethers.JsonRpcProvider(rpc, undefined, { staticNetwork: true })
}

async function main() {
  console.log('🔧 FIX ALL CAMPAIGN METADATA')
  console.log('='.repeat(70))
  
  const provider = getProvider()
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider)
  
  // Get Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  
  // Check contract owner
  const owner = await contract.owner()
  console.log(`Contract Owner: ${owner}`)
  
  // Check if we have private key
  const privateKey = process.env.PRIVATE_KEY
  if (!privateKey) {
    console.log('\n⚠️  PRIVATE_KEY not set in environment.')
    console.log('   Run with: PRIVATE_KEY=0x... node scripts/fix-all-campaign-metadata.js')
    console.log('')
    console.log('Generating SQL to get all campaign URIs from Supabase...')
    
    // Get all submissions with campaign_ids
    const { data: submissions, error } = await supabase
      .from('submissions')
      .select('campaign_id, title, metadata_uri')
      .not('campaign_id', 'is', null)
      .order('campaign_id')
    
    if (error) {
      console.error('Supabase error:', error)
      return
    }
    
    console.log('\n📋 CAMPAIGNS TO FIX:')
    console.log('-'.repeat(70))
    
    const toFix = []
    for (const sub of submissions) {
      if (BROKEN_CAMPAIGNS.includes(sub.campaign_id) && sub.metadata_uri) {
        console.log(`Campaign ${sub.campaign_id}: ${sub.title?.slice(0, 30)}...`)
        console.log(`   URI: ${sub.metadata_uri}`)
        toFix.push({ campaignId: sub.campaign_id, uri: sub.metadata_uri, title: sub.title })
      }
    }
    
    console.log('\n' + '='.repeat(70))
    console.log('MANUAL FIX INSTRUCTIONS (Hardhat Console):')
    console.log('='.repeat(70))
    console.log('')
    console.log('1. Open Hardhat console: npx hardhat console --network blockdag')
    console.log('2. Run these commands:')
    console.log('')
    console.log('const contract = await ethers.getContractAt("PatriotPledgeNFTV5", "' + CONTRACT_ADDRESS + '")')
    console.log('')
    
    for (const { campaignId, uri } of toFix) {
      console.log(`await contract.updateCampaignMetadata(${campaignId}, "${uri}")`)
    }
    
    console.log('')
    console.log('Or use this single batch call from a script with signer.')
    return
  }
  
  // Create signer
  const wallet = new ethers.Wallet(privateKey, provider)
  const signerAddress = wallet.address
  
  console.log(`Signer Address: ${signerAddress}`)
  
  if (signerAddress.toLowerCase() !== owner.toLowerCase()) {
    console.log('\n❌ Signer is not the contract owner!')
    console.log(`   Owner: ${owner}`)
    console.log(`   Signer: ${signerAddress}`)
    return
  }
  
  console.log('✅ Signer is contract owner')
  
  // Get URIs from Supabase
  const { data: submissions, error } = await supabase
    .from('submissions')
    .select('campaign_id, title, metadata_uri')
    .not('campaign_id', 'is', null)
    .order('campaign_id')
  
  if (error) {
    console.error('Supabase error:', error)
    return
  }
  
  const contractWithSigner = contract.connect(wallet)
  
  console.log('\n📝 Processing campaigns...')
  console.log('-'.repeat(70))
  
  let fixed = 0
  let failed = 0
  
  for (const sub of submissions) {
    if (!BROKEN_CAMPAIGNS.includes(sub.campaign_id)) continue
    if (!sub.metadata_uri) {
      console.log(`Campaign ${sub.campaign_id}: No metadata_uri in Supabase - SKIPPING`)
      continue
    }
    
    console.log(`\nCampaign ${sub.campaign_id}: ${sub.title?.slice(0, 40)}`)
    console.log(`   URI: ${sub.metadata_uri.slice(0, 50)}...`)
    
    try {
      const tx = await contractWithSigner.updateCampaignMetadata(sub.campaign_id, sub.metadata_uri)
      console.log(`   Tx: ${tx.hash}`)
      const receipt = await tx.wait()
      console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`)
      fixed++
      
      // Wait a bit to avoid nonce issues
      await new Promise(r => setTimeout(r, 2000))
      
    } catch (e) {
      console.log(`   ❌ Failed: ${e.message.slice(0, 60)}`)
      failed++
    }
  }
  
  console.log('\n' + '='.repeat(70))
  console.log('SUMMARY')
  console.log('='.repeat(70))
  console.log(`Fixed: ${fixed}`)
  console.log(`Failed: ${failed}`)
  console.log('')
  console.log('After fixing, MetaMask may take a few minutes to refresh metadata.')
  console.log('Users may need to remove and re-import their NFTs to see updates.')
}

main().catch(console.error)
