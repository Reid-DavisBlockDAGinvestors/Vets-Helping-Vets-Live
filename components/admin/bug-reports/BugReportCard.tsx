'use client'

/**
 * BugReportCard Component
 * 
 * Displays a single bug report in a card format
 * Following ISP - focused on card display only
 */

import type { BugReport } from './types'
import { getStatusBadge, getPriorityColor, formatDate } from './types'

export interface BugReportCardProps {
  report: BugReport
  onSelect: (report: BugReport) => void
}

export function BugReportCard({ report, onSelect }: BugReportCardProps) {
  const statusBadge = getStatusBadge(report.status)
  
  return (
    <div
      className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors cursor-pointer"
      data-testid={`bug-report-${report.id}`}
      onClick={() => onSelect(report)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
            <span className={`text-xs ${getPriorityColor(report.priority)}`}>
              {report.priority.toUpperCase()}
            </span>
            <span className="text-xs text-white/40">{report.category}</span>
          </div>
          <h3 className="font-medium text-white truncate">{report.title}</h3>
          <p className="text-sm text-white/60 line-clamp-2 mt-1">{report.description}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
            <span>{formatDate(report.created_at)}</span>
            {report.user_email && <span>{report.user_email}</span>}
            {report.screenshots?.length > 0 && (
              <span className="flex items-center gap-1">
                📷 {report.screenshots.length}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
