import Link from 'next/link'
import PurchasePanel from '@/components/PurchasePanel'
import ShareButtons from '@/components/ShareButtons'

export default function StoryViewer({ params }: { params: { id: string } }) {
  const { id } = params
  return (
    <div className="container py-8">
      <Link href="/marketplace" className="text-sm underline">← Back to marketplace</Link>
      <h1 className="mt-3 text-2xl font-semibold">Story #{id}</h1>
      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-3">
          <img src={`https://picsum.photos/seed/${id}/1200/600`} alt="story" className="w-full rounded" />
          <article className="prose prose-invert max-w-none">
            <p>Full story content goes here. Detailed, readable, and empathetic narrative with images/videos.</p>
          </article>
        </div>
        <aside className="space-y-3">
          <div className="rounded border border-white/10 p-4">Progress and Milestones</div>
          <PurchasePanel tokenId={id} />
          <div className="rounded border border-white/10 p-4">
            <h3 className="font-semibold mb-2">Share</h3>
            <ShareButtons url={`https://patriotpledge.local/story/${id}`} text={`Support this cause on PatriotPledge NFTs · Story #${id}`} />
          </div>
        </aside>
      </div>
    </div>
  )
}
