'use client'

import type { UserData, Purchase, Campaign, PurchaseStats, DetailTab } from './types'

interface UserDetailModalProps {
  user: UserData
  purchases: Purchase[]
  createdCampaigns: Campaign[]
  purchasedCampaigns: Campaign[]
  purchaseStats: PurchaseStats | null
  loading: boolean
  detailTab: DetailTab
  onTabChange: (tab: DetailTab) => void
  onClose: () => void
}

/**
 * User detail modal with tabs for purchases, created campaigns, and history
 */
export function UserDetailModal({
  user,
  purchases,
  createdCampaigns,
  purchasedCampaigns,
  purchaseStats,
  loading,
  detailTab,
  onTabChange,
  onClose,
}: UserDetailModalProps) {
  const totalNft = purchaseStats?.totalNftSpent ?? purchases.reduce((sum, p) => sum + (p.amount_usd || 0), 0)
  const totalTips = purchaseStats?.totalTips ?? 0
  const totalSpent = purchaseStats?.totalSpent ?? totalNft
  const purchaseCount = purchaseStats?.purchaseCount ?? purchases.length
  const nftsOwned = Math.max(user.nfts_owned || 0, purchaseCount)

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      data-testid="user-detail-modal"
    >
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold overflow-hidden">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                (user.display_name?.[0] || user.email?.[0] || '?').toUpperCase()
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{user.display_name || 'No name'}</h2>
              <p className="text-white/50">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="close-user-modal-btn"
            className="text-white/50 hover:text-white p-2 rounded-lg hover:bg-white/10"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Stats */}
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-4 gap-4">
              <StatCard value={purchaseCount} label="Purchases" color="blue" extra={user.nfts_owned > purchaseCount ? `(${user.nfts_owned} on-chain)` : undefined} />
              <StatCard value={nftsOwned} label="NFTs Owned" color="purple" />
              <StatCard value={`$${totalSpent.toFixed(2)}`} label="Total Spent" color="green" />
              <StatCard value={createdCampaigns.length} label="Campaigns Created" color="orange" />
            </div>
            
            {totalSpent > 0 && (
              <div className="rounded-lg bg-white/5 border border-white/10 p-3 flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-white/50">NFT Purchases:</span>
                  <span className="text-green-400 font-medium">${totalNft.toFixed(2)}</span>
                </div>
                <div className="w-px h-4 bg-white/20"></div>
                <div className="flex items-center gap-2">
                  <span className="text-white/50">Tips:</span>
                  <span className="text-yellow-400 font-medium">${totalTips.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4 border-b border-white/10 pb-3">
            <TabButton 
              active={detailTab === 'purchased'} 
              onClick={() => onTabChange('purchased')}
              color="blue"
              testId="tab-purchased"
            >
              🛒 Campaigns Purchased ({purchasedCampaigns.length})
            </TabButton>
            <TabButton 
              active={detailTab === 'created'} 
              onClick={() => onTabChange('created')}
              color="orange"
              testId="tab-created"
            >
              ✨ Campaigns Created ({createdCampaigns.length})
            </TabButton>
            <TabButton 
              active={detailTab === 'history'} 
              onClick={() => onTabChange('history')}
              color="green"
              testId="tab-history"
            >
              📜 Purchase History ({purchases.length})
            </TabButton>
          </div>

          {loading ? (
            <div className="text-center py-8 text-white/40">Loading...</div>
          ) : (
            <>
              {detailTab === 'purchased' && (
                <CampaignGrid campaigns={purchasedCampaigns} type="purchased" />
              )}
              {detailTab === 'created' && (
                <CampaignGrid campaigns={createdCampaigns} type="created" />
              )}
              {detailTab === 'history' && (
                <PurchaseHistory purchases={purchases} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ value, label, color, extra }: { value: number | string; label: string; color: string; extra?: string }) {
  const colorClass = 
    color === 'blue' ? 'text-blue-400' :
    color === 'purple' ? 'text-purple-400' :
    color === 'green' ? 'text-green-400' :
    'text-orange-400'

  return (
    <div className="rounded-lg bg-white/5 border border-white/10 p-4 text-center">
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-sm text-white/50">{label}</div>
      {extra && <div className="text-xs text-white/30 mt-1">{extra}</div>}
    </div>
  )
}

function TabButton({ active, onClick, color, testId, children }: { active: boolean; onClick: () => void; color: string; testId: string; children: React.ReactNode }) {
  const activeClass = 
    color === 'blue' ? 'bg-blue-600' :
    color === 'orange' ? 'bg-orange-600' :
    'bg-green-600'

  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? `${activeClass} text-white` : 'bg-white/5 text-white/70 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}

function CampaignGrid({ campaigns, type }: { campaigns: Campaign[]; type: 'purchased' | 'created' }) {
  if (campaigns.length === 0) {
    return (
      <div className="text-center py-8 text-white/40">
        No campaigns {type === 'purchased' ? 'purchased' : 'created'} yet
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {campaigns.map(c => (
        <div key={c.id} className="rounded-lg bg-white/5 border border-white/10 p-4 flex items-start gap-3">
          <div className="w-16 h-16 rounded-lg bg-white/10 overflow-hidden flex-shrink-0">
            {c.image_uri ? (
              <img 
                src={c.image_uri.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${c.image_uri.slice(7)}` : c.image_uri} 
                alt="" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl">
                {type === 'purchased' ? '🎁' : '📝'}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-white truncate">{c.title}</div>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={c.status} />
              <span className="text-xs text-white/40">{c.category}</span>
            </div>
            {type === 'purchased' && (
              <div className="flex items-center gap-3 mt-2 text-sm">
                <span className="text-blue-400">{c.purchase_count} purchase{c.purchase_count !== 1 ? 's' : ''}</span>
                <span className="text-green-400">${(c.total_spent || 0).toFixed(2)} spent</span>
              </div>
            )}
            {type === 'created' && c.goal && (
              <div className="mt-2 text-sm text-white/60">Goal: ${c.goal.toLocaleString()}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const classes = 
    status === 'minted' ? 'bg-green-500/20 text-green-400' :
    status === 'approved' ? 'bg-blue-500/20 text-blue-400' :
    status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
    'bg-gray-500/20 text-gray-400'

  return <span className={`text-xs px-2 py-0.5 rounded ${classes}`}>{status}</span>
}

function PurchaseHistory({ purchases }: { purchases: Purchase[] }) {
  if (purchases.length === 0) {
    return <div className="text-center py-8 text-white/40">No purchase history</div>
  }

  return (
    <div className="space-y-2">
      {purchases.map(p => (
        <div key={p.id} className="rounded-lg bg-white/5 border border-white/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-white">{p.campaign_title}</div>
              <div className="text-sm text-white/50">
                {new Date(p.created_at).toLocaleDateString()} • {p.quantity} NFT{p.quantity > 1 ? 's' : ''}
              </div>
              {p.email && <div className="text-xs text-blue-400 mt-1">📧 {p.email}</div>}
            </div>
            <div className="text-right">
              <div className="text-green-400 font-medium">${p.amount_usd?.toFixed(2) || '0.00'}</div>
              {p.tip_usd > 0 && <div className="text-yellow-400 text-sm">+${p.tip_usd.toFixed(2)} tip</div>}
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
        </div>
      ))}
    </div>
  )
}

export default UserDetailModal
