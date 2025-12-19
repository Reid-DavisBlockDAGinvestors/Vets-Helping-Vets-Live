#!/usr/bin/env node
/**
 * Verify metadata for recent tokens and check IPFS accessibility
 */
require('dotenv').config({ path: '.env.local' })
const { ethers } = require('ethers')

const CONTRACT_ADDRESS = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'

const ABI = [
  'function totalSupply() view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function getEditionInfo(uint256 tokenId) view returns (uint256 campaignId, uint256 editionNumber, uint256 totalEditions)',
  'function getCampaign(uint256 campaignId) view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)'
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

function ipfsToHttp(uri) {
  if (!uri) return null
  if (uri.startsWith('ipfs://')) {
    return `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`
  }
  return uri
}

async function fetchMetadata(uri) {
  if (!uri) return { error: 'No URI' }
  const httpUrl = ipfsToHttp(uri)
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(httpUrl, { 
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    })
    clearTimeout(timeout)
    if (!res.ok) return { error: `HTTP ${res.status}` }
    return await res.json()
  } catch (e) {
    return { error: e.message }
  }
}

async function main() {
  console.log('🔍 METADATA VERIFICATION')
  console.log('='.repeat(60))
  
  const provider = getProvider()
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider)
  
  const totalSupply = await contract.totalSupply()
  console.log(`Total Supply: ${totalSupply}\n`)
  
  // Check last 10 tokens
  const startToken = Math.max(1, Number(totalSupply) - 9)
  console.log(`Checking tokens ${startToken} to ${Number(totalSupply) - 1}:\n`)
  
  let hasIssues = false
  
  for (let tid = startToken; tid < Number(totalSupply); tid++) {
    try {
      const owner = await contract.ownerOf(tid)
      const uri = await contract.tokenURI(tid)
      const editionInfo = await contract.getEditionInfo(tid)
      const campaignId = Number(editionInfo[0])
      
      console.log(`Token ${tid}:`)
      console.log(`  Owner: ${owner}`)
      console.log(`  Campaign: ${campaignId}`)
      console.log(`  URI: ${uri || 'EMPTY'}`)
      
      if (!uri || uri === '') {
        console.log(`  ❌ ISSUE: Empty tokenURI!`)
        hasIssues = true
        
        // Check campaign baseURI
        const camp = await contract.getCampaign(campaignId)
        const baseURI = camp[1]
        console.log(`  Campaign baseURI: ${baseURI || 'EMPTY'}`)
      } else {
        // Try to fetch metadata
        const metadata = await fetchMetadata(uri)
        if (metadata.error) {
          console.log(`  ⚠️ Metadata fetch failed: ${metadata.error}`)
          hasIssues = true
        } else {
          console.log(`  ✅ Metadata OK: "${metadata.name?.slice(0, 40)}..."`)
          console.log(`  Image: ${metadata.image ? (metadata.image.slice(0, 50) + '...') : 'NONE'}`)
        }
      }
      console.log('')
    } catch (e) {
      console.log(`Token ${tid}: Error - ${e.message}\n`)
    }
  }
  
  console.log('='.repeat(60))
  if (hasIssues) {
    console.log('ISSUES FOUND:')
    console.log('- Some tokens have empty or inaccessible metadata')
    console.log('- This causes blank images in MetaMask and dashboard')
    console.log('')
    console.log('POTENTIAL FIXES:')
    console.log('1. Check that campaign baseURI is set when creating campaigns')
    console.log('2. Ensure IPFS uploads complete before campaign creation')
    console.log('3. Use updateCampaignMetadata() to fix existing campaigns')
  } else {
    console.log('All checked tokens have valid metadata ✅')
  }
}

main().catch(console.error)
