#!/usr/bin/env node
/**
 * Test the minting flow to verify token IDs are correctly extracted and displayed
 * This test simulates parsing the EditionMinted event from a transaction receipt
 */
require('dotenv').config({ path: '.env.local' })
const { ethers } = require('ethers')

const CONTRACT_ADDRESS = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'

const ABI = [
  'function totalSupply() view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'event EditionMinted(uint256 indexed campaignId, uint256 indexed tokenId, address indexed donor, uint256 editionNumber, uint256 amount)'
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
  console.log('🧪 MINTING FLOW TEST')
  console.log('='.repeat(60))
  
  const provider = getProvider()
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider)
  
  // Test 1: Verify total supply tracking
  console.log('\n📊 Test 1: Total Supply')
  const totalSupply = await contract.totalSupply()
  console.log(`   Total Supply: ${totalSupply}`)
  console.log(`   Token IDs range: 0 to ${Number(totalSupply) - 1}`)
  console.log(`   Next token to be minted: ${totalSupply}`)
  
  // Test 2: Event parsing simulation
  console.log('\n📊 Test 2: EditionMinted Event Parsing')
  
  // Simulate parsing an event - this is how PurchasePanel extracts the token ID
  const iface = new ethers.Interface(ABI)
  
  // Create a mock log with indexed topics
  const campaignId = 38n
  const tokenId = 255n
  const donor = '0x5A41EE2c7Fe998faA99D92626cF3336A8eC44B78'
  const editionNumber = 22n
  const amount = ethers.parseEther('200')
  
  // The event signature
  const eventSig = ethers.id('EditionMinted(uint256,uint256,address,uint256,uint256)')
  console.log(`   Event signature: ${eventSig}`)
  
  // Topics: [signature, indexed campaignId, indexed tokenId, indexed donor]
  const topics = [
    eventSig,
    ethers.zeroPadValue(ethers.toBeHex(campaignId), 32),
    ethers.zeroPadValue(ethers.toBeHex(tokenId), 32),
    ethers.zeroPadValue(donor, 32)
  ]
  
  // Data: [editionNumber, amount] - non-indexed params
  const data = ethers.AbiCoder.defaultAbiCoder().encode(
    ['uint256', 'uint256'],
    [editionNumber, amount]
  )
  
  // Parse the log
  try {
    const parsed = iface.parseLog({ topics, data })
    console.log(`   Parsed event name: ${parsed.name}`)
    console.log(`   Campaign ID: ${parsed.args[0]}`)
    console.log(`   Token ID: ${parsed.args[1]}`)
    console.log(`   Donor: ${parsed.args[2]}`)
    console.log(`   Edition Number: ${parsed.args[3]}`)
    console.log(`   Amount: ${ethers.formatEther(parsed.args[4])} BDAG`)
    
    // Verify the extraction logic matches what PurchasePanel does
    const extractedTokenId = Number(parsed.args?.tokenId || parsed.args?.[1])
    console.log(`   ✅ Extracted token ID: ${extractedTokenId}`)
    
    if (extractedTokenId !== Number(tokenId)) {
      console.log(`   ❌ Token ID mismatch! Expected ${tokenId}, got ${extractedTokenId}`)
    }
  } catch (e) {
    console.log(`   ❌ Parse error: ${e.message}`)
  }
  
  // Test 3: Check recent EditionMinted events from blockchain
  console.log('\n📊 Test 3: Recent On-Chain EditionMinted Events')
  try {
    const currentBlock = await provider.getBlockNumber()
    const fromBlock = Math.max(0, currentBlock - 5000)
    
    const filter = contract.filters.EditionMinted()
    const events = await contract.queryFilter(filter, fromBlock, currentBlock)
    
    console.log(`   Found ${events.length} EditionMinted events in blocks ${fromBlock}-${currentBlock}`)
    
    // Show last 5 events
    const lastEvents = events.slice(-5)
    for (const evt of lastEvents) {
      const args = evt.args
      console.log(`   Block ${evt.blockNumber}: Token ${args[1]} | Campaign ${args[0]} | Edition #${args[3]} | Donor: ${args[2].slice(0,10)}...`)
    }
    
    if (events.length === 0) {
      console.log('   ⚠️ No events found - might be RPC limitation or indexing issue')
    }
  } catch (e) {
    console.log(`   Error querying events: ${e.message}`)
  }
  
  // Test 4: Verify user's wallet tokens
  console.log('\n📊 Test 4: Check wallet 0x5A41EE2c (recent purchaser)')
  const walletToCheck = '0x5A41EE2c7Fe998faA99D92626cF3336A8eC44B78'
  try {
    // Check if this wallet owns any tokens
    const extendedABI = [
      ...ABI,
      'function balanceOf(address owner) view returns (uint256)',
      'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)'
    ]
    const extContract = new ethers.Contract(CONTRACT_ADDRESS, extendedABI, provider)
    
    const balance = await extContract.balanceOf(walletToCheck)
    console.log(`   Wallet ${walletToCheck.slice(0,10)}... owns ${balance} NFT(s)`)
    
    // List their tokens
    for (let i = 0; i < Math.min(Number(balance), 10); i++) {
      const tid = await extContract.tokenOfOwnerByIndex(walletToCheck, i)
      console.log(`   - Token ${tid}`)
    }
  } catch (e) {
    console.log(`   Error: ${e.message}`)
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('RECOMMENDATIONS:')
  console.log('1. Show the actual token ID to users after successful mint')
  console.log('2. Include token ID in the success message and receipt email')
  console.log('3. Add a "View Your NFT" button that links to the correct token')
}

main().catch(console.error)
