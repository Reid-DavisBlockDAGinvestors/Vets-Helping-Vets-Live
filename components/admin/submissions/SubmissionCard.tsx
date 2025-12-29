'use client'

import type { SubmissionCardProps } from './types'

/**
 * Submission card component for list display
 */
export function SubmissionCard({
  submission,
  username,
  isSelected,
  onClick,
}: SubmissionCardProps) {
  const s = submission

  return (
    <div
      className={`rounded p-3 cursor-pointer ${isSelected ? 'bg-white/20' : 'bg-white/10'}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">
            {s.title || 'Untitled'}
            {s.status !== 'pending' && ` (${s.status})`}
          </div>
          <div className="text-xs opacity-70">
            {s.category} · {username || s.creator_email}
          </div>
          <div className="text-[11px] opacity-70 mt-0.5">
            {typeof s.goal === 'number' && s.goal > 0 && (
              <span>Goal: ${s.goal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            )}
            {typeof s.price_per_copy === 'number' && (
              <span>{typeof s.goal === 'number' && s.goal > 0 ? ' · ' : ''}Price: ${s.price_per_copy.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            )}
            {typeof s.num_copies === 'number' && s.num_copies > 0 && (
              <span>{(typeof s.goal === 'number' && s.goal > 0) || typeof s.price_per_copy === 'number' ? ' · ' : ''}Copies: {s.num_copies}</span>
            )}
          </div>
          {s.story && (
            <div className="text-[11px] opacity-60 mt-0.5 line-clamp-2">
              {s.story.length > 120 ? s.story.slice(0, 120) + '…' : s.story}
            </div>
          )}
          {(s.contract_address || s.campaign_id != null || s.token_id != null) && (
            <div className="text-[11px] opacity-70 mt-0.5">
              {s.contract_address && <span>{s.contract_address.slice(0, 6)}…{s.contract_address.slice(-4)}</span>}
              {s.contract_address && (s.campaign_id != null || s.token_id != null) && <span> · </span>}
              {s.campaign_id != null && <span>campaign #{s.campaign_id}</span>}
              {s.campaign_id == null && s.token_id != null && <span>token #{s.token_id}</span>}
              {s.visible_on_marketplace === false && <span> · hidden</span>}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="text-xs opacity-70">
            {s.created_at ? new Date(s.created_at).toLocaleString() : ''}
          </div>
          {s.tx_hash && (
            <a
              className="text-xs underline opacity-80"
              href={`${process.env.NEXT_PUBLIC_EXPLORER_BASE || ''}/tx/${s.tx_hash}`}
              target="_blank"
              onClick={e => e.stopPropagation()}
            >
              tx
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default SubmissionCard
