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

    const gross = body.gross != null ? Number(body.gross) : null
    const net = body.net != null ? Number(body.net) : null
    const cardFees = body.cardFees != null ? Number(body.cardFees) : null
    const nonprofitFee = body.nonprofitFee != null ? Number(body.nonprofitFee) : null
    const isOnchain = !!body.isOnchain
    const buyerWallet: string | null = body.buyerWallet || null
    const paymentMethod: string | null = body.paymentMethod || null
    const paymentRef: string | null = body.paymentRef || null

    const contractAddress = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || null

    // Record contribution in Supabase
    const { error: insErr } = await supabaseAdmin.from('contributions').insert({
      token_id: tokenIdNum,
      contract_address: contractAddress,
      amount_gross: gross,
      amount_net: net,
      card_fees: cardFees,
      nonprofit_fee: nonprofitFee,
      is_onchain: isOnchain,
      buyer_wallet: buyerWallet,
      payment_method: paymentMethod,
      payment_ref: paymentRef,
    })
    if (insErr) {
      return NextResponse.json({ error: 'CONTRIBUTION_INSERT_FAILED', details: insErr.message }, { status: 500 })
    }

    // Increment sold_count on the matching submission row so the marketplace
    // can display total copies sold and remaining. We keep this best-effort
    // and ignore errors so that on-chain/state changes are not blocked by a
    // failed counter update.
    try {
      const { data: sub } = await supabaseAdmin
        .from('submissions')
        .select('id, sold_count')
        .eq('token_id', tokenIdNum)
        .maybeSingle()

      if (sub?.id) {
        const current = (sub as any).sold_count ?? 0
        await supabaseAdmin
          .from('submissions')
          .update({ sold_count: current + 1 })
          .eq('id', (sub as any).id)
      }
    } catch {}

    // Call on-chain recordContribution and optional transferNFT
    const signer = getRelayerSigner()
    const contract = getContract(signer)

    const txs: string[] = []

    if (gross != null || net != null || cardFees != null || nonprofitFee != null) {
      const g = BigInt(gross ?? 0)
      const n = BigInt(net ?? 0)
      const cf = BigInt(cardFees ?? 0)
      const nf = BigInt(nonprofitFee ?? 0)
      const tx = await (contract as any).recordContribution(BigInt(tokenIdNum), g, n, cf, nf, isOnchain)
      const rcpt = await tx.wait()
      txs.push(rcpt?.hash || tx.hash)
    }

    if (buyerWallet) {
      const tx2 = await (contract as any).transferNFT(BigInt(tokenIdNum), buyerWallet)
      const rcpt2 = await tx2.wait()
      txs.push(rcpt2?.hash || tx2.hash)
    }

    return NextResponse.json({ ok: true, txHashes: txs })
  } catch (e:any) {
    return NextResponse.json({ error: 'PURCHASE_RECORD_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}
