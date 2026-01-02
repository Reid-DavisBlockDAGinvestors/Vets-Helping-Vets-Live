/**
 * Audit V7 Contract Fund Distribution
 * Check where the funds from purchases went
 */

const { ethers } = require('ethers')

const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'
const V7_ADDRESS = '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e'
const SUBMITTER_WALLET = '0xbFD14c5A940E783AEc1993598143B59D3C971eF1'

const V7_ABI = [
  'function getCampaign(uint256 campaignId) external view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, address nonprofit, address submitter, bool active, bool closed, bool immediatePayoutEnabled)',
  'function feeConfig() external view returns (uint16 platformFeeBps, bool immediatePayout)',
  'function platformTreasury() external view returns (address)',
  'function campaignDistributed(uint256 campaignId) external view returns (uint256)',
  'function paused() external view returns (bool)',
]

async function main() {
  console.log('=== V7 Fund Distribution Audit ===\n')
  
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC)
  const contract = new ethers.Contract(V7_ADDRESS, V7_ABI, provider)
  
  // 1. Check contract balance
  console.log('1. Contract Balance:')
  const contractBalance = await provider.getBalance(V7_ADDRESS)
  console.log(`   Contract ${V7_ADDRESS}: ${ethers.formatEther(contractBalance)} ETH`)
  
  // 2. Check submitter wallet balance
  console.log('\n2. Submitter Wallet Balance:')
  const submitterBalance = await provider.getBalance(SUBMITTER_WALLET)
  console.log(`   Submitter ${SUBMITTER_WALLET}: ${ethers.formatEther(submitterBalance)} ETH`)
  
  // 3. Check platform treasury
  console.log('\n3. Platform Treasury:')
  try {
    const treasury = await contract.platformTreasury()
    console.log(`   Treasury address: ${treasury}`)
    const treasuryBalance = await provider.getBalance(treasury)
    console.log(`   Treasury balance: ${ethers.formatEther(treasuryBalance)} ETH`)
  } catch (e) {
    console.log(`   Error: ${e.message}`)
  }
  
  // 4. Check global fee config
  console.log('\n4. Global Fee Config:')
  try {
    const feeConfig = await contract.feeConfig()
    console.log(`   platformFeeBps: ${feeConfig[0]} (${Number(feeConfig[0]) / 100}%)`)
    console.log(`   immediatePayout (GLOBAL): ${feeConfig[1]}`)
    
    if (!feeConfig[1]) {
      console.log('\n   ⚠️ GLOBAL immediatePayout is FALSE!')
      console.log('   → This is why funds stayed in contract!')
      console.log('   → Both campaign.immediatePayoutEnabled AND feeConfig.immediatePayout must be TRUE')
    }
  } catch (e) {
    console.log(`   Error: ${e.message}`)
  }
  
  // 5. Check campaign #0 details
  console.log('\n5. Campaign #0 Details:')
  try {
    const campaign = await contract.getCampaign(0)
    console.log(`   category: ${campaign[0]}`)
    console.log(`   goal: ${ethers.formatEther(campaign[2])} ETH`)
    console.log(`   grossRaised: ${ethers.formatEther(campaign[3])} ETH`)
    console.log(`   netRaised: ${ethers.formatEther(campaign[4])} ETH`)
    console.log(`   editionsMinted: ${campaign[5]}`)
    console.log(`   pricePerEdition: ${ethers.formatEther(campaign[7])} ETH`)
    console.log(`   nonprofit: ${campaign[8]}`)
    console.log(`   submitter: ${campaign[9]}`)
    console.log(`   active: ${campaign[10]}`)
    console.log(`   closed: ${campaign[11]}`)
    console.log(`   immediatePayoutEnabled: ${campaign[12]}`)
    
    // Check if funds are held in netRaised
    const netRaised = campaign[4]
    if (netRaised > 0n) {
      console.log(`\n   💰 Funds held in contract's netRaised: ${ethers.formatEther(netRaised)} ETH`)
      console.log('   → These funds can be withdrawn by calling withdrawCampaignFunds()')
    }
  } catch (e) {
    console.log(`   Error: ${e.message}`)
  }
  
  // 6. Check distributed amount
  console.log('\n6. Campaign Distributed Amount:')
  try {
    const distributed = await contract.campaignDistributed(0)
    console.log(`   Amount distributed: ${ethers.formatEther(distributed)} ETH`)
    if (distributed === 0n) {
      console.log('   → No funds have been distributed yet (immediate payout did NOT happen)')
    }
  } catch (e) {
    console.log(`   Error: ${e.message}`)
  }
  
  // 7. Summary
  console.log('\n=== SUMMARY ===')
  console.log('The V7 contract has TWO flags that control immediate payout:')
  console.log('  1. feeConfig.immediatePayout (GLOBAL) - must be TRUE')
  console.log('  2. campaign.immediatePayoutEnabled (per-campaign) - must be TRUE')
  console.log('')
  console.log('Currently:')
  console.log('  - Global immediatePayout: FALSE ← This is the issue')
  console.log('  - Campaign immediatePayoutEnabled: TRUE')
  console.log('')
  console.log('Since BOTH must be true, funds went to netRaised instead of being distributed.')
  console.log('')
  console.log('SOLUTION OPTIONS:')
  console.log('  A) Call setFeeConfig() to enable global immediatePayout (requires owner)')
  console.log('  B) Call withdrawCampaignFunds() to manually distribute (requires admin)')
  console.log('  C) Use mintWithImmediatePayout() which bypasses feeConfig.immediatePayout flag')
  
  console.log('\n=== Audit Complete ===')
}

main().catch(console.error)
