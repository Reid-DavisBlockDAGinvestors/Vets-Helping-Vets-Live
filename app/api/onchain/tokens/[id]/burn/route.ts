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
    if ((profile?.role || '') !== 'admin') return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const tokenId = BigInt(context.params.id)
    const signer = getRelayerSigner()
    const c = getContract(signer)

    const tx = await c.burn(tokenId)
    const rcpt = await tx.wait()
    const txHash = rcpt?.hash || tx.hash

    return NextResponse.json({ ok: true, txHash })
  } catch (e:any) {
    return NextResponse.json({ error: 'BURN_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}
