/**
 * Debug script to check campaign on-chain data
 * Run with: npx ts-node scripts/debug-campaign.ts <campaignId>
 */
import { ethers } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''
const RPC_URL = process.env.BLOCKDAG_RPC || 'https://bdag.nownodes.io'
const NOWNODES_API_KEY = process.env.NOWNODES_API_KEY || ''

const ABI = [
  'function getCampaign(uint256 campaignId) external view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)',
  'function totalCampaigns() external view returns (uint256)',
]

async function main() {
  const campaignId = process.argv[2] || '22'
  
  console.log('=== Campaign Debug ===')
  console.log('Contract:', CONTRACT_ADDRESS)
  console.log('RPC:', RPC_URL)
  console.log('Campaign ID:', campaignId)
  console.log('')

  // Create provider with NowNodes headers if needed
  let provider: ethers.JsonRpcProvider
  if (RPC_URL.includes('nownodes')) {
    provider = new ethers.JsonRpcProvider(RPC_URL, undefined, {
      staticNetwork: true,
    })
    // Add API key header
    provider._getConnection().setHeader('api-key', NOWNODES_API_KEY)
  } else {
    provider = new ethers.JsonRpcProvider(RPC_URL)
  }

  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider)

  try {
    const totalCampaigns = await contract.totalCampaigns()
    console.log('Total campaigns on-chain:', Number(totalCampaigns))
    
    if (Number(campaignId) >= Number(totalCampaigns)) {
      console.log(`ERROR: Campaign ${campaignId} does not exist (max: ${Number(totalCampaigns) - 1})`)
      return
    }

    const camp = await contract.getCampaign(BigInt(campaignId))
    
    console.log('')
    console.log('=== Campaign Data (Raw) ===')
    console.log('category:', camp[0])
    console.log('baseURI:', camp[1]?.slice(0, 60) + '...')
    console.log('goal (wei):', camp[2].toString())
    console.log('goal (BDAG):', ethers.formatEther(camp[2]))
    console.log('grossRaised (wei):', camp[3].toString())
    console.log('netRaised (wei):', camp[4].toString())
    console.log('editionsMinted:', Number(camp[5]))
    console.log('maxEditions:', Number(camp[6]))
    console.log('pricePerEdition (wei):', camp[7].toString())
    console.log('pricePerEdition (BDAG):', ethers.formatEther(camp[7]))
    console.log('active:', camp[8])
    console.log('closed:', camp[9])
    
    console.log('')
    console.log('=== Mint Requirements ===')
    const priceWei = camp[7]
    const priceBdag = ethers.formatEther(priceWei)
    console.log(`To mint, send at least ${priceBdag} BDAG (${priceWei.toString()} wei)`)
    
    // Check what 200 BDAG converts to
    const sent200Bdag = ethers.parseEther('200')
    console.log('')
    console.log('=== Comparison ===')
    console.log('User sending: 200 BDAG =', sent200Bdag.toString(), 'wei')
    console.log('Required:    ', priceBdag, 'BDAG =', priceWei.toString(), 'wei')
    console.log('Sufficient?', sent200Bdag >= priceWei ? 'YES' : 'NO - WILL REVERT')
    
  } catch (e: any) {
    console.error('Error:', e?.message || e)
  }
}

main()
