/**
 * Simulate mintWithBDAG call to get actual revert reason
 * Run with: node scripts/simulate-mint.js
 */
const { ethers } = require('ethers')
require('dotenv').config({ path: '.env.local' })

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''
const RPC_URL = process.env.BLOCKDAG_RPC || 'https://bdag.nownodes.io'
const NOWNODES_API_KEY = process.env.NOWNODES_API_KEY || ''

// Full ABI for better error decoding
const ABI = [
  'function mintWithBDAG(uint256 campaignId) external payable returns (uint256)',
  'function mintWithBDAGAndTip(uint256 campaignId, uint256 tipAmount) external payable returns (uint256)',
  'function getCampaign(uint256 campaignId) external view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)',
  'function totalCampaigns() external view returns (uint256)',
  'function owner() external view returns (address)',
  'error OwnableUnauthorizedAccount(address account)',
]

async function main() {
  const campaignId = process.argv[2] || '22'
  const fromAddress = process.argv[3] || '0x07b3c4BB8842a9eE0698F1A3c6778bcC456d9362' // User's address
  
  console.log('=== Mint Simulation ===')
  console.log('Contract:', CONTRACT_ADDRESS)
  console.log('Campaign ID:', campaignId)
  console.log('From Address:', fromAddress)
  console.log('')

  // Create provider with NowNodes headers
  const fetchReq = new ethers.FetchRequest(RPC_URL)
  if (RPC_URL.includes('nownodes') && NOWNODES_API_KEY) {
    fetchReq.setHeader('api-key', NOWNODES_API_KEY)
  }
  const provider = new ethers.JsonRpcProvider(fetchReq)

  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider)
  const iface = new ethers.Interface(ABI)

  try {
    // Get campaign data first
    const camp = await contract.getCampaign(BigInt(campaignId))
    const pricePerEdition = camp[7]
    
    console.log('Campaign pricePerEdition:', ethers.formatEther(pricePerEdition), 'BDAG')
    console.log('Campaign active:', camp[8])
    console.log('Campaign closed:', camp[9])
    console.log('')

    // Encode the function call
    const callData = iface.encodeFunctionData('mintWithBDAG', [BigInt(campaignId)])
    console.log('Call data:', callData)
    
    // Simulate with eth_call
    console.log('\n=== Simulating eth_call ===')
    const tx = {
      to: CONTRACT_ADDRESS,
      from: fromAddress,
      data: callData,
      value: pricePerEdition, // Send exact price
    }
    
    console.log('Transaction:', JSON.stringify({
      ...tx,
      value: tx.value.toString()
    }, null, 2))

    try {
      const result = await provider.call(tx)
      console.log('\n✅ Simulation SUCCESS!')
      console.log('Result:', result)
      
      // Decode the return value (tokenId)
      const decoded = iface.decodeFunctionResult('mintWithBDAG', result)
      console.log('Would mint token ID:', decoded[0].toString())
    } catch (simErr) {
      console.log('\n❌ Simulation FAILED!')
      console.log('Error:', simErr.message)
      
      // Try to decode the revert reason
      if (simErr.data) {
        console.log('Revert data:', simErr.data)
        try {
          const decoded = iface.parseError(simErr.data)
          console.log('Decoded error:', decoded)
        } catch {
          // Try standard Error(string) decoding
          try {
            const reason = ethers.AbiCoder.defaultAbiCoder().decode(['string'], '0x' + simErr.data.slice(10))
            console.log('Revert reason:', reason[0])
          } catch {
            console.log('Could not decode error')
          }
        }
      }
      
      // Check for specific conditions
      console.log('\n=== Debugging conditions ===')
      
      // Check contract owner
      try {
        const owner = await contract.owner()
        console.log('Contract owner:', owner)
      } catch (e) {
        console.log('Could not get owner:', e.message)
      }
      
      // Check if campaign exists
      const totalCampaigns = await contract.totalCampaigns()
      console.log('Total campaigns:', totalCampaigns.toString())
      
      if (BigInt(campaignId) >= totalCampaigns) {
        console.log('ERROR: Campaign ID >= total campaigns!')
      }
    }

    // Also try simulating with more gas and slightly more value
    console.log('\n=== Trying with extra value ===')
    const tx2 = {
      ...tx,
      value: pricePerEdition + ethers.parseEther('1'), // Add 1 extra BDAG
    }
    
    try {
      const result2 = await provider.call(tx2)
      console.log('✅ With extra value: SUCCESS!')
    } catch (e) {
      console.log('❌ With extra value: Still fails -', e.message?.slice(0, 100))
    }

  } catch (e) {
    console.error('Error:', e.message || e)
  }
}

main()
