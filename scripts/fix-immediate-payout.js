/**
 * Fix V7 Immediate Payout
 * 
 * Run with: npx hardhat run scripts/fix-immediate-payout.js --network sepolia
 * 
 * This script:
 * 1. Enables global immediatePayout in feeConfig
 * 2. Distributes pending funds for campaign #0
 */

const { ethers } = require('hardhat')

const V7_ADDRESS = '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e'

const V7_ABI = [
  'function setFeeConfig(uint16 platformFeeBps, bool immediatePayout) external',
  'function distributePendingFunds(uint256 campaignId) external',
  'function feeConfig() external view returns (uint16 platformFeeBps, bool immediatePayout)',
  'function getCampaign(uint256 campaignId) external view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, address nonprofit, address submitter, bool active, bool closed, bool immediatePayoutEnabled)',
  'function owner() external view returns (address)',
]

async function main() {
  console.log('=== Fix V7 Immediate Payout ===\n')
  
  const [signer] = await ethers.getSigners()
  console.log('Signer address:', signer.address)
  
  const contract = new ethers.Contract(V7_ADDRESS, V7_ABI, signer)
  
  // 1. Check current owner
  const owner = await contract.owner()
  console.log('Contract owner:', owner)
  
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.log('\n❌ ERROR: You are not the contract owner!')
    console.log('   Only the owner can call setFeeConfig and distributePendingFunds')
    return
  }
  
  // 2. Check current fee config
  console.log('\n--- Current Fee Config ---')
  const feeConfig = await contract.feeConfig()
  console.log('platformFeeBps:', feeConfig[0].toString())
  console.log('immediatePayout:', feeConfig[1])
  
  // 3. Check campaign #0 pending funds
  console.log('\n--- Campaign #0 Pending Funds ---')
  const campaign = await contract.getCampaign(0)
  const netRaised = campaign[4]
  console.log('netRaised (pending):', ethers.formatEther(netRaised), 'ETH')
  
  // 4. Enable global immediate payout
  if (!feeConfig[1]) {
    console.log('\n--- Enabling Global Immediate Payout ---')
    const tx1 = await contract.setFeeConfig(100, true) // 1% fee, immediate payout ON
    console.log('setFeeConfig tx:', tx1.hash)
    await tx1.wait()
    console.log('✅ Global immediatePayout enabled!')
  } else {
    console.log('\n✅ Global immediatePayout already enabled')
  }
  
  // 5. Distribute pending funds for campaign #0
  if (netRaised > 0n) {
    console.log('\n--- Distributing Pending Funds ---')
    const tx2 = await contract.distributePendingFunds(0)
    console.log('distributePendingFunds tx:', tx2.hash)
    await tx2.wait()
    console.log('✅ Pending funds distributed!')
  } else {
    console.log('\n✅ No pending funds to distribute')
  }
  
  // 6. Verify
  console.log('\n--- Verification ---')
  const newFeeConfig = await contract.feeConfig()
  console.log('New immediatePayout:', newFeeConfig[1])
  
  const newCampaign = await contract.getCampaign(0)
  console.log('New netRaised:', ethers.formatEther(newCampaign[4]), 'ETH')
  
  console.log('\n=== Done! ===')
}

main().catch(console.error)
