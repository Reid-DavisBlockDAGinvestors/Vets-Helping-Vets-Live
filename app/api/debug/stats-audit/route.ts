import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ethers } from 'ethers'
import { getProvider } from '@/lib/onchain'
import { getAllDeployedContracts, V5_ABI, V6_ABI } from '@/lib/contracts'

export const dynamic = 'force-dynamic'

const V5_CONTRACT = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const V6_CONTRACT = '0xaE54e4E8A75a81780361570c17b8660CEaD27053'
const BDAG_USD_RATE = 0.05

/**
 * Debug endpoint to audit stats calculation across all data sources
 * GET /api/debug/stats-audit
 */
export async function GET(_req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false } }
  )

  // 1. Get ALL minted submissions
  const { data: allSubmissions, error } = await supabase
    .from('submissions')
    .select('id, campaign_id, title, status, contract_address, goal, num_copies')
    .eq('status', 'minted')
    .not('campaign_id', 'is', null)
    .order('campaign_id', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 2. Categorize submissions
  const withContractAddr = allSubmissions?.filter(s => s.contract_address && s.contract_address.trim() !== '') || []
  const orphaned = allSubmissions?.filter(s => !s.contract_address || s.contract_address.trim() === '') || []
  
  const byV5 = withContractAddr.filter(s => s.contract_address?.toLowerCase() === V5_CONTRACT.toLowerCase())
  const byV6 = withContractAddr.filter(s => s.contract_address?.toLowerCase() === V6_CONTRACT.toLowerCase())
  const byOther = withContractAddr.filter(s => 
    s.contract_address?.toLowerCase() !== V5_CONTRACT.toLowerCase() && 
    s.contract_address?.toLowerCase() !== V6_CONTRACT.toLowerCase()
  )

  // 3. Query on-chain data
  const provider = getProvider()
  const onchainStats: Record<string, any> = {}
  
  for (const [name, addr, abi] of [
    ['V5', V5_CONTRACT, V5_ABI],
    ['V6', V6_CONTRACT, V6_ABI]
  ] as const) {
    try {
      const contract = new ethers.Contract(addr, abi, provider)
      const totalSupply = await contract.totalSupply()
      const totalCampaigns = await contract.totalCampaigns()
      
      let totalRaisedBDAG = 0
      let totalEditionsMinted = 0
      const campaignDetails: any[] = []
      
      for (let i = 1; i <= Number(totalCampaigns); i++) {
        try {
          const camp = await contract.getCampaign(i)
          const grossRaisedWei = BigInt(camp.grossRaised ?? camp[3] ?? 0n)
          const grossRaisedBDAG = Number(grossRaisedWei) / 1e18
          const editionsMinted = Number(camp.editionsMinted ?? camp[5] ?? 0)
          
          totalRaisedBDAG += grossRaisedBDAG
          totalEditionsMinted += editionsMinted
          
          // Find matching submission
          const dbSubmission = allSubmissions?.find(s => 
            s.campaign_id === i && 
            (s.contract_address?.toLowerCase() === addr.toLowerCase() || (!s.contract_address && name === 'V5'))
          )
          
          campaignDetails.push({
            campaignId: i,
            editionsMinted,
            grossRaisedBDAG,
            grossRaisedUSD: grossRaisedBDAG * BDAG_USD_RATE,
            inDatabase: !!dbSubmission,
            dbTitle: dbSubmission?.title?.slice(0, 30) || null,
            dbContractAddr: dbSubmission?.contract_address || 'MISSING'
          })
        } catch (e) {
          // Campaign doesn't exist
        }
      }
      
      onchainStats[name] = {
        address: addr,
        totalSupply: Number(totalSupply),
        totalCampaigns: Number(totalCampaigns),
        totalRaisedBDAG,
        totalRaisedUSD: totalRaisedBDAG * BDAG_USD_RATE,
        totalEditionsMinted,
        campaigns: campaignDetails
      }
    } catch (e: any) {
      onchainStats[name] = { error: e?.message }
    }
  }

  // 4. Calculate expected totals
  const v5Stats = onchainStats['V5'] || {}
  const v6Stats = onchainStats['V6'] || {}
  
  const expectedTotalRaisedUSD = (v5Stats.totalRaisedUSD || 0) + (v6Stats.totalRaisedUSD || 0)
  const expectedTotalNFTs = (v5Stats.totalSupply || 0) + (v6Stats.totalSupply || 0)
  const expectedTotalCampaigns = (v5Stats.totalCampaigns || 0) + (v6Stats.totalCampaigns || 0)

  return NextResponse.json({
    summary: {
      expectedTotalRaisedUSD,
      expectedTotalNFTs,
      expectedTotalCampaigns,
      dbMintedSubmissions: allSubmissions?.length || 0,
      dbWithContractAddr: withContractAddr.length,
      dbOrphaned: orphaned.length,
      dbByV5: byV5.length,
      dbByV6: byV6.length,
      dbByOther: byOther.length
    },
    orphanedSubmissions: orphaned.map(s => ({
      campaignId: s.campaign_id,
      title: s.title?.slice(0, 40),
      goal: s.goal
    })),
    onchainStats,
    diagnosis: {
      issue: orphaned.length > 0 
        ? `${orphaned.length} submissions missing contract_address - these are NOT being counted in stats!`
        : 'All submissions have contract_address',
      recommendation: orphaned.length > 0
        ? 'Run backfill to set contract_address for orphaned submissions (likely V5)'
        : 'No action needed'
    }
  })
}
