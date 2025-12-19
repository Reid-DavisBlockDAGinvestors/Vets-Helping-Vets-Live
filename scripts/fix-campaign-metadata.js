#!/usr/bin/env node
/**
 * Fix Campaign Metadata - Update all edition token URIs for campaigns with empty tokenURIs
 * 
 * This script calls updateCampaignMetadata() on the contract to fix tokens
 * that were minted without proper tokenURI being set.
 * 
 * Usage: node scripts/fix-campaign-metadata.js [campaignId]
 * Example: node scripts/fix-campaign-metadata.js 38
 */
require('dotenv').config({ path: '.env.local' })
const { ethers } = require('ethers')

const CONTRACT_ADDRESS = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'

const ABI = [
  'function updateCampaignMetadata(uint256 campaignId, string calldata newBaseURI) external',
  'function getCampaign(uint256 campaignId) view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function owner() view returns (address)'
]

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
  const campaignId = process.argv[2] ? parseInt(process.argv[2]) : 38
  
  console.log('🔧 FIX CAMPAIGN METADATA')
  console.log('='.repeat(60))
  console.log(`Campaign ID: ${campaignId}`)
  console.log('')
  
  const provider = getProvider()
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider)
  
  // Check contract owner
  const owner = await contract.owner()
  console.log(`Contract Owner: ${owner}`)
  
  // Get campaign info
  const camp = await contract.getCampaign(campaignId)
  console.log(`\nCampaign Info:`)
  console.log(`  Category: ${camp[0]}`)
  console.log(`  BaseURI: ${camp[1] || 'EMPTY'}`)
  console.log(`  Editions Minted: ${camp[5]}`)
  console.log(`  Active: ${camp[8]}`)
  
  if (!camp[1]) {
    console.log('\n❌ Campaign has no baseURI set!')
    console.log('   First, set the baseURI in Supabase and sync to chain.')
    return
  }
  
  // Check if we have the owner's private key
  const privateKey = process.env.PRIVATE_KEY
  if (!privateKey) {
    console.log('\n⚠️  PRIVATE_KEY not set in environment.')
    console.log('   To fix the metadata, you need to run this with the contract owner\'s private key.')
    console.log('')
    console.log('   Manual fix via Hardhat console:')
    console.log(`   const contract = await ethers.getContractAt("PatriotPledgeNFTV5", "${CONTRACT_ADDRESS}")`)
    console.log(`   await contract.updateCampaignMetadata(${campaignId}, "${camp[1]}")`)
    return
  }
  
  // Create signer
  const wallet = new ethers.Wallet(privateKey, provider)
  const signerAddress = wallet.address
  
  console.log(`\nSigner Address: ${signerAddress}`)
  
  if (signerAddress.toLowerCase() !== owner.toLowerCase()) {
    console.log('\n❌ Signer is not the contract owner!')
    console.log(`   Owner: ${owner}`)
    console.log(`   Signer: ${signerAddress}`)
    return
  }
  
  console.log('✅ Signer is contract owner')
  
  // Prepare transaction
  const contractWithSigner = contract.connect(wallet)
  
  console.log(`\n📝 Calling updateCampaignMetadata(${campaignId}, "${camp[1].slice(0, 40)}...")`)
  console.log('   This will update all edition token URIs...')
  
  try {
    const tx = await contractWithSigner.updateCampaignMetadata(campaignId, camp[1])
    console.log(`\n📤 Transaction sent: ${tx.hash}`)
    console.log('   Waiting for confirmation...')
    
    const receipt = await tx.wait()
    console.log(`\n✅ Transaction confirmed in block ${receipt.blockNumber}`)
    console.log(`   Gas used: ${receipt.gasUsed}`)
    
    console.log('\n🎉 Campaign metadata updated successfully!')
    console.log('   All edition token URIs should now be set.')
    console.log('   MetaMask may take a few minutes to refresh the metadata.')
    
  } catch (e) {
    console.log(`\n❌ Transaction failed: ${e.message}`)
  }
}

main().catch(console.error)
