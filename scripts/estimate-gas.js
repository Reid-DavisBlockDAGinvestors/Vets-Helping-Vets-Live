/**
 * Estimate gas for mintWithBDAG
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
  const campaignId = process.argv[2] || '22'
  const fromAddress = '0x07b3c4BB8842a9eE0698F1A3c6778bcC456d9362'
  
  console.log('=== Gas Estimation ===')
  
  const fetchReq = new ethers.FetchRequest(RPC_URL)
  if (RPC_URL.includes('nownodes') && NOWNODES_API_KEY) {
    fetchReq.setHeader('api-key', NOWNODES_API_KEY)
  }
  const provider = new ethers.JsonRpcProvider(fetchReq)
  const iface = new ethers.Interface(ABI)

  // Get campaign price
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider)
  const camp = await contract.getCampaign(BigInt(campaignId))
  const pricePerEdition = camp[7]
  
  console.log('Campaign:', campaignId)
  console.log('Price:', ethers.formatEther(pricePerEdition), 'BDAG')

  const callData = iface.encodeFunctionData('mintWithBDAG', [BigInt(campaignId)])

  // Try eth_estimateGas
  try {
    const gasEstimate = await provider.estimateGas({
      to: CONTRACT_ADDRESS,
      from: fromAddress,
      data: callData,
      value: pricePerEdition,
    })
    console.log('\n✅ Gas estimate:', gasEstimate.toString())
    console.log('Recommended gas limit:', Math.ceil(Number(gasEstimate) * 1.3).toString(), '(+30%)')
  } catch (e) {
    console.log('\n❌ Gas estimation failed:', e.message?.slice(0, 200))
    
    // Try with different gas limits to find the threshold
    console.log('\n=== Binary search for required gas ===')
    for (const limit of [500000, 750000, 1000000, 1500000, 2000000]) {
      try {
        const result = await provider.call({
          to: CONTRACT_ADDRESS,
          from: fromAddress,
          data: callData,
          value: pricePerEdition,
          gasLimit: limit,
        })
        console.log(`Gas limit ${limit}: SUCCESS`)
        break
      } catch (e) {
        console.log(`Gas limit ${limit}: FAILED -`, e.message?.slice(0, 50))
      }
    }
  }
}

main()
