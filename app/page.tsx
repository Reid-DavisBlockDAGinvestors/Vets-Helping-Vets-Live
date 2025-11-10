import Link from 'next/link'
import NFTCard, { NFTItem } from '@/components/NFTCard'

const highlights: NFTItem[] = [
  { id: '1', title: 'Support a Veteran Family', image: 'https://picsum.photos/seed/vet/800/450', causeType: 'veteran', progress: 60, goal: 10000, raised: 6000, snippet: 'Combat loss recovery and mental health assistance.' },
  { id: '2', title: 'Disaster Relief', image: 'https://picsum.photos/seed/disaster/800/450', causeType: 'general', progress: 20, goal: 20000, raised: 4000, snippet: 'Rapid response fund for natural disasters.' }
]

const successStories: NFTItem[] = [
  { id: '3', title: 'PTSD Therapy Funded', image: 'https://picsum.photos/seed/ptsd/800/450', causeType: 'veteran', progress: 100, goal: 5000, raised: 5000, snippet: 'Therapy for 12 months fully covered.' },
  { id: '4', title: 'Hurricane Relief Delivered', image: 'https://picsum.photos/seed/hurricane/800/450', causeType: 'general', progress: 100, goal: 15000, raised: 15000, snippet: 'Food, water, and shelter provided to 300 families.' },
  { id: '5', title: 'Service Dog Trained', image: 'https://picsum.photos/seed/dog/800/450', causeType: 'veteran', progress: 100, goal: 8000, raised: 8000, snippet: 'Vet matched with trained service companion.' },
]

export default function HomePage() {
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
