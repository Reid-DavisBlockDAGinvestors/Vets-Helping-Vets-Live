#!/usr/bin/env node
/**
 * Audit all tokens - find which ones have valid URIs and which are broken
 */
require('dotenv').config({ path: '.env.local' })
const { ethers } = require('ethers')

const CONTRACT_ADDRESS = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'

const ABI = [
  'function totalSupply() view returns (uint256)',
  'function tokenByIndex(uint256 index) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenToCampaign(uint256 tokenId) view returns (uint256)'
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
  console.log('📊 TOKEN AUDIT')
  console.log('='.repeat(70))
  
  const provider = getProvider()
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider)
  
  const totalSupply = await contract.totalSupply()
  console.log(`Total Supply: ${totalSupply}`)
  console.log('')
  
  const tokensWithURI = []
  const tokensWithoutURI = []
  const nonExistentTokens = []
  
  // Check tokens 0-260
  console.log('Checking tokens 0-260...')
  console.log('')
  
  for (let tid = 0; tid <= 260; tid++) {
    try {
      // Check if token exists
      const owner = await contract.ownerOf(tid)
      
      // Get URI
      let uri = ''
      try {
        uri = await contract.tokenURI(tid)
      } catch {}
      
      // Get campaign
      let campaign = 0
      try {
        campaign = await contract.tokenToCampaign(tid)
      } catch {}
      
      if (uri && uri.length > 0) {
        tokensWithURI.push({ tid, campaign: Number(campaign), owner: owner.slice(0, 10) })
      } else {
        tokensWithoutURI.push({ tid, campaign: Number(campaign), owner: owner.slice(0, 10) })
      }
    } catch (e) {
      nonExistentTokens.push(tid)
    }
    
    // Progress indicator
    if (tid % 50 === 0) {
      process.stdout.write(`  ${tid}...`)
    }
  }
  
  console.log('\n')
  
  // Report
  console.log('='.repeat(70))
  console.log(`TOKENS WITH VALID URI: ${tokensWithURI.length}`)
  console.log('-'.repeat(70))
  tokensWithURI.slice(-10).forEach(t => {
    console.log(`  Token ${t.tid}: Campaign ${t.campaign} | Owner: ${t.owner}...`)
  })
  if (tokensWithURI.length > 10) {
    console.log(`  ... and ${tokensWithURI.length - 10} more`)
  }
  
  console.log('')
  console.log('='.repeat(70))
  console.log(`TOKENS WITH EMPTY URI (BROKEN): ${tokensWithoutURI.length}`)
  console.log('-'.repeat(70))
  tokensWithoutURI.forEach(t => {
    console.log(`  Token ${t.tid}: Campaign ${t.campaign} | Owner: ${t.owner}...`)
  })
  
  console.log('')
  console.log('='.repeat(70))
  console.log(`NON-EXISTENT TOKEN IDS: ${nonExistentTokens.length}`)
  console.log('-'.repeat(70))
  
  // Group consecutive non-existent tokens
  if (nonExistentTokens.length > 0) {
    let start = nonExistentTokens[0]
    let end = nonExistentTokens[0]
    const ranges = []
    
    for (let i = 1; i < nonExistentTokens.length; i++) {
      if (nonExistentTokens[i] === end + 1) {
        end = nonExistentTokens[i]
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`)
        start = nonExistentTokens[i]
        end = nonExistentTokens[i]
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`)
    
    console.log(`  ${ranges.slice(0, 20).join(', ')}${ranges.length > 20 ? '...' : ''}`)
  }
  
  console.log('')
  console.log('='.repeat(70))
  console.log('SUMMARY')
  console.log('='.repeat(70))
  console.log(`Total tokens checked: 261 (0-260)`)
  console.log(`Tokens with valid URI: ${tokensWithURI.length}`)
  console.log(`Tokens with empty URI: ${tokensWithoutURI.length}`)
  console.log(`Non-existent tokens: ${nonExistentTokens.length}`)
  
  if (tokensWithoutURI.length > 0) {
    console.log('')
    console.log('⚠️  Broken tokens need updateCampaignMetadata() to be called')
    
    // Group by campaign
    const byCampaign = {}
    tokensWithoutURI.forEach(t => {
      if (!byCampaign[t.campaign]) byCampaign[t.campaign] = []
      byCampaign[t.campaign].push(t.tid)
    })
    
    console.log('')
    console.log('Broken tokens by campaign:')
    Object.entries(byCampaign).forEach(([cid, tids]) => {
      console.log(`  Campaign ${cid}: ${tids.join(', ')}`)
    })
  }
}

main().catch(console.error)
