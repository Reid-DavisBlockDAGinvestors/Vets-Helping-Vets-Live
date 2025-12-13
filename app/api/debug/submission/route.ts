import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get('q')
    if (!query) {
      return NextResponse.json({ error: 'q (search query) required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { auth: { persistSession: false } }
    )

    // Search by title (case-insensitive partial match)
    const { data, error } = await supabase
      .from('submissions')
      .select('id, title, campaign_id, token_id, status, creator_wallet, image_uri, goal, num_copies, nft_editions, created_at')
      .ilike('title', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      query,
      results: data || [],
      count: data?.length || 0
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
