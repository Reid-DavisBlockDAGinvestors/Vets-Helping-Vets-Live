'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface BugReport {
  id: string
  created_at: string
  title: string
  description: string
  status: string
  priority: string
  category: string
  resolution_notes: string | null
  last_admin_response_at: string | null
}

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  new: { label: '🆕 New', color: 'bg-blue-500/20 text-blue-400' },
  investigating: { label: '🔍 Investigating', color: 'bg-yellow-500/20 text-yellow-400' },
  in_progress: { label: '🔧 In Progress', color: 'bg-purple-500/20 text-purple-400' },
  resolved: { label: '✅ Resolved', color: 'bg-green-500/20 text-green-400' },
  wont_fix: { label: '❌ Won\'t Fix', color: 'bg-gray-500/20 text-gray-400' },
  duplicate: { label: '📋 Duplicate', color: 'bg-orange-500/20 text-orange-400' },
}

export default function MyBugReportsPage() {
  const [reports, setReports] = useState<BugReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        fetchReports(session.access_token)
      } else {
        setLoading(false)
        setError('Please sign in to view your bug reports')
      }
    }
    checkAuth()
  }, [])

  const fetchReports = async (token: string) => {
    try {
      // Fetch user's bug reports directly from Supabase
      const { data, error: fetchError } = await supabase
        .from('bug_reports')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Fetch error:', fetchError)
        setError('Failed to load bug reports')
        return
      }

      setReports(data || [])
    } catch (e) {
      console.error('Error:', e)
      setError('Failed to load bug reports')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getStatusBadge = (status: string) => {
    return STATUS_BADGES[status] || STATUS_BADGES.new
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🔐</div>
          <h1 className="text-2xl font-bold text-white mb-4">Sign In Required</h1>
          <p className="text-white/60 mb-6">{error || 'Please sign in to view your bug reports'}</p>
          <Link
            href="/signin"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">My Bug Reports</h1>
            <p className="text-white/60 mt-1">Track the status of issues you&apos;ve reported</p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            ← Back
          </Link>
        </div>

        {reports.length === 0 ? (
          <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
            <div className="text-6xl mb-4">📭</div>
            <h2 className="text-xl font-semibold text-white mb-2">No Bug Reports</h2>
            <p className="text-white/60 max-w-md mx-auto">
              You haven&apos;t submitted any bug reports yet. If you encounter an issue, 
              use the bug report button in the app to let us know.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map(report => {
              const badge = getStatusBadge(report.status)
              const hasAdminResponse = !!report.last_admin_response_at
              
              return (
                <Link
                  key={report.id}
                  href={`/my-bug-reports/${report.id}`}
                  className="block bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 hover:border-white/20 transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${badge.color}`}>
                          {badge.label}
                        </span>
                        <span className="text-xs text-white/40">{report.category}</span>
                        {hasAdminResponse && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                            Admin responded
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-white group-hover:text-blue-300 transition-colors truncate">
                        {report.title}
                      </h3>
                      <p className="text-sm text-white/60 line-clamp-2 mt-1">
                        {report.description}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-white/40">
                        <span>Submitted {formatDate(report.created_at)}</span>
                        {report.last_admin_response_at && (
                          <span>Last response {formatDate(report.last_admin_response_at)}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-white/30 group-hover:text-white/60 transition-colors">
                      →
                    </div>
                  </div>
                  
                  {report.resolution_notes && ['resolved', 'wont_fix', 'duplicate'].includes(report.status) && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <p className="text-xs text-white/50 mb-1">Resolution</p>
                      <p className="text-sm text-white/80 line-clamp-2">{report.resolution_notes}</p>
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
