/**
 * Debug script to trace through the wallet NFT API logic
 * This simulates what the API does and logs every step
 */
require('dotenv').config({ path: '.env.local' })
const { ethers } = require('ethers')
const { createClient } = require('@supabase/supabase-js')

const WALLET_ADDRESS = '0x07b3c4BB8842a9eE0698F1A3c6778bcC456d9362'
const V5_CONTRACT = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const V6_CONTRACT = '0xaE54e4E8A75a81780361570c17b8660CEaD27053'

// ABI for V5 contract
const V5_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function getEditionInfo(uint256 tokenId) view returns (uint256 campaignId, uint256 editionNumber, uint256 totalEditions)',
  'function getCampaign(uint256 campaignId) view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)'
]

async function createProvider() {
  // Use NowNodes directly - standard RPC is too inconsistent
  const rpc = 'https://bdag.nownodes.io'
  const apiKey = process.env.NOWNODES_API_KEY

  console.log('=== Step 1: Creating NowNodes provider ===')
  
  const fetchReq = new ethers.FetchRequest(rpc)
  if (apiKey) fetchReq.setHeader('api-key', apiKey)
  const provider = new ethers.JsonRpcProvider(fetchReq, null, { staticNetwork: true })
  
  const testContract = new ethers.Contract(V5_CONTRACT, ['function totalSupply() view returns (uint256)'], provider)
  const supply = await testContract.totalSupply()
  console.log('✓ NowNodes connected - V5 supply:', supply.toString())
  return provider
}

async function main() {
  // Step 1: Get provider
  const provider = await createProvider()
  
  // Step 2: Get submissions from Supabase
  console.log('\n=== Step 2: Loading Supabase submissions ===')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  
  const { data: submissions, error: subError } = await supabase
    .from('submissions')
    .select('id, title, campaign_id, token_id, status, image_uri, goal, story')
    .eq('status', 'minted')
  
  if (subError) {
    console.log('Supabase error:', subError.message)
  }
  console.log('Minted submissions loaded:', submissions?.length || 0)
  
  // Build lookup map
  const submissionByCampaignId = {}
  for (const sub of submissions || []) {
    if (sub.campaign_id != null) {
      submissionByCampaignId[String(sub.campaign_id)] = sub
    }
  }
  console.log('Campaign IDs in Supabase:', Object.keys(submissionByCampaignId).join(', '))
  
  // Step 3: Query V5 contract for wallet balance
  console.log('\n=== Step 3: Querying V5 contract ===')
  const v5 = new ethers.Contract(V5_CONTRACT, V5_ABI, provider)
  
  const balance = await v5.balanceOf(WALLET_ADDRESS)
  console.log('Wallet balance on V5:', balance.toString())
  
  // Step 4: Enumerate tokens
  console.log('\n=== Step 4: Enumerating tokens ===')
  const nfts = []
  const errors = []
  
  for (let i = 0; i < Number(balance); i++) { // Process all NFTs
    try {
      const tokenId = await v5.tokenOfOwnerByIndex(WALLET_ADDRESS, i)
      const tokenIdNum = Number(tokenId)
      
      console.log(`\nToken ${i+1}/${balance}: tokenId=${tokenIdNum}`)
      
      // Get edition info
      const editionInfo = await v5.getEditionInfo(tokenIdNum)
      const campaignId = Number(editionInfo[0])
      const editionNumber = Number(editionInfo[1])
      
      console.log(`  Campaign: ${campaignId}, Edition: ${editionNumber}`)
      
      // Check if campaign is in Supabase
      const hasSub = submissionByCampaignId[String(campaignId)] ? '✓' : '✗'
      console.log(`  In Supabase: ${hasSub}`)
      
      // Get campaign data from contract
      const camp = await v5.getCampaign(BigInt(campaignId))
      console.log(`  On-chain: category=${camp[0]}, active=${camp[8]}, closed=${camp[9]}`)
      
      nfts.push({
        tokenId: tokenIdNum,
        campaignId,
        editionNumber,
        inSupabase: !!submissionByCampaignId[String(campaignId)]
      })
    } catch (e) {
      console.log(`  ERROR at index ${i}:`, e.message?.slice(0, 100))
      errors.push({ index: i, error: e.message })
    }
  }
  
  console.log('\n=== Summary ===')
  console.log('Total NFTs processed:', nfts.length)
  console.log('Errors:', errors.length)
  console.log('Unique campaigns:', [...new Set(nfts.map(n => n.campaignId))].join(', '))
  console.log('NFTs in Supabase:', nfts.filter(n => n.inSupabase).length)
  console.log('NFTs NOT in Supabase:', nfts.filter(n => !n.inSupabase).length)
}

main().catch(console.error)
