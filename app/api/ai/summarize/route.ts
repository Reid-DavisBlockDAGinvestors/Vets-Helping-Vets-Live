import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// Simple Grok/xAI integration placeholder for story summarization/enhancement
// Expects env GROK_API_KEY if using external API. Falls back to local heuristic.

export async function POST(req: NextRequest) {
  try {
    const { title, story, mode } = await req.json()
    const key = process.env.GROK_API_KEY

    if (!story || typeof story !== 'string') {
      return NextResponse.json({ error: 'NO_STORY' }, { status: 400 })
    }

    // If GROK_API_KEY is present, attempt remote call (format subject to change)
    if (key) {
      try {
        const prompt = mode === 'improve'
          ? `Improve clarity and engagement while preserving meaning.
Title: ${title || 'Untitled'}
Story:\n${story}`
          : `Summarize compassionately in 2-3 sentences and include a compelling donor call-to-action.
Title: ${title || 'Untitled'}
Story:\n${story}`

        const res = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: 'grok-beta',
            messages: [
              { role: 'system', content: 'You are an empathetic assistant that writes for a nonprofit fundraising platform.' },
              { role: 'user', content: prompt }
            ]
          })
        })
        if (res.ok) {
          const data = await res.json()
          const content = data?.choices?.[0]?.message?.content || ''
          return NextResponse.json({ text: content })
        }
      } catch (err) {
        logger.warn('[ai/summarize] GROK_API fallback due to error', err)
      }
    }

    // Fallback: local heuristic summary or improvement
    const trimmed = story.trim()
    if (mode === 'improve') {
      const improved = trimmed
        .replace(/\s+/g, ' ')
        .replace(/^\s+|\s+$/g, '')
      return NextResponse.json({ text: improved.slice(0, 1200) })
    } else {
      const first = trimmed.split(/(?<=[.!?])\s+/).slice(0, 3).join(' ')
      const summary = `${first}${first.endsWith('.') ? '' : '.'} Your support makes an immediate impact.`
      return NextResponse.json({ text: summary.slice(0, 600) })
    }
  } catch (e) {
    logger.error('[ai/summarize] Error:', e)
    return NextResponse.json({ error: 'AI_SUMMARY_FAILED' }, { status: 500 })
  }
}
