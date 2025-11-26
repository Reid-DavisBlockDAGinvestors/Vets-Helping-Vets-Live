import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const { id, open } = await req.json()
    if (!id || typeof open !== 'boolean') return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
    // Bearer admin auth
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    const { data: userData } = await supabaseAdmin.auth.getUser(token)
    const uid = userData?.user?.id
    if (!uid) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single()
    if ((profile?.role || '') !== 'admin') return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const { error } = await supabaseAdmin.from('proposals').update({ open }).eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('gov moderate error', e)
    return NextResponse.json({ error: 'MODERATE_FAILED' }, { status: 500 })
  }
}
