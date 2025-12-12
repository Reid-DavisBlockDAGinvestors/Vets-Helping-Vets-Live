import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { 
      id, 
      support, 
      voter_wallet, 
      voter_email, 
      voter_name,
      nfts_owned,
      campaigns_created,
      total_donated
    } = await req.json()
    
    if (!id || typeof support !== 'boolean') {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    if (!voter_wallet) {
      return NextResponse.json({ error: 'Wallet address required to vote' }, { status: 400 })
    }

    // Check if user already voted on this proposal
    const { data: existingVote } = await supabase
      .from('proposal_votes')
      .select('id')
      .eq('proposal_id', id)
      .eq('voter_wallet', voter_wallet.toLowerCase())
      .single()
    
    if (existingVote) {
      return NextResponse.json({ error: 'You have already voted on this proposal' }, { status: 400 })
    }

    // Record the vote with voter info
    const { error: voteError } = await supabase
      .from('proposal_votes')
      .insert({
        proposal_id: id,
        voter_wallet: voter_wallet.toLowerCase(),
        voter_email,
        voter_name,
        support,
        nfts_owned: nfts_owned || 0,
        campaigns_created: campaigns_created || 0,
        total_donated: total_donated || 0
      })
    
    if (voteError) {
      console.error('[Vote] Insert error:', voteError)
      // If unique constraint violation, user already voted
      if (voteError.code === '23505') {
        return NextResponse.json({ error: 'You have already voted on this proposal' }, { status: 400 })
      }
      throw voteError
    }

    // Increment yes/no vote tallies
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

    console.log(`[Vote] ${voter_wallet} voted ${support ? 'YES' : 'NO'} on proposal ${id}`)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[Vote] Error:', e)
    return NextResponse.json({ error: e?.message || 'Vote failed' }, { status: 500 })
  }
}
