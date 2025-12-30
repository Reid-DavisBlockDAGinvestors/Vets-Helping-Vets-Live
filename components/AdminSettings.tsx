'use client'

/**
 * AdminSettings - Extracted from app/admin/page.tsx
 * 
 * Handles:
 * - Admin access requests management
 * - Marketplace contract visibility
 * - Advanced tools (backfill, cleanup)
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface AdminRequest {
  id: string
  name: string
  email: string
  requested_role: string
  reason: string
  created_at: string
}

interface MarketplaceContract {
  contract_address: string
  label: string
  enabled: boolean
}

export default function AdminSettings() {
  // Admin requests state
  const [adminRequests, setAdminRequests] = useState<AdminRequest[]>([])
  const [requestsLoading, setRequestsLoading] = useState(false)
  
  // Marketplace contracts state
  const [mktContracts, setMktContracts] = useState<MarketplaceContract[]>([])
  const [mktMsg, setMktMsg] = useState('')
  
  // Advanced tools state
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [backfillMsg, setBackfillMsg] = useState('')
  const [backfillAddr, setBackfillAddr] = useState('')

  // Load data on mount
  useEffect(() => {
    loadMarketplaceContracts()
  }, [])

  // Load marketplace contracts
  const loadMarketplaceContracts = async () => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) return

      const res = await fetch('/api/admin/marketplace-contracts', {
        headers: { authorization: `Bearer ${token}` }
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setMktContracts(data?.items || [])
      }
    } catch (e) {
      console.error('Failed to load contracts:', e)
    }
  }

  // Load admin requests
  const loadAdminRequests = async () => {
    setRequestsLoading(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) return

      const res = await fetch('/api/admin/requests?status=pending', {
        headers: { authorization: `Bearer ${token}` }
      })
      const data = await res.json().catch(() => ({}))
      setAdminRequests(data?.requests || [])
    } catch (e) {
      console.error('Failed to load requests:', e)
    } finally {
      setRequestsLoading(false)
    }
  }

  // Handle admin request approval/rejection
  const handleRequest = async (requestId: string, action: 'approve' | 'reject', role?: string) => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) return

      const res = await fetch('/api/admin/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestId, action, role })
      })
      const data = await res.json().catch(() => ({}))
      
      if (res.ok) {
        loadAdminRequests()
      } else {
        alert(data?.message || data?.error || 'Action failed')
      }
    } catch (e: any) {
      alert(e?.message || 'Action failed')
    }
  }

  // Toggle marketplace contract visibility
  const toggleContractVisibility = async (addr: string, currentEnabled: boolean, label: string) => {
    try {
      setMktMsg('')
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) {
        setMktMsg('Missing admin session token')
        return
      }
      
      const res = await fetch('/api/admin/marketplace-contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ contractAddress: addr, enabled: !currentEnabled, label })
      })
      
      if (res.ok) {
        setMktContracts(prev => prev.map(x => 
          x.contract_address === addr ? { ...x, enabled: !currentEnabled } : x
        ))
      }
    } catch (e) {
      console.error('Failed to toggle contract:', e)
    }
  }

  // Run backfill
  const runBackfill = async () => {
    if (!backfillAddr) {
      setBackfillMsg('Please select or enter a contract address')
      return
    }
    
    setBackfillMsg('Starting backfill...')
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) {
        setBackfillMsg('Missing session token')
        return
      }

      const res = await fetch('/api/admin/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ contractAddress: backfillAddr })
      })
      const data = await res.json().catch(() => ({}))
      
      if (res.ok) {
        setBackfillMsg(`✅ Backfill complete: ${data?.tokensProcessed || 0} tokens processed`)
      } else {
        setBackfillMsg(`❌ ${data?.error || 'Backfill failed'}`)
      }
    } catch (e: any) {
      setBackfillMsg(`❌ ${e?.message || 'Backfill failed'}`)
    }
  }

  return (
    <>
      {/* Admin Access Requests */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-6 mb-6" data-testid="admin-requests-section">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Admin Access Requests</h2>
            <p className="text-sm text-white/50">Review and approve requests for admin access</p>
          </div>
          <button
            onClick={loadAdminRequests}
            data-testid="refresh-requests-btn"
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            {requestsLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        
        {adminRequests.length > 0 ? (
          <div className="space-y-3">
            {adminRequests.map(req => (
              <div key={req.id} className="rounded-lg bg-white/5 border border-white/10 p-4" data-testid="admin-request-card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white">{req.name || 'No name'}</span>
                      <span className="text-white/50">•</span>
                      <span className="text-white/70 text-sm">{req.email}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        req.requested_role === 'admin' ? 'bg-blue-500/20 text-blue-400' :
                        req.requested_role === 'moderator' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {req.requested_role || 'admin'}
                      </span>
                    </div>
                    {req.reason && (
                      <p className="text-white/60 text-sm mt-1">{req.reason}</p>
                    )}
                    <p className="text-white/40 text-xs mt-2">
                      Requested: {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      id={`role-${req.id}`}
                      className="rounded-lg bg-white/10 border border-white/10 px-2 py-1.5 text-white text-sm focus:outline-none"
                      defaultValue={req.requested_role || 'admin'}
                      aria-label="Select role"
                    >
                      <option value="admin" className="bg-gray-800">Admin</option>
                      <option value="moderator" className="bg-gray-800">Moderator</option>
                      <option value="viewer" className="bg-gray-800">Viewer</option>
                    </select>
                    <button
                      onClick={() => {
                        const roleSelect = document.getElementById(`role-${req.id}`) as HTMLSelectElement
                        handleRequest(req.id, 'approve', roleSelect?.value)
                      }}
                      data-testid="approve-request-btn"
                      className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleRequest(req.id, 'reject')}
                      data-testid="reject-request-btn"
                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-white/40">
            <div className="text-3xl mb-2">✅</div>
            <p>No pending requests</p>
            <p className="text-sm mt-1">Click Refresh to check for new requests</p>
          </div>
        )}
      </div>

      {/* Marketplace Contracts */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-6 mb-6" data-testid="marketplace-contracts-section">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Marketplace Visibility</h2>
            <p className="text-sm text-white/50">Control which contracts appear on the public marketplace</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {mktContracts.map(c => {
            const addr = c.contract_address || ''
            const label = c.label || ''
            const enabled = c.enabled !== false
            const short = addr && addr.length > 10 ? `${addr.slice(0,6)}…${addr.slice(-4)}` : addr || '(missing)'
            return (
              <div 
                key={addr || label} 
                className={`flex items-center gap-3 rounded-lg px-4 py-2.5 border transition-colors cursor-pointer ${
                  enabled 
                    ? 'bg-green-500/10 border-green-500/30 text-green-300' 
                    : 'bg-white/5 border-white/10 text-white/50'
                }`}
                onClick={() => toggleContractVisibility(addr, enabled, label)}
                data-testid="contract-toggle"
              >
                <div className={`w-3 h-3 rounded-full ${enabled ? 'bg-green-400' : 'bg-white/30'}`} />
                <div>
                  <div className="font-mono text-xs">{short}</div>
                  {label && <div className="text-xs opacity-70">{label}</div>}
                </div>
              </div>
            )
          })}
          {mktContracts.length === 0 && (
            <div className="text-white/40 text-sm">No contracts configured yet</div>
          )}
        </div>
        {mktMsg && <div className="text-xs text-red-400 mt-2">{mktMsg}</div>}
      </div>

      {/* Advanced Tools - Collapsible */}
      <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden" data-testid="advanced-tools-section">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
          data-testid="toggle-advanced-btn"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">⚙️</span>
            <div className="text-left">
              <h2 className="font-semibold text-white">Advanced Tools</h2>
              <p className="text-sm text-white/50">Backfill, cleanup, and other admin utilities</p>
            </div>
          </div>
          <svg 
            className={`w-5 h-5 text-white/40 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {showAdvanced && (
          <div className="border-t border-white/10 p-6 space-y-6">
            {/* Backfill */}
            <div>
              <h3 className="font-medium text-white mb-2">Backfill On-chain Data</h3>
              <p className="text-sm text-white/50 mb-3">Scan a contract and sync token data to the database</p>
              <div className="flex gap-3">
                <select
                  className="flex-1 rounded-lg bg-white/10 border border-white/10 p-2 text-white text-sm"
                  onChange={e => setBackfillAddr(e.target.value)}
                  value={backfillAddr || ''}
                  data-testid="backfill-select"
                  aria-label="Select contract"
                >
                  <option value="">Select contract…</option>
                  <option value={process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''}>Current V5 Contract</option>
                </select>
                <input
                  className="flex-1 rounded-lg bg-white/10 border border-white/10 p-2 text-white placeholder:text-white/40 text-sm"
                  placeholder="Or paste address 0x…"
                  value={backfillAddr}
                  onChange={e => setBackfillAddr(e.target.value)}
                  data-testid="backfill-input"
                  aria-label="Contract address"
                />
                <button
                  onClick={runBackfill}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                  data-testid="run-backfill-btn"
                >
                  Run
                </button>
              </div>
              {backfillMsg && (
                <div className={`text-sm mt-2 ${backfillMsg.startsWith('✅') ? 'text-green-400' : backfillMsg.startsWith('❌') ? 'text-red-400' : 'text-white/60'}`}>
                  {backfillMsg}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
