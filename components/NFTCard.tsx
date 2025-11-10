import Link from 'next/link'

export type NFTItem = {
  id: string
  title: string
  image: string
  causeType: 'veteran' | 'general'
  location?: string
  urgency?: 'low' | 'medium' | 'high'
  progress: number
  goal: number
  raised: number
  snippet: string
}

export default function NFTCard({ item }: { item: NFTItem }) {
  const pct = Math.min(100, Math.round((item.raised / Math.max(1, item.goal)) * 100))
  return (
    <div className="rounded-lg border border-white/10 bg-patriotic-navy/40 overflow-hidden">
      <img src={item.image} alt={item.title} className="h-48 w-full object-cover" />
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{item.title}</h3>
          <span className="text-xs uppercase tracking-wide opacity-70">{item.causeType}</span>
        </div>
        <p className="mt-2 text-sm opacity-80">{item.snippet}</p>
        <div className="mt-3">
          <div className="h-2 w-full rounded bg-white/10">
            <div className="h-2 rounded bg-patriotic-red" style={{ width: pct + '%' }} />
          </div>
          <p className="mt-1 text-xs opacity-80">${'{'}item.raised.toLocaleString(){'}'} / ${'{'}item.goal.toLocaleString(){'}'}</p>
        </div>
        <Link href={`/story/${item.id}`} className="mt-3 inline-block text-sm underline">View Story</Link>
      </div>
    </div>
  )
}
