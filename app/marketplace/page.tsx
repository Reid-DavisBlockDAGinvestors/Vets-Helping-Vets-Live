'use client'

import { useEffect, useState } from 'react'
import Filters, { Filters as FiltersType } from '@/components/Filters'
import NFTCard, { NFTItem } from '@/components/NFTCard'

const MOCK: NFTItem[] = [
  { id: '1', title: 'Support a Veteran Family', image: 'https://picsum.photos/seed/vet2/800/450', causeType: 'veteran', progress: 60, goal: 10000, raised: 6000, snippet: 'Combat loss recovery and mental health assistance.' },
  { id: '2', title: 'Children Education', image: 'https://picsum.photos/seed/child/800/450', causeType: 'general', progress: 30, goal: 15000, raised: 4500, snippet: 'Scholarship fund for disaster-affected kids.' }
]

export default function MarketplacePage() {
  const [filters, setFilters] = useState<FiltersType>({ causeType: 'all', urgency: 'all' })
  const [recommended, setRecommended] = useState<NFTItem[]>([])
  const items = MOCK.filter(i => filters.causeType === 'all' || i.causeType === filters.causeType)

  useEffect(() => {
    const run = async () => {
      try {
        const prefs: any = { causeType: filters.causeType || 'all', keywords: (filters.q || '').split(/\s+/).filter(Boolean) }
        const res = await fetch('/api/recommendations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ history: [], items: MOCK, prefs }) })
        const data = await res.json()
        if (data?.items) setRecommended(data.items)
      } catch {}
    }
    run()
  }, [filters])
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-semibold">Marketplace</h1>
      <div className="mt-4">
        <Filters value={filters} onChange={setFilters} />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map(i => <NFTCard key={i.id} item={i} />)}
      </div>
      {recommended.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold">Recommended for you</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recommended.map(i => <NFTCard key={'rec-'+i.id} item={i} />)}
          </div>
        </div>
      )}
    </div>
  )
}
