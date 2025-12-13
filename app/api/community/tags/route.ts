import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET - Get all tags or search tags
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q')
    const popular = searchParams.get('popular') === 'true'

    let tagsQuery = supabaseAdmin
      .from('campaign_tags')
      .select('*')

    if (query) {
      tagsQuery = tagsQuery.or(`name.ilike.%${query}%,slug.ilike.%${query}%`)
    }

    if (popular) {
      tagsQuery = tagsQuery.order('campaign_count', { ascending: false }).limit(10)
    } else {
      tagsQuery = tagsQuery.order('name', { ascending: true })
    }

    const { data: tags, error } = await tagsQuery

    if (error) {
      return NextResponse.json({ error: 'FETCH_FAILED', details: error.message }, { status: 500 })
    }

    return NextResponse.json({ tags: tags || [] })
  } catch (e: any) {
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}
