'use client'

/**
 * BugReportButtonV2 - Modular Bug Report Button
 * 
 * Orchestrator component using bug-report modules
 * Following ISP - delegates to focused hooks
 * 
 * Original BugReportButton: 529 lines
 * Refactored BugReportButtonV2: ~220 lines (orchestrator pattern)
 * 
 * Uses modular components from ./bug-report:
 * - useBugReportForm - Form state and submission logic
 * - Types and constants
 */

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useBugReportForm, BUG_CATEGORIES } from './bug-report'

export default function BugReportButtonV2() {
  const form = useBugReportForm()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <>
      {/* Floating Bug Report Button */}
      <button
        onClick={form.openModal}
        data-testid="bug-report-btn"
        className="fixed bottom-4 right-4 z-50 bg-red-600 hover:bg-red-500 text-white p-3 rounded-full shadow-lg transition-all hover:scale-110 group"
        title="Report a Bug"
        aria-label="Report a Bug"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-sm px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          Report a Bug
        </span>
      </button>

      {/* Modal */}
      {form.isOpen && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto" data-testid="bug-report-modal">
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !form.isSubmitting && form.setIsOpen(false)} />
            <div className="relative z-[100000] bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-gray-900 border-b border-white/10 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🐛</span>
                  <h2 className="text-xl font-bold text-white">Report a Bug</h2>
                </div>
                <button
                  onClick={() => !form.isSubmitting && form.setIsOpen(false)}
                  data-testid="close-bug-modal-btn"
                  aria-label="Close modal"
                  className="text-white/50 hover:text-white p-1"
                  disabled={form.isSubmitting}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {!form.isLoggedIn ? (
                <div className="p-8 text-center" data-testid="login-required-state">
                  <div className="text-6xl mb-4">🔐</div>
                  <h3 className="text-xl font-bold text-white mb-2">Login Required</h3>
                  <p className="text-white/60 mb-6">Please log in to submit a bug report.</p>
                  <div className="flex flex-col gap-3">
                    <a href="/auth?redirect=/&openBugReport=true" data-testid="login-btn"
                      className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors text-center">
                      Log In / Sign Up
                    </a>
                    <button onClick={() => form.setIsOpen(false)} data-testid="cancel-login-btn"
                      className="w-full px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : form.submitted ? (
                <div className="p-8 text-center" data-testid="success-state">
                  <div className="text-6xl mb-4">✅</div>
                  <h3 className="text-xl font-bold text-white mb-2">Thank You!</h3>
                  <p className="text-white/60">Bug report submitted. Updates will be sent to {form.userEmail}.</p>
                </div>
              ) : (
                <div className="p-6 space-y-5" data-testid="bug-report-form">
                  <p className="text-white/60 text-sm">Found an issue? Help us fix it by describing what happened.</p>

                  {/* Category */}
                  <div>
                    <label className="text-sm text-white/70 block mb-1">Category</label>
                    <select value={form.category} onChange={e => form.setCategory(e.target.value)} data-testid="bug-category-select"
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white focus:outline-none focus:border-blue-500/50">
                      {BUG_CATEGORIES.map(cat => (
                        <option key={cat.value} value={cat.value} className="bg-gray-900">{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="text-sm text-white/70 block mb-1">Brief Title <span className="text-red-400">*</span></label>
                    <input type="text" value={form.title} onChange={e => form.setTitle(e.target.value)} data-testid="bug-title-input"
                      placeholder="e.g., Cannot complete purchase" maxLength={200}
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-sm text-white/70 block mb-1">What were you trying to do? <span className="text-red-400">*</span></label>
                    <textarea value={form.description} onChange={e => form.setDescription(e.target.value)} data-testid="bug-description-input"
                      placeholder="Describe what you were trying to accomplish..." rows={3}
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 resize-none" />
                  </div>

                  {/* Steps to reproduce */}
                  <div>
                    <label className="text-sm text-white/70 block mb-1">Steps to Reproduce <span className="text-white/40">(optional)</span></label>
                    <textarea value={form.stepsToReproduce} onChange={e => form.setStepsToReproduce(e.target.value)} data-testid="bug-steps-input"
                      placeholder="1. Go to page...&#10;2. Click on...&#10;3. Error appears..." rows={3}
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 resize-none" />
                  </div>

                  {/* Expected behavior */}
                  <div>
                    <label className="text-sm text-white/70 block mb-1">What did you expect? <span className="text-white/40">(optional)</span></label>
                    <textarea value={form.expectedBehavior} onChange={e => form.setExpectedBehavior(e.target.value)} data-testid="bug-expected-input"
                      placeholder="What should have happened instead..." rows={2}
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 resize-none" />
                  </div>

                  {/* Screenshots */}
                  <div>
                    <label className="text-sm text-white/70 block mb-2">Screenshots <span className="text-white/40">(optional)</span></label>
                    <div onClick={() => form.fileInputRef.current?.click()} data-testid="screenshot-upload-area"
                      className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center cursor-pointer hover:border-white/40 transition-colors">
                      {form.isUploading ? (
                        <div className="flex items-center justify-center gap-2 text-white/60">
                          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Uploading...
                        </div>
                      ) : (
                        <>
                          <svg className="w-8 h-8 mx-auto text-white/40 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-white/60 text-sm">Drop screenshots here or click to upload</p>
                        </>
                      )}
                    </div>
                    <input ref={form.fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple className="hidden" onChange={form.handleScreenshotUpload} />

                    {form.screenshots.length > 0 && (
                      <div className="flex flex-wrap gap-3 mt-3" data-testid="screenshot-previews">
                        {form.screenshots.map((ss, i) => (
                          <div key={i} className="relative group">
                            <img src={ss.url} alt={`Screenshot ${i + 1}`} className="w-24 h-24 object-cover rounded-lg border border-white/10" />
                            <button onClick={() => form.removeScreenshot(i)} data-testid={`remove-screenshot-${i}`}
                              className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Message */}
                  {form.message && (
                    <div data-testid="form-message" className={`p-3 rounded-lg text-sm ${
                      form.messageType === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'
                    }`}>
                      {form.message}
                    </div>
                  )}

                  {/* Submit */}
                  <button onClick={form.handleSubmit} disabled={form.isSubmitting || !form.title.trim() || !form.description.trim()} data-testid="submit-bug-report-btn"
                    className="w-full px-4 py-3 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-red-800 text-white font-medium transition-colors disabled:cursor-not-allowed">
                    {form.isSubmitting ? 'Submitting...' : 'Submit Bug Report'}
                  </button>

                  <p className="text-xs text-white/40 text-center">Your page URL and browser info will be included automatically.</p>
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
