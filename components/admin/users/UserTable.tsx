'use client'

import type { UserData } from './types'

interface UserTableProps {
  users: UserData[]
  onSelect: (user: UserData) => void
}

/**
 * Desktop table view for users
 */
export function UserTable({ users, onSelect }: UserTableProps) {
  return (
    <div 
      className="hidden md:block rounded-xl bg-white/5 border border-white/10 overflow-hidden"
      data-testid="users-table"
    >
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            <th className="text-left p-4 text-white/70 font-medium">User</th>
            <th className="text-left p-4 text-white/70 font-medium">Role</th>
            <th className="text-right p-4 text-white/70 font-medium">Purchases</th>
            <th className="text-right p-4 text-white/70 font-medium">NFTs</th>
            <th className="text-right p-4 text-white/70 font-medium">Spent</th>
            <th className="text-left p-4 text-white/70 font-medium">Joined</th>
            <th className="text-center p-4 text-white/70 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr 
              key={user.id} 
              className="border-b border-white/5 hover:bg-white/5 transition-colors"
              data-testid={`user-row-${user.id}`}
            >
              <td className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (user.display_name?.[0] || user.email?.[0] || '💳').toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-white truncate">
                      {user.display_name || (user.email ? 'No name' : 'Wallet User')}
                    </div>
                    <div className="text-sm text-white/50 truncate">{user.email || 'No email'}</div>
                    {user.wallet_address && (
                      <div className="text-xs text-white/40 font-mono">
                        {user.wallet_address.slice(0, 6)}...{user.wallet_address.slice(-4)}
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td className="p-4">
                <RoleBadge role={user.role} />
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
                  onClick={() => onSelect(user)}
                  data-testid={`view-user-${user.id}-btn`}
                  className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm transition-colors"
                >
                  View Details
                </button>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={7} className="p-8 text-center text-white/40">
                No users found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  const classes = 
    role === 'super_admin' ? 'bg-red-500/20 text-red-400' :
    role === 'admin' ? 'bg-blue-500/20 text-blue-400' :
    role === 'moderator' ? 'bg-purple-500/20 text-purple-400' :
    'bg-gray-500/20 text-gray-400'

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${classes}`}>
      {role || 'user'}
    </span>
  )
}

export default UserTable
