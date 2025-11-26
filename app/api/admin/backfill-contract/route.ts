'use server'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { PatriotPledgeV2ABI, getProvider } from '@/lib/onchain'
import { ethers } from 'ethers'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const requestedAddress: string | undefined = body.contractAddress || body.address

    // Admin bearer auth (same pattern as other admin endpoints)
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    const { data: userData } = await supabaseAdmin.auth.getUser(token)
    const uid = userData?.user?.id
    if (!uid) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single()
    if ((profile?.role || '') !== 'admin') return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const envAddr = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''
    const addr = (requestedAddress || envAddr || '').trim()
    if (!addr) return NextResponse.json({ error: 'MISSING_CONTRACT_ADDRESS' }, { status: 400 })

    const provider = getProvider()
    const contract = new ethers.Contract(addr, PatriotPledgeV2ABI, provider)

    const totalSupplyBig: bigint = await contract.totalSupply()
    const totalSupply = Number(totalSupplyBig)

    const upserted: number[] = []

    for (let i = 0; i < totalSupply; i++) {
      try {
        const tokenIdBig: bigint = await contract.tokenByIndex(i)
        const tokenId = Number(tokenIdBig)
        const uri: string = await contract.tokenURI(tokenIdBig)
        const campaign = await contract.campaigns(tokenIdBig)
        const category: string = campaign.category
        const goal = campaign.goal as bigint
        const goalNumber = Number(goal)

        // Check if a submission already exists for this contract + token
        const { data: existing } = await supabaseAdmin
          .from('submissions')
          .select('id')
          .eq('contract_address', addr)
          .eq('token_id', tokenId)
          .maybeSingle()

        const payload: any = {
          contract_address: addr,
          token_id: tokenId,
          metadata_uri: uri,
          category,
          goal: goalNumber,
          status: 'minted',
          visible_on_marketplace: true,
        }

        if (existing?.id) {
          await supabaseAdmin.from('submissions').update(payload).eq('id', existing.id)
        } else {
          await supabaseAdmin.from('submissions').insert(payload)
        }

        upserted.push(tokenId)
      } catch (e) {
        // Skip individual token errors but continue with others
        console.error('backfill token error', e)
      }
    }

    return NextResponse.json({ ok: true, contractAddress: addr, totalSupply, upsertedTokenIds: upserted })
  } catch (e: any) {
    console.error('backfill-contract error', e)
    return NextResponse.json({ error: 'BACKFILL_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}
