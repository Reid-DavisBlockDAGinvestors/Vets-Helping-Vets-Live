'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface BugReport {
  id: string
  created_at: string
  title: string
  description: string
  steps_to_reproduce: string | null
  expected_behavior: string | null
  screenshots: { url: string; filename: string }[]
  page_url: string | null
  user_agent: string | null
  screen_size: string | null
  user_email: string | null
  wallet_address: string | null
  category: string
  status: string
  priority: string
  resolution_notes: string | null
  tags: string[]
}

const STATUS_OPTIONS = [
  { value: 'new', label: '🆕 New', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'investigating', label: '🔍 Investigating', color: 'bg-yellow-500/20 text-yellow-400' },
  { value: 'in_progress', label: '🔧 In Progress', color: 'bg-purple-500/20 text-purple-400' },
  { value: 'resolved', label: '✅ Resolved', color: 'bg-green-500/20 text-green-400' },
  { value: 'wont_fix', label: '❌ Won\'t Fix', color: 'bg-gray-500/20 text-gray-400' },
  { value: 'duplicate', label: '📋 Duplicate', color: 'bg-orange-500/20 text-orange-400' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'text-gray-400' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-400' },
  { value: 'high', label: 'High', color: 'text-orange-400' },
  { value: 'critical', label: 'Critical', color: 'text-red-400' },
]

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'general', label: '🐛 General' },
  { value: 'purchase', label: '💳 Purchase' },
  { value: 'submission', label: '📝 Submission' },
  { value: 'wallet', label: '👛 Wallet' },
  { value: 'auth', label: '🔐 Auth' },
  { value: 'display', label: '🖼️ Display' },
  { value: 'performance', label: '⚡ Performance' },
  { value: 'other', label: '❓ Other' },
]

export default function AdminBugReports() {
  const [reports, setReports] = useState<BugReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null)
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  
  // Stats
  const [stats, setStats] = useState({ total: 0, new: 0, inProgress: 0, resolved: 0 })

  const fetchReports = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      
      if (!token) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      
      const res = await fetch(`/api/bug-reports?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || 'Failed to fetch bug reports')
        setLoading(false)
        return
      }

      setReports(data.reports || [])
      
      // Calculate stats
      const all = data.reports || []
      setStats({
        total: all.length,
        new: all.filter((r: BugReport) => r.status === 'new').length,
        inProgress: all.filter((r: BugReport) => ['investigating', 'in_progress'].includes(r.status)).length,
        resolved: all.filter((r: BugReport) => r.status === 'resolved').length,
      })
    } catch (e) {
      console.error('Fetch error:', e)
      setError('Failed to fetch bug reports')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [statusFilter, categoryFilter])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getStatusBadge = (status: string) => {
    const opt = STATUS_OPTIONS.find(o => o.value === status)
    return opt || STATUS_OPTIONS[0]
  }

  const getPriorityColor = (priority: string) => {
    const opt = PRIORITY_OPTIONS.find(o => o.value === priority)
    return opt?.color || 'text-gray-400'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-sm text-white/60">Total Reports</div>
        </div>
        <div className="bg-blue-500/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-400">{stats.new}</div>
          <div className="text-sm text-white/60">New</div>
        </div>
        <div className="bg-purple-500/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-400">{stats.inProgress}</div>
          <div className="text-sm text-white/60">In Progress</div>
        </div>
        <div className="bg-green-500/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">{stats.resolved}</div>
          <div className="text-sm text-white/60">Resolved</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-lg bg-white/10 border border-white/10 text-white focus:outline-none"
        >
          <option value="all" className="bg-gray-900">All Statuses</option>
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-gray-900">{opt.label}</option>
          ))}
        </select>
        
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="px-4 py-2 rounded-lg bg-white/10 border border-white/10 text-white focus:outline-none"
        >
          {CATEGORY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-gray-900">{opt.label}</option>
          ))}
        </select>

        <button
          onClick={fetchReports}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Reports list */}
      {reports.length === 0 ? (
        <div className="text-center py-12 text-white/60">
          No bug reports found
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map(report => (
            <div
              key={report.id}
              className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors cursor-pointer"
              onClick={() => setSelectedReport(report)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadge(report.status).color}`}>
                      {getStatusBadge(report.status).label}
                    </span>
                    <span className={`text-xs ${getPriorityColor(report.priority)}`}>
                      {report.priority.toUpperCase()}
                    </span>
                    <span className="text-xs text-white/40">{report.category}</span>
                  </div>
                  <h3 className="font-medium text-white truncate">{report.title}</h3>
                  <p className="text-sm text-white/60 line-clamp-2 mt-1">{report.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
                    <span>{formatDate(report.created_at)}</span>
                    {report.user_email && <span>{report.user_email}</span>}
                    {report.screenshots?.length > 0 && (
                      <span className="flex items-center gap-1">
                        📷 {report.screenshots.length}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80" onClick={() => setSelectedReport(null)} />
          <div className="relative z-10 bg-gray-900 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-900 border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Bug Report Details</h2>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-white/50 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-2">
                <span className={`text-sm px-3 py-1 rounded-full ${getStatusBadge(selectedReport.status).color}`}>
                  {getStatusBadge(selectedReport.status).label}
                </span>
                <span className={`text-sm ${getPriorityColor(selectedReport.priority)}`}>
                  Priority: {selectedReport.priority.toUpperCase()}
                </span>
              </div>

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

              {selectedReport.expected_behavior && (
                <div>
                  <h4 className="text-sm font-medium text-white/70 mb-2">Expected Behavior</h4>
                  <p className="text-white/90 whitespace-pre-wrap">{selectedReport.expected_behavior}</p>
                </div>
              )}

              {selectedReport.screenshots?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-white/70 mb-2">Screenshots</h4>
                  <div className="flex flex-wrap gap-3">
                    {selectedReport.screenshots.map((ss, i) => (
                      <a
                        key={i}
                        href={ss.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={ss.url}
                          alt={`Screenshot ${i + 1}`}
                          className="w-48 h-auto rounded-lg border border-white/10 hover:border-blue-500 transition-colors"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-white/10 pt-4">
                <h4 className="text-sm font-medium text-white/70 mb-2">Technical Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {selectedReport.user_email && (
                    <div>
                      <span className="text-white/40">Email:</span>{' '}
                      <span className="text-white/80">{selectedReport.user_email}</span>
                    </div>
                  )}
                  {selectedReport.page_url && (
                    <div className="col-span-full">
                      <span className="text-white/40">Page:</span>{' '}
                      <span className="text-white/80 break-all">{selectedReport.page_url}</span>
                    </div>
                  )}
                  {selectedReport.screen_size && (
                    <div>
                      <span className="text-white/40">Screen:</span>{' '}
                      <span className="text-white/80">{selectedReport.screen_size}</span>
                    </div>
                  )}
                  {selectedReport.user_agent && (
                    <div className="col-span-full">
                      <span className="text-white/40">Browser:</span>{' '}
                      <span className="text-white/80 text-xs break-all">{selectedReport.user_agent}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-xs text-white/30">
                Report ID: {selectedReport.id}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
