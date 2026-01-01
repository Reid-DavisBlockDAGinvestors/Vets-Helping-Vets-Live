#!/usr/bin/env node
/**
 * Query specific campaigns on-chain - Larry Odom (#4) and Anthony Turner (#38)
 */

const { ethers } = require('ethers')
require('dotenv').config({ path: '.env.local' })

const V5_CONTRACT = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const V6_CONTRACT = '0xaE54e4E8A75a81780361570c17b8660CEaD27053'

// Use NowNodes with API key
const RPC_URL = 'https://bdag.nownodes.io'
const API_KEY = process.env.NOWNODES_API_KEY || ''

const CAMPAIGN_ABI = [
  'function totalSupply() view returns (uint256)',
  'function getCampaign(uint256 campaignId) view returns (tuple(address recipient, string metadataURI, uint256 pricePerEdition, uint256 grossRaised, uint256 tipsCollected, uint256 editionsMinted, uint256 maxEditions, uint256 createdAt, bool active, bool closed))',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)'
]

async function main() {
  console.log('🔍 SPECIFIC CAMPAIGN AUDIT\n')
  
  // Create provider with NowNodes API key
  const fetchRequest = new ethers.FetchRequest(RPC_URL)
  fetchRequest.setHeader('api-key', API_KEY)
  const provider = new ethers.JsonRpcProvider(fetchRequest, 1043, { staticNetwork: true })
  
  // Test connection
  const block = await provider.getBlockNumber()
  console.log(`✅ Connected to BlockDAG. Block: ${block}\n`)
  
  const v5 = new ethers.Contract(V5_CONTRACT, CAMPAIGN_ABI, provider)
  const v6 = new ethers.Contract(V6_CONTRACT, CAMPAIGN_ABI, provider)
  
  // Get total supplies
  console.log('=== CONTRACT TOTAL SUPPLIES ===')
  try {
    const v5Supply = await v5.totalSupply()
    console.log(`V5 totalSupply: ${v5Supply}`)
  } catch (e: any) {
    console.log(`V5 totalSupply error: ${e.message}`)
  }
  
  try {
    const v6Supply = await v6.totalSupply()
    console.log(`V6 totalSupply: ${v6Supply}`)
  } catch (e: any) {
    console.log(`V6 totalSupply error: ${e.message}`)
  }
  
  // Query specific campaigns
  const campaignsToCheck = [
    { id: 4, name: 'Larry Odom', contract: v5, contractName: 'V5' },
    { id: 38, name: 'Anthony Turner', contract: v6, contractName: 'V6' },
    { id: 1, name: 'Shriners', contract: v5, contractName: 'V5' },
    { id: 2, name: 'Reid & Gravy', contract: v6, contractName: 'V6' },
    { id: 5, name: 'Reid Davis', contract: v5, contractName: 'V5' },
  ]
  
  console.log('\n=== SPECIFIC CAMPAIGN DATA ===\n')
  
  for (const camp of campaignsToCheck) {
    console.log(`--- Campaign #${camp.id}: ${camp.name} (${camp.contractName}) ---`)
    try {
      const data = await camp.contract.getCampaign(BigInt(camp.id))
      
      const grossRaisedBDAG = Number(BigInt(data.grossRaised || data[3] || 0n)) / 1e18
      const tipsBDAG = Number(BigInt(data.tipsCollected || data[4] || 0n)) / 1e18
      const editionsMinted = Number(data.editionsMinted || data[5] || 0)
      const maxEditions = Number(data.maxEditions || data[6] || 0)
      const active = data.active ?? data[8] ?? true
      const closed = data.closed ?? data[9] ?? false
      
      const isSoldOut = editionsMinted >= maxEditions
      
      console.log(`  Editions: ${editionsMinted} / ${maxEditions} ${isSoldOut ? '🔴 SOLD OUT' : '🟢 Available'}`)
      console.log(`  Gross Raised: ${grossRaisedBDAG.toFixed(2)} BDAG ($${(grossRaisedBDAG * 0.05).toFixed(2)} USD)`)
      console.log(`  Tips: ${tipsBDAG.toFixed(2)} BDAG`)
      console.log(`  Active: ${active}, Closed: ${closed}`)
      console.log('')
    } catch (e: any) {
      console.log(`  ❌ Error: ${e.message?.slice(0, 100)}`)
      console.log('')
    }
  }
  
  // Also check if Anthony Turner might be on V5 instead
  console.log('--- Checking Anthony Turner on V5 (in case wrong contract) ---')
  try {
    const data = await v5.getCampaign(BigInt(38))
    const editionsMinted = Number(data.editionsMinted || data[5] || 0)
    const maxEditions = Number(data.maxEditions || data[6] || 0)
    console.log(`  V5 Campaign #38: ${editionsMinted}/${maxEditions}`)
  } catch (e: any) {
    console.log(`  V5 Campaign #38: ${e.message?.slice(0, 80)}`)
  }
  
  // Query campaigns 1-50 on V5 to get full picture
  console.log('\n=== ALL V5 CAMPAIGNS (1-50) ===\n')
  let totalV5Editions = 0
  let totalV5RaisedBDAG = 0
  
  for (let i = 1; i <= 60; i++) {
    try {
      const data = await v5.getCampaign(BigInt(i))
      const editionsMinted = Number(data.editionsMinted || data[5] || 0)
      const maxEditions = Number(data.maxEditions || data[6] || 0)
      const grossRaisedBDAG = Number(BigInt(data.grossRaised || data[3] || 0n)) / 1e18
      
      if (editionsMinted > 0 || maxEditions > 0) {
        totalV5Editions += editionsMinted
        totalV5RaisedBDAG += grossRaisedBDAG
        const status = editionsMinted >= maxEditions ? '🔴 SOLD OUT' : `🟢 ${maxEditions - editionsMinted} left`
        console.log(`V5 #${i}: ${editionsMinted}/${maxEditions} | $${(grossRaisedBDAG * 0.05).toFixed(2)} | ${status}`)
      }
    } catch (e: any) {
      // Campaign doesn't exist
    }
  }
  
  console.log(`\nV5 TOTAL: ${totalV5Editions} editions, $${(totalV5RaisedBDAG * 0.05).toFixed(2)} raised`)
  
  // Query V6 campaigns
  console.log('\n=== ALL V6 CAMPAIGNS (1-50) ===\n')
  let totalV6Editions = 0
  let totalV6RaisedBDAG = 0
  
  for (let i = 1; i <= 50; i++) {
    try {
      const data = await v6.getCampaign(BigInt(i))
      const editionsMinted = Number(data.editionsMinted || data[5] || 0)
      const maxEditions = Number(data.maxEditions || data[6] || 0)
      const grossRaisedBDAG = Number(BigInt(data.grossRaised || data[3] || 0n)) / 1e18
      
      if (editionsMinted > 0 || maxEditions > 0) {
        totalV6Editions += editionsMinted
        totalV6RaisedBDAG += grossRaisedBDAG
        const status = editionsMinted >= maxEditions ? '🔴 SOLD OUT' : `🟢 ${maxEditions - editionsMinted} left`
        console.log(`V6 #${i}: ${editionsMinted}/${maxEditions} | $${(grossRaisedBDAG * 0.05).toFixed(2)} | ${status}`)
      }
    } catch (e: any) {
      // Campaign doesn't exist
    }
  }
  
  console.log(`\nV6 TOTAL: ${totalV6Editions} editions, $${(totalV6RaisedBDAG * 0.05).toFixed(2)} raised`)
  
  console.log('\n=== GRAND TOTAL ===')
  console.log(`Total Editions: ${totalV5Editions + totalV6Editions}`)
  console.log(`Total Raised: $${((totalV5RaisedBDAG + totalV6RaisedBDAG) * 0.05).toFixed(2)} USD`)
}

main().catch(console.error)
