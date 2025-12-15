import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Admin-only API to view and update which contracts are visible in the marketplace
// GET  -> list all marketplace_contracts rows
// POST -> upsert a row { contractAddress, enabled, label? }

async function requireAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
  if (!token) return { ok: false as const, error: 'UNAUTHORIZED' as const }

  const { data: userData } = await supabaseAdmin.auth.getUser(token)
  const uid = userData?.user?.id
  if (!uid) return { ok: false as const, error: 'UNAUTHORIZED' as const }
  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single()
  if (!['admin', 'super_admin'].includes(profile?.role || '')) return { ok: false as const, error: 'UNAUTHORIZED' as const }

  return { ok: true as const }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

    const { data, error } = await supabaseAdmin
      .from('marketplace_contracts')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: 'MARKETPLACE_CONTRACTS_LIST_FAILED', details: error.message }, { status: 500 })
    return NextResponse.json({ items: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: 'MARKETPLACE_CONTRACTS_LIST_ERROR', details: e?.message || String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

    const body = await req.json().catch(() => null)
    const addr: string | undefined = body?.contractAddress || body?.address
    const enabled: boolean | undefined = body?.enabled
    const label: string | undefined = body?.label

    if (!addr) return NextResponse.json({ error: 'MISSING_CONTRACT_ADDRESS' }, { status: 400 })

    const payload: any = {
      contract_address: addr,
    }
    if (typeof enabled === 'boolean') payload.enabled = enabled
    if (typeof label === 'string') payload.label = label

    const { data, error } = await supabaseAdmin
      .from('marketplace_contracts')
      .upsert(payload, { onConflict: 'contract_address' })
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: 'MARKETPLACE_CONTRACTS_UPSERT_FAILED', details: error.message }, { status: 500 })
    return NextResponse.json({ item: data })
  } catch (e: any) {
    return NextResponse.json({ error: 'MARKETPLACE_CONTRACTS_UPSERT_ERROR', details: e?.message || String(e) }, { status: 500 })
  }
}
