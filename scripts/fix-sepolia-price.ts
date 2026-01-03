/**
 * Fix Sepolia Campaign #1 Price
 * 
 * The campaign was created with pricePerEdition = 200 ETH (wrong)
 * It should be ~0.00322 ETH ($10 at $3100/ETH)
 * 
 * Run with: npx ts-node scripts/fix-sepolia-price.ts
 */

import { ethers } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const SEPOLIA_RPC = process.env.ETHEREUM_SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com'
const SEPOLIA_RELAYER_KEY = process.env.ETH_DEPLOYER_KEY || process.env.SEPOLIA_RELAYER_KEY
const V7_CONTRACT = '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e'
const CAMPAIGN_ID = 1
const PRICE_USD = 10
const ETH_USD_RATE = 3100

const V7_ABI = [
  'function updateCampaignPrice(uint256 campaignId, uint256 newPrice) external',
  'function owner() external view returns (address)'
]

async function main() {
  console.log('=== Fix Sepolia Campaign Price ===')
  console.log(`Campaign ID: ${CAMPAIGN_ID}`)
  console.log(`Target Price: $${PRICE_USD} USD`)
  console.log(`ETH Rate: $${ETH_USD_RATE}/ETH`)
  
  if (!SEPOLIA_RELAYER_KEY) {
    console.error('ERROR: Missing ETH_DEPLOYER_KEY in .env.local')
    process.exit(1)
  }

  // Connect
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC)
  const wallet = new ethers.Wallet(SEPOLIA_RELAYER_KEY, provider)
  const contract = new ethers.Contract(V7_CONTRACT, V7_ABI, wallet)
  
  console.log(`\nWallet: ${wallet.address}`)
  
  // Check owner
  const owner = await contract.owner()
  console.log(`Contract Owner: ${owner}`)
  
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(`ERROR: Wallet is not the contract owner!`)
    console.error(`Expected: ${owner}`)
    console.error(`Got: ${wallet.address}`)
    process.exit(1)
  }
  
  // Calculate new price: $10 / $3100 = 0.00322580645 ETH
  const newPriceEth = PRICE_USD / ETH_USD_RATE
  const newPriceWei = ethers.parseEther(newPriceEth.toFixed(18))
  
  console.log(`\nNew pricePerEdition: ${newPriceEth.toFixed(8)} ETH (${newPriceWei} wei)`)
  
  // Execute update
  console.log(`\nUpdating price...`)
  const tx = await contract.updateCampaignPrice(CAMPAIGN_ID, newPriceWei)
  console.log(`Tx submitted: ${tx.hash}`)
  
  const receipt = await tx.wait()
  console.log(`Tx confirmed in block ${receipt?.blockNumber}`)
  
  console.log(`\n✅ Done! Campaign #${CAMPAIGN_ID} price is now $${PRICE_USD} worth of ETH.`)
}

main().catch(console.error)
