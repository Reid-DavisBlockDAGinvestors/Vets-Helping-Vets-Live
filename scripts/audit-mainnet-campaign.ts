/**
 * Audit script for "A Mother's Fight" campaign on Ethereum Mainnet
 * Campaign ID: 1 (first campaign on V8 Mainnet)
 */

import { ethers } from 'ethers'

const V8_MAINNET_ADDRESS = '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e'
const CAMPAIGN_ID = 1

const V8_ABI = [
  'function getCampaign(uint256 campaignId) view returns (tuple(uint256 id, string category, string baseURI, uint256 goalNative, uint256 goalUsd, uint256 grossRaised, uint256 netRaised, uint256 tipsReceived, uint256 editionsMinted, uint256 maxEditions, uint256 priceNative, uint256 priceUsd, address nonprofit, address submitter, bool active, bool paused, bool closed, bool refunded, bool immediatePayoutEnabled))',
  'function totalCampaigns() view returns (uint256)',
  'function owner() view returns (address)',
  'function campaignDistributed(uint256 campaignId) view returns (uint256)',
]

async function main() {
  // Use public RPC with longer timeout
  const provider = new ethers.JsonRpcProvider('https://ethereum-rpc.publicnode.com')
  const contract = new ethers.Contract(V8_MAINNET_ADDRESS, V8_ABI, provider)

  console.log('=== V8 MAINNET CONTRACT AUDIT ===')
  console.log(`Contract: ${V8_MAINNET_ADDRESS}`)
  console.log(`Chain: Ethereum Mainnet (1)`)
  console.log('')

  // Get contract balance
  const balance = await provider.getBalance(V8_MAINNET_ADDRESS)
  console.log(`Contract Balance: ${ethers.formatEther(balance)} ETH`)
  console.log('')

  // Get total campaigns
  const totalCampaigns = await contract.totalCampaigns()
  console.log(`Total Campaigns: ${totalCampaigns}`)

  // Get owner
  const owner = await contract.owner()
  console.log(`Contract Owner: ${owner}`)
  console.log('')

  // Loop through all campaigns
  for (let i = 1; i <= Number(totalCampaigns); i++) {
    console.log(`=== CAMPAIGN #${i} DETAILS ===`)
    try {
      const camp = await contract.getCampaign(i)
      console.log(`ID: ${camp.id}`)
      console.log(`Category: ${camp.category}`)
      console.log(`Editions Minted: ${camp.editionsMinted}`)
      console.log(`Max Editions: ${camp.maxEditions}`)
      console.log(`Gross Raised: ${ethers.formatEther(camp.grossRaised)} ETH`)
      console.log(`Net Raised: ${ethers.formatEther(camp.netRaised)} ETH`)
      console.log(`Tips: ${ethers.formatEther(camp.tipsReceived)} ETH`)
      console.log(`Price: ${ethers.formatEther(camp.priceNative)} ETH ($${Number(camp.priceUsd) / 100})`)
      console.log(`Submitter: ${camp.submitter}`)
      console.log(`Immediate Payout: ${camp.immediatePayoutEnabled}`)
      console.log(`Active: ${camp.active}, Paused: ${camp.paused}, Closed: ${camp.closed}`)
      console.log('')
    } catch (e: any) {
      console.log(`Error fetching campaign ${i}: ${e.message}`)
    }
  }

  // Get campaign details for the specified campaign
  console.log(`=== DETAILED CAMPAIGN #${CAMPAIGN_ID} ===`)
  const camp = await contract.getCampaign(CAMPAIGN_ID)
  
  console.log(`ID: ${camp.id}`)
  console.log(`Category: ${camp.category}`)
  console.log(`Base URI: ${camp.baseURI}`)
  console.log(`Goal (Native): ${ethers.formatEther(camp.goalNative)} ETH`)
  console.log(`Goal (USD): $${Number(camp.goalUsd) / 100}`)
  console.log(`Gross Raised: ${ethers.formatEther(camp.grossRaised)} ETH`)
  console.log(`Net Raised: ${ethers.formatEther(camp.netRaised)} ETH`)
  console.log(`Tips Received: ${ethers.formatEther(camp.tipsReceived)} ETH`)
  console.log(`Editions Minted: ${camp.editionsMinted}`)
  console.log(`Max Editions: ${camp.maxEditions}`)
  console.log(`Price (Native): ${ethers.formatEther(camp.priceNative)} ETH`)
  console.log(`Price (USD): $${Number(camp.priceUsd) / 100}`)
  console.log(`Nonprofit: ${camp.nonprofit}`)
  console.log(`Submitter: ${camp.submitter}`)
  console.log(`Active: ${camp.active}`)
  console.log(`Paused: ${camp.paused}`)
  console.log(`Closed: ${camp.closed}`)
  console.log(`Refunded: ${camp.refunded}`)
  console.log(`Immediate Payout: ${camp.immediatePayoutEnabled}`)
  console.log('')

  // Get distributed amount
  try {
    const distributed = await contract.campaignDistributed(CAMPAIGN_ID)
    console.log(`Already Distributed: ${ethers.formatEther(distributed)} ETH`)
  } catch (e) {
    console.log('campaignDistributed not available or no distributions yet')
  }

  // Calculate pending distribution
  const pendingDistribution = balance
  console.log('')
  console.log('=== DISTRIBUTION STATUS ===')
  console.log(`Contract Balance (available for distribution): ${ethers.formatEther(pendingDistribution)} ETH`)
  
  // USD value estimate
  const ethPrice = 3300 // approximate
  const balanceUsd = Number(ethers.formatEther(balance)) * ethPrice
  console.log(`Estimated USD Value: $${balanceUsd.toFixed(2)}`)
}

main().catch(console.error)
