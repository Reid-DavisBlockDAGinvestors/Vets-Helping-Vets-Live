import Link from 'next/link'
import PurchasePanel from '@/components/PurchasePanel'
import ShareButtons from '@/components/ShareButtons'
import { ipfsToHttp } from '@/lib/ipfs'

type OnchainItem = {
  tokenId: number
  campaignId?: number
  owner?: string
  uri: string
  metadata: any
  category: string
  goal: string
  raised: string
  // V5 edition fields
  editionsMinted?: number
  maxEditions?: number
  pricePerEdition?: string
  active?: boolean
  closed?: boolean
}

// For server-side fetches, use the correct base URL
function getBaseUrl() {
  // Check for various production environment URLs
  if (process.env.URL) return process.env.URL // Netlify
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}` // Vercel
  if (process.env.NEXT_PUBLIC_BASE_URL && !process.env.NEXT_PUBLIC_BASE_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_BASE_URL
  }
  // In development, use localhost
  return 'http://localhost:3000'
}

async function loadOnchainToken(id: string): Promise<OnchainItem | null> {
  try {
    const baseUrl = getBaseUrl()
    const res = await fetch(`${baseUrl}/api/onchain/token/${id}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json().catch(() => ({}))
    return data || null
  } catch {
    return null
  }
}

async function loadSubmissionByToken(id: string) {
  try {
    const baseUrl = getBaseUrl()
    const res = await fetch(`${baseUrl}/api/submissions/by-token/${id}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json().catch(() => ({}))
    return data?.item || null
  } catch {
    return null
  }
}

type CampaignUpdate = {
  id: string
  title: string | null
  story_update: string | null
  funds_utilization: string | null
  benefits: string | null
  still_needed: string | null
  media_uris: string[] | null
  created_at: string
  status: string
}

async function loadCampaignUpdates(submissionId: string): Promise<CampaignUpdate[]> {
  try {
    const baseUrl = getBaseUrl()
    const res = await fetch(`${baseUrl}/api/campaign-updates?submission_id=${submissionId}&status=approved`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json().catch(() => ({}))
    return data?.updates || []
  } catch {
    return []
  }
}

export default async function StoryViewer({ params }: { params: { id: string } }) {
  const { id } = params
  const [onchain, submission] = await Promise.all([
    loadOnchainToken(id),
    loadSubmissionByToken(id)
  ])
  
  // Load campaign updates if we have a submission ID
  const campaignUpdates = submission?.id 
    ? await loadCampaignUpdates(submission.id) 
    : []
  
  // Collect all media from updates
  const allUpdateMedia: { uri: string; updateTitle: string; date: string }[] = []
  for (const update of campaignUpdates) {
    if (update.media_uris && Array.isArray(update.media_uris)) {
      for (const uri of update.media_uris) {
        allUpdateMedia.push({
          uri,
          updateTitle: update.title || 'Update',
          date: new Date(update.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        })
      }
    }
  }

  const meta = onchain?.metadata || {}
  const title = submission?.title || meta.name || meta.title || `Fundraiser #${id}`
  // Try multiple sources for image
  const image = submission?.image_uri || meta.image || meta.image_url || meta.image_uri || ''
  // Try multiple sources for description  
  const description = submission?.story || meta.description || meta.story || ''
  
  const category = submission?.category || onchain?.category || 'general'
  const goalUsd = submission?.goal ? Number(submission.goal) : null
  const benchmarks: string[] = Array.isArray(submission?.benchmarks) ? submission.benchmarks : []
  
  // V5 Edition NFT pricing info
  // Price per NFT = Goal ÷ Number of NFTs in the series
  const maxEditions = submission?.nft_editions 
    ? Number(submission.nft_editions)
    : (submission?.num_copies 
      ? Number(submission.num_copies) 
      : (onchain?.maxEditions ? Number(onchain.maxEditions) : 0))
  
  const editionsMinted = onchain?.editionsMinted ? Number(onchain.editionsMinted) : 0
  const goal = goalUsd ?? (onchain ? Number(onchain.goal || 0) : 0)
  
  // Calculate price: check nft_price first (admin set in USD), then price_per_copy, then calculate from goal/copies, then on-chain price
  let pricePerCopy: number | null = null
  if (submission?.nft_price && Number(submission.nft_price) > 0) {
    // Admin explicitly set the price in USD
    pricePerCopy = Number(submission.nft_price)
  } else if (submission?.price_per_copy && Number(submission.price_per_copy) > 0) {
    pricePerCopy = Number(submission.price_per_copy)
  } else if (goal > 0 && maxEditions > 0) {
    pricePerCopy = goal / maxEditions
  } else if (onchain?.pricePerEdition && Number(onchain.pricePerEdition) > 0) {
    // Fallback to on-chain price (already in USD from API)
    pricePerCopy = Number(onchain.pricePerEdition)
  } else if (goal > 0) {
    // Last fallback: assume 100 editions if no other data (common default)
    // This ensures campaigns with a goal always show NFT purchase UI
    pricePerCopy = goal / 100
  }
  
  // Get raised amount from on-chain
  const raised = onchain ? Number(onchain.raised || 0) : 0
  
  // Calculate progress percentage based on editions sold (most accurate for V5 model)
  const pct = maxEditions > 0 
    ? Math.min(100, Math.round((editionsMinted / maxEditions) * 100))
    : (goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0)
  
  console.log('[StoryPage] NFT Pricing Debug:', {
    submissionNftPrice: submission?.nft_price,
    submissionPricePerCopy: submission?.price_per_copy,
    submissionNftEditions: submission?.nft_editions,
    submissionNumCopies: submission?.num_copies,
    calculatedPricePerCopy: pricePerCopy,
    calculatedMaxEditions: maxEditions,
    goal
  })
  
  // 0 maxEditions = unlimited
  const remainingCopies = maxEditions > 0 ? Math.max(0, maxEditions - editionsMinted) : null

  // Truncate description for preview
  const maxPreviewLength = 500
  const hasLongDescription = description.length > maxPreviewLength
  const previewDescription = hasLongDescription 
    ? description.slice(0, maxPreviewLength).trimEnd() + '...'
    : description

  return (
    <div className="min-h-screen pb-12">
      {/* Header Bar */}
      <div className="container py-4">
        <div className="flex items-center justify-between">
          <Link 
            href="/marketplace" 
            className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Marketplace
          </Link>
          <span className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            category === 'veteran' 
              ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
          }`}>
            {category === 'veteran' ? '🎖️ Veteran Cause' : '💝 General Cause'}
          </span>
        </div>
      </div>

      <div className="container">
        {/* Top Section: Image + Donation Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
          {/* Large Image */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
              {image ? (
                <img 
                  src={ipfsToHttp(image)} 
                  alt={title} 
                  className="w-full h-auto max-h-[500px] object-contain bg-black/20"
                />
              ) : (
                <div className="h-64 bg-gradient-to-br from-blue-900/50 to-purple-900/50 flex items-center justify-center">
                  <span className="text-6xl opacity-30">🎖️</span>
                </div>
              )}
            </div>
          </div>

          {/* Donation Panel - Right Side */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-5">
              {/* NFT Pricing Info */}
              {pricePerCopy && (
                <div className="mb-4 pb-4 border-b border-white/10">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-white">${pricePerCopy}</span>
                    <span className="text-white/50 text-sm">per NFT</span>
                  </div>
                  {remainingCopies !== null && (
                    <p className="text-sm text-white/60 mt-1">
                      {remainingCopies > 0 ? (
                        <>{remainingCopies.toLocaleString()} of {maxEditions.toLocaleString()} remaining</>
                      ) : (
                        <span className="text-red-400">Sold out!</span>
                      )}
                    </p>
                  )}
                </div>
              )}
              <h2 className="text-lg font-semibold text-white mb-3">
                {pricePerCopy ? 'Purchase NFT' : 'Make a Donation'}
              </h2>
              <PurchasePanel campaignId={id} tokenId={id} pricePerNft={pricePerCopy} remainingCopies={remainingCopies} />
            </div>
          </div>
        </div>

        {/* Title + Progress Section */}
        <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-white">{title}</h1>
              <div className="mt-1 flex items-center gap-3 flex-wrap">
                <p className="text-white/50 text-sm">Campaign #{id} on BlockDAG</p>
                <a 
                  href={`https://awakening.bdagscan.com/address/${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 transition-colors border border-emerald-500/30"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View on Chain
                </a>
              </div>
            </div>
            <div className="md:text-right">
              <div className="text-2xl font-bold text-white">${raised.toLocaleString()}</div>
              <div className="text-sm text-white/50">
                {goalUsd ? `raised of $${Number(goalUsd).toLocaleString()} goal` : 'raised'}
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-2 text-sm text-white/60">{pct}% complete</div>
          </div>
        </div>

        {/* Story + Benchmarks + Share in Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Story - Takes 2 columns */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">About This Fundraiser</h2>
              {description ? (
                <div className="prose prose-invert max-w-none">
                  <p className="text-white/80 leading-relaxed whitespace-pre-wrap text-sm">{previewDescription}</p>
                  {hasLongDescription && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-blue-400 hover:text-blue-300 text-sm font-medium">
                        Read full story...
                      </summary>
                      <p className="mt-4 text-white/80 leading-relaxed whitespace-pre-wrap text-sm">
                        {description}
                      </p>
                    </details>
                  )}
                </div>
              ) : (
                <p className="text-white/50 italic">No story provided yet.</p>
              )}
            </div>
          </div>

          {/* Right Column: Benchmarks + Share */}
          <div className="space-y-6">
            {/* Benchmarks */}
            {benchmarks.length > 0 && (
              <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-5">
                <h3 className="text-lg font-semibold text-white mb-3">Milestones</h3>
                <div className="space-y-2">
                  {benchmarks.map((b, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-semibold">
                        {i + 1}
                      </div>
                      <span className="text-white/80 text-sm">{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Share */}
            <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-5">
              <h3 className="text-lg font-semibold text-white mb-3">Share</h3>
              <ShareButtons 
                url={`https://patriotpledge.nft/story/${id}`} 
                text={`Support "${title}" on PatriotPledge NFTs`} 
              />
            </div>

            {/* Blockchain Verification */}
            <div className="rounded-2xl bg-gradient-to-br from-emerald-900/20 to-teal-900/20 border border-emerald-500/20 p-5">
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <span>⛓️</span> On-Chain Verified
              </h3>
              <p className="text-sm text-white/60 mb-4">
                This campaign is recorded on the BlockDAG blockchain for full transparency.
              </p>
              <a 
                href={`https://awakening.bdagscan.com/address/${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View Contract on Explorer
              </a>
              <p className="text-xs text-white/40 mt-2 text-center">
                Campaign ID: {id}
              </p>
            </div>
          </div>
        </div>

        {/* Living NFT Updates Section */}
        {campaignUpdates.length > 0 && (
          <div className="mt-8">
            <div className="rounded-2xl bg-gradient-to-br from-blue-900/20 to-purple-900/20 backdrop-blur-xl border border-white/10 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <span className="text-xl">📢</span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Living NFT Updates</h2>
                  <p className="text-sm text-white/50">{campaignUpdates.length} update{campaignUpdates.length !== 1 ? 's' : ''} from the fundraiser</p>
                </div>
              </div>

              {/* Media Gallery */}
              {allUpdateMedia.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-white/70 mb-3">📸 Update Photos & Media</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {allUpdateMedia.map((media, idx) => {
                      const httpUrl = ipfsToHttp(media.uri)
                      const isVideo = httpUrl.match(/\.(mp4|webm|mov)$/i)
                      const isAudio = httpUrl.match(/\.(mp3|wav|ogg|m4a|aac)$/i)
                      
                      return (
                        <a
                          key={idx}
                          href={httpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group block rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/30 transition-all hover:scale-[1.02]"
                        >
                          {isVideo ? (
                            <div className="h-32 flex items-center justify-center bg-gradient-to-br from-blue-900/30 to-purple-900/30">
                              <svg className="w-10 h-10 text-white/40 group-hover:text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                          ) : isAudio ? (
                            <div className="h-32 flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-pink-900/30">
                              <svg className="w-10 h-10 text-white/40 group-hover:text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                              </svg>
                            </div>
                          ) : (
                            <img
                              src={httpUrl}
                              alt={`Update: ${media.updateTitle}`}
                              className="h-32 w-full object-cover"
                            />
                          )}
                          <div className="p-2 text-xs text-white/50 text-center">
                            {media.date}
                          </div>
                        </a>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Updates Timeline */}
              <div className="space-y-4">
                {campaignUpdates.map((update, idx) => (
                  <div key={update.id} className="rounded-xl bg-white/5 border border-white/10 p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-400 flex items-center justify-center text-white font-bold text-sm">
                        {campaignUpdates.length - idx}
                      </div>
                      <div>
                        <h4 className="font-medium text-white">
                          {update.title || `Update #${campaignUpdates.length - idx}`}
                        </h4>
                        <p className="text-xs text-white/40">
                          {new Date(update.created_at).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-3 text-sm">
                      {update.story_update && (
                        <div>
                          <span className="text-blue-400 font-medium">Current Situation: </span>
                          <span className="text-white/80">{update.story_update}</span>
                        </div>
                      )}
                      {update.funds_utilization && (
                        <div>
                          <span className="text-green-400 font-medium">Funds Used: </span>
                          <span className="text-white/80">{update.funds_utilization}</span>
                        </div>
                      )}
                      {update.benefits && (
                        <div>
                          <span className="text-purple-400 font-medium">Impact: </span>
                          <span className="text-white/80">{update.benefits}</span>
                        </div>
                      )}
                      {update.still_needed && (
                        <div>
                          <span className="text-yellow-400 font-medium">Still Needed: </span>
                          <span className="text-white/80">{update.still_needed}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
