import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// Placeholder recommendation engine using simple scoring
// Score by causeType match and keyword overlap; later enhance using Supabase history
export async function POST(req: NextRequest) {
  try {
    const { history = [], items = [], prefs = {} } = await req.json()
    const preferredCause: 'veteran' | 'general' | 'all' = prefs.causeType || 'all'
    const keywords: string[] = (prefs.keywords || []).map((s: string) => s.toLowerCase())

    const score = (it: any) => {
      let s = 0
      if (preferredCause !== 'all' && it.causeType === preferredCause) s += 2
      const text = `${it.title} ${it.snippet}`.toLowerCase()
      s += keywords.reduce((acc, k) => acc + (text.includes(k) ? 1 : 0), 0)
      // small boost for mocked popularity
      s += Math.min(3, Math.round((it.raised || 0) / Math.max(1, it.goal || 1) * 3))
      return s
    }

    const ranked = (items as any[]).slice().sort((a, b) => score(b) - score(a)).slice(0, 6)
    return NextResponse.json({ items: ranked })
  } catch (e) {
    logger.error('[recommendations] Error:', e)
    return NextResponse.json({ error: 'RECOMMENDATIONS_FAILED' }, { status: 500 })
  }
}
