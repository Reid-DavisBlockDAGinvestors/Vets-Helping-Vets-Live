import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'

export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false } }
  )
}

const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || '0.05')

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const contractAddress = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''
    
    // Get all minted submissions
    const { data: subs } = await supabase
      .from('submissions')
      .select('id, title, goal, campaign_id, status, visible_on_marketplace')
      .eq('status', 'minted')
      .order('created_at', { ascending: false })
    
    if (!subs || subs.length === 0) {
      return NextResponse.json({ message: 'No minted submissions', contractAddress })
    }
    
    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)
    
    const results = await Promise.all(subs.map(async (sub) => {
      const campaignId = sub.campaign_id
      if (campaignId == null) {
        return { ...sub, onchain: null, error: 'No campaign_id' }
      }
      
      try {
        const camp = await contract.getCampaign(BigInt(campaignId))
        const goalWei = BigInt(camp.goal ?? 0n)
        const netRaisedWei = BigInt(camp.netRaised ?? 0n)
        const grossRaisedWei = BigInt(camp.grossRaised ?? 0n)
        const priceWei = BigInt(camp.pricePerEdition ?? 0n)
        
        // Convert from wei (18 decimals) to BDAG
        const goalBDAG = Number(goalWei) / 1e18
        const netRaisedBDAG = Number(netRaisedWei) / 1e18
        const grossRaisedBDAG = Number(grossRaisedWei) / 1e18
        const priceBDAG = Number(priceWei) / 1e18
        
        // Convert BDAG to USD
        const goalUSD = goalBDAG * BDAG_USD_RATE
        const netRaisedUSD = netRaisedBDAG * BDAG_USD_RATE
        const grossRaisedUSD = grossRaisedBDAG * BDAG_USD_RATE
        const priceUSD = priceBDAG * BDAG_USD_RATE
        
        return {
          id: sub.id?.slice(0, 8),
          title: sub.title,
          supabaseGoal: sub.goal, // Goal stored in Supabase (USD)
          campaignId,
          onchain: {
            category: camp.category,
            goalWei: goalWei.toString(),
            goalBDAG,
            goalUSD,
            netRaisedWei: netRaisedWei.toString(),
            netRaisedBDAG,
            netRaisedUSD,
            grossRaisedWei: grossRaisedWei.toString(),
            grossRaisedBDAG,
            grossRaisedUSD,
            editionsMinted: Number(camp.editionsMinted ?? 0n),
            maxEditions: Number(camp.maxEditions ?? 0n),
            pricePerEditionWei: priceWei.toString(),
            pricePerEditionBDAG: priceBDAG,
            pricePerEditionUSD: priceUSD,
            active: camp.active,
            closed: camp.closed
          },
          // Calculated progress
          progress: sub.goal > 0 ? Math.round((netRaisedUSD / sub.goal) * 100) : 0
        }
      } catch (e: any) {
        return { ...sub, onchain: null, error: e?.message?.slice(0, 100) }
      }
    }))
    
    return NextResponse.json({
      contractAddress,
      BDAG_USD_RATE,
      campaigns: results
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
