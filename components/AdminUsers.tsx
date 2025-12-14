'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface UserData {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  role: string
  created_at: string
  last_sign_in_at: string | null
  wallet_address: string | null
  purchases_count: number
  nfts_owned: number
  total_spent_usd: number
  campaigns_created: number
  source?: 'profile' | 'purchase'
}

interface Purchase {
  id: string
  campaign_title: string
  amount_usd: number
  quantity: number
  created_at: string
  tx_hash: string | null
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null)
  const [userPurchases, setUserPurchases] = useState<Purchase[]>([])
  const [loadingPurchases, setLoadingPurchases] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'created_at' | 'purchases_count' | 'total_spent_usd'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) {
        setError('Not authenticated')
        return
      }

      const res = await fetch('/api/admin/users', {
        headers: { authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      console.log('[AdminUsers] API response:', data)
      
      if (!res.ok) {
        setError(data?.error || 'Failed to load users')
        return
      }
      
      console.log('[AdminUsers] Users count:', data?.users?.length, 'Total:', data?.total)
      setUsers(data?.users || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const loadUserPurchases = async (userId: string) => {
    setLoadingPurchases(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) return

      const res = await fetch(`/api/admin/users/${userId}/purchases`, {
        headers: { authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      
      if (res.ok) {
        setUserPurchases(data?.purchases || [])
      }
    } catch (e) {
      console.error('Failed to load purchases:', e)
    } finally {
      setLoadingPurchases(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    if (selectedUser) {
      loadUserPurchases(selectedUser.id)
    }
  }, [selectedUser])

  const filteredUsers = users
    .filter(u => 
      !searchTerm || 
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortBy] ?? 0
      const bVal = b[sortBy] ?? 0
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1
      }
      return aVal < bVal ? 1 : -1
    })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-blue-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-white/50">Loading users...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Platform Users</h2>
          <p className="text-white/50 text-sm">{users.length} total users</p>
        </div>
        <button
          onClick={loadUsers}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Search and Sort */}
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search by email or name..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="flex-1 rounded-lg bg-white/10 border border-white/10 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
        />
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          className="rounded-lg bg-white/10 border border-white/10 px-4 py-2 text-white focus:outline-none"
        >
          <option value="created_at" className="bg-gray-800">Sort by Join Date</option>
          <option value="purchases_count" className="bg-gray-800">Sort by Purchases</option>
          <option value="total_spent_usd" className="bg-gray-800">Sort by Total Spent</option>
        </select>
        <button
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white hover:bg-white/20 transition-colors"
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {/* Users Table */}
      <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="text-left p-4 text-white/70 font-medium">User</th>
              <th className="text-left p-4 text-white/70 font-medium">Role</th>
              <th className="text-right p-4 text-white/70 font-medium">Purchases</th>
              <th className="text-right p-4 text-white/70 font-medium">NFTs Owned</th>
              <th className="text-right p-4 text-white/70 font-medium">Total Spent</th>
              <th className="text-left p-4 text-white/70 font-medium">Joined</th>
              <th className="text-center p-4 text-white/70 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold overflow-hidden">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (user.display_name?.[0] || user.email?.[0] || '💳').toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-white">{user.display_name || (user.email ? 'No name' : 'Wallet User')}</div>
                      <div className="text-sm text-white/50">{user.email || 'No email'}</div>
                      {user.wallet_address && (
                        <div className="text-xs text-white/40 font-mono">
                          {user.wallet_address.slice(0, 6)}...{user.wallet_address.slice(-4)}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    user.role === 'super_admin' ? 'bg-red-500/20 text-red-400' :
                    user.role === 'admin' ? 'bg-blue-500/20 text-blue-400' :
                    user.role === 'moderator' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {user.role || 'user'}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <span className="text-white font-medium">{user.purchases_count || 0}</span>
                </td>
                <td className="p-4 text-right">
                  <span className="text-white font-medium">{user.nfts_owned || 0}</span>
                </td>
                <td className="p-4 text-right">
                  <span className="text-green-400 font-medium">${(user.total_spent_usd || 0).toFixed(2)}</span>
                </td>
                <td className="p-4 text-white/70 text-sm">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </td>
                <td className="p-4 text-center">
                  <button
                    onClick={() => setSelectedUser(user)}
                    className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm transition-colors"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-white/40">
                  {searchTerm ? 'No users match your search' : 'No users found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold overflow-hidden">
                  {selectedUser.avatar_url ? (
                    <img src={selectedUser.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (selectedUser.display_name?.[0] || selectedUser.email?.[0] || '?').toUpperCase()
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedUser.display_name || 'No name'}</h2>
                  <p className="text-white/50">{selectedUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-white/50 hover:text-white p-2 rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="rounded-lg bg-white/5 border border-white/10 p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400">{selectedUser.purchases_count || 0}</div>
                  <div className="text-sm text-white/50">Purchases</div>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/10 p-4 text-center">
                  <div className="text-2xl font-bold text-purple-400">{selectedUser.nfts_owned || 0}</div>
                  <div className="text-sm text-white/50">NFTs Owned</div>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/10 p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">${(selectedUser.total_spent_usd || 0).toFixed(2)}</div>
                  <div className="text-sm text-white/50">Total Spent</div>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/10 p-4 text-center">
                  <div className="text-2xl font-bold text-orange-400">{selectedUser.campaigns_created || 0}</div>
                  <div className="text-sm text-white/50">Campaigns Created</div>
                </div>
              </div>

              {/* Purchase History */}
              <h3 className="text-lg font-semibold text-white mb-4">Purchase History</h3>
              {loadingPurchases ? (
                <div className="text-center py-8 text-white/40">Loading purchases...</div>
              ) : userPurchases.length > 0 ? (
                <div className="space-y-2">
                  {userPurchases.map(p => (
                    <div key={p.id} className="rounded-lg bg-white/5 border border-white/10 p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-white">{p.campaign_title}</div>
                        <div className="text-sm text-white/50">
                          {new Date(p.created_at).toLocaleDateString()} • {p.quantity} NFT{p.quantity > 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-green-400 font-medium">${p.amount_usd?.toFixed(2) || '0.00'}</div>
                        {p.tx_hash && (
                          <a 
                            href={`https://awakening.bdagscan.com/tx/${p.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:underline"
                          >
                            View TX →
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-white/40">No purchases yet</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
