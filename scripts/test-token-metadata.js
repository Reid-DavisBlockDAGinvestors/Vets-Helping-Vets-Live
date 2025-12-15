#!/usr/bin/env node
/**
 * Test Token Metadata - Diagnose missing metadata issues
 */
require('dotenv').config({ path: '.env.local' })
const { ethers } = require('ethers')

const CONTRACT_ADDRESS = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const TOKEN_ID = 140

const ABI = [
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function getEditionInfo(uint256 tokenId) view returns (uint256 campaignId, uint256 editionNumber)',
  'function getCampaign(uint256 campaignId) view returns (tuple(string category, string metadataURI, uint256 goal, uint256 raised, uint256 maxEditions, uint256 editionsMinted, uint256 pricePerEdition, uint256 feeRateBps, address creator, bool active))',
  'function totalCampaigns() view returns (uint256)',
  'function campaigns(uint256) view returns (string category, string metadataURI, uint256 goal, uint256 raised, uint256 maxEditions, uint256 editionsMinted, uint256 pricePerEdition, uint256 feeRateBps, address creator, bool active)'
]

async function main() {
  console.log('🔍 TOKEN METADATA DIAGNOSIS')
  console.log('='.repeat(60))
  console.log(`Contract: ${CONTRACT_ADDRESS}`)
  console.log(`Token ID: ${TOKEN_ID}`)
  
  const rpcUrl = process.env.BLOCKDAG_RPC || 'https://rpc.awakening.bdagscan.com'
  const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true })
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider)
  
  // 1. Check if token exists
  console.log('\n1️⃣ Token Existence:')
  try {
    const owner = await contract.ownerOf(TOKEN_ID)
    console.log(`   ✅ Token exists, owner: ${owner}`)
  } catch (e) {
    console.log(`   ❌ Token does not exist or error: ${e.message}`)
    return
  }
  
  // 2. Get tokenURI
  console.log('\n2️⃣ Token URI:')
  try {
    const uri = await contract.tokenURI(TOKEN_ID)
    console.log(`   URI: ${uri}`)
    
    if (!uri || uri === '') {
      console.log(`   ❌ Token URI is EMPTY - this is the problem!`)
    } else if (uri.startsWith('ipfs://')) {
      const httpUrl = `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`
      console.log(`   HTTP URL: ${httpUrl}`)
      
      // Try to fetch the metadata
      console.log('\n3️⃣ Fetching Metadata:')
      try {
        const response = await fetch(httpUrl)
        if (response.ok) {
          const metadata = await response.json()
          console.log(`   ✅ Metadata fetched successfully:`)
          console.log(`   Name: ${metadata.name}`)
          console.log(`   Description: ${metadata.description?.slice(0, 100)}...`)
          console.log(`   Image: ${metadata.image}`)
          if (metadata.image?.startsWith('ipfs://')) {
            const imgHttp = `https://gateway.pinata.cloud/ipfs/${metadata.image.slice(7)}`
            console.log(`   Image HTTP: ${imgHttp}`)
          }
        } else {
          console.log(`   ❌ Failed to fetch metadata: ${response.status}`)
        }
      } catch (e) {
        console.log(`   ❌ Fetch error: ${e.message}`)
      }
    } else {
      console.log(`   URI is HTTP: ${uri}`)
    }
  } catch (e) {
    console.log(`   ❌ Error getting tokenURI: ${e.message}`)
  }
  
  // 4. Get edition info
  console.log('\n4️⃣ Edition Info:')
  try {
    const [campaignId, editionNumber] = await contract.getEditionInfo(TOKEN_ID)
    console.log(`   Campaign ID: ${campaignId}`)
    console.log(`   Edition Number: ${editionNumber}`)
    
    // 5. Get campaign metadata
    console.log('\n5️⃣ Campaign Info:')
    try {
      const campaign = await contract.getCampaign(campaignId)
      console.log(`   Category: ${campaign.category}`)
      console.log(`   Metadata URI: ${campaign.metadataURI}`)
      console.log(`   Goal: ${ethers.formatEther(campaign.goal)} BDAG`)
      console.log(`   Raised: ${ethers.formatEther(campaign.raised)} BDAG`)
      console.log(`   Max Editions: ${campaign.maxEditions}`)
      console.log(`   Editions Minted: ${campaign.editionsMinted}`)
      console.log(`   Price Per Edition: ${ethers.formatEther(campaign.pricePerEdition)} BDAG`)
      console.log(`   Creator: ${campaign.creator}`)
      console.log(`   Active: ${campaign.active}`)
      
      if (!campaign.metadataURI || campaign.metadataURI === '') {
        console.log(`\n   ❌ PROBLEM: Campaign has NO metadata URI!`)
      }
    } catch (e) {
      console.log(`   ❌ Error getting campaign: ${e.message}`)
    }
  } catch (e) {
    console.log(`   ❌ Error getting edition info: ${e.message}`)
  }
  
  // 6. Compare with a working token
  console.log('\n6️⃣ Comparing with working tokens:')
  const workingTokenIds = [1, 2, 3, 4, 5]
  for (const tid of workingTokenIds) {
    try {
      const uri = await contract.tokenURI(tid)
      console.log(`   Token ${tid}: ${uri ? uri.slice(0, 50) + '...' : 'EMPTY'}`)
    } catch (e) {
      console.log(`   Token ${tid}: Error - ${e.message.slice(0, 30)}`)
    }
  }
  
  console.log('\n' + '='.repeat(60))
}

main().catch(console.error)
