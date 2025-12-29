'use client'

import type { CampaignStatsGridProps } from './types'

/**
 * Campaign statistics grid component
 * Displays key metrics for admin overview
 */
export function CampaignStatsGrid({ stats }: CampaignStatsGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <div className="text-2xl font-bold text-white">{stats.total}</div>
        <div className="text-xs text-white/50">Total Campaigns</div>
      </div>
      <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4">
        <div className="text-2xl font-bold text-green-400">{stats.minted}</div>
        <div className="text-xs text-green-400/70">Minted</div>
      </div>
      <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-4">
        <div className="text-2xl font-bold text-yellow-400">{stats.pendingCampaigns}</div>
        <div className="text-xs text-yellow-400/70">Pending Review</div>
      </div>
      <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-4">
        <div className="text-2xl font-bold text-purple-400">{stats.withUpdates}</div>
        <div className="text-xs text-purple-400/70">With Updates</div>
      </div>
      <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-4">
        <div className="text-2xl font-bold text-orange-400">{stats.pendingUpdates}</div>
        <div className="text-xs text-orange-400/70">Pending Updates</div>
      </div>
      <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4">
        <div className="text-2xl font-bold text-blue-400">{stats.totalUpdates}</div>
        <div className="text-xs text-blue-400/70">Total Updates</div>
      </div>
    </div>
  )
}

export default CampaignStatsGrid
