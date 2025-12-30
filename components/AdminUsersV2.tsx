'use client'

/**
 * AdminUsersV2 - Modular Users Management
 * 
 * Orchestrator component using modular admin/users/ structure
 * Following ISP - delegates to focused hooks and components
 * 
 * Original: 652 lines (monolithic)
 * Refactored: ~120 lines (orchestrator pattern)
 * 
 * Uses modular components from @/components/admin/users:
 * - useUsers - Users list state and filtering
 * - useUserDetails - Selected user details
 * - UserTable - Desktop table view
 * - UserCard - Mobile card view
 * - UserDetailModal - Detail modal with tabs
 */

import { useState } from 'react'
import {
  useUsers,
  useUserDetails,
  UserTable,
  UserCard,
  UserDetailModal,
  type UserData,
} from './admin/users'

export default function AdminUsersV2() {
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null)
  
  const users = useUsers()
  const details = useUserDetails(selectedUser)

  if (users.loading) {
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
    <div className="space-y-6" data-testid="admin-users-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Platform Users</h2>
          <p className="text-white/50 text-sm">{users.users.length} total users</p>
        </div>
        <button
          onClick={users.refresh}
          data-testid="refresh-users-btn"
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          Refresh
        </button>
      </div>

      {users.error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-red-400">
          {users.error}
        </div>
      )}

      {/* Search and Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by email or name..."
          value={users.searchTerm}
          onChange={e => users.setSearchTerm(e.target.value)}
          data-testid="search-users-input"
          className="flex-1 rounded-lg bg-white/10 border border-white/10 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
        />
        <div className="flex gap-2">
          <select
            value={users.sortBy}
            onChange={e => users.setSortBy(e.target.value as any)}
            data-testid="sort-users-select"
            className="flex-1 sm:flex-none rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none"
          >
            <option value="created_at" className="bg-gray-800">Join Date</option>
            <option value="purchases_count" className="bg-gray-800">Purchases</option>
            <option value="total_spent_usd" className="bg-gray-800">Total Spent</option>
          </select>
          <button
            onClick={() => users.setSortOrder(users.sortOrder === 'asc' ? 'desc' : 'asc')}
            data-testid="sort-order-btn"
            className="px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white hover:bg-white/20 transition-colors"
          >
            {users.sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Desktop Table */}
      <UserTable users={users.filteredUsers} onSelect={setSelectedUser} />

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {users.filteredUsers.map(user => (
          <UserCard key={user.id} user={user} onSelect={setSelectedUser} />
        ))}
        {users.filteredUsers.length === 0 && (
          <div className="rounded-xl bg-white/5 border border-white/10 p-8 text-center text-white/40">
            {users.searchTerm ? 'No users match your search' : 'No users found'}
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          purchases={details.userPurchases}
          createdCampaigns={details.createdCampaigns}
          purchasedCampaigns={details.purchasedCampaigns}
          purchaseStats={details.purchaseStats}
          loading={details.loading}
          detailTab={details.detailTab}
          onTabChange={details.setDetailTab}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  )
}
