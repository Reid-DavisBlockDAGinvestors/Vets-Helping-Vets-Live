/**
 * Verify the gas limit fix
 */
const { ethers } = require('ethers')
require('dotenv').config({ path: '.env.local' })

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''
const RPC_URL = process.env.BLOCKDAG_RPC || 'https://bdag.nownodes.io'
const NOWNODES_API_KEY = process.env.NOWNODES_API_KEY || ''

const ABI = [
  'function mintWithBDAG(uint256 campaignId) external payable returns (uint256)',
  'function getCampaign(uint256 campaignId) external view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)',
]

async function main() {
  const campaignId = '22'
  const fromAddress = '0x07b3c4BB8842a9eE0698F1A3c6778bcC456d9362'
  
  const fetchReq = new ethers.FetchRequest(RPC_URL)
  if (RPC_URL.includes('nownodes') && NOWNODES_API_KEY) {
    fetchReq.setHeader('api-key', NOWNODES_API_KEY)
  }
  const provider = new ethers.JsonRpcProvider(fetchReq)
  const iface = new ethers.Interface(ABI)
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider)
  
  const camp = await contract.getCampaign(BigInt(campaignId))
  const pricePerEdition = camp[7]
  const callData = iface.encodeFunctionData('mintWithBDAG', [BigInt(campaignId)])

  console.log('=== Gas Limit Verification ===')
  console.log('')
  
  // Test with OLD gas limit (300k) - should fail
  console.log('OLD gas limit (300000):')
  try {
    await provider.call({
      to: CONTRACT_ADDRESS,
      from: fromAddress,
      data: callData,
      value: pricePerEdition,
      gasLimit: 300000,
    })
    console.log('  ❓ Unexpectedly succeeded (might work on fresh state)')
  } catch (e) {
    console.log('  ❌ Would fail -', e.message?.includes('revert') ? 'revert' : 'out of gas')
  }
  
  // Test with NEW gas limit (600k) - should succeed
  console.log('')
  console.log('NEW gas limit (600000):')
  try {
    const result = await provider.call({
      to: CONTRACT_ADDRESS,
      from: fromAddress,
      data: callData,
      value: pricePerEdition,
      gasLimit: 600000,
    })
    const decoded = iface.decodeFunctionResult('mintWithBDAG', result)
    console.log('  ✅ SUCCESS - would mint token ID:', decoded[0].toString())
  } catch (e) {
    console.log('  ❌ Failed -', e.message?.slice(0, 100))
  }

  // Get actual gas estimate
  console.log('')
  const gasEstimate = await provider.estimateGas({
    to: CONTRACT_ADDRESS,
    from: fromAddress,
    data: callData,
    value: pricePerEdition,
  })
  console.log('Actual gas needed:', gasEstimate.toString())
  console.log('New limit provides:', Math.round((600000 / Number(gasEstimate) - 1) * 100) + '% buffer')
}

main()
