import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getContract, getRelayerSigner } from '@/lib/onchain'

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  try {
    // Admin bearer auth
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    const { data: userData } = await supabaseAdmin.auth.getUser(token)
    const uid = userData?.user?.id
    if (!uid) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single()
    if (!['admin', 'super_admin'].includes(profile?.role || '')) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const tokenIdRaw = context.params.id
    const tokenId = BigInt(tokenIdRaw)
    const body = await req.json().catch(()=>({}))
    const { newUri, addRaised } = body || {}

    const signer = getRelayerSigner()
    const c = getContract(signer)

    let txHash: string | undefined
    if (typeof newUri === 'string' && newUri.length > 0) {
      const tx = await c.updateTokenURI(tokenId, newUri)
      const rcpt = await tx.wait()
      txHash = rcpt?.hash || tx.hash
    }
    if (typeof addRaised === 'number' && addRaised > 0) {
      const delta = BigInt(addRaised)
      const tx = await c.addRaised(tokenId, delta)
      const rcpt = await tx.wait()
      txHash = rcpt?.hash || tx.hash

      // After updating raised on-chain, compute progress and log benchmark milestones
      try {
        const tidNum = Number(tokenIdRaw)
        if (Number.isFinite(tidNum)) {
          // Load submission to get benchmarks
          const { data: sub } = await supabaseAdmin
            .from('submissions')
            .select('goal, benchmarks')
            .eq('token_id', tidNum)
            .maybeSingle()

          const bmarks: string[] = Array.isArray(sub?.benchmarks) ? sub!.benchmarks as string[] : []

          if (bmarks.length > 0) {
            // Read on-chain goal/raised from V2 campaigns mapping
            const camp: any = await c.campaigns(tokenId)
            const goalOnchain = BigInt(camp?.goal ?? camp?.[1] ?? 0)
            const raisedOnchain = BigInt(camp?.raised ?? camp?.[2] ?? 0)

            if (goalOnchain > 0n && raisedOnchain >= 0n) {
              const pct = Number((raisedOnchain * 100n) / goalOnchain)
              const n = bmarks.length
              const step = 100 / n
              // Determine how many benchmark thresholds are now reached
              let reached = 0
              for (let i = 0; i < n; i++) {
                const threshold = Math.round((i + 1) * step)
                if (pct >= threshold) reached = i + 1
              }

              if (reached > 0) {
                // Count existing milestone events for this token
                const { data: existing } = await supabaseAdmin
                  .from('events')
                  .select('id')
                  .eq('type', 'milestone')
                  .eq('token_id', tidNum)

                const already = (existing || []).length
                const toInsert = [] as { type: string; token_id: number; amount?: number | null; tx_hash?: string | null; notice?: string | null }[]
                for (let i = already; i < reached && i < n; i++) {
                  toInsert.push({
                    type: 'milestone',
                    token_id: tidNum,
                    amount: null,
                    tx_hash: txHash || null,
                    notice: bmarks[i]
                  })
                }
                if (toInsert.length > 0) {
                  await supabaseAdmin.from('events').insert(toInsert as any)
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('[onchain/update] benchmark computation failed', e)
      }
    }

    return NextResponse.json({ ok: true, txHash })
  } catch (e:any) {
    return NextResponse.json({ error: 'UPDATE_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}
