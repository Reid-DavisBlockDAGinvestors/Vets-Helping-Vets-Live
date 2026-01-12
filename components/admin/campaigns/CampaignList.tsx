'use client'

import { CampaignCard } from './CampaignCard'
import type { Campaign } from './types'

interface CampaignListProps {
  campaigns: Campaign[]
  expandedIds: Set<string>
  onToggleExpand: (id: string) => void
  onApprove: (campaign: Campaign) => void
  onReject: (campaign: Campaign) => void
  onEdit: (campaign: Campaign) => void
  onDelete: (campaign: Campaign) => void
  onVerify?: (campaign: Campaign) => void
  onFix?: (campaign: Campaign) => void
  onToggleFeature?: (campaign: Campaign) => void
  onViewDocument?: (path: string) => void
  approvingId: string | null
  verifyingId: string | null
  fixingId: string | null
  featuringId?: string | null
}

export function CampaignList({
  campaigns,
  expandedIds,
  onToggleExpand,
  onApprove,
  onReject,
  onEdit,
  onDelete,
  onVerify,
  onFix,
  onToggleFeature,
  onViewDocument,
  approvingId,
  verifyingId,
  fixingId,
  featuringId
}: CampaignListProps) {
  if (campaigns.length === 0) {
    return (
      <div className="rounded-xl bg-white/5 border border-white/10 p-8 text-center">
        <div className="text-4xl mb-3">📭</div>
        <div className="text-white/70">No campaigns found</div>
        <div className="text-sm text-white/50 mt-1">Try adjusting your filters</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {campaigns.map((campaign) => (
        <CampaignCard
          key={campaign.id}
          campaign={campaign}
          isExpanded={expandedIds.has(campaign.id)}
          onToggle={() => onToggleExpand(campaign.id)}
          onApprove={() => onApprove(campaign)}
          onReject={() => onReject(campaign)}
          onEdit={() => onEdit(campaign)}
          onDelete={() => onDelete(campaign)}
          onVerify={onVerify ? () => onVerify(campaign) : undefined}
          onFix={onFix ? () => onFix(campaign) : undefined}
          onToggleFeature={onToggleFeature ? () => onToggleFeature(campaign) : undefined}
          onViewDocument={onViewDocument}
          isApproving={approvingId === campaign.id}
          isVerifying={verifyingId === campaign.id}
          isFixing={fixingId === campaign.id}
          isFeaturing={featuringId === campaign.id}
        />
      ))}
    </div>
  )
}

export default CampaignList
