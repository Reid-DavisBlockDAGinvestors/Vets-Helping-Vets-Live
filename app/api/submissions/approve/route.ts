import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getRelayerSigner, getContract } from '@/lib/onchain'
import { sendEmail } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  try {
    // Require admin via Supabase bearer token
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    const { data: userData } = await supabaseAdmin.auth.getUser(token)
    const uid = userData?.user?.id
    if (!uid) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single()
    if ((profile?.role || '') !== 'admin') return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const body = await req.json().catch(()=>null)
    if (!body?.id) return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })
    const id: string = body.id
    const updates = body.updates || {}

    // Load existing submission
    const { data: sub, error: fetchErr } = await supabaseAdmin.from('submissions').select('*').eq('id', id).single()
    if (fetchErr || !sub) return NextResponse.json({ error: 'SUBMISSION_NOT_FOUND', details: fetchErr?.message }, { status: 404 })

    // Apply edits from admin
    const merged = { ...sub, ...updates }
    const creatorWallet: string = merged.creator_wallet
    const nonprofitWallet: string | undefined = process.env.BDAG_NONPROFIT_ADDRESS
    // Mint target is the nonprofit custodial wallet; fall back to creator wallet
    // only if nonprofit address is not configured, to avoid breaking existing envs.
    const to: string = (nonprofitWallet && nonprofitWallet.trim()) || creatorWallet
    const uri: string = merged.metadata_uri
    const category: string = merged.category || 'general'
    if (!creatorWallet || !uri) {
      return NextResponse.json({
        error: 'SUBMISSION_INVALID_FIELDS',
        details: 'creator_wallet and metadata_uri required'
      }, { status: 400 })
    }

    // Mark approved pre-mint and email
    await supabaseAdmin.from('submissions').update({ status: 'approved', reviewer_notes: merged.reviewer_notes || sub.reviewer_notes, title: merged.title, story: merged.story, category: merged.category, image_uri: merged.image_uri, metadata_uri: merged.metadata_uri }).eq('id', id)
    try {
      let uname: string | null = null
      try {
        const { data: profU } = await supabaseAdmin.from('profiles').select('username').eq('email', sub.creator_email).maybeSingle()
        uname = profU?.username || null
      } catch {}
      await sendEmail({
        to: sub.creator_email,
        subject: 'Your submission was approved',
        html: `<p>${uname ? `Hi ${uname},` : 'Good news!'}</p><p>Your submission was approved and minting will begin shortly.</p><p>ID: ${id}</p>`
      })
    } catch {}

    const signer = getRelayerSigner()
    const contract = getContract(signer)
    // V3 signature: mint(address to, string uri, string category, uint256 goal, uint256 feeRate) returns (uint256)
    // If admin configured num_copies > 1, mint a series; otherwise mint a single NFT
    const totalGoal = BigInt(merged.goal || 0)
    const feeRateBps = 100n // default 1% nonprofit fee; can be made editable in admin later
    const size = Math.max(1, Number(merged.num_copies || 1))

    let firstTokenId: number | null = null
    const txHashes: string[] = []

    // Manage nonce explicitly so we don't collide with previous txs from the
    // same relayer (e.g. contract deployment). We read the current nonce once
    // and then increment locally for each mint we send.
    let nextNonce = await signer.getNonce()

    if (size <= 1) {
      // Single NFT: predict next tokenId using totalSupply() before sending the
      // mint tx. In this contract, _nextTokenId starts at 0 and increments on
      // each mint, and totalSupply() tracks the number of minted tokens, so the
      // next tokenId is equal to the current totalSupply value.
      let predictedId: number | null = null
      try {
        const supply: bigint = await (contract as any).totalSupply()
        predictedId = Number(supply)
      } catch {
        predictedId = null
      }
      const tx = await contract.mint(to, uri, category, totalGoal, feeRateBps, { nonce: nextNonce })
      const txHash = tx.hash
      firstTokenId = predictedId
      txHashes.push(txHash)
    } else {
      // Series of NFTs: split total goal across copies. We still avoid waiting
      // for confirmations; instead we record tx hashes and best-effort tokenId
      // for the first copy using totalSupply() as a prediction.
      const perTokenGoal = totalGoal > 0n && size > 0 ? totalGoal / BigInt(size) : 0n
      let baseId: number | null = null
      try {
        const supply: bigint = await (contract as any).totalSupply()
        baseId = Number(supply)
      } catch {
        baseId = null
      }
      for (let i = 0; i < size; i++) {
        // For now reuse the same metadata URI for all copies; in future we can fan out baseURI
        const tx = await contract.mint(to, uri, category, perTokenGoal, feeRateBps, { nonce: nextNonce })
        const txHash = tx.hash
        txHashes.push(txHash)
        nextNonce++
        if (firstTokenId == null && baseId != null) {
          firstTokenId = baseId
        }
      }
    }

    // Option A: keep submission row and mark as minted with token/tx info
    try {
      const primaryTx = txHashes[0] || null
      const contractAddress = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || null
      await supabaseAdmin
        .from('submissions')
        .update({ status: 'minted', token_id: firstTokenId, tx_hash: primaryTx, contract_address: contractAddress, visible_on_marketplace: true })
        .eq('id', id)
    } catch {}
    try {
      let uname: string | null = null
      try {
        const { data: profU } = await supabaseAdmin.from('profiles').select('username').eq('email', sub.creator_email).maybeSingle()
        uname = profU?.username || null
      } catch {}
      const base = process.env.NEXT_PUBLIC_EXPLORER_BASE || ''
      const primaryTx = txHashes[0] || ''
      const link = primaryTx && base ? `${base}/tx/${primaryTx}` : primaryTx
      await sendEmail({
        to: sub.creator_email,
        subject: 'Your NFT fundraiser has been minted',
        html: `<p>${uname ? `Hi ${uname},` : 'Congratulations!'}</p><p>Your fundraiser NFT has been minted.</p><p>Tx: <a href="${link}">${primaryTx}</a></p>`
      })
    } catch {}

    return NextResponse.json({
      ok: true,
      txHashes,
      tokenId: firstTokenId != null ? firstTokenId : undefined
    })
  } catch (e:any) {
    return NextResponse.json({ error: 'APPROVE_AND_MINT_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}
