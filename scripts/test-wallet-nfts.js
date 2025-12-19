/**
 * Debug script to test wallet NFT query across multiple contracts
 */
require('dotenv').config({ path: '.env.local' })
const { ethers } = require('ethers')

const WALLET_ADDRESS = '0x07b3c4BB8842a9eE0698F1A3c6778bcC456d9362'

// V5 and V6 contract addresses
const V5_ADDRESS = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const V6_ADDRESS = '0xaE54e4E8A75a81780361570c17b8660CEaD27053'

// Basic ABI for balance check
const BASIC_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function totalSupply() view returns (uint256)'
]

async function main() {
  // Test RPC fallback logic - try standard first, then NowNodes
  const primaryRpc = process.env.BLOCKDAG_RPC || 'https://rpc.awakening.bdagscan.com'
  const fallbackRpc = process.env.BLOCKDAG_RPC_FALLBACK || 'https://bdag.nownodes.io'
  const apiKey = process.env.NOWNODES_API_KEY
  
  console.log('=== Testing RPC Fallback Logic ===')
  console.log('Primary RPC:', primaryRpc)
  console.log('Fallback RPC:', fallbackRpc)
  
  // Try primary RPC first
  let provider
  let usedRpc = primaryRpc
  
  const MIN_BLOCK_HEIGHT = 40000000 // Contracts deployed around block 43M
  
  console.log('\n--- Testing Primary RPC ---')
  try {
    provider = new ethers.JsonRpcProvider(primaryRpc, null, { staticNetwork: true })
    const blockNum = await provider.getBlockNumber()
    console.log('Primary RPC block:', blockNum)
    
    if (blockNum < MIN_BLOCK_HEIGHT) {
      console.log(`✗ Primary RPC too far behind (need ${MIN_BLOCK_HEIGHT.toLocaleString()}+)`)
      throw new Error('RPC not synced')
    }
    console.log('✓ Primary RPC synced and working!')
  } catch (e) {
    console.log('Falling back to NowNodes...')
    
    // Fall back to NowNodes
    usedRpc = fallbackRpc
    if (apiKey) {
      const fetchReq = new ethers.FetchRequest(fallbackRpc)
      fetchReq.setHeader('api-key', apiKey)
      provider = new ethers.JsonRpcProvider(fetchReq, null, { staticNetwork: true })
    } else {
      provider = new ethers.JsonRpcProvider(fallbackRpc, null, { staticNetwork: true })
    }
    const blockNum = await provider.getBlockNumber()
    console.log('✓ NowNodes fallback works! Block:', blockNum.toLocaleString())
  }
  
  console.log('\nUsing RPC:', usedRpc)
  
  console.log('\n=== V5 Contract ===')
  console.log('Address:', V5_ADDRESS)
  try {
    const v5 = new ethers.Contract(V5_ADDRESS, BASIC_ABI, provider)
    const v5Supply = await v5.totalSupply()
    console.log('Total Supply:', v5Supply.toString())
    
    const v5Balance = await v5.balanceOf(WALLET_ADDRESS)
    console.log(`Balance for ${WALLET_ADDRESS.slice(0,8)}...:`, v5Balance.toString())
    
    if (Number(v5Balance) > 0) {
      console.log('Token IDs owned:')
      for (let i = 0; i < Math.min(Number(v5Balance), 5); i++) {
        const tokenId = await v5.tokenOfOwnerByIndex(WALLET_ADDRESS, i)
        console.log(`  - Token #${tokenId}`)
      }
    }
  } catch (e) {
    console.error('V5 Error:', e.message)
  }
  
  console.log('\n=== V6 Contract ===')
  console.log('Address:', V6_ADDRESS)
  try {
    const v6 = new ethers.Contract(V6_ADDRESS, BASIC_ABI, provider)
    const v6Supply = await v6.totalSupply()
    console.log('Total Supply:', v6Supply.toString())
    
    const v6Balance = await v6.balanceOf(WALLET_ADDRESS)
    console.log(`Balance for ${WALLET_ADDRESS.slice(0,8)}...:`, v6Balance.toString())
    
    if (Number(v6Balance) > 0) {
      console.log('Token IDs owned:')
      for (let i = 0; i < Math.min(Number(v6Balance), 5); i++) {
        const tokenId = await v6.tokenOfOwnerByIndex(WALLET_ADDRESS, i)
        console.log(`  - Token #${tokenId}`)
      }
    }
  } catch (e) {
    console.error('V6 Error:', e.message)
  }
  
  console.log('\n=== Environment Check ===')
  console.log('CONTRACT_ADDRESS:', process.env.CONTRACT_ADDRESS || '(not set)')
  console.log('CONTRACT_ADDRESS_V5:', process.env.CONTRACT_ADDRESS_V5 || '(not set)')
  console.log('NEXT_PUBLIC_CONTRACT_ADDRESS:', process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '(not set)')
  console.log('NEXT_PUBLIC_CONTRACT_ADDRESS_V5:', process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_V5 || '(not set)')
}

main().catch(console.error)
