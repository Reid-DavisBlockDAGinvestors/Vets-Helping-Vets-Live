'use client'

import { useState, useCallback } from 'react'
import type { AIFieldType, AIMode } from '../types'

interface UseAIAssistOptions {
  title: string
  category: string
  goal: number
  background: string
  need: string
  fundsUsage: string
  onFieldUpdate: (field: AIFieldType, value: string) => void
  onMessage: (msg: string, type: 'success' | 'error' | 'info') => void
}

/**
 * Hook for AI-assisted writing
 */
export function useAIAssist({
  title,
  category,
  goal,
  background,
  need,
  fundsUsage,
  onFieldUpdate,
  onMessage
}: UseAIAssistOptions) {
  const [isProcessing, setIsProcessing] = useState(false)

  const getFieldValue = useCallback((field: AIFieldType): string => {
    switch (field) {
      case 'background': return background
      case 'need': return need
      case 'fundsUsage': return fundsUsage
      case 'title': return title
      default: return ''
    }
  }, [background, need, fundsUsage, title])

  const callAI = useCallback(async (
    field: AIFieldType,
    mode: AIMode = 'improve'
  ) => {
    const fieldValue = getFieldValue(field)

    // For generate mode, we don't need existing content
    if (mode !== 'generate' && !fieldValue?.trim()) {
      onMessage('Please write something first, then use AI to improve it', 'error')
      return
    }

    try {
      setIsProcessing(true)
      onMessage('✨ AI is working...', 'info')

      const res = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          field,
          content: fieldValue || '',
          context: { title, category, goal, background, need, fundsUsage }
        })
      })

      const data = await res.json().catch(() => ({ error: 'Invalid response from server' }))

      if (!res.ok) {
        throw new Error(data?.error || 'AI request failed')
      }

      if (data?.result) {
        onFieldUpdate(field, data.result)
        onMessage(`✨ AI ${mode === 'generate' ? 'generated' : 'improved'} your ${field}!`, 'success')
      }
    } catch (err: any) {
      onMessage(err?.message || 'AI request failed', 'error')
    } finally {
      setIsProcessing(false)
    }
  }, [getFieldValue, title, category, goal, background, need, fundsUsage, onFieldUpdate, onMessage])

  return {
    isProcessing,
    callAI,
    improve: (field: AIFieldType) => callAI(field, 'improve'),
    expand: (field: AIFieldType) => callAI(field, 'expand'),
    generate: (field: AIFieldType) => callAI(field, 'generate'),
  }
}
