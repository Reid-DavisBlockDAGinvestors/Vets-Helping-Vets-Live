/**
 * Decode a failed transaction to see what was actually sent
 * Run with: node scripts/decode-tx.js <txHash>
 */
const { ethers } = require('ethers')
require('dotenv').config({ path: '.env.local' })

const RPC_URL = process.env.BLOCKDAG_RPC || 'https://bdag.nownodes.io'
const NOWNODES_API_KEY = process.env.NOWNODES_API_KEY || ''

const ABI = [
  'function mintWithBDAG(uint256 campaignId) external payable returns (uint256)',
  'function mintWithBDAGAndTip(uint256 campaignId, uint256 tipAmount) external payable returns (uint256)',
]

async function main() {
  const txHash = process.argv[2] || '0x4e928e19508f2b587c68b31fa4ea74b19bf909448f5c0b8104a4898f988ad814'
  
  console.log('=== Transaction Decode ===')
  console.log('TX Hash:', txHash)
  console.log('')

  // Create provider with NowNodes headers
  const fetchReq = new ethers.FetchRequest(RPC_URL)
  if (RPC_URL.includes('nownodes') && NOWNODES_API_KEY) {
    fetchReq.setHeader('api-key', NOWNODES_API_KEY)
  }
  const provider = new ethers.JsonRpcProvider(fetchReq)
  const iface = new ethers.Interface(ABI)

  try {
    // Get transaction details
    const tx = await provider.getTransaction(txHash)
    
    if (!tx) {
      console.log('Transaction not found!')
      return
    }

    console.log('=== Transaction Details ===')
    console.log('From:', tx.from)
    console.log('To:', tx.to)
    console.log('Value:', ethers.formatEther(tx.value), 'BDAG')
    console.log('Value (wei):', tx.value.toString())
    console.log('Gas Limit:', tx.gasLimit.toString())
    console.log('Gas Price:', tx.gasPrice?.toString())
    console.log('Nonce:', tx.nonce)
    console.log('Data:', tx.data)
    console.log('Data length:', tx.data?.length)
    
    // Check if data is empty or just '0x'
    if (!tx.data || tx.data === '0x' || tx.data === '') {
      console.log('\n⚠️  WARNING: Transaction data is EMPTY!')
      console.log('This means no function was called - just a value transfer!')
      console.log('The contract receive() function accepted the BDAG but no NFT was minted.')
    } else {
      // Try to decode the function call
      console.log('\n=== Decoded Function Call ===')
      try {
        const decoded = iface.parseTransaction({ data: tx.data, value: tx.value })
        console.log('Function:', decoded?.name)
        console.log('Args:', decoded?.args?.map(a => a.toString()))
      } catch (e) {
        console.log('Could not decode function call:', e.message)
        console.log('Function selector:', tx.data.slice(0, 10))
      }
    }

    // Get receipt
    console.log('\n=== Transaction Receipt ===')
    const receipt = await provider.getTransactionReceipt(txHash)
    
    if (receipt) {
      console.log('Status:', receipt.status === 1 ? 'SUCCESS' : 'FAILED')
      console.log('Gas Used:', receipt.gasUsed.toString())
      console.log('Block:', receipt.blockNumber)
      console.log('Logs count:', receipt.logs?.length || 0)
      
      if (receipt.status === 0) {
        console.log('\n❌ Transaction REVERTED on-chain')
        
        // Try to get revert reason via debug_traceTransaction (if supported)
        try {
          const trace = await provider.send('debug_traceTransaction', [txHash, {}])
          console.log('Trace:', JSON.stringify(trace, null, 2).slice(0, 500))
        } catch {
          console.log('(debug_traceTransaction not supported by this RPC)')
        }
      }
    }

  } catch (e) {
    console.error('Error:', e.message || e)
  }
}

main()
