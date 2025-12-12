'use client'

export type FilterValues = {
  q?: string
  causeType?: 'veteran' | 'general' | 'all'
  urgency?: 'low' | 'medium' | 'high' | 'all'
  location?: string
}

export default function Filters({ value, onChange }: { value: FilterValues, onChange: (f: FilterValues) => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-patriotic-navy/40 p-3 md:flex-row md:items-end">
      <div className="flex-1">
        <label className="text-xs opacity-70">Search</label>
        <input className="w-full rounded bg-white/10 p-2" placeholder="Search stories or NFTs" value={value.q ?? ''} onChange={e => onChange({ ...value, q: e.target.value })} />
      </div>
      <div>
        <label className="text-xs opacity-70">Cause</label>
        <select className="w-full rounded bg-white/10 p-2" value={value.causeType ?? 'all'} onChange={e => onChange({ ...value, causeType: e.target.value as any })}>
          <option value="all">All</option>
          <option value="veteran">Veteran</option>
          <option value="general">General</option>
        </select>
      </div>
      <div>
        <label className="text-xs opacity-70">Urgency</label>
        <select className="w-full rounded bg-white/10 p-2" value={value.urgency ?? 'all'} onChange={e => onChange({ ...value, urgency: e.target.value as any })}>
          <option value="all">All</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <div>
        <label className="text-xs opacity-70">Location</label>
        <input className="w-full rounded bg-white/10 p-2" placeholder="City, Country" value={value.location ?? ''} onChange={e => onChange({ ...value, location: e.target.value })} />
      </div>
    </div>
  )
}
