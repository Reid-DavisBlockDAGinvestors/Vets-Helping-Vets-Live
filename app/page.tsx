import Link from 'next/link'
import NFTCard, { NFTItem } from '@/components/NFTCard'

async function loadOnchain(limit = 12): Promise<NFTItem[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/onchain/tokens?limit=${limit}`, { cache: 'no-store' })
    const data = await res.json()
    const mapped: NFTItem[] = (data?.items || []).map((t: any) => {
      const meta = t.metadata || {}
      const goal = Number(t.goal || meta.goal || 0)
      const raised = Number(t.raised || meta.raised || 0)
      const pct = goal > 0 ? Math.round((raised / goal) * 100) : 0
      const title = meta.name || meta.title || `Token #${t.tokenId}`
      const image = meta.image || meta.image_url || ''
      const snippet = meta.description || ''
      const cause: any = (t.category || meta.category || 'general')
      return { id: String(t.tokenId), title, image, causeType: (cause === 'veteran' ? 'veteran' : 'general'), progress: pct, goal, raised, snippet }
    })
    return mapped
  } catch {
    return []
  }
}

export default async function HomePage() {
  const all = await loadOnchain(24)
  const highlights = all.slice(0, 6)
  const successStories = all.filter(i => i.goal > 0 && i.raised >= i.goal).slice(0, 6)
  return (
    <div>
      <section className="container py-12">
        <h1 className="text-3xl font-bold">Empowering Donors & Creators with Transparent, Dynamic NFTs</h1>
        <p className="mt-3 max-w-3xl text-white/80">PatriotPledge NFTs is the most advanced fundraising platform in history. Direct support, transparency, and dynamic NFTs unlock trust and global impact for veterans, families, and all causes.</p>
        <div className="mt-6 flex gap-3">
          <Link href="/submit" className="rounded bg-patriotic-red px-4 py-2">Submit Story</Link>
          <Link href="/marketplace" className="rounded bg-white/10 px-4 py-2">Browse Marketplace</Link>
        </div>
      </section>
      <section className="container py-8">
        <h2 className="text-2xl font-semibold">Watch the Demo</h2>
        <div className="mt-4 aspect-video w-full overflow-hidden rounded bg-black/50" data-testid="demo-video">
          {/* Replace src with real video or embed */}
          <div className="flex h-full w-full items-center justify-center text-white/70">Demo video coming soon</div>
        </div>
      </section>
      <section className="container py-8">
        <h2 className="text-2xl font-semibold">Story Highlights</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {highlights.map(h => (<NFTCard key={h.id} item={h} />))}
        </div>
      </section>
      <section className="container py-8">
        <h2 className="text-2xl font-semibold">Success Stories</h2>
        <div className="mt-4 flex gap-4 overflow-x-auto pb-2" data-testid="success-carousel">
          {successStories.map(s => (
            <div key={s.id} className="min-w-[320px] max-w-[360px] flex-shrink-0">
              <NFTCard item={s} />
            </div>
          ))}
        </div>
      </section>
      <section className="container py-12">
        <h2 className="text-2xl font-semibold">Mass Appeal & Target Groups</h2>
        <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 text-white/80">
          <li className="rounded bg-white/5 p-3">Tax seekers · Corporates · Patriots</li>
          <li className="rounded bg-white/5 p-3">War‑torn diaspora · Individuals · Political supporters</li>
          <li className="rounded bg-white/5 p-3">Transparency · Personalization · Gamification via NFTs</li>
        </ul>
      </section>
    </div>
  )
}
