'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'

interface Screenshot {
  url: string
  filename: string
}

// Global event for triggering bug report from anywhere
export interface BugReportContext {
  title?: string
  description?: string
  category?: string
  errorMessage?: string
}

// Create a global event emitter for bug reports
class BugReportEmitter {
  private listeners: ((context: BugReportContext) => void)[] = []
  
  subscribe(listener: (context: BugReportContext) => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }
  
  emit(context: BugReportContext) {
    this.listeners.forEach(l => l(context))
  }
}

export const bugReportEmitter = new BugReportEmitter()

// Helper function to open bug report from anywhere
export function openBugReport(context: BugReportContext = {}) {
  bugReportEmitter.emit(context)
}

const CATEGORIES = [
  { value: 'general', label: '🐛 General Bug' },
  { value: 'purchase', label: '💳 Purchase/Payment Issue' },
  { value: 'submission', label: '📝 Campaign Submission' },
  { value: 'wallet', label: '👛 Wallet Connection' },
  { value: 'auth', label: '🔐 Login/Account' },
  { value: 'display', label: '🖼️ Display/UI Issue' },
  { value: 'performance', label: '⚡ Performance/Speed' },
  { value: 'other', label: '❓ Other' },
]

export default function BugReportButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
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

  useEffect(() => {
    setMounted(true)
    
    // Subscribe to bug report events from other components
    const unsubscribe = bugReportEmitter.subscribe((context) => {
      logger.debug('[BugReportButton] Received event, opening modal with context:', context)
      
      // Reset form first to clear any stale state
      setSubmitted(false)
      setMessage('')
      setIsSubmitting(false)
      
      // Pre-fill form with context
      if (context.title) setTitle(context.title)
      else setTitle('')
      
      if (context.category) setCategory(context.category)
      else setCategory('general')
      
      // Build description from context
      let desc = ''
      if (context.description) desc = context.description
      if (context.errorMessage) {
        desc += (desc ? '\n\n' : '') + `Error Message:\n${context.errorMessage}`
      }
      setDescription(desc)
      
      // Clear other fields
      setStepsToReproduce('')
      setExpectedBehavior('')
      setScreenshots([])
      
      // Open the modal with a small delay to ensure state is set
      setTimeout(() => {
        logger.debug('[BugReportButton] Setting isOpen to true')
        setIsOpen(true)
      }, 10)
    })
    
    return () => unsubscribe()
  }, [])

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
  }

  const removeScreenshot = (index: number) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      setMessage('Please provide a title and description')
      setMessageType('error')
      return
    }

    setIsSubmitting(true)
    setMessage('')

    try {
      // Get auth token if logged in
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      // Capture console logs (last 50 entries)
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
      
      // Reset form after delay
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
  }

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setStepsToReproduce('')
    setExpectedBehavior('')
    setCategory('general')
    setScreenshots([])
    setMessage('')
    setSubmitted(false)
  }

  const openModal = () => {
    resetForm()
    setIsOpen(true)
  }

  if (!mounted) return null

  return (
    <>
      {/* Floating Bug Report Button */}
      <button
        onClick={openModal}
        data-testid="bug-report-fab-btn"
        aria-label="Report a Bug"
        className="fixed bottom-4 right-4 z-50 bg-red-600 hover:bg-red-500 text-white p-3 rounded-full shadow-lg transition-all hover:scale-110 group"
        title="Report a Bug"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-sm px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          Report a Bug
        </span>
      </button>

      {/* Modal */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-4">
            <div 
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => !isSubmitting && setIsOpen(false)}
            />
            <div className="relative z-[100000] bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-gray-900 border-b border-white/10 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🐛</span>
                  <h2 className="text-xl font-bold text-white">Report a Bug</h2>
                </div>
                <button
                  onClick={() => !isSubmitting && setIsOpen(false)}
                  data-testid="bug-report-close-btn"
                  aria-label="Close bug report modal"
                  className="text-white/50 hover:text-white p-1"
                  disabled={isSubmitting}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {!isLoggedIn ? (
                // Login required state
                <div className="p-8 text-center">
                  <div className="text-6xl mb-4">🔐</div>
                  <h3 className="text-xl font-bold text-white mb-2">Login Required</h3>
                  <p className="text-white/60 mb-6">
                    Please log in or create an account to submit a bug report. This helps us track your issue and send you updates.
                  </p>
                  <div className="flex flex-col gap-3">
                    <a
                      href="/auth?redirect=/&openBugReport=true"
                      className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors text-center"
                    >
                      Log In / Sign Up
                    </a>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="w-full px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-xs text-white/40 mt-4">
                    Creating an account only takes a moment and allows us to keep you updated on your bug report.
                  </p>
                </div>
              ) : submitted ? (
                // Success state
                <div className="p-8 text-center">
                  <div className="text-6xl mb-4">✅</div>
                  <h3 className="text-xl font-bold text-white mb-2">Thank You!</h3>
                  <p className="text-white/60">Your bug report has been submitted. We'll send updates to {userEmail}.</p>
                </div>
              ) : (
                // Form
                <div className="p-6 space-y-5">
                  <p className="text-white/60 text-sm">
                    Found an issue? Help us fix it by describing what happened. Screenshots are very helpful!
                  </p>

                  {/* Category */}
                  <div>
                    <label className="text-sm text-white/70 block mb-1">Category</label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      data-testid="bug-report-category-select"
                      aria-label="Bug category"
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat.value} value={cat.value} className="bg-gray-900">
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="text-sm text-white/70 block mb-1">
                      Brief Title <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="e.g., Cannot complete purchase"
                      data-testid="bug-report-title-input"
                      aria-label="Bug report title"
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
                      maxLength={200}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-sm text-white/70 block mb-1">
                      What were you trying to do? <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Describe what you were trying to accomplish when the error occurred..."
                      rows={3}
                      data-testid="bug-report-description-input"
                      aria-label="Bug description"
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 resize-none"
                    />
                  </div>

                  {/* Steps to reproduce */}
                  <div>
                    <label className="text-sm text-white/70 block mb-1">
                      Steps to Reproduce <span className="text-white/40">(optional)</span>
                    </label>
                    <textarea
                      value={stepsToReproduce}
                      onChange={e => setStepsToReproduce(e.target.value)}
                      placeholder="1. Go to page...&#10;2. Click on...&#10;3. Error appears..."
                      rows={3}
                      data-testid="bug-report-steps-input"
                      aria-label="Steps to reproduce"
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 resize-none"
                    />
                  </div>

                  {/* Expected behavior */}
                  <div>
                    <label className="text-sm text-white/70 block mb-1">
                      What did you expect to happen? <span className="text-white/40">(optional)</span>
                    </label>
                    <textarea
                      value={expectedBehavior}
                      onChange={e => setExpectedBehavior(e.target.value)}
                      placeholder="What should have happened instead..."
                      rows={2}
                      data-testid="bug-report-expected-input"
                      aria-label="Expected behavior"
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 resize-none"
                    />
                  </div>

                  {/* Attachments */}
                  <div>
                    <label className="text-sm text-white/70 block mb-2">
                      Attachments <span className="text-white/40">(screenshots, documents, videos)</span>
                    </label>
                    
                    {/* Upload area */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-blue-500') }}
                      onDragLeave={e => { e.preventDefault(); e.currentTarget.classList.remove('border-blue-500') }}
                      onDrop={e => {
                        e.preventDefault()
                        e.currentTarget.classList.remove('border-blue-500')
                        if (e.dataTransfer.files.length) {
                          const input = fileInputRef.current
                          if (input) {
                            input.files = e.dataTransfer.files
                            handleScreenshotUpload({ target: input } as any)
                          }
                        }
                      }}
                      className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center cursor-pointer hover:border-white/40 transition-colors"
                    >
                      {isUploading ? (
                        <div className="flex items-center justify-center gap-2 text-white/60">
                          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Uploading...
                        </div>
                      ) : (
                        <>
                          <svg className="w-8 h-8 mx-auto text-white/40 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="text-white/60 text-sm">Drop files here or click to browse</p>
                          <p className="text-white/40 text-xs mt-1">Images, PDFs, Docs, Videos • Max 50MB each</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.json,.zip,.rar,.7z,video/*,audio/*"
                      multiple
                      className="hidden"
                      onChange={handleScreenshotUpload}
                    />

                    {/* Attachment previews */}
                    {screenshots.length > 0 && (
                      <div className="flex flex-wrap gap-3 mt-3">
                        {screenshots.map((ss, i) => {
                          const isImage = ss.filename.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i)
                          const isPdf = ss.filename.match(/\.pdf$/i)
                          const isDoc = ss.filename.match(/\.(doc|docx|xls|xlsx|ppt|pptx)$/i)
                          const isVideo = ss.filename.match(/\.(mp4|webm|mov)$/i)
                          const isAudio = ss.filename.match(/\.(mp3|wav|ogg)$/i)
                          const isArchive = ss.filename.match(/\.(zip|rar|7z)$/i)
                          
                          return (
                            <div key={i} className="relative group">
                              {isImage ? (
                                <img
                                  src={ss.url}
                                  alt={`Attachment ${i + 1}`}
                                  className="w-24 h-24 object-cover rounded-lg border border-white/10"
                                />
                              ) : (
                                <div className="w-24 h-24 rounded-lg border border-white/10 bg-white/5 flex flex-col items-center justify-center p-2">
                                  <span className="text-2xl">
                                    {isPdf ? '📄' : isDoc ? '📝' : isVideo ? '🎬' : isAudio ? '🎵' : isArchive ? '📦' : '📎'}
                                  </span>
                                  <span className="text-[10px] text-white/60 mt-1 truncate w-full text-center">
                                    {ss.filename.split('-').pop()?.slice(0, 12)}
                                  </span>
                                </div>
                              )}
                              <button
                                onClick={() => removeScreenshot(i)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                ×
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Message */}
                  {message && (
                    <div className={`p-3 rounded-lg text-sm ${
                      messageType === 'success'
                        ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                        : 'bg-red-500/10 border border-red-500/30 text-red-400'
                    }`}>
                      {message}
                    </div>
                  )}

                  {/* Submit button */}
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !title.trim() || !description.trim()}
                    data-testid="bug-report-submit-btn"
                    className="w-full px-4 py-3 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-red-800 text-white font-medium transition-colors disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Bug Report'}
                  </button>

                  <p className="text-xs text-white/40 text-center">
                    Your current page URL and browser info will be included automatically to help us debug.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
