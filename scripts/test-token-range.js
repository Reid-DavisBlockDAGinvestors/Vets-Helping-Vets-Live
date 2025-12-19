#!/usr/bin/env node
/**
 * Test Token Range - Find what tokens actually exist
 */
require('dotenv').config({ path: '.env.local' })
const { ethers } = require('ethers')

const CONTRACT_ADDRESS = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'

const ABI = [
  'function totalSupply() view returns (uint256)',
  'function tokenByIndex(uint256 index) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)'
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
  console.log('🔍 TOKEN RANGE INVESTIGATION')
  console.log('='.repeat(60))
  
  const provider = getProvider()
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider)
  
  const totalSupply = await contract.totalSupply()
  console.log(`Total Supply: ${totalSupply}\n`)
  
  // Check last 10 tokens by index
  console.log('Last 10 tokens by enumeration index:')
  const startIdx = Math.max(0, Number(totalSupply) - 10)
  for (let i = startIdx; i < Number(totalSupply); i++) {
    try {
      const tokenId = await contract.tokenByIndex(i)
      const owner = await contract.ownerOf(tokenId)
      console.log(`  Index ${i} => Token ID ${tokenId} (owner: ${owner.slice(0,10)}...)`)
    } catch (e) {
      console.log(`  Index ${i} => Error: ${e.message.slice(0, 50)}`)
    }
  }
  
  // Directly check tokens 250-260
  console.log('\nDirect check of tokens 250-260:')
  for (let tid = 250; tid <= 260; tid++) {
    try {
      const owner = await contract.ownerOf(tid)
      const uri = await contract.tokenURI(tid)
      const hasUri = uri && uri.length > 0 ? '✅' : '❌'
      console.log(`  Token ${tid}: exists ${hasUri} (owner: ${owner.slice(0,10)}...)`)
    } catch (e) {
      console.log(`  Token ${tid}: ❌ does not exist`)
    }
  }
  
  // Check the very first and last tokens
  console.log('\nFirst and last tokens:')
  try {
    const firstToken = await contract.tokenByIndex(0)
    console.log(`  First token (index 0): ${firstToken}`)
  } catch (e) {
    console.log(`  First token error: ${e.message.slice(0, 50)}`)
  }
  
  try {
    const lastToken = await contract.tokenByIndex(Number(totalSupply) - 1)
    console.log(`  Last token (index ${Number(totalSupply) - 1}): ${lastToken}`)
  } catch (e) {
    console.log(`  Last token error: ${e.message.slice(0, 50)}`)
  }
}

main().catch(console.error)
