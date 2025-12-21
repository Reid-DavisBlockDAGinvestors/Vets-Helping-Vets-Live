'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface Message {
  id: string
  created_at: string
  sender_name: string
  sender_email: string | null
  is_admin: boolean
  message: string
}

interface BugReport {
  id: string
  created_at: string
  updated_at: string
  title: string
  description: string
  steps_to_reproduce: string | null
  expected_behavior: string | null
  screenshots: { url: string; filename: string }[]
  page_url: string | null
  status: string
  priority: string
  category: string
  resolution_notes: string | null
  last_admin_response_at: string | null
}

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  new: { label: '🆕 New', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  investigating: { label: '🔍 Investigating', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  in_progress: { label: '🔧 In Progress', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  resolved: { label: '✅ Resolved', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  wont_fix: { label: '❌ Won\'t Fix', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  duplicate: { label: '📋 Duplicate', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
}

export default function BugReportDetailPage() {
  const params = useParams()
  const reportId = params.id as string
  
  const [report, setReport] = useState<BugReport | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        fetchReport(session.access_token)
      } else {
        setLoading(false)
        setError('Please sign in to view this bug report')
      }
    }
    checkAuth()
  }, [reportId])

  const fetchReport = async (token: string) => {
    try {
      const res = await fetch(`/api/bug-reports/${reportId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || 'Failed to load bug report')
        return
      }

      setReport(data.report)
      setMessages(data.messages || [])
    } catch (e) {
      console.error('Error:', e)
      setError('Failed to load bug report')
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return
    
    setSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Session expired, please sign in again')
        return
      }

      const res = await fetch(`/api/bug-reports/${reportId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: newMessage.trim() })
      })

      const data = await res.json()
      
      if (res.ok) {
        setMessages(prev => [...prev, data.message])
        setNewMessage('')
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      } else {
        alert(data.error || 'Failed to send message')
      }
    } catch (e) {
      console.error('Error:', e)
      alert('Failed to send message')
    } finally {
      setSending(false)
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

  if (error || !user || !report) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🔐</div>
          <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-white/60 mb-6">{error || 'Unable to load bug report'}</p>
          <Link
            href="/my-bug-reports"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
          >
            Back to My Reports
          </Link>
        </div>
      </div>
    )
  }

  const badge = getStatusBadge(report.status)
  const isResolved = ['resolved', 'wont_fix', 'duplicate'].includes(report.status)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/my-bug-reports"
            className="inline-flex items-center text-white/60 hover:text-white transition-colors mb-4"
          >
            ← Back to My Reports
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-sm px-3 py-1 rounded-full border ${badge.color}`}>
                  {badge.label}
                </span>
                <span className="text-sm text-white/40">{report.category}</span>
              </div>
              <h1 className="text-2xl font-bold text-white">{report.title}</h1>
              <p className="text-white/50 text-sm mt-1">
                Submitted {formatDate(report.created_at)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h2 className="text-sm font-medium text-white/60 mb-3">Description</h2>
              <p className="text-white whitespace-pre-wrap">{report.description}</p>
            </div>

            {/* Steps to Reproduce */}
            {report.steps_to_reproduce && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <h2 className="text-sm font-medium text-white/60 mb-3">Steps to Reproduce</h2>
                <p className="text-white whitespace-pre-wrap">{report.steps_to_reproduce}</p>
              </div>
            )}

            {/* Expected Behavior */}
            {report.expected_behavior && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <h2 className="text-sm font-medium text-white/60 mb-3">Expected Behavior</h2>
                <p className="text-white whitespace-pre-wrap">{report.expected_behavior}</p>
              </div>
            )}

            {/* Screenshots */}
            {report.screenshots?.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <h2 className="text-sm font-medium text-white/60 mb-3">Screenshots</h2>
                <div className="flex flex-wrap gap-3">
                  {report.screenshots.map((ss, i) => (
                    <a
                      key={i}
                      href={ss.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={ss.url}
                        alt={`Screenshot ${i + 1}`}
                        className="w-32 h-24 object-cover rounded-lg border border-white/10 hover:border-blue-500 transition-colors"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution Notes */}
            {isResolved && report.resolution_notes && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5">
                <h2 className="text-sm font-medium text-green-400 mb-3">✅ Resolution</h2>
                <p className="text-white whitespace-pre-wrap">{report.resolution_notes}</p>
              </div>
            )}

            {/* Messages / Conversation */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h2 className="font-medium text-white">💬 Conversation</h2>
                <p className="text-xs text-white/50 mt-1">
                  Communicate with our team about this issue
                </p>
              </div>
              
              <div className="p-5 space-y-4 max-h-96 overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-white/40 text-center py-6">
                    No messages yet. Send a message to communicate with our team.
                  </p>
                ) : (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.is_admin ? 'justify-start' : 'justify-end'}`}
                    >
                      <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                        msg.is_admin 
                          ? 'bg-purple-500/20 border border-purple-500/30' 
                          : 'bg-blue-500/20 border border-blue-500/30'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-medium ${msg.is_admin ? 'text-purple-400' : 'text-blue-400'}`}>
                            {msg.is_admin ? '👤 Admin' : 'You'}
                          </span>
                          <span className="text-xs text-white/40">{formatDate(msg.created_at)}</span>
                        </div>
                        <p className="text-white text-sm whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="px-5 py-4 border-t border-white/10 bg-white/5">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 bg-white/10 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                  >
                    {sending ? '...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Status Card */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h3 className="text-sm font-medium text-white/60 mb-4">Status</h3>
              <div className={`inline-flex items-center px-4 py-2 rounded-lg border ${badge.color}`}>
                <span className="font-medium">{badge.label}</span>
              </div>
              {report.last_admin_response_at && (
                <p className="text-xs text-white/40 mt-3">
                  Last admin response: {formatDate(report.last_admin_response_at)}
                </p>
              )}
            </div>

            {/* Details Card */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h3 className="text-sm font-medium text-white/60 mb-4">Details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-white/40">Category</span>
                  <p className="text-white">{report.category}</p>
                </div>
                <div>
                  <span className="text-white/40">Priority</span>
                  <p className="text-white capitalize">{report.priority}</p>
                </div>
                {report.page_url && (
                  <div>
                    <span className="text-white/40">Page URL</span>
                    <p className="text-white/80 text-xs break-all">{report.page_url}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Report ID */}
            <div className="text-xs text-white/30 p-2">
              Report ID: {report.id}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
