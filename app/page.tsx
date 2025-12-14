import Link from 'next/link'
import { ethers } from 'ethers'
import NFTCard, { NFTItem } from '@/components/NFTCard'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Force dynamic rendering - don't cache this page
export const dynamic = 'force-dynamic'
export const revalidate = 0

const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || process.env.NEXT_PUBLIC_BDAG_USD_RATE || '0.05')

async function loadOnchain(limit = 12): Promise<NFTItem[]> {
  try {
    // First, get campaigns from database with full metadata - prioritize minted ones
    const { data: submissions, error: dbError } = await supabaseAdmin
      .from('submissions')
      .select('id, campaign_id, slug, short_code, title, story, image_uri, goal, status, category, creator_name, num_copies, price_per_copy')
      .in('status', ['minted', 'approved'])
      .order('status', { ascending: false }) // 'minted' comes before 'approved' alphabetically reversed
      .order('created_at', { ascending: false })
      .limit(limit)

    console.log(`[loadOnchain] Found ${submissions?.length || 0} submissions from DB`, dbError ? `Error: ${dbError.message}` : '', submissions?.[0] ? `First: ${submissions[0].title}` : '')

    if (!submissions || submissions.length === 0) {
      console.log('[loadOnchain] No submissions found, returning empty')
      return []
    }

    // Get on-chain data for raised amounts
    const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()
    let contract: any = null
    
    if (contractAddress) {
      try {
        const provider = getProvider()
        contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)
      } catch (e) {
        console.log('[loadOnchain] Could not create contract instance')
      }
    }

    const mapped: NFTItem[] = await Promise.all(submissions.map(async (s: any) => {
      let raised = 0
      let nftSalesUSD = 0
      let tipsUSD = 0
      let editionsMinted = 0
      let maxEditions = 0
      const goal = Number(s.goal || 0)
      const numCopies = Number(s.num_copies || 100)
      const pricePerCopy = Number(s.price_per_copy || (goal > 0 && numCopies > 0 ? goal / numCopies : 0))

      // Get raised amount from blockchain if campaign_id exists
      if (s.campaign_id && contract) {
        try {
          const campaign = await contract.getCampaign(s.campaign_id)
          const grossRaisedWei = BigInt(campaign.grossRaised ?? campaign[3] ?? 0n)
          const grossRaisedBDAG = Number(grossRaisedWei) / 1e18
          raised = grossRaisedBDAG * BDAG_USD_RATE
          
          editionsMinted = Number(campaign.editionsMinted ?? campaign[5] ?? 0)
          maxEditions = Number(campaign.maxEditions ?? campaign[6] ?? 0)
          
          // Calculate NFT sales and tips
          nftSalesUSD = editionsMinted * pricePerCopy
          tipsUSD = Math.max(0, raised - nftSalesUSD)
        } catch (e) {
          // Campaign may not exist on chain yet
        }
      }

      const pct = goal > 0 ? Math.round((raised / goal) * 100) : 0
      const cause = s.category === 'veteran' ? 'veteran' : 'general'

      return {
        id: s.id,
        campaignId: s.campaign_id || undefined,
        slug: s.slug || null,
        short_code: s.short_code || null,
        title: s.title || 'Untitled Campaign',
        image: s.image_uri || '',
        causeType: cause as 'veteran' | 'general',
        progress: pct,
        goal,
        raised,
        nftSalesUSD,
        tipsUSD,
        sold: editionsMinted,
        total: maxEditions || numCopies,
        snippet: s.story?.slice(0, 150) || ''
      }
    }))

    console.log(`[loadOnchain] Mapped ${mapped.length} items, first: ${mapped[0]?.title}, image: ${mapped[0]?.image?.slice(0, 50)}...`)

    return mapped
  } catch (e) {
    console.error('[loadOnchain] Error:', e)
    return []
  }
}

async function loadStats(): Promise<{ raised: number; campaigns: number; nfts: number }> {
  try {
    const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()
    if (!contractAddress) {
      console.log('[HomePage Stats] No contract address configured')
      return { raised: 0, campaigns: 0, nfts: 0 }
    }

    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)

    // Get total NFTs minted from blockchain
    let totalNFTs = 0
    try {
      const supply = await contract.totalSupply()
      totalNFTs = Number(supply)
    } catch (e: any) {
      console.error('[HomePage Stats] Error getting total supply:', e?.message)
    }

    // Get campaign IDs from database (only real campaigns with submissions)
    // This is the source of truth - orphaned blockchain campaigns without submissions don't count
    let campaignIds: number[] = []
    try {
      const { data: submissions } = await supabaseAdmin
        .from('submissions')
        .select('campaign_id')
        .not('campaign_id', 'is', null)
      
      campaignIds = (submissions || [])
        .map(s => s.campaign_id)
        .filter((id): id is number => id != null)
      
      console.log(`[HomePage Stats] Found ${campaignIds.length} campaigns with submissions: ${campaignIds.join(', ')}`)
    } catch (e: any) {
      console.error('[HomePage Stats] Error getting campaigns from DB:', e?.message)
    }

    // Calculate total raised for these campaigns only
    let totalGrossRaisedWei = BigInt(0)
    
    for (const campaignId of campaignIds) {
      try {
        const campaign = await contract.getCampaign(campaignId)
        const grossRaised = BigInt(campaign.grossRaised ?? campaign[3] ?? 0n)
        totalGrossRaisedWei += grossRaised
        console.log(`[HomePage Stats] Campaign ${campaignId}: grossRaised=${grossRaised}`)
      } catch (e) {
        console.log(`[HomePage Stats] Campaign ${campaignId}: error reading from chain`)
      }
    }

    const totalRaisedBDAG = Number(totalGrossRaisedWei) / 1e18
    const totalRaisedUSD = totalRaisedBDAG * BDAG_USD_RATE

    console.log(`[HomePage Stats] Campaigns: ${campaignIds.length}, NFTs: ${totalNFTs}, Total BDAG: ${totalRaisedBDAG}, Raised: $${totalRaisedUSD.toFixed(2)}`)

    return {
      raised: totalRaisedUSD,
      campaigns: campaignIds.length,
      nfts: totalNFTs
    }
  } catch (e: any) {
    console.error('[HomePage Stats] Error:', e?.message)
    return { raised: 0, campaigns: 0, nfts: 0 }
  }
}

const FEATURES = [
  { icon: '🔒', title: 'Transparent', desc: 'Every dollar tracked on blockchain. See exactly where funds go.' },
  { icon: '⚡', title: 'Direct Support', desc: 'Funds go directly to recipients. No middlemen, no delays.' },
  { icon: '🎨', title: 'Dynamic NFTs', desc: 'Your contribution becomes a living digital collectible.' },
  { icon: '✅', title: 'Verified Stories', desc: 'KYC verification ensures authentic campaigns.' },
]

export default async function HomePage() {
  const [all, stats] = await Promise.all([loadOnchain(24), loadStats()])
  
  // Success stories: campaigns that reached their goal
  const successStories = all.filter(i => i.goal > 0 && i.raised >= i.goal).slice(0, 3)
  const successIds = new Set(successStories.map(s => s.id))
  
  // Featured: exclude fully funded campaigns (they go in Success Stories)
  const highlights = all.filter(i => !successIds.has(i.id) && (i.goal === 0 || i.raised < i.goal)).slice(0, 6)
  
  // Format stats for display
  const formatCurrency = (n: number) => {
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`
    return `$${n.toFixed(0)}`
  }
  
  const STATS = [
    { value: formatCurrency(stats.raised), label: 'Raised' },
    { value: String(stats.campaigns), label: 'Campaigns' },
    { value: String(stats.nfts), label: 'NFTs Minted' },
    { value: '100%', label: 'Transparent' },
  ]

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-blue-900/20" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        
        <div className="container relative py-12 sm:py-20 md:py-32">
          <div className="max-w-4xl mx-auto text-center px-2">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs sm:text-sm mb-6 sm:mb-8">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white/70">Powered by BlockDAG Blockchain</span>
            </div>
            
            {/* Main headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent leading-tight mb-4 sm:mb-6">
              Empowering Veterans Through <span className="bg-gradient-to-r from-red-400 via-white to-blue-400 bg-clip-text">Transparent</span> Giving
            </h1>
            
            <p className="text-base sm:text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-8 sm:mb-10 px-2">
              The most advanced fundraising platform ever built. Direct support, full transparency, and dynamic NFTs that evolve as campaigns progress.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
              <Link 
                href="/submit" 
                className="px-6 sm:px-8 py-3 sm:py-4 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white font-semibold text-base sm:text-lg hover:from-red-500 hover:to-red-400 transition-all shadow-lg shadow-red-500/25 hover:shadow-red-500/40 active:scale-[0.98]"
              >
                Submit Your Story
              </Link>
              <Link 
                href="/marketplace" 
                className="px-6 sm:px-8 py-3 sm:py-4 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-base sm:text-lg hover:bg-white/10 transition-all active:scale-[0.98]"
              >
                Browse Campaigns
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="container py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-sm text-white/50 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="container py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Why PatriotPledge?</h2>
          <p className="text-white/50 max-w-2xl mx-auto">Built on blockchain technology for unmatched transparency and direct impact</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f, i) => (
            <div 
              key={i} 
              className="group relative rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 p-6 hover:border-white/20 transition-all"
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                {f.icon}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-white/50">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Video Section - See How It Works */}
      <section className="container py-16" id="how-it-works">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">See How It Works</h2>
          <p className="text-white/50 max-w-2xl mx-auto">Learn how to set up your wallet and support campaigns using BDAG tokens</p>
        </div>

        {/* Important Notice */}
        <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="text-3xl">⚠️</div>
            <div>
              <h3 className="text-lg font-semibold text-amber-400 mb-2">Testnet Phase - BDAG Only</h3>
              <p className="text-white/70">
                PatriotPledge NFTs is currently in <strong className="text-white">testnet phase</strong>. We are <strong className="text-white">not accepting credit cards, PayPal, Cash App, or Venmo</strong> at this time. 
                All transactions are conducted using <strong className="text-amber-400">BDAG tokens</strong> native on the BlockDAG Awakening Testnet.
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Instructions */}
          <div className="space-y-6">
            {/* Step 1: MetaMask Setup */}
            <div className="rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center text-white font-bold">1</div>
                <h3 className="text-xl font-semibold text-white">Set Up MetaMask with Awakening Testnet</h3>
              </div>
              <div className="space-y-4 text-white/70">
                <p>First, install <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">MetaMask</a> browser extension if you haven&apos;t already.</p>
                
                <div className="bg-black/30 rounded-xl p-4">
                  <p className="text-sm text-white/50 mb-3">Add the Awakening Testnet with these settings:</p>
                  <div className="space-y-2 font-mono text-sm">
                    <div className="flex justify-between items-center py-1 border-b border-white/10">
                      <span className="text-white/50">Network Name:</span>
                      <span className="text-white">BlockDAG Awakening</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/10">
                      <span className="text-white/50">RPC URL:</span>
                      <span className="text-green-400 text-xs">https://rpc.primordial.bdagscan.com</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/10">
                      <span className="text-white/50">Chain ID:</span>
                      <span className="text-white">1043</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/10">
                      <span className="text-white/50">Currency Symbol:</span>
                      <span className="text-white">BDAG</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-white/50">Block Explorer:</span>
                      <span className="text-blue-400 text-xs">https://awakening.bdagscan.com</span>
                    </div>
                  </div>
                </div>
                
                <p className="text-sm">
                  <strong className="text-white">How to add:</strong> Open MetaMask → Click network dropdown → &quot;Add Network&quot; → &quot;Add a network manually&quot; → Enter the details above → Save
                </p>
              </div>
            </div>

            {/* Step 2: Get BDAG */}
            <div className="rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold">2</div>
                <h3 className="text-xl font-semibold text-white">Get BDAG Tokens</h3>
              </div>
              <div className="space-y-3 text-white/70">
                <p>You&apos;ll need BDAG tokens to purchase NFTs. During testnet, you can:</p>
                <ul className="list-disc list-inside space-y-2 ml-2">
                  <li>Request testnet BDAG from the <a href="https://t.me/BlockDAGBuildathon" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">BlockDAG Buildathon Telegram</a></li>
                  <li>Contact the PatriotPledge team for testnet tokens</li>
                </ul>
              </div>
            </div>

            {/* Step 3: Buy NFT */}
            <div className="rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold">3</div>
                <h3 className="text-xl font-semibold text-white">Purchase an NFT</h3>
              </div>
              <div className="space-y-3 text-white/70">
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li><strong className="text-white">Browse campaigns</strong> on the <Link href="/marketplace" className="text-blue-400 hover:underline">Marketplace</Link></li>
                  <li><strong className="text-white">Click &quot;View Story&quot;</strong> on a campaign you want to support</li>
                  <li><strong className="text-white">Connect your wallet</strong> by clicking &quot;Connect Wallet&quot;</li>
                  <li><strong className="text-white">Select quantity</strong> and optionally add a tip</li>
                  <li><strong className="text-white">Click &quot;Purchase with BDAG&quot;</strong> and confirm in MetaMask</li>
                  <li><strong className="text-white">Your NFT will appear</strong> in your MetaMask NFT tab!</li>
                </ol>
                <p className="text-sm mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <span className="text-green-400">✓</span> Your NFT automatically appears in MetaMask after purchase. You can also view it on the <a href="https://awakening.bdagscan.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">BlockDAG Explorer</a>.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Video */}
          <div className="lg:sticky lg:top-24 h-fit">
            <div className="rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 p-6">
              <h3 className="text-xl font-semibold text-white mb-4">📺 Video Tutorial</h3>
              <div className="aspect-video rounded-xl bg-black/50 overflow-hidden" data-testid="demo-video">
                <iframe
                  src="https://www.youtube.com/embed/xkYcSQdnMXs"
                  title="PatriotPledge NFTs Tutorial - How to Set Up MetaMask and Purchase NFTs"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
              
              {/* Quick Links */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <h4 className="text-sm font-semibold text-white/70 mb-3">Quick Links</h4>
                <div className="grid grid-cols-2 gap-3">
                  <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-sm text-white/70 hover:text-white">
                    <span>🦊</span> Get MetaMask
                  </a>
                  <a href="https://awakening.bdagscan.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-sm text-white/70 hover:text-white">
                    <span>🔍</span> Block Explorer
                  </a>
                  <a href="https://t.me/BlockDAGBuildathon" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-sm text-white/70 hover:text-white">
                    <span>💬</span> Telegram
                  </a>
                  <Link href="/marketplace" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-sm text-white/70 hover:text-white">
                    <span>🛒</span> Marketplace
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Ready to Make a Difference */}
      <section className="container py-20">
        <div className="relative rounded-3xl overflow-hidden">
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 via-purple-600/20 to-blue-600/20" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/5 to-transparent" />
          
          <div className="relative p-12 md:p-20 text-center">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Ready to Make a Difference?
            </h2>
            <p className="text-lg text-white/60 max-w-2xl mx-auto mb-10">
              Whether you need help or want to help others, PatriotPledge NFTs is the platform for transparent, impactful giving.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/submit" 
                className="px-8 py-4 rounded-xl bg-white text-gray-900 font-semibold text-lg hover:bg-white/90 transition-all"
              >
                Start Your Campaign
              </Link>
              <Link 
                href="/marketplace" 
                className="px-8 py-4 rounded-xl bg-white/10 border border-white/20 text-white font-semibold text-lg hover:bg-white/20 transition-all"
              >
                Support a Veteran
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Campaigns */}
      {highlights.length > 0 && (
        <section className="container py-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-white">Featured Campaigns</h2>
              <p className="text-white/50 mt-1">Support verified veterans and their families</p>
            </div>
            <Link 
              href="/marketplace" 
              className="hidden md:flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all"
            >
              View All
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {highlights.map(h => (<NFTCard key={h.id} item={h} />))}
          </div>
          
          <div className="mt-8 text-center md:hidden">
            <Link 
              href="/marketplace" 
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all"
            >
              View All Campaigns
            </Link>
          </div>
        </section>
      )}

      {/* Success Stories */}
      {successStories.length > 0 && (
        <section className="py-16 bg-gradient-to-b from-transparent via-green-900/10 to-transparent">
          <div className="container">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-sm text-green-400 mb-4">
                <span>✓</span> Fully Funded
              </div>
              <h2 className="text-3xl font-bold text-white">Success Stories</h2>
              <p className="text-white/50 mt-2">Campaigns that reached their goals thanks to donors like you</p>
            </div>
            
            <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory" data-testid="success-carousel">
              {successStories.map(s => (
                <div key={s.id} className="min-w-[320px] max-w-[360px] flex-shrink-0 snap-start">
                  <NFTCard item={s} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Trust Indicators */}
      <section className="container pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6 text-center">
            <div className="text-4xl mb-3">🛡️</div>
            <h3 className="font-semibold text-white mb-2">Verified Recipients</h3>
            <p className="text-sm text-white/50">Every campaign creator undergoes KYC verification to ensure authenticity</p>
          </div>
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6 text-center">
            <div className="text-4xl mb-3">⛓️</div>
            <h3 className="font-semibold text-white mb-2">Blockchain Transparency</h3>
            <p className="text-sm text-white/50">All transactions recorded on BlockDAG for complete auditability</p>
          </div>
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6 text-center">
            <div className="text-4xl mb-3">💯</div>
            <h3 className="font-semibold text-white mb-2">1% Platform Fee</h3>
            <p className="text-sm text-white/50">99% of your donation goes directly to the campaign recipient</p>
          </div>
        </div>
      </section>
    </div>
  )
}
