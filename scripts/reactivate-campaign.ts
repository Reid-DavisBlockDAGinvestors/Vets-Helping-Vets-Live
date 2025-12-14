import { ethers } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || ''
const RPC_URL = process.env.BLOCKDAG_RPC || 'https://rpc.primordial.bdagscan.com'
const NOWNODES_API_KEY = process.env.NOWNODES_API_KEY || ''

const ABI = [
  'function reactivateCampaign(uint256 campaignId) external',
  'function getCampaign(uint256 campaignId) external view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)',
]

async function main() {
  const campaignId = parseInt(process.argv[2] || '16')
  
  console.log(`Reactivating campaign #${campaignId}...`)
  console.log(`Contract: ${CONTRACT_ADDRESS}`)
  console.log(`RPC: ${RPC_URL}`)
  
  // Create provider with NowNodes header if needed
  let provider: ethers.JsonRpcProvider
  if (RPC_URL.includes('nownodes')) {
    provider = new ethers.JsonRpcProvider(RPC_URL, undefined, {
      staticNetwork: true,
      batchMaxCount: 1,
    })
    // Add API key header
    provider._getConnection().setHeader('api-key', NOWNODES_API_KEY)
  } else {
    provider = new ethers.JsonRpcProvider(RPC_URL)
  }
  
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet)
  
  // Check current state
  console.log('\nCurrent campaign state:')
  try {
    const campaign = await contract.getCampaign(campaignId)
    console.log(`  Category: ${campaign[0]}`)
    console.log(`  BaseURI: ${campaign[1]}`)
    console.log(`  Goal: ${ethers.formatEther(campaign[2])} BDAG`)
    console.log(`  Gross Raised: ${ethers.formatEther(campaign[3])} BDAG`)
    console.log(`  Editions Minted: ${campaign[5].toString()}`)
    console.log(`  Max Editions: ${campaign[6].toString()}`)
    console.log(`  Price Per Edition: ${ethers.formatEther(campaign[7])} BDAG`)
    console.log(`  Active: ${campaign[8]}`)
    console.log(`  Closed: ${campaign[9]}`)
    
    if (campaign[8] === true) {
      console.log('\n✓ Campaign is already active!')
      return
    }
    
    if (campaign[9] === true) {
      console.log('\n✗ Campaign is permanently closed and cannot be reactivated')
      return
    }
  } catch (e: any) {
    console.log(`  Error fetching campaign: ${e.message}`)
  }
  
  // Reactivate
  console.log('\nSending reactivateCampaign transaction...')
  try {
    const tx = await contract.reactivateCampaign(campaignId)
    console.log(`  Tx hash: ${tx.hash}`)
    console.log('  Waiting for confirmation...')
    await tx.wait(1)
    console.log('  ✓ Transaction confirmed!')
    
    // Verify
    const campaign = await contract.getCampaign(campaignId)
    console.log(`\nNew state: active=${campaign[8]}`)
  } catch (e: any) {
    console.error(`  ✗ Error: ${e.message}`)
  }
}

main().catch(console.error)
