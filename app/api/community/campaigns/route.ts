import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET - Search campaigns for mentions/autocomplete
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q') || ''
    const limit = parseInt(searchParams.get('limit') || '10')

    // Search by title, slug, short_code, or hashtag
    const { data: campaigns, error } = await supabaseAdmin
      .from('submissions')
      .select('id, title, slug, short_code, hashtag, status, image_url, goal')
      .or(`title.ilike.%${query}%,slug.ilike.%${query}%,short_code.ilike.%${query}%,hashtag.ilike.%${query}%`)
      .in('status', ['approved', 'minted'])
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: 'SEARCH_FAILED', details: error.message }, { status: 500 })
    }

    return NextResponse.json({ campaigns: campaigns || [] })
  } catch (e: any) {
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}
