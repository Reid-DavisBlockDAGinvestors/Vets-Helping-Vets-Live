import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || process.env.NEXT_PUBLIC_BDAG_USD_RATE || '0.05')
const PLATFORM_FEE_PERCENT = 1 // 1% platform fee

/**
 * GET /api/campaigns/stats?campaignIds=1,2,3
 * Returns on-chain stats for multiple campaigns
 */
export async function GET(req: NextRequest) {
  try {
    const idsParam = req.nextUrl.searchParams.get('campaignIds')
    if (!idsParam) {
      return NextResponse.json({ error: 'campaignIds required' }, { status: 400 })
    }

    const campaignIds = idsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    if (campaignIds.length === 0) {
      return NextResponse.json({ error: 'No valid campaign IDs' }, { status: 400 })
    }

    const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()
    if (!contractAddress) {
      return NextResponse.json({ error: 'Contract not configured' }, { status: 500 })
    }

    // Create Supabase client to fetch submission data for accurate pricing
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { auth: { persistSession: false } }
    )

    // Batch fetch all submissions for these campaign IDs
    const { data: submissions, error: subError } = await supabase
      .from('submissions')
      .select('campaign_id, goal, num_copies, nft_editions, price_per_copy, nft_price')
      .eq('status', 'minted')
      .in('campaign_id', campaignIds)
    
    console.log(`[CampaignStats] Supabase query: campaignIds=${JSON.stringify(campaignIds)}, found=${submissions?.length || 0}, error=${subError?.message || 'none'}`)

    // Build lookup map
    const submissionMap: Record<number, any> = {}
    for (const sub of submissions || []) {
      if (sub.campaign_id != null) {
        submissionMap[sub.campaign_id] = sub
      }
    }
    console.log(`[CampaignStats] Found ${submissions?.length || 0} submissions for ${campaignIds.length} campaigns`)
    console.log(`[CampaignStats] SubmissionMap keys:`, Object.keys(submissionMap))

    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)

    const stats: Record<number, any> = {}

    await Promise.all(campaignIds.map(async (campaignId) => {
      try {
        const camp = await contract.getCampaign(BigInt(campaignId))
        const submission = submissionMap[campaignId]
        
        console.log(`[CampaignStats] Campaign ${campaignId}: submission found=${!!submission}, goal=${submission?.goal}, num_copies=${submission?.num_copies}, nft_editions=${submission?.nft_editions}`)
        
        const grossRaisedWei = BigInt(camp.grossRaised ?? 0n)
        const editionsMinted = Number(camp.editionsMinted ?? 0)
        const maxEditions = Number(camp.maxEditions ?? 0)
        
        // Convert gross raised from BDAG to USD
        const grossRaisedBDAG = Number(grossRaisedWei) / 1e18
        const grossRaisedUSD = grossRaisedBDAG * BDAG_USD_RATE
        
        // Get goal from Supabase, fallback to on-chain goal converted to USD
        const onchainGoalWei = BigInt(camp.goal ?? camp[2] ?? 0n)
        const onchainGoalBDAG = Number(onchainGoalWei) / 1e18
        const onchainGoalUSD = onchainGoalBDAG * BDAG_USD_RATE
        
        // Goal from Supabase is in dollars
        const goalUSD = submission?.goal ? Number(submission.goal) : (onchainGoalUSD > 0 ? onchainGoalUSD : 100)
        const numEditions = Number(submission?.num_copies || submission?.nft_editions || maxEditions || 100)
        
        // Price calculation priority:
        // 1. Explicit nft_price from Supabase (in dollars)
        // 2. Explicit price_per_copy from Supabase (in dollars)
        // 3. Goal / Editions (allows decimals like $0.50)
        // 4. Default to goal / on-chain maxEditions
        let pricePerEditionUSD = 0
        let priceSource = 'none'
        if (submission?.nft_price && Number(submission.nft_price) > 0) {
          pricePerEditionUSD = Number(submission.nft_price)
          priceSource = 'nft_price'
        } else if (submission?.price_per_copy && Number(submission.price_per_copy) > 0) {
          pricePerEditionUSD = Number(submission.price_per_copy)
          priceSource = 'price_per_copy'
        } else if (goalUSD > 0 && numEditions > 0) {
          pricePerEditionUSD = goalUSD / numEditions
          priceSource = `goal(${goalUSD})/editions(${numEditions})`
        } else if (goalUSD > 0 && maxEditions > 0) {
          // Fallback: use on-chain maxEditions directly
          pricePerEditionUSD = goalUSD / maxEditions
          priceSource = `goal(${goalUSD})/maxEditions(${maxEditions})`
        }
        
        console.log(`[CampaignStats] Campaign ${campaignId}: priceSource=${priceSource}, price=$${pricePerEditionUSD.toFixed(4)}`)
        
        // Calculate NFT sales revenue = editions sold × price per edition
        const nftSalesUSD = editionsMinted * pricePerEditionUSD
        
        console.log(`[CampaignStats] Campaign #${campaignId}: goal=$${goalUSD}, editions=${numEditions}, minted=${editionsMinted}, price=$${pricePerEditionUSD.toFixed(2)}, nftSales=$${nftSalesUSD.toFixed(2)}, grossRaised=$${grossRaisedUSD.toFixed(2)}`)
        
        // Tips = gross raised - NFT sales (anything paid above NFT price)
        const tipsUSD = Math.max(0, grossRaisedUSD - nftSalesUSD)
        
        // Net after 1% platform fee (gas is paid by donor, not deducted from funds)
        const netRaisedUSD = grossRaisedUSD * (1 - PLATFORM_FEE_PERCENT / 100)
        
        // Remaining editions
        const remainingEditions = maxEditions > 0 ? maxEditions - editionsMinted : null
        
        stats[campaignId] = {
          campaignId,
          editionsMinted,
          maxEditions,
          remainingEditions,
          pricePerEditionUSD,
          nftSalesUSD,
          tipsUSD,
          grossRaisedUSD,
          netRaisedUSD, // 99% of gross (1% platform fee)
          totalRaisedUSD: grossRaisedUSD,
          active: camp.active ?? true,
          // Debug info
          _debug: {
            submissionFound: !!submission,
            goalUSD,
            numEditions,
            priceSource,
            onchainMaxEditions: maxEditions
          },
          closed: camp.closed ?? false,
          progressPercent: maxEditions > 0 ? Math.round((editionsMinted / maxEditions) * 100) : 0,
        }
      } catch (e: any) {
        console.error(`Error fetching campaign ${campaignId}:`, e?.message)
        stats[campaignId] = { error: 'Campaign not found', campaignId }
      }
    }))

    return NextResponse.json({ 
      stats,
      _queryDebug: {
        requestedIds: campaignIds,
        foundSubmissions: submissions?.length || 0,
        supabaseError: subError?.message || null,
        submissionMapKeys: Object.keys(submissionMap)
      }
    })
  } catch (e: any) {
    console.error('Campaign stats error:', e)
    return NextResponse.json({ error: 'FETCH_FAILED', details: e?.message }, { status: 500 })
  }
}
