import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(_req: NextRequest, context: { params: { id: string } }) {
  try {
    const tokenId = Number(context.params.id)
    if (!Number.isFinite(tokenId)) {
      return NextResponse.json({ error: 'INVALID_TOKEN_ID' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('token_id', tokenId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: 'SUBMISSION_LOOKUP_FAILED', details: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'SUBMISSION_NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json({ item: data })
  } catch (e: any) {
    return NextResponse.json({ error: 'SUBMISSION_BY_TOKEN_ERROR', details: e?.message || String(e) }, { status: 500 })
  }
}
