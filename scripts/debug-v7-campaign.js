/**
 * Debug V7 Campaign on Sepolia
 * Run with: node scripts/debug-v7-campaign.js
 */

require('dotenv').config({ path: '.env.local' })
const { ethers } = require('ethers')

const V7_ADDRESS = '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e'
const SEPOLIA_RPC = process.env.ETHEREUM_SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com'

const V7_ABI = [
  'function getCampaign(uint256 campaignId) external view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, address nonprofit, address submitter, bool active, bool closed, bool immediatePayoutEnabled)',
  'function totalCampaigns() external view returns (uint256)',
  'function deploymentChainId() external view returns (uint256)',
  'function paused() external view returns (bool)',
  'function owner() external view returns (address)',
  'function platformTreasury() external view returns (address)',
  'function feeConfig() external view returns (uint16 platformFeeBps, bool immediatePayout)',
]

async function main() {
  console.log('🔍 Debugging V7 Campaign on Sepolia\n')
  console.log('Contract:', V7_ADDRESS)
  console.log('RPC:', SEPOLIA_RPC)
  console.log('')

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC)
  const contract = new ethers.Contract(V7_ADDRESS, V7_ABI, provider)

  // Check chain ID
  const network = await provider.getNetwork()
  console.log('📡 Connected to chain:', network.chainId.toString())

  // Check contract state
  try {
    const deploymentChainId = await contract.deploymentChainId()
    console.log('📋 Contract deploymentChainId:', deploymentChainId.toString())
    
    if (network.chainId !== deploymentChainId) {
      console.log('⚠️  MISMATCH! Contract expects chain', deploymentChainId.toString(), 'but connected to', network.chainId.toString())
    }
  } catch (e) {
    console.log('❌ Could not read deploymentChainId:', e.message)
  }

  try {
    const paused = await contract.paused()
    console.log('⏸️  Contract paused:', paused)
  } catch (e) {
    console.log('❌ Could not read paused:', e.message)
  }

  try {
    const owner = await contract.owner()
    console.log('👤 Contract owner:', owner)
  } catch (e) {
    console.log('❌ Could not read owner:', e.message)
  }

  try {
    const platformTreasury = await contract.platformTreasury()
    console.log('🏦 Platform Treasury:', platformTreasury)
  } catch (e) {
    console.log('❌ Could not read platformTreasury:', e.message)
  }

  try {
    const feeConfig = await contract.feeConfig()
    console.log('💰 Fee config:')
    console.log('   - Platform fee:', feeConfig[0]?.toString(), 'bps')
    console.log('   - Immediate payout enabled:', feeConfig[1])
  } catch (e) {
    console.log('❌ Could not read feeConfig:', e.message)
  }

  try {
    const totalCampaigns = await contract.totalCampaigns()
    console.log('\n📊 Total campaigns:', totalCampaigns.toString())
  } catch (e) {
    console.log('❌ Could not read totalCampaigns:', e.message)
  }

  // Check campaign 0
  console.log('\n--- Campaign #0 Details ---')
  try {
    const campaign = await contract.getCampaign(0)
    console.log('Category:', campaign[0])
    console.log('BaseURI:', campaign[1])
    console.log('Goal:', ethers.formatEther(campaign[2]), 'ETH')
    console.log('Gross Raised:', ethers.formatEther(campaign[3]), 'ETH')
    console.log('Net Raised:', ethers.formatEther(campaign[4]), 'ETH')
    console.log('Editions Minted:', campaign[5].toString())
    console.log('Max Editions:', campaign[6].toString(), campaign[6] == 0n ? '(unlimited)' : '')
    console.log('Price Per Edition:', ethers.formatEther(campaign[7]), 'ETH')
    console.log('Nonprofit:', campaign[8])
    console.log('Submitter:', campaign[9])
    console.log('Active:', campaign[10])
    console.log('Closed:', campaign[11])
    console.log('Immediate Payout:', campaign[12])

    // Check if purchase should work
    console.log('\n--- Purchase Validation ---')
    if (!campaign[10]) console.log('❌ Campaign is NOT active')
    else console.log('✅ Campaign is active')
    
    if (campaign[11]) console.log('❌ Campaign is CLOSED')
    else console.log('✅ Campaign is not closed')

    const priceWei = campaign[7]
    console.log('💵 Required payment:', ethers.formatEther(priceWei), 'ETH')
    console.log('   In Wei:', priceWei.toString())

  } catch (e) {
    console.log('❌ Could not read campaign 0:', e.message)
  }
}

main().catch(console.error)
