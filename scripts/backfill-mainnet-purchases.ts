/**
 * Backfill Mainnet Purchase Records
 * 
 * This script syncs on-chain NFT mints with Supabase purchase records.
 * Contract shows 16 NFTs minted but only 8 recorded in Supabase.
 * 
 * Run with: npx ts-node scripts/backfill-mainnet-purchases.ts
 */

import { ethers } from 'ethers'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const CONTRACT = '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e'
const CHAIN_ID = 1
const CHAIN_NAME = 'Ethereum Mainnet'

// V8 ABI for reading on-chain data
const V8_ABI = [
  'function totalSupply() view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function tokenToCampaign(uint256 tokenId) view returns (uint256)',
  'function tokenEditionNumber(uint256 tokenId) view returns (uint256)',
  'function getCampaign(uint256 campaignId) external view returns (tuple(uint256 id, string category, string baseURI, uint256 goalNative, uint256 goalUsd, uint256 grossRaised, uint256 netRaised, uint256 tipsReceived, uint256 editionsMinted, uint256 maxEditions, uint256 priceNative, uint256 priceUsd, address nonprofit, address submitter, bool active, bool paused, bool closed, bool refunded, bool immediatePayoutEnabled))',
  'event EditionMinted(uint256 indexed campaignId, uint256 indexed tokenId, address indexed donor, uint256 editionNumber, uint256 amountPaid)'
]

async function main() {
  console.log('🔄 Backfill Mainnet Purchase Records')
  console.log('=' .repeat(60))

  // Initialize providers
  const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com')
  const contract = new ethers.Contract(CONTRACT, V8_ABI, provider)
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get total supply
  const totalSupply = await contract.totalSupply()
  console.log(`\n📊 Total NFTs on-chain: ${totalSupply}`)

  // Get existing purchase records
  const { data: existingPurchases } = await supabase
    .from('purchases')
    .select('token_id, wallet_address, tx_hash')
    .eq('chain_id', CHAIN_ID)

  const existingTokenIds = new Set(existingPurchases?.map(p => p.token_id) || [])
  console.log(`📝 Existing records in Supabase: ${existingTokenIds.size}`)

  // Get campaign data for price info
  const campaign = await contract.getCampaign(0)
  const priceUsd = Number(campaign.priceUsd) / 100 // Convert cents to dollars
  const priceNative = ethers.formatEther(campaign.priceNative)
  
  console.log(`💰 NFT Price: $${priceUsd} (${priceNative} ETH)`)

  // Check each token
  let added = 0
  let skipped = 0
  
  console.log('\n🔍 Checking tokens...')
  
  for (let tokenId = 0; tokenId < Number(totalSupply); tokenId++) {
    try {
      // Check if already recorded
      if (existingTokenIds.has(tokenId)) {
        console.log(`  Token ${tokenId}: Already recorded ✓`)
        skipped++
        continue
      }

      // Get on-chain data
      const owner = await contract.ownerOf(tokenId)
      const campaignId = await contract.tokenToCampaign(tokenId)
      const editionNumber = await contract.tokenEditionNumber(tokenId)
      
      console.log(`  Token ${tokenId}: Owner ${owner.substring(0, 10)}... - MISSING, adding...`)

      // Insert purchase record
      const { error } = await supabase.from('purchases').insert({
        wallet_address: owner.toLowerCase(),
        campaign_id: Number(campaignId),
        token_id: tokenId,
        chain_id: CHAIN_ID,
        chain_name: CHAIN_NAME,
        contract_address: CONTRACT,
        amount_native: parseFloat(priceNative),
        native_currency: 'ETH',
        amount_usd: priceUsd,
        payment_method: 'crypto_eth',
        is_testnet: false,
        quantity: 1,
        tx_hash: `backfill_token_${tokenId}`, // Placeholder - actual tx unknown
        created_at: new Date().toISOString()
      })

      if (error) {
        console.log(`    ❌ Error: ${error.message}`)
      } else {
        console.log(`    ✅ Added`)
        added++
      }

    } catch (e: any) {
      console.log(`  Token ${tokenId}: Error - ${e.message?.substring(0, 50)}`)
    }
  }

  console.log('\n' + '=' .repeat(60))
  console.log(`📊 Summary:`)
  console.log(`   Total on-chain: ${totalSupply}`)
  console.log(`   Already recorded: ${skipped}`)
  console.log(`   Added: ${added}`)
  console.log(`   Total now in Supabase: ${skipped + added}`)

  // Verify final count
  const { count } = await supabase
    .from('purchases')
    .select('*', { count: 'exact', head: true })
    .eq('chain_id', CHAIN_ID)

  console.log(`\n✅ Final Supabase count for Mainnet: ${count}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message || error)
    process.exit(1)
  })
