import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { id, support } = await req.json()
    if (!id || typeof support !== 'boolean') return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })

    // Increment yes/no vote tallies. In production, verify voter weight with ERC20 on-chain proofs.
    const column = support ? 'yes_votes' : 'no_votes'
    const { error } = await supabase.rpc('increment_proposal_votes', { p_id: id, p_column: column })

    if (error) {
      // Fallback if no RPC function: read-modify-write
      const { data: cur, error: e1 } = await supabase.from('proposals').select('yes_votes, no_votes').eq('id', id).single()
      if (e1) throw e1
      const next = support ? (Number(cur?.yes_votes || 0) + 1) : (Number(cur?.no_votes || 0) + 1)
      const update = support ? { yes_votes: next } : { no_votes: next }
      const { error: e2 } = await supabase.from('proposals').update(update).eq('id', id)
      if (e2) throw e2
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('gov vote error', e)
    return NextResponse.json({ error: 'VOTE_FAILED' }, { status: 500 })
  }
}
