'use client'

/**
 * useBugReports Hook
 * 
 * Manages bug report data fetching, filtering, and CRUD operations
 * Following ISP - focused on bug report state management
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { BugReport, BugReportStats } from '../types'

export interface UseBugReportsReturn {
  reports: BugReport[]
  loading: boolean
  error: string | null
  stats: BugReportStats
  statusFilter: string
  categoryFilter: string
  setStatusFilter: (filter: string) => void
  setCategoryFilter: (filter: string) => void
  fetchReports: () => Promise<void>
  updateReport: (id: string, updates: { status?: string; priority?: string; resolution_notes?: string }, adminMessage?: string, sendEmail?: boolean) => Promise<boolean>
  deleteReport: (id: string) => Promise<boolean>
  updating: boolean
  deleting: boolean
}

export function useBugReports(): UseBugReportsReturn {
  const [reports, setReports] = useState<BugReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stats, setStats] = useState<BugReportStats>({ total: 0, new: 0, inProgress: 0, resolved: 0 })
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchReports = useCallback(async () => {
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
      logger.error('Fetch error:', e)
      setError('Failed to fetch bug reports')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, categoryFilter])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const updateReport = useCallback(async (
    id: string, 
    updates: { status?: string; priority?: string; resolution_notes?: string },
    adminMessage?: string,
    sendEmail: boolean = true
  ): Promise<boolean> => {
    setUpdating(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) return false

      const res = await fetch('/api/bug-reports', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          id, 
          ...updates,
          admin_message: adminMessage || undefined,
          send_email: sendEmail
        })
      })

      if (res.ok) {
        const data = await res.json()
        setReports(prev => prev.map(r => r.id === id ? { ...r, ...data.report } : r))
        fetchReports() // Refresh stats
        return true
      }
      return false
    } catch (e) {
      logger.error('Update error:', e)
      return false
    } finally {
      setUpdating(false)
    }
  }, [fetchReports])

  const deleteReport = useCallback(async (id: string): Promise<boolean> => {
    setDeleting(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) return false

      const res = await fetch(`/api/bug-reports?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (res.ok) {
        setReports(prev => prev.filter(r => r.id !== id))
        fetchReports() // Refresh stats
        return true
      }
      return false
    } catch (e) {
      logger.error('Delete error:', e)
      return false
    } finally {
      setDeleting(false)
    }
  }, [fetchReports])

  return {
    reports,
    loading,
    error,
    stats,
    statusFilter,
    categoryFilter,
    setStatusFilter,
    setCategoryFilter,
    fetchReports,
    updateReport,
    deleteReport,
    updating,
    deleting
  }
}
