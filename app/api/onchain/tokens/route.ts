import { NextRequest, NextResponse } from 'next/server'
import { getContract, getProvider, PatriotPledgeV2ABI } from '@/lib/onchain'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ethers } from 'ethers'

export const dynamic = 'force-dynamic'

// BDAG to USD conversion rate (configurable via env)
const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || process.env.NEXT_PUBLIC_BDAG_USD_RATE || '0.05')

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') || 12)))
    const cursor = url.searchParams.get('cursor')

    const provider = getProvider()

    // Load enabled contracts from marketplace_contracts; fall back to env-based
    // single contract when none are configured.
    const { data: mktRows } = await supabaseAdmin
      .from('marketplace_contracts')
      .select('contract_address, enabled')
      .eq('enabled', true)

    const enabledAddrs = (mktRows || [])
      .map(r => (r as any).contract_address as string | undefined)
      .map(a => a?.trim())
      .filter(Boolean) as string[]

    const fallbackEnv = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()
    const targetContracts = enabledAddrs.length > 0 ? enabledAddrs : (fallbackEnv ? [fallbackEnv] : [])

    if (targetContracts.length === 0) {
      return NextResponse.json({ items: [], total: 0 })
    }

    const items: any[] = []
    const seen = new Set<string>()

    // For simplicity and to keep behavior predictable, apply the limit across
    // the merged results. When multiple contracts are enabled, we iterate each
    // one from newest to oldest, collecting up to `limit` items in total.

    let remaining = limit

    for (const addr of targetContracts) {
      if (remaining <= 0) break

      const contract = new ethers.Contract(addr, PatriotPledgeV2ABI, provider)
      const total: bigint = await contract.totalSupply()
      const totalNum = Number(total)

      for (let idx = totalNum - 1; idx >= 0 && remaining > 0; idx--) {
        const tokenId: bigint = await contract.tokenByIndex(idx)
        const tokenIdNum = Number(tokenId)
        if (cursor && tokenIdNum >= Number(cursor)) continue

        // Respect Supabase submissions/visibility: hide tokens explicitly
        // marked as not visible for this contract, but default to showing
        // tokens based on on-chain data when no matching row exists.
        try {
          const q = supabaseAdmin
            .from('submissions')
            .select('visible_on_marketplace, contract_address')
            .eq('token_id', tokenIdNum)
            .limit(1)

          const { data: rows } = await q
          const row = rows?.[0]
          if (row) {
            const rowAddr = (row as any).contract_address as string | null
            if ((rowAddr || '').toLowerCase() !== addr.toLowerCase()) {
              // Row belongs to a different contract; ignore its visibility flag
            } else if ((row as any).visible_on_marketplace === false) {
              continue
            }
          }
        } catch {}

        const [owner, uri, camp] = await Promise.all([
          contract.ownerOf(tokenId),
          contract.tokenURI(tokenId),
          contract.campaigns(tokenId)
        ])
        let metadata: any = null
        try {
          const mres = await fetch(uri)
          metadata = await mres.json()
        } catch {}

        const key = `${addr.toLowerCase()}:${tokenIdNum}`
        if (seen.has(key)) {
          continue
        }
        seen.add(key)

        // Try to get goal from Supabase (source of truth) instead of on-chain
        let displayGoal = camp.goal?.toString?.() || String(camp.goal)
        try {
          const { data: subRow } = await supabaseAdmin
            .from('submissions')
            .select('goal')
            .eq('token_id', tokenIdNum)
            .eq('contract_address', addr)
            .maybeSingle()
          if (subRow?.goal) {
            displayGoal = String(subRow.goal)
          }
        } catch {}

        // Convert raised from wei to BDAG then to USD
        const netRaisedWei = BigInt(camp.netRaised ?? 0n)
        const netRaisedBDAG = Number(netRaisedWei) / 1e18
        const raisedValue = netRaisedBDAG * BDAG_USD_RATE
        
        items.push({
          contractAddress: addr,
          tokenId: tokenIdNum,
          owner,
          uri,
          metadata,
          category: camp.category,
          goal: displayGoal,
          raised: raisedValue.toString(),
        })
        remaining--
        if (remaining <= 0) break
      }
    }

    return NextResponse.json({ items, total: items.length })
  } catch (e:any) {
    return NextResponse.json({ error: 'ONCHAIN_LIST_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}
