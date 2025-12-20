import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getProvider } from '@/lib/onchain'
import { getAllDeployedContracts, V5_ABI, V6_ABI } from '@/lib/contracts'
import { ethers } from 'ethers'

export const dynamic = 'force-dynamic'

const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || process.env.NEXT_PUBLIC_BDAG_USD_RATE || '0.05')

export async function GET(_req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { auth: { persistSession: false } }
    )

    // Get all deployed contracts (V5, V6, etc.)
    const deployedContracts = getAllDeployedContracts()
    console.log(`[Analytics] Querying ${deployedContracts.length} deployed contracts...`)
    
    // Get minted campaigns from Supabase WITH contract_address
    const { data: submissions, error: subError } = await supabase
      .from('submissions')
      .select('id, campaign_id, title, goal, num_copies, contract_address')
      .eq('status', 'minted')
      .not('campaign_id', 'is', null)

    if (subError) {
      console.error('[Analytics] Supabase error:', subError)
    }

    // Group campaigns by contract address - FALL BACK TO V5 FOR ORPHANED SUBMISSIONS
    const V5_CONTRACT = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'.toLowerCase()
    const campaignsByContract: Record<string, Array<{ id: number; title: string }>> = {}
    let orphanedCount = 0
    
    for (const sub of submissions || []) {
      // If no contract_address, assume V5 (legacy submissions)
      let addr = (sub.contract_address || '').toLowerCase()
      if (!addr && sub.campaign_id != null) {
        addr = V5_CONTRACT
        orphanedCount++
      }
      
      if (addr && sub.campaign_id != null) {
        if (!campaignsByContract[addr]) campaignsByContract[addr] = []
        if (!campaignsByContract[addr].find(c => c.id === sub.campaign_id)) {
          campaignsByContract[addr].push({ id: sub.campaign_id, title: sub.title || '' })
        }
      }
    }
    
    if (orphanedCount > 0) {
      console.log(`[Analytics] ${orphanedCount} orphaned submissions (no contract_address) assigned to V5`)
    }

    console.log('[Analytics] Campaigns by contract:', 
      Object.entries(campaignsByContract).map(([addr, camps]) => `${addr.slice(0, 10)}...: ${camps.length} campaigns`)
    )

    let totalRaisedUSD = 0
    let totalNftsMinted = 0
    let totalCampaigns = 0

    // Query each deployed contract
    const provider = getProvider()
    
    for (const contractInfo of deployedContracts) {
      const addr = contractInfo.address.toLowerCase()
      const abi = contractInfo.version === 'v5' ? V5_ABI : V6_ABI
      const contract = new ethers.Contract(contractInfo.address, abi, provider)
      
      const campaigns = campaignsByContract[addr] || []
      
      // Get total NFT supply for this contract
      try {
        const supply = await contract.totalSupply()
        totalNftsMinted += Number(supply)
      } catch (e: any) {
        console.error(`[Analytics] Error getting totalSupply for ${contractInfo.version}:`, e?.message)
      }
      
      // Query each campaign's grossRaised
      for (const campaign of campaigns) {
        try {
          const camp = await contract.getCampaign(BigInt(campaign.id))
          const grossRaisedWei = BigInt(camp.grossRaised ?? camp[3] ?? 0n)
          const grossRaisedBDAG = Number(grossRaisedWei) / 1e18
          const raisedUSD = grossRaisedBDAG * BDAG_USD_RATE
          
          totalRaisedUSD += raisedUSD
          totalCampaigns++
          
          console.log(`[Analytics] ${contractInfo.version} Campaign #${campaign.id}: raised=$${raisedUSD.toFixed(2)} BDAG=${grossRaisedBDAG.toFixed(2)}`)
        } catch (e: any) {
          console.error(`[Analytics] Error fetching ${contractInfo.version} campaign ${campaign.id}:`, e?.message)
        }
      }
    }
    
    console.log(`[Analytics] TOTALS: raised=$${totalRaisedUSD.toFixed(2)}, nfts=${totalNftsMinted}, campaigns=${totalCampaigns}`)

    // Calculate donor retention from purchases table
    // (% of wallets that purchased from 2+ different campaigns)
    let donorRetention = 0
    let totalUniqueWallets = 0
    let repeatDonors = 0
    
    try {
      // Get all purchases grouped by wallet
      const { data: purchases } = await supabase
        .from('purchases')
        .select('wallet_address, campaign_id')
      
      if (purchases && purchases.length > 0) {
        // Build map of wallet -> Set of campaign IDs
        const walletCampaigns: Record<string, Set<number>> = {}
        for (const p of purchases) {
          const wallet = p.wallet_address?.toLowerCase()
          if (wallet && p.campaign_id != null) {
            if (!walletCampaigns[wallet]) {
              walletCampaigns[wallet] = new Set()
            }
            walletCampaigns[wallet].add(p.campaign_id)
          }
        }
        
        // Calculate retention
        const wallets = Object.keys(walletCampaigns)
        totalUniqueWallets = wallets.length
        repeatDonors = wallets.filter(w => walletCampaigns[w].size >= 2).length
        
        if (totalUniqueWallets > 0) {
          donorRetention = Math.round((repeatDonors / totalUniqueWallets) * 100)
        }
        
        console.log(`[Analytics] Donor Retention: ${repeatDonors}/${totalUniqueWallets} wallets (${donorRetention}%) from purchases table`)
      }
    } catch (e: any) {
      console.error('[Analytics] Donor retention calc error:', e?.message)
      // Table might not exist yet - that's OK
    }

    // Get milestone count (approved campaign updates) and list of campaigns with milestones
    const { data: milestoneData, count: milestones } = await supabase
      .from('campaign_updates')
      .select('submission_id, title, created_at', { count: 'exact' })
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(50)

    // Get submission IDs that have approved milestones
    const milestonedSubmissionIds = [...new Set((milestoneData || []).map(m => m.submission_id))]

    // Count milestones per submission
    const milestonesPerSubmission: Record<string, number> = {}
    for (const m of milestoneData || []) {
      milestonesPerSubmission[m.submission_id] = (milestonesPerSubmission[m.submission_id] || 0) + 1
    }

    return NextResponse.json({
      fundsRaised: Math.round(totalRaisedUSD * 100) / 100,
      purchases: totalNftsMinted, // NFTs sold = purchases
      mints: totalCampaigns, // Campaigns minted
      milestones: milestones || 0,
      donorRetention, // % of wallets that purchased from 2+ campaigns
      totalUniqueWallets,
      repeatDonors,
      // Detailed milestone info
      milestonedSubmissionIds,
      milestonesPerSubmission,
      recentMilestones: (milestoneData || []).slice(0, 10)
    })
  } catch (e: any) {
    console.error('[Analytics] Error:', e)
    return NextResponse.json({
      fundsRaised: 0,
      purchases: 0,
      mints: 0,
      milestones: 0,
      donorRetention: 0,
      milestonedSubmissionIds: [],
      milestonesPerSubmission: {},
      recentMilestones: [],
      error: e?.message
    })
  }
}
