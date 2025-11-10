import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { id, open, secret } = await req.json()
    if (!id || typeof open !== 'boolean') return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
    if (!secret || secret !== process.env.ADMIN_SECRET) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const { error } = await supabase.from('proposals').update({ open }).eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('gov moderate error', e)
    return NextResponse.json({ error: 'MODERATE_FAILED' }, { status: 500 })
  }
}
