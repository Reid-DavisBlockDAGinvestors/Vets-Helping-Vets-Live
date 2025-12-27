'use client'

import { useEffect, useState, useMemo } from 'react'
import Filters, { FilterValues } from '@/components/Filters'
import NFTCard, { NFTItem } from '@/components/NFTCard'
import { NFTGridSkeleton } from '@/components/Skeleton'
import { mapLegacyCategory } from '@/lib/categories'

export default function MarketplacePage() {
  const [filters, setFilters] = useState<FilterValues>({ causeType: 'all', urgency: 'all' })
  const [items, setItems] = useState<NFTItem[]>([])
  const [cursor, setCursor] = useState<number | null>(0)
  const [hasMore, setHasMore] = useState(true)
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
        const sold = Number(f.editionsMinted || 0)
        const total = Number(f.maxEditions || 0)
        // Use API-calculated progress (edition-based for V5)
        const pct = Number(f.progress || 0)
        const title = f.title || `Fundraiser #${f.campaignId}`
        const image = f.image || ''
        const snippet = f.story || ''
        const cause: any = f.category || 'general'
        return {
          id: f.id || String(f.campaignId), // Use submission UUID, fallback to campaignId
          campaignId: Number(f.campaignId), // V5: campaign ID for linking
          slug: f.slug || null,
          short_code: f.short_code || null,
          title,
          image,
          causeType: mapLegacyCategory(cause),
          progress: pct,
          goal,
          raised,
          nftSalesUSD: Number(f.nftSalesUSD || 0),
          tipsUSD: Number(f.tipsUSD || 0),
          snippet,
          sold,
          total,
          remaining: f.remaining != null ? Number(f.remaining) : null,
          // Living NFT update info
          updateCount: f.updateCount || 0,
          lastUpdated: f.lastUpdated || null,
          hasRecentUpdate: f.hasRecentUpdate || false,
          // Multi-contract support
          contractAddress: f.contract_address || null,
        }
      })
      // De-duplicate by id when appending
      const newItems = reset ? mapped : [...items, ...mapped]
      const seen = new Set<string>()
      const deduplicated = newItems.filter((item) => {
        if (seen.has(item.id)) return false
        seen.add(item.id)
        return true
      })
      setItems(deduplicated)
      const nextCursor = typeof data.nextCursor === 'number' ? data.nextCursor : null
      setCursor(nextCursor)
      setHasMore(nextCursor !== null)
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
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 via-purple-900/20 to-transparent" />
        <div className="container py-16 relative">
          <h1 className="text-4xl md:text-5xl font-bold text-white">
            Support a Cause
          </h1>
          <p className="mt-4 text-lg text-white/70 max-w-2xl">
            Browse verified fundraisers and make a difference. Every donation is transparent and tracked on-chain.
          </p>
        </div>
      </div>

      <div className="container pb-16 -mt-4">
        {/* Filters */}
        <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-4 mb-8">
          <Filters value={filters} onChange={setFilters} />
        </div>

        {/* Error State */}
        {err && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 mb-6 text-red-400">
            {err}
          </div>
        )}

        {/* Loading State - Modern Skeleton */}
        {loading && items.length === 0 && (
          <NFTGridSkeleton count={6} />
        )}

        {/* Empty State */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4 opacity-30">🔍</div>
            <h3 className="text-xl font-semibold text-white/70">No fundraisers found</h3>
            <p className="mt-2 text-white/50">Try adjusting your filters or check back later.</p>
            <button 
              onClick={() => load(true)} 
              className="mt-4 px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(i => <NFTCard key={i.id} item={i} />)}
        </div>

        {/* Load More */}
        {filtered.length > 0 && hasMore && (
          <div className="mt-10 text-center">
            <button 
              className="rounded-full bg-white/10 hover:bg-white/20 border border-white/10 px-8 py-3 font-medium text-white transition-all disabled:opacity-50" 
              disabled={loading || !hasMore} 
              onClick={() => load(false)}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Loading...
                </span>
              ) : 'Load More Fundraisers'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
