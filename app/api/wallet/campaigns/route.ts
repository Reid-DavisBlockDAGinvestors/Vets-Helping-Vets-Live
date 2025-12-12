import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'

export const dynamic = 'force-dynamic'

const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || process.env.NEXT_PUBLIC_BDAG_USD_RATE || '0.05')

/**
 * GET /api/wallet/campaigns?address=0x...
 * Returns all fundraiser campaigns created by a wallet address
 */
export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get('address')
    if (!address || !ethers.isAddress(address)) {
      return NextResponse.json({ error: 'INVALID_ADDRESS' }, { status: 400 })
    }

    // Query Supabase for submissions by this creator wallet
    const { data: submissions, error } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .ilike('creator_wallet', address) // Case-insensitive match
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: 'QUERY_FAILED', details: error.message }, { status: 500 })
    }

    const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()
    const provider = getProvider()
    const contract = contractAddress ? new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider) : null

    // Enrich with on-chain data if available
    const campaigns = await Promise.all(
      (submissions || []).map(async (sub) => {
        let onchainData: any = null

        if (contract && sub.campaign_id != null) {
          try {
            const camp = await contract.getCampaign(sub.campaign_id)
            const netRaisedWei = BigInt(camp.netRaised ?? camp[4] ?? 0n)
            const netRaisedBDAG = Number(netRaisedWei) / 1e18
            
            onchainData = {
              grossRaised: Number(BigInt(camp.grossRaised ?? camp[3] ?? 0n)) / 1e18 * BDAG_USD_RATE,
              netRaised: netRaisedBDAG * BDAG_USD_RATE,
              editionsMinted: Number(camp.editionsMinted ?? camp[6] ?? 0),
              maxEditions: Number(camp.maxEditions ?? camp[7] ?? 0),
              active: camp.active ?? camp[8] ?? true,
              closed: camp.closed ?? camp[9] ?? false
            }
          } catch (e: any) {
            console.error(`Failed to get on-chain data for campaign ${sub.campaign_id}:`, e?.message)
          }
        }

        // Get pending updates count
        let pendingUpdates = 0
        try {
          const { count } = await supabaseAdmin
            .from('campaign_updates')
            .select('*', { count: 'exact', head: true })
            .eq('submission_id', sub.id)
            .eq('status', 'pending')
          pendingUpdates = count || 0
        } catch {}

        // Get approved updates for display
        let latestUpdate: any = null
        try {
          const { data: updates } = await supabaseAdmin
            .from('campaign_updates')
            .select('*')
            .eq('submission_id', sub.id)
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
            .limit(1)
          latestUpdate = updates?.[0] || null
        } catch {}

        return {
          id: sub.id,
          campaignId: sub.campaign_id,
          tokenId: sub.token_id,
          title: sub.title,
          story: sub.story,
          category: sub.category,
          goal: sub.goal,
          imageUri: sub.image_uri,
          metadataUri: sub.metadata_uri,
          status: sub.status,
          soldCount: sub.sold_count || 0,
          numCopies: sub.num_copies,
          pricePerCopy: sub.price_per_copy,
          benchmarks: sub.benchmarks,
          createdAt: sub.created_at,
          // On-chain data
          raised: onchainData?.netRaised || 0,
          editionsMinted: onchainData?.editionsMinted || 0,
          maxEditions: onchainData?.maxEditions || sub.num_copies || 0,
          active: onchainData?.active ?? true,
          closed: onchainData?.closed ?? false,
          // Update info
          pendingUpdates,
          latestUpdate,
          canUpdate: ['approved', 'minted'].includes(sub.status) && sub.campaign_id != null
        }
      })
    )

    return NextResponse.json({
      address,
      count: campaigns.length,
      campaigns
    })
  } catch (e: any) {
    console.error('Wallet campaigns error:', e)
    return NextResponse.json({ error: 'FETCH_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}
