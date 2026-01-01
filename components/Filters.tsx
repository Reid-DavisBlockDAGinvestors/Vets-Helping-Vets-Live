'use client'

import { CATEGORIES, type CategoryId } from '@/lib/categories'

export type FilterValues = {
  q?: string
  causeType?: CategoryId | 'all'
  urgency?: 'low' | 'medium' | 'high' | 'all'
  location?: string
}

export default function Filters({ value, onChange }: { value: FilterValues, onChange: (f: FilterValues) => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-patriotic-navy/40 p-3 md:flex-row md:items-end">
      <div className="flex-1">
        <label className="text-xs opacity-70">Search</label>
        <input 
          className="w-full rounded bg-white/10 p-2 text-white placeholder:text-white/50" 
          placeholder="Search stories or NFTs" 
          value={value.q ?? ''} 
          onChange={e => onChange({ ...value, q: e.target.value })}
          data-testid="filter-search"
        />
      </div>
      <div>
        <label className="text-xs opacity-70">Cause</label>
        <select 
          className="w-full rounded bg-white/10 p-2 text-white" 
          value={value.causeType ?? 'all'} 
          onChange={e => onChange({ ...value, causeType: e.target.value as any })}
          data-testid="filter-cause"
        >
          <option value="all" className="bg-gray-800">All Causes</option>
          {CATEGORIES.map(cat => (
            <option key={cat.id} value={cat.id} className="bg-gray-800">
              {cat.emoji} {cat.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs opacity-70">Urgency</label>
        <select 
          className="w-full rounded bg-white/10 p-2 text-white" 
          value={value.urgency ?? 'all'} 
          onChange={e => onChange({ ...value, urgency: e.target.value as any })}
          data-testid="filter-urgency"
        >
          <option value="all" className="bg-gray-800">All</option>
          <option value="high" className="bg-gray-800">🔴 High</option>
          <option value="medium" className="bg-gray-800">🟡 Medium</option>
          <option value="low" className="bg-gray-800">🟢 Low</option>
        </select>
      </div>
      <div>
        <label className="text-xs opacity-70">Location</label>
        <input 
          className="w-full rounded bg-white/10 p-2 text-white placeholder:text-white/50" 
          placeholder="City, Country" 
          value={value.location ?? ''} 
          onChange={e => onChange({ ...value, location: e.target.value })}
          data-testid="filter-location"
        />
      </div>
    </div>
  )
}
