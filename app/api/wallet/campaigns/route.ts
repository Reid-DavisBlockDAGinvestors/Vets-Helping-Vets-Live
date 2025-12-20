import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'
import { getContractByAddress, V5_ABI, V6_ABI } from '@/lib/contracts'

export const dynamic = 'force-dynamic'

const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || process.env.NEXT_PUBLIC_BDAG_USD_RATE || '0.05')

// V5 contract address for fallback
const V5_CONTRACT = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'

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

    const provider = getProvider()
    
    // Cache contracts by address to avoid recreating them
    const contractCache: Record<string, ethers.Contract> = {}
    
    function getContractForSubmission(subContractAddr: string | null): ethers.Contract | null {
      const addr = (subContractAddr || V5_CONTRACT).toLowerCase()
      if (!addr) return null
      
      if (!contractCache[addr]) {
        // Use V5 ABI for V5 contract, V6 ABI for others (V6 extends V5)
        const isV5 = addr.toLowerCase() === V5_CONTRACT.toLowerCase()
        const abi = isV5 ? V5_ABI : V6_ABI
        contractCache[addr] = new ethers.Contract(addr, abi, provider)
      }
      return contractCache[addr]
    }

    // Enrich with on-chain data if available
    const campaigns = await Promise.all(
      (submissions || []).map(async (sub) => {
        let onchainData: any = null

        // Use the submission's specific contract_address for on-chain queries
        const contract = getContractForSubmission(sub.contract_address)
        
        if (contract && sub.campaign_id != null) {
          try {
            const camp = await contract.getCampaign(sub.campaign_id)
            const grossRaisedWei = BigInt(camp.grossRaised ?? camp[3] ?? 0n)
            const grossRaisedBDAG = Number(grossRaisedWei) / 1e18
            const grossRaisedUSD = grossRaisedBDAG * BDAG_USD_RATE
            
            const editionsMinted = Number(camp.editionsMinted ?? camp[6] ?? 0)
            const maxEditions = Number(camp.maxEditions ?? camp[7] ?? 0)
            
            // Calculate price per edition and NFT sales
            const goalUSD = Number(sub.goal || 0)
            const numEditions = Number(sub.num_copies || maxEditions || 100)
            const pricePerCopy = Number(sub.price_per_copy || (goalUSD > 0 && numEditions > 0 ? goalUSD / numEditions : 0))
            
            const nftSalesUSD = editionsMinted * pricePerCopy
            const tipsUSD = Math.max(0, grossRaisedUSD - nftSalesUSD)
            
            onchainData = {
              grossRaised: grossRaisedUSD,
              nftSalesUSD,
              tipsUSD,
              editionsMinted,
              maxEditions,
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
          // Contract info for multi-contract support
          contractAddress: sub.contract_address,
          contractVersion: sub.contract_version || 'v5',
          // On-chain data
          raised: onchainData?.grossRaised || 0,
          nftSalesUSD: onchainData?.nftSalesUSD || 0,
          tipsUSD: onchainData?.tipsUSD || 0,
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
