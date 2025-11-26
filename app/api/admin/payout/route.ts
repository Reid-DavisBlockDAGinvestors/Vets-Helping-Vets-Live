import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getRelayerSigner, getContract } from '@/lib/onchain'

async function requireAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
  if (!token) return { ok: false as const, error: 'UNAUTHORIZED' as const }

  const { data: userData } = await supabaseAdmin.auth.getUser(token)
  const uid = userData?.user?.id
  if (!uid) return { ok: false as const, error: 'UNAUTHORIZED' as const }
  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single()
  if ((profile?.role || '') !== 'admin') return { ok: false as const, error: 'UNAUTHORIZED' as const }

  return { ok: true as const }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

    const body = await req.json().catch(()=>null)
    if (!body) return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })

    const tokenIdNum = Number(body.tokenId)
    if (!Number.isFinite(tokenIdNum) || tokenIdNum < 0) {
      return NextResponse.json({ error: 'INVALID_TOKEN_ID' }, { status: 400 })
    }

    const amountNum = Number(body.amount)
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 })
    }

    const recipient: string | undefined = body.recipient
    if (!recipient) {
      return NextResponse.json({ error: 'MISSING_RECIPIENT' }, { status: 400 })
    }

    const onchain = !!body.onchain

    const signer = getRelayerSigner()
    const contract = getContract(signer)

    const amount = BigInt(amountNum)
    const tx = await (contract as any).markPayoutReleased(BigInt(tokenIdNum), amount, recipient, onchain)
    const rcpt = await tx.wait()
    const txHash = rcpt?.hash || tx.hash

    return NextResponse.json({ ok: true, txHash })
  } catch (e:any) {
    return NextResponse.json({ error: 'PAYOUT_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}
