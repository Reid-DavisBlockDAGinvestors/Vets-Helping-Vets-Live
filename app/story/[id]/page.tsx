import Link from 'next/link'
import PurchasePanel from '@/components/PurchasePanel'
import dynamic from 'next/dynamic'
const CampaignCreator = dynamic(() => import('@/components/CampaignCreator'), { ssr: false })
import ShareButtons from '@/components/ShareButtons'

type OnchainItem = {
  tokenId: number
  owner: string
  uri: string
  metadata: any
  category: string
  goal: string
  raised: string
}

async function loadOnchainToken(id: string): Promise<OnchainItem | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/onchain/tokens?limit=1&cursor=${Number(id) + 1}`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    const items: OnchainItem[] = data?.items || []
    const found = items.find((t: any) => Number(t.tokenId) === Number(id))
    return found || null
  } catch {
    return null
  }
}

async function loadSubmissionByToken(id: string) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/submissions/by-token/${id}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json().catch(() => ({}))
    return data?.item || null
  } catch {
    return null
  }
}

export default async function StoryViewer({ params }: { params: { id: string } }) {
  const { id } = params
  const [onchain, submission] = await Promise.all([
    loadOnchainToken(id),
    loadSubmissionByToken(id)
  ])

  const meta = onchain?.metadata || {}
  const title = submission?.title || meta.name || meta.title || `Story #${id}`
  const image = submission?.image_uri || meta.image || meta.image_url || `https://picsum.photos/seed/${id}/1200/600`
  const description = submission?.story || meta.description || ''
  const goalUsd = submission?.goal ?? null
  const pricePerCopy = submission?.price_per_copy ?? null
  const numCopies = submission?.num_copies ?? null
  const benchmarks: string[] = Array.isArray(submission?.benchmarks) ? submission.benchmarks : []
  const raised = onchain ? Number(onchain.raised || 0) : 0
  const goalOnchain = onchain ? Number(onchain.goal || 0) : 0
  const pct = goalOnchain > 0 ? Math.round((raised / goalOnchain) * 100) : 0

  return (
    <div className="container py-8">
      <Link href="/marketplace" className="text-sm underline">← Back to marketplace</Link>
      <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
      <div className="mt-1 text-xs opacity-70">Story #{id}{submission?.category ? ` · ${submission.category}` : ''}</div>
      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-3">
          <img src={image} alt={title} className="w-full rounded" />
          <article className="prose prose-invert max-w-none">
            {description ? <p>{description}</p> : <p>No description provided.</p>}
          </article>
        </div>
        <aside className="space-y-3">
          <div className="rounded border border-white/10 p-4 space-y-2">
            <h3 className="font-semibold mb-1">Progress and Benchmarks</h3>
            <div className="text-xs opacity-80">
              <div>On-chain Goal: {goalOnchain ? `${goalOnchain}` : '—'} (contract units)</div>
              <div>Raised: {raised ? `${raised}` : '0'} (contract units)</div>
              <div>Progress: {pct}%</div>
              {goalUsd != null && (
                <div className="mt-1">Requested Goal (USD): ${goalUsd.toLocaleString?.() || goalUsd}</div>
              )}
              {pricePerCopy != null && (
                <div>Price per Copy (USD): ${pricePerCopy}</div>
              )}
              {numCopies != null && (
                <div>Number of Copies: {numCopies}</div>
              )}
            </div>
            {benchmarks.length > 0 && (
              <div className="mt-2">
                <div className="text-xs font-semibold mb-1">Benchmarks</div>
                <ul className="list-disc pl-4 text-xs opacity-80 space-y-1">
                  {benchmarks.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <PurchasePanel tokenId={id} />
          <CampaignCreator />
          <div className="rounded border border-white/10 p-4">
            <h3 className="font-semibold mb-2">Share</h3>
            <ShareButtons url={`https://patriotpledge.local/story/${id}`} text={`Support this cause on PatriotPledge NFTs · ${title}`} />
          </div>
        </aside>
      </div>
    </div>
  )
}
