/**
 * Debug V7 Mint Function Encoding
 * 
 * This script verifies that the mint function calls are properly encoded
 * and the contract ABI matches the deployed contract.
 */

const { ethers } = require('ethers')

// V7 Contract on Sepolia
const V7_ADDRESS = '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e'
const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'

// Full V7 ABI for minting functions
const V7_FULL_ABI = [
  // Legacy mint functions (V5/V6 compatible)
  'function mintWithBDAG(uint256 campaignId) external payable returns (uint256)',
  'function mintWithBDAGAndTip(uint256 campaignId, uint256 tipAmount) external payable returns (uint256)',
  // V7 immediate payout functions
  'function mintWithImmediatePayout(uint256 campaignId) external payable returns (uint256)',
  'function mintWithImmediatePayoutAndTip(uint256 campaignId, uint256 tipAmount) external payable returns (uint256)',
  // View functions
  'function getCampaign(uint256 campaignId) external view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, address nonprofit, address submitter, bool active, bool closed, bool immediatePayoutEnabled)',
  'function totalCampaigns() external view returns (uint256)',
  'function deploymentChainId() external view returns (uint256)',
  'function paused() external view returns (bool)',
  'function owner() external view returns (address)',
]

async function main() {
  console.log('=== V7 Mint Function Debug ===\n')
  
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC)
  const contract = new ethers.Contract(V7_ADDRESS, V7_FULL_ABI, provider)
  
  // 1. Verify contract exists
  console.log('1. Checking contract code at address...')
  const code = await provider.getCode(V7_ADDRESS)
  if (code === '0x') {
    console.log('   ❌ NO CONTRACT at this address!')
    return
  }
  console.log(`   ✅ Contract exists (code length: ${code.length} bytes)`)
  
  // 2. Verify deployment chain ID
  console.log('\n2. Checking deploymentChainId...')
  try {
    const chainId = await contract.deploymentChainId()
    console.log(`   deploymentChainId: ${chainId}`)
    if (Number(chainId) === 11155111) {
      console.log('   ✅ Matches Sepolia (11155111)')
    } else {
      console.log(`   ⚠️ MISMATCH! Expected 11155111, got ${chainId}`)
    }
  } catch (e) {
    console.log(`   ❌ Error reading deploymentChainId: ${e.message}`)
  }
  
  // 3. Check if paused
  console.log('\n3. Checking if contract is paused...')
  try {
    const paused = await contract.paused()
    console.log(`   paused: ${paused}`)
    if (paused) {
      console.log('   ❌ CONTRACT IS PAUSED - mints will fail!')
    } else {
      console.log('   ✅ Contract is not paused')
    }
  } catch (e) {
    console.log(`   ❌ Error: ${e.message}`)
  }
  
  // 4. Check campaign #0
  console.log('\n4. Checking campaign #0...')
  try {
    const campaign = await contract.getCampaign(0)
    console.log(`   category: ${campaign[0]}`)
    console.log(`   pricePerEdition: ${ethers.formatEther(campaign[7])} ETH`)
    console.log(`   active: ${campaign[10]}`)
    console.log(`   closed: ${campaign[11]}`)
    console.log(`   immediatePayoutEnabled: ${campaign[12]}`)
    
    if (!campaign[10]) {
      console.log('   ❌ Campaign is NOT active!')
    } else if (campaign[11]) {
      console.log('   ❌ Campaign is CLOSED!')
    } else {
      console.log('   ✅ Campaign is active and open')
    }
  } catch (e) {
    console.log(`   ❌ Error: ${e.message}`)
  }
  
  // 5. Encode function calls and verify selectors
  console.log('\n5. Function selector verification...')
  
  const iface = new ethers.Interface(V7_FULL_ABI)
  
  // Get function selectors
  const mintWithBDAGSelector = iface.getFunction('mintWithBDAG').selector
  const mintWithBDAGAndTipSelector = iface.getFunction('mintWithBDAGAndTip').selector
  const mintWithImmediatePayoutSelector = iface.getFunction('mintWithImmediatePayout').selector
  
  console.log(`   mintWithBDAG(uint256): ${mintWithBDAGSelector}`)
  console.log(`   mintWithBDAGAndTip(uint256,uint256): ${mintWithBDAGAndTipSelector}`)
  console.log(`   mintWithImmediatePayout(uint256): ${mintWithImmediatePayoutSelector}`)
  
  // 6. Encode a sample call
  console.log('\n6. Sample encoded calldata for mintWithBDAG(0)...')
  const calldata = iface.encodeFunctionData('mintWithBDAG', [0])
  console.log(`   Calldata: ${calldata}`)
  console.log(`   Length: ${calldata.length} chars (${(calldata.length - 2) / 2} bytes)`)
  
  // Verify calldata is not empty
  if (calldata === '0x' || calldata.length < 10) {
    console.log('   ❌ CALLDATA IS EMPTY OR INVALID!')
  } else {
    console.log('   ✅ Calldata looks valid')
  }
  
  // 7. Try a static call to simulate the mint
  console.log('\n7. Simulating mintWithBDAG(0) with static call...')
  const priceWei = ethers.parseEther('0.00434783')
  try {
    // Create a fake signer for static call
    const result = await provider.call({
      to: V7_ADDRESS,
      data: calldata,
      value: priceWei,
      from: '0x0000000000000000000000000000000000000001' // Dummy address
    })
    console.log(`   Result: ${result}`)
    console.log('   ✅ Static call succeeded (would return tokenId)')
  } catch (e) {
    console.log(`   ❌ Static call failed: ${e.message}`)
    
    // Parse the error
    if (e.message.includes('Campaign not active')) {
      console.log('   → Campaign #0 is not active')
    } else if (e.message.includes('execution reverted')) {
      console.log('   → Transaction would revert on-chain')
      // Try to decode revert reason
      if (e.data) {
        try {
          const reason = ethers.AbiCoder.defaultAbiCoder().decode(['string'], '0x' + e.data.slice(10))
          console.log(`   → Revert reason: ${reason[0]}`)
        } catch {}
      }
    }
  }
  
  // 8. Check if mintWithBDAG exists by trying to get its bytecode signature
  console.log('\n8. Verifying function exists on deployed contract...')
  try {
    // Call with 0 value to see if function exists
    const testCall = await provider.call({
      to: V7_ADDRESS,
      data: mintWithBDAGSelector + '0000000000000000000000000000000000000000000000000000000000000000', // selector + campaignId=0
      value: 0
    })
    console.log('   ✅ mintWithBDAG function exists on contract')
  } catch (e) {
    if (e.message.includes('Insufficient payment')) {
      console.log('   ✅ mintWithBDAG exists (failed due to insufficient payment as expected)')
    } else if (e.message.includes('data')) {
      console.log(`   ⚠️ Function may not exist: ${e.message}`)
    } else {
      console.log(`   Response: ${e.message}`)
    }
  }
  
  console.log('\n=== Debug Complete ===')
}

main().catch(console.error)
