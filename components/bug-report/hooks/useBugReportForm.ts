'use client'

/**
 * useBugReportForm Hook
 * 
 * Manages bug report form state, auth, and submission
 * Following ISP - focused on form logic only
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { bugReportEmitter, type Screenshot, type BugReportContext } from '../types'

export interface UseBugReportFormReturn {
  // Form state
  title: string
  description: string
  stepsToReproduce: string
  expectedBehavior: string
  category: string
  screenshots: Screenshot[]
  setTitle: (v: string) => void
  setDescription: (v: string) => void
  setStepsToReproduce: (v: string) => void
  setExpectedBehavior: (v: string) => void
  setCategory: (v: string) => void
  
  // UI state
  isOpen: boolean
  isSubmitting: boolean
  isUploading: boolean
  message: string
  messageType: 'success' | 'error'
  submitted: boolean
  setIsOpen: (v: boolean) => void
  
  // Auth state
  isLoggedIn: boolean
  userEmail: string | null
  authChecked: boolean
  
  // Actions
  handleScreenshotUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  removeScreenshot: (index: number) => void
  handleSubmit: () => Promise<void>
  resetForm: () => void
  openModal: () => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
}

export function useBugReportForm(): UseBugReportFormReturn {
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  
  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [stepsToReproduce, setStepsToReproduce] = useState('')
  const [expectedBehavior, setExpectedBehavior] = useState('')
  const [category, setCategory] = useState('general')
  const [screenshots, setScreenshots] = useState<Screenshot[]>([])
  
  // UI state
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [submitted, setSubmitted] = useState(false)

  // Check auth state
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setIsLoggedIn(!!session?.user)
      setUserEmail(session?.user?.email || null)
      setAuthChecked(true)
    }
    checkAuth()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user)
      setUserEmail(session?.user?.email || null)
      setAuthChecked(true)
    })
    
    return () => subscription.unsubscribe()
  }, [])

  // Subscribe to bug report events
  useEffect(() => {
    const unsubscribe = bugReportEmitter.subscribe((context: BugReportContext) => {
      logger.debug('[useBugReportForm] Received event with context:', context)
      
      // Reset form first
      setSubmitted(false)
      setMessage('')
      setIsSubmitting(false)
      
      // Pre-fill form with context
      setTitle(context.title || '')
      setCategory(context.category || 'general')
      
      // Build description
      let desc = context.description || ''
      if (context.errorMessage) {
        desc += (desc ? '\n\n' : '') + `Error Message:\n${context.errorMessage}`
      }
      setDescription(desc)
      
      // Clear other fields
      setStepsToReproduce('')
      setExpectedBehavior('')
      setScreenshots([])
      
      setTimeout(() => setIsOpen(true), 10)
    })
    
    return () => unsubscribe()
  }, [])

  const resetForm = useCallback(() => {
    setTitle('')
    setDescription('')
    setStepsToReproduce('')
    setExpectedBehavior('')
    setCategory('general')
    setScreenshots([])
    setMessage('')
    setSubmitted(false)
  }, [])

  const openModal = useCallback(() => {
    resetForm()
    setIsOpen(true)
  }, [resetForm])

  const handleScreenshotUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return

    setIsUploading(true)
    setMessage('')

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/bug-reports/upload', {
          method: 'POST',
          body: formData
        })

        const data = await res.json()
        
        if (!res.ok) {
          setMessage(data.error || 'Failed to upload screenshot')
          setMessageType('error')
          continue
        }

        setScreenshots(prev => [...prev, { url: data.url, filename: data.filename }])
      } catch (err) {
        logger.error('Upload error:', err)
        setMessage('Failed to upload screenshot')
        setMessageType('error')
      }
    }

    setIsUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const removeScreenshot = useCallback((index: number) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !description.trim()) {
      setMessage('Please provide a title and description')
      setMessageType('error')
      return
    }

    setIsSubmitting(true)
    setMessage('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const consoleLogs = (window as any).__bugReportLogs || []

      const res = await fetch('/api/bug-reports', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title,
          description,
          steps_to_reproduce: stepsToReproduce,
          expected_behavior: expectedBehavior,
          category,
          screenshots,
          page_url: window.location.href,
          user_agent: navigator.userAgent,
          screen_size: `${window.innerWidth}x${window.innerHeight}`,
          browser_console_logs: consoleLogs.slice(-50)
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || 'Failed to submit bug report')
        setMessageType('error')
        setIsSubmitting(false)
        return
      }

      setMessage(data.message || 'Bug report submitted successfully!')
      setMessageType('success')
      setSubmitted(true)
      
      setTimeout(() => {
        setIsOpen(false)
        resetForm()
      }, 3000)
    } catch (err) {
      logger.error('Submit error:', err)
      setMessage('Failed to submit bug report')
      setMessageType('error')
    } finally {
      setIsSubmitting(false)
    }
  }, [title, description, stepsToReproduce, expectedBehavior, category, screenshots, resetForm])

  return {
    title,
    description,
    stepsToReproduce,
    expectedBehavior,
    category,
    screenshots,
    setTitle,
    setDescription,
    setStepsToReproduce,
    setExpectedBehavior,
    setCategory,
    isOpen,
    isSubmitting,
    isUploading,
    message,
    messageType,
    submitted,
    setIsOpen,
    isLoggedIn,
    userEmail,
    authChecked,
    handleScreenshotUpload,
    removeScreenshot,
    handleSubmit,
    resetForm,
    openModal,
    fileInputRef
  }
}
