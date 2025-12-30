import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// Support multiple AI providers with fallback
const GROK_API_KEY = process.env.GROK_API_KEY || process.env.XAI_API_KEY || ''
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''

// Determine which provider to use
const getProvider = () => {
  if (OPENAI_API_KEY) return { name: 'openai', key: OPENAI_API_KEY, base: 'https://api.openai.com/v1', model: 'gpt-4o-mini-search-preview-2025-03-11' }
  if (GROK_API_KEY) return { name: 'grok', key: GROK_API_KEY, base: 'https://api.x.ai/v1', model: 'grok-beta' }
  return null
}

type AssistMode = 'improve' | 'expand' | 'summarize' | 'generate'

interface AssistRequest {
  mode: AssistMode
  content: string
  field: 'background' | 'need' | 'fundsUsage' | 'title'
  context?: {
    title?: string
    category?: string
    goal?: number
    background?: string
    need?: string
    fundsUsage?: string
  }
}

const SYSTEM_PROMPTS: Record<string, string> = {
  fundraiser: `You are a compassionate writing assistant helping veterans and individuals in need create compelling fundraiser campaigns. Your goal is to help them tell their story authentically and emotionally while being clear about their needs. Keep the tone respectful, genuine, and hopeful. Avoid being overly dramatic or manipulative. Focus on clarity and emotional connection.`,
}

// Helper to build context summary from all fields
const buildContextSummary = (context?: any) => {
  const parts = []
  if (context?.title) parts.push(`Campaign Title: "${context.title}"`)
  if (context?.category) parts.push(`Category: ${context.category}`)
  if (context?.goal) parts.push(`Fundraising Goal: $${context.goal}`)
  if (context?.background) parts.push(`Their Story/Background:\n"${context.background}"`)
  if (context?.need) parts.push(`What They Need:\n"${context.need}"`)
  if (context?.fundsUsage) parts.push(`How Funds Will Be Used:\n"${context.fundsUsage}"`)
  return parts.length > 0 ? `\n\nFull Campaign Context:\n${parts.join('\n\n')}` : ''
}

const MODE_PROMPTS: Record<AssistMode, (field: string, context?: any) => string> = {
  improve: (field, context) => {
    const contextSummary = buildContextSummary(context)
    return `Improve the following ${field} text for a fundraiser campaign. Make it more compelling, clear, and emotionally resonant while keeping the authentic voice. Fix any grammar or spelling issues. Keep it concise but impactful. Ensure it flows well with the other sections of their campaign.${contextSummary}\n\nReturn only the improved text for the ${field} section, no explanations.`
  },
  
  expand: (field, context) => {
    const contextSummary = buildContextSummary(context)
    return `Expand the following ${field} text for a fundraiser campaign. Add more detail and emotional depth while keeping it authentic and not too long (aim for 2-3 paragraphs). Make sure it complements the other sections.${contextSummary}\n\nReturn only the expanded text for the ${field} section, no explanations.`
  },
  
  summarize: (field, context) => {
    const contextSummary = buildContextSummary(context)
    return `Summarize the following ${field} text for a fundraiser campaign. Make it concise while keeping the key emotional points.${contextSummary}\n\nReturn only the summarized text, no explanations.`
  },
  
  generate: (field, context) => {
    const contextSummary = buildContextSummary(context)
    if (field === 'title') {
      return `Generate a compelling, concise title for a ${context?.category || 'veteran'} fundraiser campaign.${contextSummary}\n\nReturn only the title, nothing else. Make it emotional but not clickbait.`
    }
    if (field === 'background') {
      return `Generate a heartfelt "About Me" section for a ${context?.category || 'veteran'} fundraiser. Write 2-3 paragraphs introducing who they are and their situation.${contextSummary}\n\nReturn only the text, no explanations.`
    }
    if (field === 'need') {
      return `Generate a clear "What I Need" section explaining why this person needs help. Be specific but not overly detailed. Make it complement the background story.${contextSummary}\n\nReturn only the text, no explanations.`
    }
    if (field === 'fundsUsage') {
      return `Generate a transparent "How Funds Will Be Used" section. Break down potential uses clearly based on the goal and their stated needs.${contextSummary}\n\nReturn only the text, no explanations.`
    }
    return `Help write compelling content for a fundraiser campaign.${contextSummary}`
  }
}

export async function POST(req: NextRequest) {
  try {
    const provider = getProvider()
    
    if (!provider) {
      return NextResponse.json({ 
        error: 'AI service not configured. Please set OPENAI_API_KEY or GROK_API_KEY in environment.' 
      }, { status: 500 })
    }

    const body: AssistRequest = await req.json()
    const { mode, content, field, context } = body

    if (!mode || !field) {
      return NextResponse.json({ error: 'Missing mode or field' }, { status: 400 })
    }

    // Build the prompt
    const systemPrompt = SYSTEM_PROMPTS.fundraiser
    const modePrompt = MODE_PROMPTS[mode](field, context)
    
    const userMessage = mode === 'generate' && !content
      ? modePrompt
      : `${modePrompt}\n\nText to ${mode}:\n"${content}"`

    logger.api('[AI Assist] Provider: ' + provider.name, { mode, field })
    
    // Call AI API (OpenAI-compatible format)
    // Note: gpt-4o-mini-search-preview doesn't support temperature parameter
    const requestBody: any = {
      model: provider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 1000,
    }
    
    // Only add temperature for models that support it (not search-preview models)
    if (!provider.model.includes('search-preview')) {
      requestBody.temperature = 0.7
    }
    
    const response = await fetch(`${provider.base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.key}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('[AI Assist] API error:', response.status, errorText)
      return NextResponse.json({ 
        error: `AI service error: ${response.status}` 
      }, { status: 500 })
    }

    const data = await response.json()
    const result = data.choices?.[0]?.message?.content?.trim()

    if (!result) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    logger.api('[AI Assist] Success via ' + provider.name, { chars: result.length })

    return NextResponse.json({ 
      success: true, 
      result,
      mode,
      field
    })

  } catch (error: any) {
    logger.error('[AI Assist] Error:', error)
    return NextResponse.json({ 
      error: error?.message || 'AI assist failed' 
    }, { status: 500 })
  }
}
