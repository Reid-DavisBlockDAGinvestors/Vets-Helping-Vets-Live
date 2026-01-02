'use client'

import { useState } from 'react'
import { ipfsToHttp } from '@/lib/ipfs'
import { getCategoryById } from '@/lib/categories'
import { StatusBadge, UpdateStatusBadge } from './StatusBadge'
import type { Campaign, CampaignUpdate } from './types'

// Chain explorer URLs
const CHAIN_EXPLORERS: Record<number, string> = {
  1043: 'https://awakening.bdagscan.com',
  1: 'https://etherscan.io',
  11155111: 'https://sepolia.etherscan.io',
  137: 'https://polygonscan.com',
  8453: 'https://basescan.org',
}

// Chain display info
const CHAIN_INFO: Record<number, { name: string; color: string; icon: string }> = {
  1043: { name: 'BlockDAG', color: 'bg-blue-500/20 text-blue-400', icon: '🔷' },
  1: { name: 'Ethereum', color: 'bg-purple-500/20 text-purple-400', icon: '⟠' },
  11155111: { name: 'Sepolia', color: 'bg-yellow-500/20 text-yellow-400', icon: '🧪' },
  137: { name: 'Polygon', color: 'bg-violet-500/20 text-violet-400', icon: '🟣' },
  8453: { name: 'Base', color: 'bg-blue-500/20 text-blue-400', icon: '🔵' },
}

function getExplorerTxUrl(chainId: number | null, txHash: string): string {
  const baseUrl = chainId ? CHAIN_EXPLORERS[chainId] : CHAIN_EXPLORERS[1043]
  return `${baseUrl || CHAIN_EXPLORERS[1043]}/tx/${txHash}`
}

function NetworkBadge({ chainId, chainName }: { chainId: number | null; chainName: string | null }) {
  if (!chainId) return null
  
  const info = CHAIN_INFO[chainId]
  if (!info) return null
  
  return (
    <span 
      className={`px-2 py-0.5 rounded-full text-xs ${info.color}`}
      data-testid={`network-badge-${chainId}`}
    >
      {info.icon} {chainName || info.name}
    </span>
  )
}

interface CampaignCardProps {
  campaign: Campaign
  isExpanded: boolean
  onToggle: () => void
  onApprove: () => void
  onReject: () => void
  onEdit: () => void
  onDelete: () => void
  onVerify?: () => void
  onFix?: () => void
  onClose?: () => void
  onDeactivate?: () => void
  onReactivate?: () => void
  isApproving?: boolean
  isVerifying?: boolean
  isFixing?: boolean
  isClosing?: boolean
  isDeactivating?: boolean
  isReactivating?: boolean
  onViewDocument?: (path: string) => void
}

export function CampaignCard({
  campaign,
  isExpanded,
  onToggle,
  onApprove,
  onReject,
  onEdit,
  onDelete,
  onVerify,
  onFix,
  onClose,
  onDeactivate,
  onReactivate,
  isApproving,
  isVerifying,
  isFixing,
  isClosing,
  isDeactivating,
  isReactivating,
  onViewDocument
}: CampaignCardProps) {
  const [showUpdates, setShowUpdates] = useState(false)
  const category = getCategoryById(campaign.category)

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
      {/* Header - Always visible */}
      <div 
        className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start gap-4">
          {/* Thumbnail */}
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
            {campaign.image_uri && (
              <img 
                src={ipfsToHttp(campaign.image_uri)} 
                alt={campaign.title}
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-white truncate">{campaign.title}</h3>
              <StatusBadge status={campaign.status} />
              {category && (
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs text-white/70">
                  {category.emoji} {category.label}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-4 mt-1 text-sm text-white/50 flex-wrap">
              <span>Goal: {formatCurrency(campaign.goal)}</span>
              <span>Created: {formatDate(campaign.created_at)}</span>
              {campaign.campaign_id != null && (
                <span className="text-green-400">
                  {campaign.contract_version?.toUpperCase() || 'V5'} #{campaign.campaign_id}
                </span>
              )}
              {/* Network Badge */}
              <NetworkBadge chainId={campaign.chain_id} chainName={campaign.chain_name} />
            </div>

            {/* Updates indicator */}
            {campaign.updates.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-white/50">
                  {campaign.updates.length} update{campaign.updates.length !== 1 ? 's' : ''}
                </span>
                {campaign.pendingUpdates > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs">
                    {campaign.pendingUpdates} pending
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Expand icon */}
          <div className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-white/10 p-4 space-y-4">
          {/* On-chain stats */}
          {campaign.onchainStats && (
            <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
              <div className="text-sm font-medium text-green-400 mb-2">On-Chain Stats</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-white/50">Editions</div>
                  <div className="text-white">{campaign.onchainStats.editionsMinted}/{campaign.onchainStats.maxEditions}</div>
                </div>
                <div>
                  <div className="text-white/50">NFT Sales</div>
                  <div className="text-white">{formatCurrency(campaign.onchainStats.nftSalesUSD)}</div>
                </div>
                <div>
                  <div className="text-white/50">Tips</div>
                  <div className="text-white">{formatCurrency(campaign.onchainStats.tipsUSD)}</div>
                </div>
                <div>
                  <div className="text-white/50">Progress</div>
                  <div className="text-white">{campaign.onchainStats.progressPercent}%</div>
                </div>
              </div>
            </div>
          )}

          {/* Creator Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-white/50 mb-1">Creator</div>
              <div className="text-sm text-white">{campaign.creator_name || 'Not provided'}</div>
              <div className="text-xs text-white/50">{campaign.creator_email}</div>
              <div className="text-xs text-white/50 font-mono truncate">{campaign.creator_wallet}</div>
            </div>
            {campaign.creator_address && (
              <div>
                <div className="text-sm text-white/50 mb-1">Address</div>
                <div className="text-xs text-white/70">
                  {campaign.creator_address.street && <div>{campaign.creator_address.street}</div>}
                  {(campaign.creator_address.city || campaign.creator_address.state) && (
                    <div>{campaign.creator_address.city}, {campaign.creator_address.state} {campaign.creator_address.zip}</div>
                  )}
                  {campaign.creator_address.country && <div>{campaign.creator_address.country}</div>}
                </div>
              </div>
            )}
          </div>

          {/* Story Preview */}
          {campaign.story && (
            <div>
              <div className="text-sm text-white/50 mb-1">Story</div>
              <div className="text-sm text-white/70 line-clamp-3">{campaign.story}</div>
            </div>
          )}

          {/* Verification Documents */}
          {(campaign.verification_selfie || campaign.verification_id_front || campaign.verification_documents?.length) && (
            <div>
              <div className="text-sm text-white/50 mb-2">Verification Documents</div>
              <div className="flex flex-wrap gap-2">
                {campaign.verification_selfie && (
                  <button
                    onClick={() => onViewDocument?.(campaign.verification_selfie!)}
                    className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/30"
                  >
                    📸 Selfie
                  </button>
                )}
                {campaign.verification_id_front && (
                  <button
                    onClick={() => onViewDocument?.(campaign.verification_id_front!)}
                    className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/30"
                  >
                    🪪 ID Front
                  </button>
                )}
                {campaign.verification_id_back && (
                  <button
                    onClick={() => onViewDocument?.(campaign.verification_id_back!)}
                    className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/30"
                  >
                    🪪 ID Back
                  </button>
                )}
                {campaign.verification_documents?.map((doc, i) => (
                  <button
                    key={i}
                    onClick={() => onViewDocument?.(doc.url)}
                    className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/30"
                  >
                    📄 {doc.name || doc.type || `Doc ${i + 1}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Updates Section */}
          {campaign.updates.length > 0 && (
            <div>
              <button
                onClick={() => setShowUpdates(!showUpdates)}
                className="flex items-center gap-2 text-sm text-white/70 hover:text-white"
              >
                <span className={`transition-transform ${showUpdates ? 'rotate-90' : ''}`}>▶</span>
                {campaign.updates.length} Campaign Update{campaign.updates.length !== 1 ? 's' : ''}
              </button>
              
              {showUpdates && (
                <div className="mt-2 space-y-2">
                  {campaign.updates.map((update) => (
                    <div key={update.id} className="rounded-lg bg-white/5 p-3">
                      <div className="flex items-center gap-2">
                        <UpdateStatusBadge status={update.status} />
                        <span className="text-xs text-white/50">{formatDate(update.created_at)}</span>
                      </div>
                      {update.title && <div className="text-sm font-medium text-white mt-1">{update.title}</div>}
                      {update.story_update && <div className="text-xs text-white/70 mt-1 line-clamp-2">{update.story_update}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
            {campaign.status === 'pending' && (
              <>
                <button
                  onClick={onApprove}
                  disabled={isApproving}
                  className="px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50"
                >
                  {isApproving ? 'Approving...' : '✓ Approve'}
                </button>
                <button
                  onClick={onReject}
                  className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30"
                >
                  ✕ Reject
                </button>
              </>
            )}
            
            {campaign.status === 'pending_onchain' && onVerify && (
              <button
                onClick={onVerify}
                disabled={isVerifying}
                className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
              >
                {isVerifying ? 'Verifying...' : '🔄 Verify Transaction'}
              </button>
            )}

            {/* Show Fix button when: approved without campaign_id, OR minted but missing/invalid campaign_id */}
            {(
              (campaign.status === 'approved' && !campaign.campaign_id) ||
              (campaign.status === 'minted' && !campaign.campaign_id) ||
              (campaign.status === 'pending_onchain')
            ) && onFix && (
              <button
                onClick={onFix}
                disabled={isFixing}
                className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
              >
                {isFixing ? 'Fixing...' : '🔧 Fix Campaign'}
              </button>
            )}

            <button
              onClick={onEdit}
              className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20"
            >
              ✏️ Edit
            </button>
            
            <button
              onClick={onDelete}
              className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20"
            >
              🗑️ Delete
            </button>

            {campaign.tx_hash && (
              <a
                href={getExplorerTxUrl(campaign.chain_id, campaign.tx_hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/30"
                data-testid="view-tx-link"
              >
                🔗 View TX
              </a>
            )}

            {/* Campaign Lifecycle Controls - only for minted campaigns */}
            {campaign.status === 'minted' && campaign.campaign_id && (
              <>
                {onClose && (
                  <button
                    onClick={onClose}
                    disabled={isClosing}
                    className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/30 disabled:opacity-50"
                    data-testid="close-campaign-btn"
                    title="Close campaign - stops new purchases, allows withdrawals"
                  >
                    {isClosing ? '⏳ Closing...' : '🔒 Close'}
                  </button>
                )}
                {onDeactivate && (
                  <button
                    onClick={onDeactivate}
                    disabled={isDeactivating}
                    className="px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 text-sm font-medium hover:bg-orange-500/30 disabled:opacity-50"
                    data-testid="deactivate-campaign-btn"
                    title="Deactivate campaign - hide from marketplace"
                  >
                    {isDeactivating ? '⏳ Deactivating...' : '⏸️ Deactivate'}
                  </button>
                )}
              </>
            )}

            {/* Reactivate for deactivated/closed campaigns */}
            {(campaign.status === 'deactivated' || campaign.status === 'closed') && campaign.campaign_id && onReactivate && (
              <button
                onClick={onReactivate}
                disabled={isReactivating}
                className="px-4 py-2 rounded-lg bg-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/30 disabled:opacity-50"
                data-testid="reactivate-campaign-btn"
                title="Reactivate campaign - make visible again"
              >
                {isReactivating ? '⏳ Reactivating...' : '▶️ Reactivate'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default CampaignCard
