import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { ethers } from 'ethers'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const V5_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const RPC_URL = process.env.BLOCKDAG_RPC || 'https://bdag.nownodes.io'
const API_KEY = process.env.NOWNODES_API_KEY || ''

const V5_ABI = [
  'function totalCampaigns() view returns (uint256)',
  'function getCampaign(uint256) view returns (uint8 category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)'
]

async function audit() {
  console.log('=== SUBMISSION AUDIT ===\n')
  
  // 1. Get all pending/approved submissions
  const { data: pending, error: pendingErr } = await supabase
    .from('submissions')
    .select('*')
    .in('status', ['pending', 'approved'])
    .order('created_at', { ascending: false })
  
  if (pendingErr) {
    console.error('Error fetching pending:', pendingErr)
    return
  }
  
  console.log(`Found ${pending?.length || 0} pending/approved submissions:\n`)
  for (const sub of pending || []) {
    console.log(`- ${sub.title || 'Untitled'}`)
    console.log(`  ID: ${sub.id}`)
    console.log(`  Status: ${sub.status}`)
    console.log(`  Creator: ${sub.creator_email}`)
    console.log(`  Wallet: ${sub.creator_wallet?.slice(0, 10)}...`)
    console.log(`  Campaign ID: ${sub.campaign_id ?? 'NOT SET'}`)
    console.log(`  Created: ${sub.created_at}`)
    console.log('')
  }
  
  // 2. Get all minted submissions to find orphans
  const { data: minted } = await supabase
    .from('submissions')
    .select('campaign_id, title')
    .eq('status', 'minted')
  
  const dbCampaignIds = new Set((minted || []).map(s => s.campaign_id).filter(c => c != null))
  console.log(`\n=== DATABASE CAMPAIGN IDS (${dbCampaignIds.size}) ===`)
  console.log([...dbCampaignIds].sort((a: any, b: any) => a - b).join(', '))
  
  // 3. Check on-chain campaigns
  console.log('\n=== ON-CHAIN CAMPAIGN CHECK ===')
  
  // Create provider with NowNodes API key
  const fetchReq = new ethers.FetchRequest(RPC_URL)
  if (API_KEY && RPC_URL.includes('nownodes')) {
    fetchReq.setHeader('api-key', API_KEY)
  }
  const provider = new ethers.JsonRpcProvider(fetchReq, undefined, {
    staticNetwork: true,
    batchMaxCount: 1
  })
  
  const contract = new ethers.Contract(V5_ADDRESS, V5_ABI, provider)
  
  try {
    const total = Number(await contract.totalCampaigns())
    console.log(`Total on-chain campaigns: ${total}`)
    
    // Find orphan campaigns (on-chain but not in DB)
    const orphans: number[] = []
    for (let i = 0; i < total; i++) {
      if (!dbCampaignIds.has(i)) {
        orphans.push(i)
      }
    }
    
    console.log(`\nOrphan campaigns (on-chain, no DB record): ${orphans.length}`)
    console.log(orphans.join(', '))
    
    // Get details for Campaign #38 specifically
    if (orphans.includes(38)) {
      console.log('\n=== CAMPAIGN #38 DETAILS (HIGH VALUE ORPHAN) ===')
      const camp38 = await contract.getCampaign(38)
      console.log(`Category: ${camp38.category}`)
      console.log(`BaseURI: ${camp38.baseURI}`)
      console.log(`Goal: ${ethers.formatEther(camp38.goal)} BDAG`)
      console.log(`Gross Raised: ${ethers.formatEther(camp38.grossRaised)} BDAG`)
      console.log(`Editions Minted: ${camp38.editionsMinted}`)
      console.log(`Max Editions: ${camp38.maxEditions}`)
      console.log(`Price Per Edition: ${ethers.formatEther(camp38.pricePerEdition)} BDAG`)
      console.log(`Active: ${camp38.active}`)
      console.log(`Closed: ${camp38.closed}`)
    }
    
  } catch (err: any) {
    console.error('On-chain error:', err?.message)
  }
}

audit().catch(console.error)
