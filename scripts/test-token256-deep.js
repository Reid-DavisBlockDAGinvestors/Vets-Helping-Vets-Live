#!/usr/bin/env node
/**
 * Deep investigation of token 256 - why is its tokenURI empty?
 */
require('dotenv').config({ path: '.env.local' })
const { ethers } = require('ethers')

const CONTRACT_ADDRESS = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'

const ABI = [
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function tokenByIndex(uint256 index) view returns (uint256)',
  'function tokenToCampaign(uint256 tokenId) view returns (uint256)',
  'function tokenEditionNumber(uint256 tokenId) view returns (uint256)',
  'function getEditionInfo(uint256 tokenId) view returns (uint256 campaignId, uint256 editionNumber, uint256 totalEditions)',
  'function getCampaign(uint256 campaignId) view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)',
  'function totalCampaigns() view returns (uint256)'
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
  console.log('🔬 DEEP INVESTIGATION: Token 256')
  console.log('='.repeat(60))
  
  const provider = getProvider()
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider)
  
  // Get total supply
  const totalSupply = await contract.totalSupply()
  console.log(`Total Supply: ${totalSupply}`)
  console.log(`Token IDs should be 0 to ${Number(totalSupply) - 1}`)
  
  // Check token 256 ownership
  console.log('\n--- Token 256 Analysis ---')
  try {
    const owner = await contract.ownerOf(256)
    console.log(`Owner: ${owner}`)
    
    // Direct mapping lookups (not through getEditionInfo which might have issues)
    try {
      const campaignId = await contract.tokenToCampaign(256)
      console.log(`Campaign ID (direct): ${campaignId}`)
      
      if (Number(campaignId) > 0) {
        const campaign = await contract.getCampaign(campaignId)
        console.log(`Campaign baseURI: ${campaign[1] || 'EMPTY'}`)
      }
    } catch (e) {
      console.log(`tokenToCampaign error: ${e.message.slice(0, 50)}`)
    }
    
    try {
      const editionNum = await contract.tokenEditionNumber(256)
      console.log(`Edition Number (direct): ${editionNum}`)
    } catch (e) {
      console.log(`tokenEditionNumber error: ${e.message.slice(0, 50)}`)
    }
    
    // Try tokenURI again
    try {
      const uri = await contract.tokenURI(256)
      console.log(`TokenURI: ${uri || 'EMPTY'}`)
    } catch (e) {
      console.log(`TokenURI error: ${e.message.slice(0, 60)}`)
    }
    
  } catch (e) {
    console.log(`Token 256 doesn't exist: ${e.message.slice(0, 50)}`)
  }
  
  // Compare with working tokens
  console.log('\n--- Working Token Comparison ---')
  const workingTokens = [4, 5, 6, 134, 135, 255]
  
  for (const tid of workingTokens) {
    try {
      const uri = await contract.tokenURI(tid)
      const owner = await contract.ownerOf(tid)
      let campaignId = 0
      try {
        campaignId = await contract.tokenToCampaign(tid)
      } catch {}
      
      console.log(`Token ${tid}: Campaign ${campaignId} | URI: ${uri ? 'YES' : 'EMPTY'} | Owner: ${owner.slice(0,10)}...`)
    } catch (e) {
      console.log(`Token ${tid}: Error - ${e.message.slice(0, 40)}`)
    }
  }
  
  // Check recent campaigns
  console.log('\n--- Recent Campaigns ---')
  const totalCampaigns = await contract.totalCampaigns()
  console.log(`Total Campaigns: ${totalCampaigns}`)
  
  // Check last few campaigns
  for (let i = Math.max(0, Number(totalCampaigns) - 5); i < Number(totalCampaigns); i++) {
    try {
      const camp = await contract.getCampaign(i)
      console.log(`Campaign ${i}: ${camp[5]} editions | baseURI: ${camp[1] ? camp[1].slice(0, 40) + '...' : 'EMPTY'}`)
    } catch (e) {
      console.log(`Campaign ${i}: Error`)
    }
  }
  
  // Check recent tokens (250-257)
  console.log('\n--- Recent Tokens (250-257) ---')
  for (let tid = 250; tid <= 257; tid++) {
    try {
      const owner = await contract.ownerOf(tid)
      let uri = ''
      try {
        uri = await contract.tokenURI(tid)
      } catch {}
      
      let campaignId = 0
      try {
        campaignId = await contract.tokenToCampaign(tid)
      } catch {}
      
      console.log(`Token ${tid}: Campaign ${campaignId} | URI: ${uri ? 'YES (' + uri.slice(0, 25) + '...)' : 'EMPTY'} | Owner: ${owner.slice(0,10)}...`)
    } catch (e) {
      console.log(`Token ${tid}: Does not exist`)
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('DIAGNOSIS:')
  console.log('If token 256 has EMPTY tokenURI, it was minted without metadata.')
  console.log('This can happen if the campaign\'s baseURI was empty at mint time.')
  console.log('')
  console.log('FIX: Contract owner can call updateCampaignMetadata() to set')
  console.log('the baseURI, which will update all edition token URIs.')
}

main().catch(console.error)
