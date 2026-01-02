/**
 * Audit Script: Check if Campaign #3 exists on-chain
 * Run with: npx ts-node scripts/audit-campaign-onchain.ts
 */

import { ethers } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const V7_CONTRACT_ADDRESS = '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e'
const SEPOLIA_CHAIN_ID = 11155111

// V7 ABI (subset needed for audit)
const V7_ABI = [
  'function totalCampaigns() view returns (uint256)',
  'function getCampaign(uint256 campaignId) view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)',
  'function campaigns(uint256 campaignId) view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 tipsReceived, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, uint256 nonprofitFeeRate, address nonprofit, address submitter, bool active, bool closed)',
]

async function main() {
  console.log('='.repeat(60))
  console.log('CAMPAIGN ON-CHAIN AUDIT - V7 Sepolia Contract')
  console.log('='.repeat(60))
  console.log(`Contract: ${V7_CONTRACT_ADDRESS}`)
  console.log(`Chain: Sepolia (${SEPOLIA_CHAIN_ID})`)
  console.log('')

  // Connect to Sepolia
  const rpcUrl = process.env.ETHEREUM_SEPOLIA_RPC || process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com'
  console.log(`RPC: ${rpcUrl}`)
  
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  
  // Verify connection
  try {
    const network = await provider.getNetwork()
    console.log(`Connected to network: ${network.name} (chainId: ${network.chainId})`)
    
    if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
      console.error(`ERROR: Expected Sepolia (${SEPOLIA_CHAIN_ID}), got ${network.chainId}`)
      process.exit(1)
    }
  } catch (err) {
    console.error('Failed to connect to Sepolia:', err)
    process.exit(1)
  }

  // Check contract
  const contract = new ethers.Contract(V7_CONTRACT_ADDRESS, V7_ABI, provider)

  console.log('')
  console.log('--- Contract Status ---')
  
  try {
    const totalCampaigns = await contract.totalCampaigns()
    console.log(`Total campaigns on-chain: ${totalCampaigns}`)

    if (Number(totalCampaigns) === 0) {
      console.log('')
      console.log('❌ NO CAMPAIGNS ON V7 CONTRACT')
      console.log('The approve flow did NOT create the campaign on-chain.')
      console.log('')
      console.log('Possible causes:')
      console.log('1. Approval used wrong contract (V6 on BlockDAG instead of V7 on Sepolia)')
      console.log('2. Transaction failed or was not confirmed')
      console.log('3. Wrong RPC/network during approval')
      return
    }

    console.log('')
    console.log('--- Campaign Details ---')
    
    for (let i = 0; i < Number(totalCampaigns); i++) {
      try {
        const campaign = await contract.getCampaign(i)
        console.log(`\nCampaign #${i}:`)
        console.log(`  Category: ${campaign[0]}`)
        console.log(`  BaseURI: ${campaign[1].slice(0, 60)}...`)
        console.log(`  Goal: ${ethers.formatEther(campaign[2])} ETH`)
        console.log(`  Gross Raised: ${ethers.formatEther(campaign[3])} ETH`)
        console.log(`  Editions Minted: ${campaign[5]} / ${campaign[6]}`)
        console.log(`  Price: ${ethers.formatEther(campaign[7])} ETH`)
        console.log(`  Active: ${campaign[8]}, Closed: ${campaign[9]}`)
      } catch (err) {
        console.log(`  Error reading campaign ${i}:`, err)
      }
    }

  } catch (err) {
    console.error('Error querying contract:', err)
  }

  console.log('')
  console.log('='.repeat(60))
  console.log('AUDIT COMPLETE')
  console.log('='.repeat(60))
}

main().catch(console.error)
