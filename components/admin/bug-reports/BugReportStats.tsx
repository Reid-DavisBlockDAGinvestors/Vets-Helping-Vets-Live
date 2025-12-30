'use client'

/**
 * BugReportStats Component
 * 
 * Displays bug report statistics grid
 * Following ISP - focused on stats display only
 */

import type { BugReportStats as Stats } from './types'

export interface BugReportStatsProps {
  stats: Stats
}

export function BugReportStats({ stats }: BugReportStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="bug-report-stats">
      <div className="bg-white/5 rounded-lg p-4" data-testid="stat-total">
        <div className="text-2xl font-bold text-white">{stats.total}</div>
        <div className="text-sm text-white/60">Total Reports</div>
      </div>
      <div className="bg-blue-500/10 rounded-lg p-4" data-testid="stat-new">
        <div className="text-2xl font-bold text-blue-400">{stats.new}</div>
        <div className="text-sm text-white/60">New</div>
      </div>
      <div className="bg-purple-500/10 rounded-lg p-4" data-testid="stat-in-progress">
        <div className="text-2xl font-bold text-purple-400">{stats.inProgress}</div>
        <div className="text-sm text-white/60">In Progress</div>
      </div>
      <div className="bg-green-500/10 rounded-lg p-4" data-testid="stat-resolved">
        <div className="text-2xl font-bold text-green-400">{stats.resolved}</div>
        <div className="text-sm text-white/60">Resolved</div>
      </div>
    </div>
  )
}
