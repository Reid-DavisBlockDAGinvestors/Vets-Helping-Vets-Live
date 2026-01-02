/**
 * Debug Failed Transaction on Sepolia
 * 
 * Fetches transaction details and tries to understand why it failed
 */

const { ethers } = require('ethers')

const TX_HASH = '0xe40c66ec8cfd0095f9b038484a269c286ba614dbf24fc949273b08b6416b5c09'
const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'
const V7_ADDRESS = '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e'

const V7_ABI = [
  'function getCampaign(uint256 campaignId) external view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, address nonprofit, address submitter, bool active, bool closed, bool immediatePayoutEnabled)',
  'function mintWithBDAG(uint256 campaignId) external payable returns (uint256)',
  'function paused() external view returns (bool)',
  'function deploymentChainId() external view returns (uint256)',
  'function blacklist(address) external view returns (bool)',
]

async function main() {
  console.log('=== Debug Failed Transaction ===\n')
  
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC)
  const contract = new ethers.Contract(V7_ADDRESS, V7_ABI, provider)
  
  // 1. Get transaction details
  console.log('1. Fetching transaction details...')
  try {
    const tx = await provider.getTransaction(TX_HASH)
    if (!tx) {
      console.log('   Transaction not found on chain')
      return
    }
    console.log(`   From: ${tx.from}`)
    console.log(`   To: ${tx.to}`)
    console.log(`   Value: ${ethers.formatEther(tx.value)} ETH`)
    console.log(`   Data: ${tx.data}`)
    console.log(`   Gas Limit: ${tx.gasLimit}`)
    console.log(`   Nonce: ${tx.nonce}`)
  } catch (e) {
    console.log(`   Error fetching tx: ${e.message}`)
  }
  
  // 2. Get transaction receipt
  console.log('\n2. Fetching transaction receipt...')
  try {
    const receipt = await provider.getTransactionReceipt(TX_HASH)
    if (!receipt) {
      console.log('   Receipt not found (tx may be pending)')
      return
    }
    console.log(`   Status: ${receipt.status === 1 ? 'SUCCESS' : 'FAILED'}`)
    console.log(`   Gas Used: ${receipt.gasUsed}`)
    console.log(`   Block: ${receipt.blockNumber}`)
    
    if (receipt.status === 0) {
      console.log('   ❌ Transaction REVERTED on-chain')
    }
  } catch (e) {
    console.log(`   Error: ${e.message}`)
  }
  
  // 3. Check contract state
  console.log('\n3. Checking contract state...')
  
  try {
    const paused = await contract.paused()
    console.log(`   Contract paused: ${paused}`)
  } catch (e) {
    console.log(`   Error checking paused: ${e.message}`)
  }
  
  try {
    const chainId = await contract.deploymentChainId()
    console.log(`   Deployment chainId: ${chainId}`)
    const network = await provider.getNetwork()
    console.log(`   Current chainId: ${network.chainId}`)
    if (Number(chainId) !== Number(network.chainId)) {
      console.log('   ⚠️ CHAIN ID MISMATCH!')
    }
  } catch (e) {
    console.log(`   Error checking chainId: ${e.message}`)
  }
  
  // 4. Check campaign #0
  console.log('\n4. Checking campaign #0...')
  try {
    const campaign = await contract.getCampaign(0)
    console.log(`   pricePerEdition: ${ethers.formatEther(campaign[7])} ETH`)
    console.log(`   active: ${campaign[10]}`)
    console.log(`   closed: ${campaign[11]}`)
    console.log(`   submitter: ${campaign[9]}`)
    console.log(`   nonprofit: ${campaign[8]}`)
    
    // Check if price matches
    const requiredPrice = campaign[7]
    const sentValue = ethers.parseEther('0.00434783')
    console.log(`\n   Required: ${ethers.formatEther(requiredPrice)} ETH`)
    console.log(`   Sent: ${ethers.formatEther(sentValue)} ETH`)
    if (sentValue < requiredPrice) {
      console.log('   ❌ INSUFFICIENT PAYMENT!')
    } else {
      console.log('   ✅ Payment amount is sufficient')
    }
  } catch (e) {
    console.log(`   Error: ${e.message}`)
  }
  
  // 5. Check if sender is blacklisted
  console.log('\n5. Checking blacklist status...')
  const senderAddress = '0x52042b1eedf54ebf6cf226f0d5e283e9e3e74dd9'
  try {
    const isBlacklisted = await contract.blacklist(senderAddress)
    console.log(`   Address ${senderAddress} blacklisted: ${isBlacklisted}`)
    if (isBlacklisted) {
      console.log('   ❌ SENDER IS BLACKLISTED!')
    }
  } catch (e) {
    console.log(`   Error: ${e.message}`)
  }
  
  // 6. Try to simulate the call to get revert reason
  console.log('\n6. Simulating call to get revert reason...')
  try {
    const calldata = '0xd88d6ef30000000000000000000000000000000000000000000000000000000000000000'
    const value = ethers.parseEther('0.00434783')
    
    await provider.call({
      to: V7_ADDRESS,
      data: calldata,
      value: value,
      from: senderAddress
    })
    console.log('   ✅ Call would succeed')
  } catch (e) {
    console.log(`   ❌ Call would revert: ${e.message}`)
    
    // Try to extract revert reason
    if (e.data) {
      console.log(`   Revert data: ${e.data}`)
    }
    if (e.reason) {
      console.log(`   Revert reason: ${e.reason}`)
    }
  }
  
  console.log('\n=== Debug Complete ===')
}

main().catch(console.error)
