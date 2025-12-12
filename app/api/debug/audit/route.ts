import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    supabase: {},
    onchain: {},
    discrepancies: []
  }
  
  // 1. Get ALL submissions from Supabase (no filters)
  const { data: allSubs, error: subError } = await supabaseAdmin
    .from('submissions')
    .select('id, status, campaign_id, token_id, title, visible_on_marketplace, contract_address, created_at')
    .order('created_at', { ascending: false })
  
  results.supabase.allSubmissions = allSubs || []
  results.supabase.error = subError?.message || null
  results.supabase.totalCount = allSubs?.length || 0
  
  // Group by status
  const byStatus: Record<string, number> = {}
  for (const sub of allSubs || []) {
    byStatus[sub.status] = (byStatus[sub.status] || 0) + 1
  }
  results.supabase.byStatus = byStatus
  
  // 2. Get minted submissions specifically
  const mintedSubs = (allSubs || []).filter((s: any) => s.status === 'minted')
  results.supabase.mintedCount = mintedSubs.length
  results.supabase.mintedSubmissions = mintedSubs.map((s: any) => ({
    id: s.id,
    campaign_id: s.campaign_id,
    title: s.title?.slice(0, 30),
    visible: s.visible_on_marketplace,
    contract: s.contract_address?.slice(0, 12)
  }))
  
  // 3. Check marketplace_contracts table
  const { data: contracts, error: contractsError } = await supabaseAdmin
    .from('marketplace_contracts')
    .select('*')
  results.supabase.marketplaceContracts = contracts || []
  results.supabase.marketplaceContractsError = contractsError?.message || null
  
  // 4. Get on-chain campaign count
  const contractAddress = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS
  if (contractAddress) {
    try {
      const provider = getProvider()
      const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)
      
      const totalCampaigns = await contract.totalCampaigns()
      results.onchain.contractAddress = contractAddress
      results.onchain.totalCampaigns = Number(totalCampaigns)
      
      // Get details for each campaign
      const campaigns: any[] = []
      for (let i = 0; i < Number(totalCampaigns); i++) {
        try {
          const camp = await contract.getCampaign(BigInt(i))
          campaigns.push({
            campaignId: i,
            category: camp.category,
            baseURI: camp.baseURI?.slice(0, 50),
            goal: Number(camp.goal) / 1e18,
            editionsMinted: Number(camp.editionsMinted),
            maxEditions: Number(camp.maxEditions),
            active: camp.active,
            closed: camp.closed
          })
        } catch (e: any) {
          campaigns.push({ campaignId: i, error: e?.message?.slice(0, 50) })
        }
      }
      results.onchain.campaigns = campaigns
    } catch (e: any) {
      results.onchain.error = e?.message || String(e)
    }
  } else {
    results.onchain.error = 'No contract address configured'
  }
  
  // 5. Check for discrepancies
  // Campaigns on-chain that aren't in Supabase
  const supabaseCampaignIds = new Set(mintedSubs.map((s: any) => s.campaign_id))
  for (const camp of results.onchain.campaigns || []) {
    if (!camp.error && !supabaseCampaignIds.has(camp.campaignId)) {
      results.discrepancies.push({
        type: 'ONCHAIN_MISSING_IN_SUPABASE',
        campaignId: camp.campaignId,
        details: `Campaign ${camp.campaignId} exists on-chain but not in Supabase submissions`
      })
    }
  }
  
  // Supabase campaigns that don't exist on-chain
  const onchainCampaignIds = new Set((results.onchain.campaigns || []).map((c: any) => c.campaignId))
  for (const sub of mintedSubs) {
    if (sub.campaign_id != null && !onchainCampaignIds.has(sub.campaign_id)) {
      results.discrepancies.push({
        type: 'SUPABASE_MISSING_ONCHAIN',
        submissionId: sub.id,
        campaignId: sub.campaign_id,
        details: `Submission ${sub.id.slice(0,8)} references campaign ${sub.campaign_id} but it doesn't exist on-chain`
      })
    }
  }
  
  // 6. Environment info
  results.env = {
    CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS?.slice(0, 12) + '...',
    NEXT_PUBLIC_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.slice(0, 12) + '...',
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30) + '...',
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  }
  
  return NextResponse.json(results, { 
    headers: { 'Cache-Control': 'no-store' }
  })
}
