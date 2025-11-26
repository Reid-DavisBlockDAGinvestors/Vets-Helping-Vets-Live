import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET: list proposals
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('proposals')
      .select('id, title, description, category, yes_votes, no_votes, open, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    const items = (data || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      category: p.category,
      yesVotes: Number(p.yes_votes || 0),
      noVotes: Number(p.no_votes || 0),
      open: !!p.open,
      createdAt: p.created_at
    }))
    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json({ items: [] })
  }
}

// POST: create proposal
export async function POST(req: NextRequest) {
  try {
    const { title, description, category } = await req.json()
    if (!title || !description) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
    const { data, error } = await supabase
      .from('proposals')
      .insert({ title, description, category, open: true })
      .select('id')
      .single()
    if (error) throw error
    return NextResponse.json({ id: data?.id })
  } catch (e) {
    return NextResponse.json({ error: 'CREATE_FAILED' }, { status: 500 })
  }
}
