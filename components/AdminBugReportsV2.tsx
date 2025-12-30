'use client'

/**
 * AdminBugReportsV2 - Modular Bug Report Management
 * 
 * Orchestrator component using admin/bug-reports modules
 * Following ISP - delegates to focused hooks and components
 * 
 * Original AdminBugReports: 592 lines
 * Refactored AdminBugReportsV2: ~280 lines (orchestrator pattern)
 * 
 * Uses modular components from ./admin/bug-reports:
 * - useBugReports - Data fetching and CRUD operations
 * - BugReportCard - Individual report card UI
 * - BugReportStats - Stats grid display
 * - Types and constants for status/priority/category
 */

import { useState } from 'react'
import ErrorWithBugReport from './ErrorWithBugReport'
import {
  useBugReports,
  BugReportCard,
  BugReportStats,
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  CATEGORY_OPTIONS,
  getStatusBadge,
  formatDate,
  type BugReport
} from './admin/bug-reports'

export default function AdminBugReportsV2() {
  const bugReports = useBugReports()
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [adminMessage, setAdminMessage] = useState('')
  const [sendEmailOnUpdate, setSendEmailOnUpdate] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleSelectReport = (report: BugReport) => {
    setSelectedReport(report)
    setResolutionNotes(report.resolution_notes || '')
    setShowDeleteConfirm(false)
    setAdminMessage('')
  }

  const handleUpdateReport = async (updates: { status?: string; priority?: string; resolution_notes?: string }) => {
    if (!selectedReport) return
    const success = await bugReports.updateReport(
      selectedReport.id, 
      updates, 
      adminMessage, 
      sendEmailOnUpdate
    )
    if (success) {
      setSelectedReport(prev => prev ? { ...prev, ...updates } : null)
      if (adminMessage) setAdminMessage('')
    }
  }

  const handleDeleteReport = async () => {
    if (!selectedReport) return
    const success = await bugReports.deleteReport(selectedReport.id)
    if (success) {
      setSelectedReport(null)
      setShowDeleteConfirm(false)
    }
  }

  if (bugReports.loading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="bug-reports-loading">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (bugReports.error) {
    return (
      <ErrorWithBugReport 
        error={bugReports.error} 
        onRetry={bugReports.fetchReports}
        context={{ page: 'Admin Bug Reports', category: 'auth' }}
      />
    )
  }

  return (
    <div className="space-y-6" data-testid="admin-bug-reports-panel">
      {/* Stats */}
      <BugReportStats stats={bugReports.stats} />

      {/* Filters */}
      <div className="flex flex-wrap gap-4" data-testid="bug-report-filters">
        <select
          value={bugReports.statusFilter}
          onChange={e => bugReports.setStatusFilter(e.target.value)}
          data-testid="bug-status-filter"
          className="px-4 py-2 rounded-lg bg-white/10 border border-white/10 text-white focus:outline-none"
        >
          <option value="all" className="bg-gray-900">All Statuses</option>
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-gray-900">{opt.label}</option>
          ))}
        </select>
        
        <select
          value={bugReports.categoryFilter}
          onChange={e => bugReports.setCategoryFilter(e.target.value)}
          data-testid="bug-category-filter"
          className="px-4 py-2 rounded-lg bg-white/10 border border-white/10 text-white focus:outline-none"
        >
          {CATEGORY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-gray-900">{opt.label}</option>
          ))}
        </select>

        <button
          onClick={bugReports.fetchReports}
          data-testid="refresh-bugs-btn"
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Reports List */}
      {bugReports.reports.length === 0 ? (
        <div className="text-center py-12 text-white/60" data-testid="no-reports-message">
          No bug reports found
        </div>
      ) : (
        <div className="space-y-4" data-testid="bug-reports-list">
          {bugReports.reports.map(report => (
            <BugReportCard 
              key={report.id} 
              report={report} 
              onSelect={handleSelectReport} 
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80" onClick={() => setSelectedReport(null)} />
          <div 
            className="relative z-10 bg-gray-900 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" 
            data-testid="bug-detail-modal"
          >
            <div className="sticky top-0 bg-gray-900 border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Bug Report Details</h2>
              <button
                onClick={() => setSelectedReport(null)}
                data-testid="close-bug-modal-btn"
                aria-label="Close modal"
                className="text-white/50 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Status & Priority Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Status</label>
                  <select
                    value={selectedReport.status}
                    onChange={(e) => handleUpdateReport({ status: e.target.value })}
                    disabled={bugReports.updating}
                    data-testid="bug-status-select"
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value} className="bg-gray-900">{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Priority</label>
                  <select
                    value={selectedReport.priority}
                    onChange={(e) => handleUpdateReport({ priority: e.target.value })}
                    disabled={bugReports.updating}
                    data-testid="bug-priority-select"
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    {PRIORITY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value} className="bg-gray-900">{opt.label}</option>
                    ))}
                  </select>
                </div>
                {bugReports.updating && <span className="text-blue-400 text-sm animate-pulse">Saving...</span>}
              </div>

              {/* Report Details */}
              <div>
                <h3 className="text-xl font-bold text-white">{selectedReport.title}</h3>
                <p className="text-sm text-white/40 mt-1">
                  {formatDate(selectedReport.created_at)} • {selectedReport.category}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-white/70 mb-2">Description</h4>
                <p className="text-white/90 whitespace-pre-wrap">{selectedReport.description}</p>
              </div>

              {selectedReport.steps_to_reproduce && (
                <div>
                  <h4 className="text-sm font-medium text-white/70 mb-2">Steps to Reproduce</h4>
                  <p className="text-white/90 whitespace-pre-wrap">{selectedReport.steps_to_reproduce}</p>
                </div>
              )}

              {selectedReport.screenshots?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-white/70 mb-2">Screenshots</h4>
                  <div className="flex flex-wrap gap-3">
                    {selectedReport.screenshots.map((ss, i) => (
                      <a key={i} href={ss.url} target="_blank" rel="noopener noreferrer" className="block">
                        <img src={ss.url} alt={`Screenshot ${i + 1}`} 
                          className="w-48 h-auto rounded-lg border border-white/10 hover:border-blue-500 transition-colors" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Resolution Notes */}
              <div className="border-t border-white/10 pt-4">
                <h4 className="text-sm font-medium text-white/70 mb-2">Resolution Notes</h4>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  data-testid="resolution-notes-input"
                  placeholder="Add notes about how this was resolved..."
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500 min-h-[100px] text-sm"
                />
                <button
                  onClick={() => handleUpdateReport({ resolution_notes: resolutionNotes })}
                  disabled={bugReports.updating || resolutionNotes === (selectedReport.resolution_notes || '')}
                  data-testid="save-notes-btn"
                  className="mt-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {bugReports.updating ? 'Saving...' : 'Save Notes'}
                </button>
              </div>

              {/* Quick Actions */}
              <div className="border-t border-white/10 pt-4">
                <h4 className="text-sm font-medium text-white/70 mb-3">Quick Actions</h4>
                <div className="flex flex-wrap gap-2">
                  {['investigating', 'in_progress', 'resolved', 'wont_fix'].map(status => {
                    const opt = STATUS_OPTIONS.find(o => o.value === status)
                    if (!opt) return null
                    return (
                      <button
                        key={status}
                        onClick={() => handleUpdateReport({ status })}
                        disabled={bugReports.updating || selectedReport.status === status}
                        data-testid={`quick-action-${status}`}
                        className={`px-3 py-2 rounded-lg border text-sm transition-colors disabled:opacity-50 ${opt.color.replace('/20', '/20 hover:bg-opacity-40 border-opacity-30')}`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Delete Section */}
              <div className="border-t border-red-500/20 pt-4">
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    data-testid="delete-report-btn"
                    className="px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 text-red-400 text-sm transition-colors"
                  >
                    🗑️ Delete Report
                  </button>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4" data-testid="delete-confirm">
                    <p className="text-red-400 text-sm mb-3">Are you sure? This cannot be undone.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDeleteReport}
                        disabled={bugReports.deleting}
                        data-testid="confirm-delete-btn"
                        className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
                      >
                        {bugReports.deleting ? 'Deleting...' : 'Yes, Delete'}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        data-testid="cancel-delete-btn"
                        className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-xs text-white/30">Report ID: {selectedReport.id}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
