'use client'

import type { CampaignFiltersProps, StatusFilter, SortOption } from './types'

/**
 * Campaign filters component
 * Search, status filter, sort, and has-updates toggle
 */
export function CampaignFilters({ 
  filters, 
  onFiltersChange, 
  resultCount, 
  totalCount 
}: CampaignFiltersProps) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
      <div className="flex flex-wrap gap-4">
        {/* Search */}
        <div className="flex-1 min-w-[250px]">
          <div className="relative">
            <svg 
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
              />
            </svg>
            <input
              type="text"
              placeholder="Search by title, wallet, email, ID..."
              value={filters.searchQuery}
              onChange={(e) => onFiltersChange({ searchQuery: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
            />
            {filters.searchQuery && (
              <button
                onClick={() => onFiltersChange({ searchQuery: '' })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Status Filter */}
        <select
          value={filters.statusFilter}
          onChange={(e) => onFiltersChange({ statusFilter: e.target.value as StatusFilter })}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="minted">Minted</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>

        {/* Sort */}
        <select
          value={filters.sortBy}
          onChange={(e) => onFiltersChange({ sortBy: e.target.value as SortOption })}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
        >
          <option value="recent">Most Recent</option>
          <option value="updates">Most Updates</option>
          <option value="pending">Pending Updates</option>
          <option value="goal">Highest Goal</option>
        </select>

        {/* Has Updates Toggle */}
        <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.hasUpdatesOnly}
            onChange={(e) => onFiltersChange({ hasUpdatesOnly: e.target.checked })}
            className="rounded border-white/20"
          />
          With updates only
        </label>
      </div>

      {/* Results count */}
      <div className="mt-3 text-sm text-white/50">
        Showing {resultCount} of {totalCount} campaigns
        {filters.searchQuery && ` matching "${filters.searchQuery}"`}
      </div>
    </div>
  )
}

export default CampaignFilters
