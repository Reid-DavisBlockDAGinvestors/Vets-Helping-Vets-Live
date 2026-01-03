/**
 * Enable immediate payout for Ethereum Mainnet campaign #0
 * 
 * This script calls setCampaignImmediatePayout(0, true) on the V8 Mainnet contract
 * to enable automatic fund distribution to submitter on each NFT mint.
 * 
 * Contract: 0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e (Ethereum Mainnet)
 * Campaign: #0 - "A Mother's Fight to Keep Her Family"
 * 
 * Run with: npx ts-node scripts/enable-mainnet-immediate-payout.ts
 */

import { ethers } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

// V8 Contract ABI - only the functions we need
const V8_ABI = [
  'function setCampaignImmediatePayout(uint256 campaignId, bool enabled) external',
  'function getCampaign(uint256 campaignId) external view returns (tuple(string category, string baseURI, uint256 goalNative, uint256 goalUsd, uint256 maxEditions, uint256 mintedCount, uint256 pricePerEditionNative, uint256 pricePerEditionUsd, uint256 totalRaised, uint256 netRaised, address nonprofit, address submitter, bool active, bool closed, bool refunded, bool paused, bool immediatePayoutEnabled))',
  'function owner() external view returns (address)',
  'event CampaignUpdated(uint256 indexed campaignId, string field)'
]

// Configuration
const CONFIG = {
  chainId: 1,
  contractAddress: '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e',
  campaignId: 0,
  rpcUrl: process.env.ETHEREUM_RPC || 'https://eth.llamarpc.com',
  privateKey: process.env.ETH_MAINNET_KEY
}

async function main() {
  console.log('🔧 Enable Immediate Payout for Mainnet Campaign #0')
  console.log('=' .repeat(60))
  
  // Validate environment
  if (!CONFIG.privateKey) {
    console.error('❌ ETH_MAINNET_KEY not set in environment')
    process.exit(1)
  }

  // Connect to Ethereum Mainnet
  console.log('\n📡 Connecting to Ethereum Mainnet...')
  const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl)
  const network = await provider.getNetwork()
  console.log(`   Network: ${network.name} (Chain ID: ${network.chainId})`)
  
  if (Number(network.chainId) !== CONFIG.chainId) {
    console.error(`❌ Wrong network! Expected chain ${CONFIG.chainId}, got ${network.chainId}`)
    process.exit(1)
  }

  // Create signer
  const signer = new ethers.Wallet(CONFIG.privateKey, provider)
  console.log(`   Signer: ${signer.address}`)
  
  // Check signer balance
  const balance = await provider.getBalance(signer.address)
  console.log(`   Balance: ${ethers.formatEther(balance)} ETH`)
  
  if (balance === 0n) {
    console.error('❌ Signer has no ETH for gas!')
    process.exit(1)
  }

  // Connect to contract
  console.log(`\n📜 Contract: ${CONFIG.contractAddress}`)
  const contract = new ethers.Contract(CONFIG.contractAddress, V8_ABI, signer)
  
  // Verify ownership
  const owner = await contract.owner()
  console.log(`   Owner: ${owner}`)
  
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error(`❌ Signer is not contract owner!`)
    console.error(`   Expected: ${owner}`)
    console.error(`   Got: ${signer.address}`)
    process.exit(1)
  }
  console.log('   ✅ Signer is contract owner')

  // Get current campaign state
  console.log(`\n📊 Campaign #${CONFIG.campaignId} current state:`)
  const campaign = await contract.getCampaign(CONFIG.campaignId)
  
  console.log(`   Category: ${campaign.category}`)
  console.log(`   Goal: ${ethers.formatEther(campaign.goalNative)} ETH ($${Number(campaign.goalUsd) / 100})`)
  console.log(`   Minted: ${campaign.mintedCount}/${campaign.maxEditions}`)
  console.log(`   Total Raised: ${ethers.formatEther(campaign.totalRaised)} ETH`)
  console.log(`   Net Raised: ${ethers.formatEther(campaign.netRaised)} ETH`)
  console.log(`   Submitter: ${campaign.submitter}`)
  console.log(`   Active: ${campaign.active}`)
  console.log(`   Closed: ${campaign.closed}`)
  console.log(`   Immediate Payout Enabled: ${campaign.immediatePayoutEnabled}`)

  if (campaign.immediatePayoutEnabled) {
    console.log('\n✅ Immediate payout is ALREADY ENABLED!')
    console.log('   No action needed.')
    process.exit(0)
  }

  if (campaign.closed) {
    console.error('\n❌ Campaign is closed - cannot enable immediate payout')
    process.exit(1)
  }

  // Enable immediate payout
  console.log('\n🚀 Enabling immediate payout...')
  
  // Estimate gas
  const gasEstimate = await contract.setCampaignImmediatePayout.estimateGas(CONFIG.campaignId, true)
  console.log(`   Estimated gas: ${gasEstimate}`)
  
  // Get current gas price
  const feeData = await provider.getFeeData()
  console.log(`   Gas price: ${ethers.formatUnits(feeData.gasPrice || 0n, 'gwei')} gwei`)
  
  const estimatedCost = gasEstimate * (feeData.gasPrice || 0n)
  console.log(`   Estimated cost: ${ethers.formatEther(estimatedCost)} ETH`)

  // Confirm before proceeding (on mainnet!)
  console.log('\n⚠️  WARNING: This is ETHEREUM MAINNET - real money!')
  console.log('   Press Ctrl+C within 5 seconds to cancel...')
  await new Promise(resolve => setTimeout(resolve, 5000))

  // Send transaction
  console.log('\n📤 Sending transaction...')
  const tx = await contract.setCampaignImmediatePayout(CONFIG.campaignId, true)
  console.log(`   Tx Hash: ${tx.hash}`)
  console.log(`   Etherscan: https://etherscan.io/tx/${tx.hash}`)

  // Wait for confirmation
  console.log('\n⏳ Waiting for confirmation...')
  const receipt = await tx.wait()
  
  if (receipt.status === 1) {
    console.log(`\n✅ SUCCESS! Transaction confirmed in block ${receipt.blockNumber}`)
    console.log(`   Gas used: ${receipt.gasUsed}`)
    
    // Verify the change
    const updatedCampaign = await contract.getCampaign(CONFIG.campaignId)
    console.log(`\n📊 Updated campaign state:`)
    console.log(`   Immediate Payout Enabled: ${updatedCampaign.immediatePayoutEnabled}`)
    
    if (updatedCampaign.immediatePayoutEnabled) {
      console.log('\n🎉 IMMEDIATE PAYOUT IS NOW ENABLED!')
      console.log('   Future NFT purchases will automatically distribute funds to the submitter.')
    }
  } else {
    console.error('\n❌ Transaction failed!')
    process.exit(1)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message || error)
    process.exit(1)
  })
