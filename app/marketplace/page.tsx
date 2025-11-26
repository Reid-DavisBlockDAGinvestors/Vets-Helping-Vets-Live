'use client'

import { useEffect, useState, useMemo } from 'react'
import Filters, { Filters as FiltersType } from '@/components/Filters'
import NFTCard, { NFTItem } from '@/components/NFTCard'

export default function MarketplacePage() {
  const [filters, setFilters] = useState<FiltersType>({ causeType: 'all', urgency: 'all' })
  const [items, setItems] = useState<NFTItem[]>([])
  const [cursor, setCursor] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const load = async (reset = false) => {
    try {
      setLoading(true)
      setErr('')
      const qs = new URLSearchParams()
      qs.set('limit', '12')
      if (!reset && cursor != null) qs.set('cursor', String(cursor))
      const res = await fetch(`/api/marketplace/fundraisers?${qs.toString()}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) { setErr(data?.error || 'Failed to load'); return }
      const mapped: NFTItem[] = (data?.items || []).map((f: any) => {
        const goal = Number(f.goal || 0)
        const raised = Number(f.raised || 0)
        const pct = goal > 0 ? Math.round((raised / goal) * 100) : 0
        const title = f.title || `Fundraiser #${f.tokenId}`
        const image = f.image || ''
        const snippet = f.story || ''
        const cause: any = f.category || 'general'
        return {
          id: String(f.tokenId),
          title,
          image,
          causeType: (cause === 'veteran' ? 'veteran' : 'general'),
          progress: pct,
          goal,
          raised,
          snippet,
          sold: Number(f.sold || 0),
          total: Number(f.total || 0),
          remaining: Number(f.remaining || 0),
        }
      })
      setItems(reset ? mapped : [...items, ...mapped])
      if (data?.items?.length) {
        const nextCursor = typeof data.nextCursor === 'number' ? data.nextCursor : null
        setCursor(nextCursor)
      }
    } catch (e:any) {
      setErr(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(true) }, [])

  const filtered = useMemo(() => {
    return items.filter(i => (filters.causeType === 'all' || i.causeType === filters.causeType) && (!filters.q || (i.title + ' ' + i.snippet).toLowerCase().includes(filters.q.toLowerCase())))
  }, [items, filters])

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-semibold">Marketplace</h1>
      <div className="mt-4">
        <Filters value={filters} onChange={setFilters} />
      </div>
      {err && <div className="mt-3 text-xs opacity-80">{err}</div>}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(i => <NFTCard key={i.id} item={i} />)}
      </div>
      <div className="mt-6">
        <button className="rounded bg-white/10 px-3 py-2 text-sm" disabled={loading} onClick={()=>load(false)}>{loading ? 'Loading...' : 'Load more'}</button>
      </div>
    </div>
  )
}
