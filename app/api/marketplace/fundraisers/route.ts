import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getProvider, PatriotPledgeV2ABI } from '@/lib/onchain'
import { ethers } from 'ethers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') || 12)))
    const cursor = Number(url.searchParams.get('cursor') || '0')
    const offset = Number.isFinite(cursor) && cursor > 0 ? cursor : 0

    const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()
    if (!contractAddress) {
      return NextResponse.json({ items: [], total: 0 })
    }

    // Submissions are the canonical record for fundraisers. We only show
    // those that are minted on the active V3 contract and explicitly
    // enabled for the marketplace.
    const { data: subs, error } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('status', 'minted')
      .eq('visible_on_marketplace', true)
      .not('token_id', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: 'FUNDRAISER_QUERY_FAILED', details: error.message }, { status: 500 })
    }

    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, PatriotPledgeV2ABI, provider)

    const items = await Promise.all((subs || []).map(async (sub: any) => {
      // Optionally enforce contract match in code using a case-insensitive
      // comparison, but default to including rows without a contract_address
      // set to avoid hiding valid fundraisers.
      const rowAddr = (sub.contract_address || '') as string
      if (rowAddr && rowAddr.toLowerCase() !== contractAddress.toLowerCase()) {
        return null
      }
      const tokenIdNum = Number(sub.token_id)
      let goal = 0
      let raised = 0
      try {
        const camp = await (contract as any).campaigns(BigInt(tokenIdNum))
        // V3 Campaign struct: (category, goal, grossRaised, netRaised, payoutEligible, ...)
        const rawGoal = camp.goal ?? 0n
        const rawNet = camp.netRaised ?? 0n
        goal = Number(rawGoal)
        raised = Number(rawNet)
      } catch {}

      const total = Number(sub.num_copies || 0)
      const sold = Number(sub.sold_count || 0)
      const remaining = Math.max(0, total - sold)
      const progress = goal > 0 ? Math.round((raised / goal) * 100) : 0

      return {
        id: sub.id,
        title: sub.title || sub.story || `Fundraiser #${tokenIdNum}`,
        image: sub.image_uri || '',
        story: sub.story || '',
        category: sub.category || 'general',
        tokenId: tokenIdNum,
        contract_address: contractAddress,
        goal,
        raised,
        progress,
        total,
        sold,
        remaining,
      }
    }))

    const clean = items.filter(Boolean)
    return NextResponse.json({ items: clean, total: clean.length, nextCursor: offset + clean.length })
  } catch (e: any) {
    return NextResponse.json({ error: 'FUNDRAISER_LIST_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}
