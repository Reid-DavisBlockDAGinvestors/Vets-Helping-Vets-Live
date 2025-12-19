#!/usr/bin/env node
/**
 * Investigate token 256 issue - check database and on-chain state
 */
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const { ethers } = require('ethers')

const CONTRACT_ADDRESS = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ABI = [
  'function totalSupply() view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function getEditionInfo(uint256 tokenId) view returns (uint256 campaignId, uint256 editionNumber, uint256 totalEditions)',
  'function getCampaign(uint256 campaignId) view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)',
  'event EditionMinted(uint256 indexed campaignId, uint256 indexed tokenId, address indexed buyer, uint256 editionNumber, uint256 amount)'
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
  console.log('🔍 INVESTIGATING TOKEN 256 ISSUE')
  console.log('='.repeat(60))
  
  // 1. Check Supabase for any purchase records mentioning token 256
  console.log('\n1️⃣ Checking Supabase purchases table for token 256...')
  const { data: purchases256, error: purchaseErr } = await supabase
    .from('purchases')
    .select('*')
    .eq('token_id', 256)
  
  if (purchaseErr) {
    console.log(`   Error: ${purchaseErr.message}`)
  } else if (purchases256?.length > 0) {
    console.log(`   Found ${purchases256.length} purchase record(s):`)
    for (const p of purchases256) {
      console.log(`   - ID: ${p.id}`)
      console.log(`     Wallet: ${p.wallet_address}`)
      console.log(`     Campaign: ${p.campaign_id}`)
      console.log(`     TX Hash: ${p.tx_hash}`)
      console.log(`     Amount: ${p.amount_bdag} BDAG / $${p.amount_usd}`)
      console.log(`     Created: ${p.created_at}`)
    }
  } else {
    console.log(`   No purchase records for token_id=256`)
  }
  
  // 2. Check events table
  console.log('\n2️⃣ Checking Supabase events table...')
  const { data: events256, error: eventsErr } = await supabase
    .from('events')
    .select('*')
    .or('metadata->>editionMinted.eq.256,metadata->>mintedTokenIds.cs.[256]')
    .limit(5)
  
  if (eventsErr) {
    console.log(`   Error: ${eventsErr.message}`)
  } else if (events256?.length > 0) {
    console.log(`   Found ${events256.length} event(s) mentioning token 256`)
    for (const e of events256) {
      console.log(`   - Type: ${e.event_type}, Campaign: ${e.campaign_id}, TX: ${e.tx_hash}`)
    }
  } else {
    console.log(`   No events mentioning token 256`)
  }
  
  // 3. Get recent purchases to see the pattern
  console.log('\n3️⃣ Recent purchases (last 10):')
  const { data: recentPurchases, error: recentErr } = await supabase
    .from('purchases')
    .select('id, wallet_address, campaign_id, token_id, tx_hash, created_at, amount_bdag')
    .order('created_at', { ascending: false })
    .limit(10)
  
  if (recentErr) {
    console.log(`   Error: ${recentErr.message}`)
  } else if (recentPurchases?.length > 0) {
    for (const p of recentPurchases) {
      console.log(`   Token ${p.token_id || '?'} | Campaign ${p.campaign_id} | ${p.amount_bdag} BDAG | ${p.wallet_address?.slice(0,10)}... | ${p.created_at?.slice(0,16)}`)
    }
  } else {
    console.log(`   No recent purchases`)
  }
  
  // 4. Check on-chain state for tokens 253-257
  console.log('\n4️⃣ On-chain token state (253-258):')
  const provider = getProvider()
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider)
  
  for (let tid = 253; tid <= 258; tid++) {
    try {
      const owner = await contract.ownerOf(tid)
      const uri = await contract.tokenURI(tid)
      const editionInfo = await contract.getEditionInfo(tid)
      const campaignId = Number(editionInfo[0])
      const editionNum = Number(editionInfo[1])
      console.log(`   Token ${tid}: ✅ exists | Campaign ${campaignId} | Edition #${editionNum} | Owner: ${owner.slice(0,10)}... | URI: ${uri ? 'yes' : 'empty'}`)
    } catch (e) {
      console.log(`   Token ${tid}: ❌ does not exist`)
    }
  }
  
  // 5. Check recent EditionMinted events on-chain
  console.log('\n5️⃣ Recent EditionMinted events (last 20 blocks):')
  try {
    const currentBlock = await provider.getBlockNumber()
    const fromBlock = Math.max(0, currentBlock - 1000) // Check last 1000 blocks
    
    const filter = contract.filters.EditionMinted()
    const events = await contract.queryFilter(filter, fromBlock, currentBlock)
    
    console.log(`   Found ${events.length} EditionMinted events in blocks ${fromBlock}-${currentBlock}`)
    
    // Show last 10 events
    const lastEvents = events.slice(-10)
    for (const evt of lastEvents) {
      const args = evt.args
      console.log(`   Block ${evt.blockNumber}: Campaign ${args[0]}, Token ${args[1]}, Buyer ${args[2]?.slice(0,10)}..., Edition #${args[3]}`)
    }
  } catch (e) {
    console.log(`   Error querying events: ${e.message}`)
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('DIAGNOSIS:')
  console.log('If token 256 exists in MetaMask but not on-chain, the user likely:')
  console.log('1. Manually imported a token ID that was never minted')
  console.log('2. Had a transaction that failed/reverted but MetaMask cached the expected ID')
  console.log('3. The frontend showed an incorrect token ID')
  console.log('')
  console.log('FIX: User should remove token 256 from MetaMask and re-import their actual tokens')
}

main().catch(console.error)
