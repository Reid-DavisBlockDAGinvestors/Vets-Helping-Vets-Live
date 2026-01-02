/**
 * Debug Submitter Address
 * 
 * Check if the submitter can receive ETH
 */

const { ethers } = require('ethers')

const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'
const SUBMITTER = '0xbFD14c5A940E783AEc1993598143B59D3C971eF1'
const V7_ADDRESS = '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e'

const V7_ABI = [
  'function feeConfig() external view returns (uint16 platformFeeBps, bool immediatePayout)',
  'function platformTreasury() external view returns (address)',
  'function getCampaign(uint256 campaignId) external view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, address nonprofit, address submitter, bool active, bool closed, bool immediatePayoutEnabled)',
]

async function main() {
  console.log('=== Debug Submitter & Fund Distribution ===\n')
  
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC)
  const contract = new ethers.Contract(V7_ADDRESS, V7_ABI, provider)
  
  // 1. Check if submitter is a contract or EOA
  console.log('1. Checking submitter address...')
  const code = await provider.getCode(SUBMITTER)
  console.log(`   Submitter: ${SUBMITTER}`)
  console.log(`   Is Contract: ${code !== '0x'}`)
  console.log(`   Code length: ${code.length}`)
  
  if (code !== '0x') {
    console.log('   ⚠️ SUBMITTER IS A CONTRACT - may not accept ETH!')
  } else {
    console.log('   ✅ Submitter is an EOA (can receive ETH)')
  }
  
  // 2. Check platform treasury
  console.log('\n2. Checking platform treasury...')
  try {
    const treasury = await contract.platformTreasury()
    console.log(`   Platform Treasury: ${treasury}`)
    const treasuryCode = await provider.getCode(treasury)
    console.log(`   Is Contract: ${treasuryCode !== '0x'}`)
    
    if (treasuryCode !== '0x') {
      console.log('   ⚠️ TREASURY IS A CONTRACT - may not accept ETH!')
    }
  } catch (e) {
    console.log(`   Error: ${e.message}`)
  }
  
  // 3. Check fee config
  console.log('\n3. Checking fee config...')
  try {
    const feeConfig = await contract.feeConfig()
    console.log(`   Platform Fee BPS: ${feeConfig[0]} (${feeConfig[0] / 100}%)`)
    console.log(`   Immediate Payout Enabled (global): ${feeConfig[1]}`)
    
    if (!feeConfig[1]) {
      console.log('   ⚠️ GLOBAL IMMEDIATE PAYOUT IS DISABLED!')
      console.log('   → Funds should be held in contract, not distributed')
    } else {
      console.log('   → Immediate payout IS enabled globally')
    }
  } catch (e) {
    console.log(`   Error: ${e.message}`)
  }
  
  // 4. Check campaign immediate payout setting
  console.log('\n4. Checking campaign #0 immediate payout...')
  try {
    const campaign = await contract.getCampaign(0)
    console.log(`   Campaign immediatePayoutEnabled: ${campaign[12]}`)
    
    if (campaign[12]) {
      console.log('   → Campaign HAS immediate payout enabled')
      console.log('   → Funds will be distributed on mint')
    } else {
      console.log('   → Campaign does NOT have immediate payout')
      console.log('   → Funds will be held in contract')
    }
  } catch (e) {
    console.log(`   Error: ${e.message}`)
  }
  
  // 5. Check submitter balance
  console.log('\n5. Checking submitter ETH balance...')
  try {
    const balance = await provider.getBalance(SUBMITTER)
    console.log(`   Balance: ${ethers.formatEther(balance)} ETH`)
  } catch (e) {
    console.log(`   Error: ${e.message}`)
  }
  
  console.log('\n=== Analysis ===')
  console.log('If both global feeConfig.immediatePayout AND campaign.immediatePayoutEnabled are TRUE,')
  console.log('the contract will try to send ETH to the submitter and treasury on mint.')
  console.log('If either recipient cannot receive ETH (e.g., contract without receive()),')
  console.log('the entire transaction will REVERT.')
  
  console.log('\n=== Debug Complete ===')
}

main().catch(console.error)
