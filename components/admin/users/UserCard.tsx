'use client'

import type { UserData } from './types'

interface UserCardProps {
  user: UserData
  onSelect: (user: UserData) => void
}

/**
 * Mobile-friendly user card component
 */
export function UserCard({ user, onSelect }: UserCardProps) {
  return (
    <div 
      className="rounded-xl bg-white/5 border border-white/10 p-4"
      data-testid={`user-card-${user.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            (user.display_name?.[0] || user.email?.[0] || '💳').toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-white truncate">
              {user.display_name || (user.email ? 'No name' : 'Wallet User')}
            </span>
            <RoleBadge role={user.role} />
          </div>
          <div className="text-sm text-white/50 truncate">{user.email || 'No email'}</div>
          {user.wallet_address && (
            <div className="text-xs text-white/40 font-mono mt-1">
              {user.wallet_address.slice(0, 10)}...{user.wallet_address.slice(-6)}
            </div>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-2 mt-4 text-center">
        <div className="bg-white/5 rounded-lg p-2">
          <div className="text-lg font-bold text-white">{user.purchases_count || 0}</div>
          <div className="text-xs text-white/50">Purchases</div>
        </div>
        <div className="bg-white/5 rounded-lg p-2">
          <div className="text-lg font-bold text-purple-400">{user.nfts_owned || 0}</div>
          <div className="text-xs text-white/50">NFTs</div>
        </div>
        <div className="bg-white/5 rounded-lg p-2">
          <div className="text-lg font-bold text-green-400">${(user.total_spent_usd || 0).toFixed(0)}</div>
          <div className="text-xs text-white/50">Spent</div>
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
        <span className="text-xs text-white/50">
          Joined {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
        </span>
        <button
          onClick={() => onSelect(user)}
          data-testid={`view-user-${user.id}-btn`}
          className="px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm font-medium transition-colors"
        >
          View Details
        </button>
      </div>
    </div>
  )
}

/**
 * Role badge component
 */
function RoleBadge({ role }: { role: string }) {
  const classes = 
    role === 'super_admin' ? 'bg-red-500/20 text-red-400' :
    role === 'admin' ? 'bg-blue-500/20 text-blue-400' :
    role === 'moderator' ? 'bg-purple-500/20 text-purple-400' :
    'bg-gray-500/20 text-gray-400'

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${classes}`}>
      {role || 'user'}
    </span>
  )
}

export default UserCard
