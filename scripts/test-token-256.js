#!/usr/bin/env node
/**
 * Test Token 256 - Diagnose missing metadata and dashboard display issues
 */
require('dotenv').config({ path: '.env.local' })
const { ethers } = require('ethers')

const CONTRACT_ADDRESS = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const TOKEN_ID = 256

const ABI = [
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function getEditionInfo(uint256 tokenId) view returns (uint256 campaignId, uint256 editionNumber, uint256 totalEditions)',
  'function getCampaign(uint256 campaignId) view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function tokenToCampaign(uint256 tokenId) view returns (uint256)',
  'function tokenEditionNumber(uint256 tokenId) view returns (uint256)'
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
  console.log('🔍 TOKEN 256 DIAGNOSIS')
  console.log('='.repeat(60))
  console.log(`Contract: ${CONTRACT_ADDRESS}`)
  console.log(`Token ID: ${TOKEN_ID}`)
  console.log(`RPC: ${process.env.BLOCKDAG_RPC || 'fallback'}`)
  
  const provider = getProvider()
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider)
  
  // 1. Check total supply
  console.log('\n1️⃣ Contract Stats:')
  try {
    const totalSupply = await contract.totalSupply()
    console.log(`   Total Supply: ${totalSupply}`)
    if (Number(totalSupply) < TOKEN_ID) {
      console.log(`   ❌ Token ${TOKEN_ID} is beyond total supply!`)
    }
  } catch (e) {
    console.log(`   ❌ Error: ${e.message}`)
  }
  
  // 2. Check if token exists
  console.log('\n2️⃣ Token Existence:')
  let owner = null
  try {
    owner = await contract.ownerOf(TOKEN_ID)
    console.log(`   ✅ Token exists`)
    console.log(`   Owner: ${owner}`)
  } catch (e) {
    console.log(`   ❌ Token does not exist: ${e.message}`)
    return
  }
  
  // 3. Get tokenURI
  console.log('\n3️⃣ Token URI:')
  let tokenUri = null
  try {
    tokenUri = await contract.tokenURI(TOKEN_ID)
    console.log(`   Raw URI: "${tokenUri}"`)
    
    if (!tokenUri || tokenUri === '') {
      console.log(`   ❌ TOKEN URI IS EMPTY - THIS IS THE ROOT CAUSE!`)
    } else if (tokenUri.startsWith('ipfs://')) {
      const httpUrl = `https://gateway.pinata.cloud/ipfs/${tokenUri.slice(7)}`
      console.log(`   HTTP URL: ${httpUrl}`)
      
      // Try to fetch the metadata
      console.log('\n   Fetching metadata...')
      try {
        const response = await fetch(httpUrl, { 
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000)
        })
        if (response.ok) {
          const metadata = await response.json()
          console.log(`   ✅ Metadata fetched successfully:`)
          console.log(`      Name: ${metadata.name}`)
          console.log(`      Description: ${(metadata.description || '').slice(0, 80)}...`)
          console.log(`      Image: ${metadata.image}`)
        } else {
          console.log(`   ❌ HTTP ${response.status}: ${response.statusText}`)
        }
      } catch (e) {
        console.log(`   ❌ Fetch error: ${e.message}`)
      }
    } else {
      console.log(`   URI is HTTP/other: ${tokenUri}`)
    }
  } catch (e) {
    console.log(`   ❌ Error getting tokenURI: ${e.message}`)
  }
  
  // 4. Get edition info
  console.log('\n4️⃣ Edition Info:')
  let campaignId = null
  try {
    const editionInfo = await contract.getEditionInfo(TOKEN_ID)
    campaignId = Number(editionInfo[0] ?? editionInfo.campaignId)
    const editionNumber = Number(editionInfo[1] ?? editionInfo.editionNumber)
    const totalEditions = Number(editionInfo[2] ?? editionInfo.totalEditions)
    console.log(`   Campaign ID: ${campaignId}`)
    console.log(`   Edition Number: ${editionNumber}`)
    console.log(`   Total Editions: ${totalEditions}`)
  } catch (e) {
    console.log(`   ❌ Error: ${e.message}`)
    // Try alternate methods
    try {
      campaignId = Number(await contract.tokenToCampaign(TOKEN_ID))
      const editionNum = Number(await contract.tokenEditionNumber(TOKEN_ID))
      console.log(`   (via alternate) Campaign ID: ${campaignId}`)
      console.log(`   (via alternate) Edition Number: ${editionNum}`)
    } catch (e2) {
      console.log(`   ❌ Alternate method also failed: ${e2.message}`)
    }
  }
  
  // 5. Get campaign info
  if (campaignId != null) {
    console.log('\n5️⃣ Campaign Info:')
    try {
      const camp = await contract.getCampaign(campaignId)
      console.log(`   Category: ${camp[0] ?? camp.category}`)
      console.log(`   Base URI: "${camp[1] ?? camp.baseURI}"`)
      console.log(`   Goal: ${ethers.formatEther(camp[2] ?? camp.goal)} BDAG`)
      console.log(`   Gross Raised: ${ethers.formatEther(camp[3] ?? camp.grossRaised)} BDAG`)
      console.log(`   Editions Minted: ${camp[5] ?? camp.editionsMinted}`)
      console.log(`   Max Editions: ${camp[6] ?? camp.maxEditions}`)
      console.log(`   Active: ${camp[8] ?? camp.active}`)
      console.log(`   Closed: ${camp[9] ?? camp.closed}`)
      
      const baseURI = camp[1] ?? camp.baseURI
      if (!baseURI || baseURI === '') {
        console.log(`\n   ❌ CAMPAIGN HAS NO BASE URI - METADATA WILL BE EMPTY!`)
      }
    } catch (e) {
      console.log(`   ❌ Error: ${e.message}`)
    }
  }
  
  // 6. Check wallet ownership enumeration
  if (owner) {
    console.log('\n6️⃣ Wallet Enumeration Check:')
    try {
      const balance = await contract.balanceOf(owner)
      console.log(`   Wallet balance: ${balance} NFTs`)
      
      // Check if token 256 appears in enumeration
      let foundInEnum = false
      for (let i = 0; i < Math.min(Number(balance), 50); i++) {
        const tid = await contract.tokenOfOwnerByIndex(owner, i)
        if (Number(tid) === TOKEN_ID) {
          foundInEnum = true
          console.log(`   ✅ Token ${TOKEN_ID} found at index ${i}`)
          break
        }
      }
      if (!foundInEnum && Number(balance) <= 50) {
        console.log(`   ❌ Token ${TOKEN_ID} NOT FOUND in wallet enumeration!`)
      }
    } catch (e) {
      console.log(`   ❌ Error: ${e.message}`)
    }
  }
  
  // 7. Compare with a known working token
  console.log('\n7️⃣ Compare with recent tokens:')
  const tokensToCheck = [254, 255, 256, 257, 258]
  for (const tid of tokensToCheck) {
    try {
      const uri = await contract.tokenURI(tid)
      const status = uri && uri !== '' ? '✅' : '❌'
      console.log(`   Token ${tid}: ${status} URI=${uri ? uri.slice(0, 50) + '...' : 'EMPTY'}`)
    } catch (e) {
      console.log(`   Token ${tid}: ⚠️ Error - ${e.message.slice(0, 40)}`)
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY:')
  if (!tokenUri || tokenUri === '') {
    console.log('❌ ROOT CAUSE: Token has no URI stored on-chain')
    console.log('   This means either:')
    console.log('   1. Campaign was created without a baseURI')
    console.log('   2. Token was minted but URI was not set')
    console.log('   FIX: Update campaign metadata via updateCampaignMetadata()')
  }
}

main().catch(console.error)
