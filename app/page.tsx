import Link from 'next/link'
import NFTCard, { NFTItem } from '@/components/NFTCard'
import { logger } from '@/lib/logger'
import { createClient } from '@supabase/supabase-js'
import { ethers } from 'ethers'
import { V8_ABI } from '@/lib/contracts'
import { getProviderForChain, ChainId } from '@/lib/chains'

// Force dynamic rendering - don't cache this page
export const dynamic = 'force-dynamic'
export const revalidate = 0

const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || process.env.NEXT_PUBLIC_BDAG_USD_RATE || '0.05')
const ETH_USD_RATE = Number(process.env.ETH_USD_RATE || '3100')

// Create fresh Supabase client for each request (avoids caching issues)
function getFreshSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false } }
  )
}

// Extended NFT item with video support
interface ExtendedNFTItem extends NFTItem {
  videoUrl?: string | null
  isFeatured?: boolean
}

// USD conversion rates (used for campaign raised calculations)
const ETH_USD = Number(process.env.ETH_USD_RATE || '3100')
const BDAG_USD = Number(process.env.BDAG_USD_RATE || '0.05')

// Aggregate tips from purchases table by campaign_id
async function getTipsPerCampaign(): Promise<Map<number, number>> {
  const supabase = getFreshSupabase()
  const { data: purchases, error } = await supabase
    .from('purchases')
    .select('campaign_id, tip_usd')
  
  if (error || !purchases) {
    logger.error('[getTipsPerCampaign] Error:', error?.message)
    return new Map()
  }
  
  const tipsMap = new Map<number, number>()
  for (const p of purchases) {
    const cid = Number(p.campaign_id)
    const tip = Number(p.tip_usd || 0)
    tipsMap.set(cid, (tipsMap.get(cid) || 0) + tip)
  }
  
  logger.debug(`[getTipsPerCampaign] Found tips for ${tipsMap.size} campaigns`)
  return tipsMap
}

// Fetch on-chain data for mainnet campaigns (more accurate than DB for live trading)
async function getOnchainCampaignData(campaignId: number, contractAddress: string, chainId: number): Promise<{ grossRaised: number; editionsMinted: number } | null> {
  try {
    const provider = getProviderForChain(chainId as ChainId)
    const contract = new ethers.Contract(contractAddress, V8_ABI, provider)
    const campaign = await contract.getCampaign(BigInt(campaignId))
    
    const grossRaisedWei = BigInt(campaign.grossRaised ?? 0n)
    const grossRaisedETH = Number(grossRaisedWei) / 1e18
    const grossRaisedUSD = grossRaisedETH * ETH_USD_RATE
    const editionsMinted = Number(campaign.editionsMinted ?? 0)
    
    return { grossRaised: grossRaisedUSD, editionsMinted }
  } catch (e) {
    logger.debug('[getOnchainCampaignData] Failed to fetch on-chain data:', e)
    return null
  }
}

async function loadOnchain(limit = 24, tipsMap?: Map<number, number>): Promise<ExtendedNFTItem[]> {
  try {
    const supabase = getFreshSupabase()
    
    // Get tips from purchases if not provided
    const tips = tipsMap || await getTipsPerCampaign()
    
    // Get all submissions with minted status
    const { data: allSubs, error } = await supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      logger.error('[loadOnchain] Database error:', error.message)
      return []
    }
    
    // Filter by status in code (only 'minted' is valid)
    const mintedSubs = (allSubs || []).filter((s: any) => 
      s.status === 'minted'
    )
    
    // Filter visible in JavaScript (handles boolean and string 'true')
    const visible = mintedSubs.filter((s: any) => 
      s.visible_on_marketplace === true || s.visible_on_marketplace === 'true'
    ).slice(0, limit)
    
    logger.debug(`[loadOnchain] Total: ${allSubs?.length}, minted: ${mintedSubs.length}, visible: ${visible.length}`)
    
    if (visible.length === 0) {
      return []
    }
    
    // Map to NFTItem format - use synced database values for speed/reliability
    // Database sold_count is synced with on-chain via sync-sold-counts.ts script
    const mapped: ExtendedNFTItem[] = visible.map((s: any) => {
      const goal = Number(s.goal || 0)
      const numCopies = Number(s.num_copies || 100)
      const chainId = s.chain_id || 1043
      const isTestnet = ![1, 137, 8453, 42161, 10].includes(chainId)
      
      // Use synced database values (sold_count synced with on-chain)
      const soldCount = Number(s.sold_count || 0)
      const pricePerCopy = goal > 0 && numCopies > 0 ? goal / numCopies : 0
      const nftSalesUSD = soldCount * pricePerCopy
      // Get tips from purchases table (aggregated by campaign_id)
      const giftsUSD = tips.get(Number(s.campaign_id)) || 0
      const totalRaised = nftSalesUSD + giftsUSD
      
      const pct = goal > 0 ? Math.min(100, Math.round((totalRaised / goal) * 100)) : 0
      
      return {
        id: s.id,
        campaignId: s.campaign_id,
        slug: s.slug || null,
        short_code: s.short_code || null,
        title: s.title || 'Untitled Campaign',
        image: s.image_uri || '',
        causeType: s.category || 'general',
        progress: pct,
        goal,
        raised: totalRaised,
        nftSalesUSD,
        giftsUSD,
        sold: soldCount,
        total: numCopies,
        snippet: s.story?.slice(0, 150) || '',
        chainId,
        chainName: s.chain_name || (isTestnet ? 'BlockDAG' : 'Ethereum Mainnet'),
        isTestnet,
        contractAddress: s.contract_address,
        videoUrl: s.video_url || null,
        isFeatured: false
      }
    })

    logger.debug(`[loadOnchain] Mapped ${mapped.length} items`)
    return mapped
  } catch (e) {
    console.error('[loadOnchain] Error:', e)
    return []
  }
}

interface HomeStats {
  raised: number
  campaigns: number
  nfts: number
  mainnetRaised: number
  testnetRaised: number
}

// Calculate stats from campaigns array
function calculateStatsFromCampaigns(campaigns: ExtendedNFTItem[]): HomeStats {
  let raised = 0
  let mainnetRaised = 0
  let testnetRaised = 0
  let nfts = 0
  
  for (const c of campaigns) {
    const totalRaised = (c.raised || 0)
    raised += totalRaised
    nfts += c.sold || 0
    
    if (c.isTestnet) {
      testnetRaised += totalRaised
    } else {
      mainnetRaised += totalRaised
    }
  }
  
  return {
    raised: Math.round(raised * 100) / 100,
    campaigns: campaigns.length,
    nfts,
    mainnetRaised: Math.round(mainnetRaised * 100) / 100,
    testnetRaised: Math.round(testnetRaised * 100) / 100
  }
}

// Load ALL visible campaigns for stats (no limit)
async function loadAllCampaignsForStats(tipsMap?: Map<number, number>): Promise<ExtendedNFTItem[]> {
  try {
    const supabase = getFreshSupabase()
    
    // Get tips from purchases if not provided
    const tips = tipsMap || await getTipsPerCampaign()
    
    const { data: allSubs, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('status', 'minted')
      .order('created_at', { ascending: false })
    
    if (error) {
      logger.error('[loadAllCampaignsForStats] Database error:', error.message)
      return []
    }
    
    // Filter visible in JavaScript
    const visible = (allSubs || []).filter((s: any) => 
      s.visible_on_marketplace === true || s.visible_on_marketplace === 'true'
    )
    
    // Map to ExtendedNFTItem format
    return visible.map((s: any) => {
      const goal = Number(s.goal || 0)
      const numCopies = Number(s.num_copies || 100)
      const chainId = s.chain_id || 1043
      const isTestnet = ![1, 137, 8453, 42161, 10].includes(chainId)
      
      const soldCount = Number(s.sold_count || 0)
      const pricePerCopy = goal > 0 && numCopies > 0 ? goal / numCopies : 0
      const nftSalesUSD = soldCount * pricePerCopy
      // Get tips from purchases table (aggregated by campaign_id)
      const giftsUSD = tips.get(Number(s.campaign_id)) || 0
      const totalRaised = nftSalesUSD + giftsUSD
      
      return {
        id: s.id,
        campaignId: s.campaign_id,
        slug: s.slug || null,
        short_code: s.short_code || null,
        title: s.title || 'Untitled Campaign',
        image: s.image_uri || '',
        causeType: s.category || 'general',
        progress: goal > 0 ? Math.min(100, Math.round((totalRaised / goal) * 100)) : 0,
        goal,
        raised: totalRaised,
        nftSalesUSD,
        giftsUSD,
        sold: soldCount,
        total: numCopies,
        snippet: s.story?.slice(0, 150) || '',
        chainId,
        chainName: s.chain_name || (isTestnet ? 'BlockDAG' : 'Ethereum Mainnet'),
        isTestnet,
        contractAddress: s.contract_address,
        videoUrl: s.video_url || null,
        isFeatured: false
      }
    })
  } catch (e) {
    console.error('[loadAllCampaignsForStats] Error:', e)
    return []
  }
}

const FEATURES = [
  { icon: '🔒', title: 'Full Transparency', desc: 'Every dollar tracked on blockchain. See exactly where your support goes.' },
  { icon: '⚡', title: 'Direct Impact', desc: 'Funds go directly to recipients. No middlemen, no delays.' },
  { icon: '🌐', title: 'Multi-Chain', desc: 'Support campaigns on Ethereum, BlockDAG, and more networks.' },
  { icon: '✅', title: 'Verified Stories', desc: 'Every campaign creator undergoes verification for authenticity.' },
]

export default async function HomePage() {
  // Fetch tips once and pass to both functions for efficiency
  const tipsMap = await getTipsPerCampaign()
  
  // Fetch campaigns for display (limited to 24)
  const all = await loadOnchain(24, tipsMap)
  
  // Load ALL visible campaigns for accurate stats (not limited)
  const allCampaigns = await loadAllCampaignsForStats(tipsMap)
  let stats = calculateStatsFromCampaigns(allCampaigns)
  
  // Featured campaign: prioritize mainnet campaigns, then first available
  // Sort to put mainnet campaigns first
  const sortedCampaigns = [...all].sort((a, b) => {
    // Mainnet first (isTestnet=false comes before isTestnet=true)
    if (a.isTestnet !== b.isTestnet) return a.isTestnet ? 1 : -1
    // Then by raised amount
    return (b.raised || 0) - (a.raised || 0)
  })
  let featuredCampaign = sortedCampaigns[0]
  
  // For mainnet featured campaign, fetch accurate on-chain data
  if (featuredCampaign && !featuredCampaign.isTestnet && featuredCampaign.contractAddress) {
    const onchainData = await getOnchainCampaignData(
      featuredCampaign.campaignId || 0,
      featuredCampaign.contractAddress,
      featuredCampaign.chainId || 1
    )
    if (onchainData) {
      const total = featuredCampaign.total || 1000
      const pricePerCopy = featuredCampaign.goal > 0 && total > 0 
        ? featuredCampaign.goal / total 
        : 20
      const nftSalesUSD = onchainData.editionsMinted * pricePerCopy
      const giftsUSD = Math.max(0, onchainData.grossRaised - nftSalesUSD)
      
      // Update featured campaign with accurate on-chain data
      featuredCampaign = {
        ...featuredCampaign,
        sold: onchainData.editionsMinted,
        raised: onchainData.grossRaised,
        nftSalesUSD,
        giftsUSD,
        progress: featuredCampaign.goal > 0 
          ? Math.min(100, Math.round((onchainData.grossRaised / featuredCampaign.goal) * 100))
          : 0
      }
      
      // Also update mainnet stats with accurate on-chain data
      stats = {
        ...stats,
        mainnetRaised: onchainData.grossRaised,
        raised: stats.testnetRaised + onchainData.grossRaised
      }
      
      logger.debug('[HomePage] Updated featured campaign with on-chain data:', {
        editionsMinted: onchainData.editionsMinted,
        grossRaised: onchainData.grossRaised,
        nftSalesUSD,
        giftsUSD
      })
    }
  }
  
  // Success stories: campaigns that reached their goal
  const successStories = all.filter(i => i.goal > 0 && i.raised >= i.goal).slice(0, 3)
  const successIds = new Set(successStories.map(s => s.id))
  const featuredId = featuredCampaign?.id
  
  // Other campaigns: exclude featured and fully funded
  const highlights = all.filter(i => !successIds.has(i.id) && i.id !== featuredId && (i.goal === 0 || i.raised < i.goal)).slice(0, 6)
  
  // Format stats for display
  const formatCurrency = (n: number) => {
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`
    return `$${n.toFixed(0)}`
  }
  
  // Stats with mainnet/testnet distinction - ACCURATE from all contracts
  const hasMainnet = stats.mainnetRaised > 0
  const STATS = [
    { 
      value: formatCurrency(stats.mainnetRaised), 
      label: 'Live Funds',
      sublabel: '💎 Ethereum Mainnet',
      isMainnet: true,
      highlight: true
    },
    { 
      value: formatCurrency(stats.testnetRaised), 
      label: 'Test Value',
      sublabel: '🧪 BlockDAG + Sepolia',
      isMainnet: false,
      highlight: false
    },
    { value: String(stats.campaigns), label: 'Campaigns', sublabel: 'All chains', isMainnet: null, highlight: false },
    { value: String(stats.nfts), label: 'NFTs Minted', sublabel: 'All chains', isMainnet: null, highlight: false },
  ]

  return (
    <div className="min-h-screen">
      {/* Stats Bar - TOP - Shows accurate data from ALL contracts */}
      <section className="border-b border-white/10 bg-gradient-to-r from-green-900/30 via-blue-900/20 to-purple-900/20">
        <div className="container py-6">
          {/* Verified Contract Badge */}
          <div className="flex justify-center mb-4">
            <a 
              href="https://etherscan.io/address/0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e#code" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 text-sm text-green-400 hover:bg-green-500/20 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <span className="font-medium">V8 Contract Verified on Etherscan</span>
              <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {STATS.map((stat, i) => (
              <div key={i} className={`text-center p-3 rounded-xl ${stat.highlight ? 'bg-green-500/10 border border-green-500/20' : ''}`}>
                <div className={`text-2xl sm:text-3xl md:text-4xl font-bold ${
                  stat.isMainnet === true ? 'text-green-400' : 
                  stat.isMainnet === false ? 'text-orange-400' : 
                  'bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent'
                }`}>
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm text-white/60 mt-1 font-medium">{stat.label}</div>
                {stat.sublabel && (
                  <div className={`text-xs mt-0.5 ${stat.isMainnet === true ? 'text-green-400/80' : stat.isMainnet === false ? 'text-orange-400/70' : 'text-white/40'}`}>
                    {stat.sublabel}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-blue-900/20" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        
        <div className="container relative py-12 sm:py-16 md:py-24">
          <div className="max-w-4xl mx-auto text-center px-2">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs sm:text-sm mb-6 sm:mb-8">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white/70">Powered by Multi-Chain Technology</span>
            </div>
            
            {/* Main headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent leading-tight mb-4 sm:mb-6">
              Be Your Brother&apos;s Keeper — <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text">Transparent</span> Giving
            </h1>
            
            <p className="text-base sm:text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-8 sm:mb-10 px-2">
              Support your community with full blockchain transparency. From veterans to disaster relief, medical emergencies to education — every dollar is tracked and verified.
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

      {/* Featured Campaign Section - Right after Hero */}
      {featuredCampaign && (
        <section className="container py-16" id="featured">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-sm text-green-400 mb-4">
              <span>{featuredCampaign.isTestnet ? '🧪' : '💎'}</span>
              <span>{featuredCampaign.isTestnet ? 'Featured Campaign' : 'LIVE on Ethereum'}</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Support This Campaign</h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left: Campaign Card - Full details like marketplace */}
            <Link href={`/story/${featuredCampaign.id}`} className="group block">
              <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5 hover:border-white/20 transition-all">
                <div className="relative h-64 md:h-80 overflow-hidden">
                  {featuredCampaign.image ? (
                    <img 
                      src={featuredCampaign.image.startsWith('ipfs://') ? featuredCampaign.image.replace('ipfs://', 'https://ipfs.io/ipfs/') : featuredCampaign.image} 
                      alt={featuredCampaign.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-900/50 to-purple-900/50 flex items-center justify-center">
                      <span className="text-6xl opacity-30">🎖️</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  
                  {/* Top badges row */}
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                    {/* Sold count */}
                    <span className="rounded-full px-3 py-1.5 text-sm font-semibold backdrop-blur-sm bg-black/40 text-white border border-white/20">
                      {featuredCampaign.sold}/{featuredCampaign.total} sold
                    </span>
                    
                    {/* Chain + Category badges */}
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-3 py-1.5 text-sm font-semibold backdrop-blur-sm border ${
                        featuredCampaign.isTestnet 
                          ? 'bg-orange-500/40 text-orange-200 border-orange-500/40' 
                          : 'bg-green-500/40 text-green-200 border-green-500/40'
                      }`}>
                        {featuredCampaign.isTestnet ? '🧪' : '💎'} {featuredCampaign.chainName || (featuredCampaign.isTestnet ? 'Testnet' : 'Ethereum Mainnet')}
                      </span>
                      <span className="rounded-full px-3 py-1.5 text-sm font-semibold backdrop-blur-sm bg-blue-500/40 text-blue-200 border border-blue-500/40">
                        🤝 Community
                      </span>
                    </div>
                  </div>
                  
                  {/* Progress with detailed amounts */}
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="flex justify-between items-end text-white text-sm mb-2">
                      <div>
                        <span className={`font-bold text-2xl ${featuredCampaign.isTestnet ? 'text-orange-400' : 'text-green-400'}`}>
                          {featuredCampaign.isTestnet ? '~' : ''}${featuredCampaign.raised.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                        <div className="flex gap-2 text-xs mt-1">
                          <span className="text-emerald-300 font-medium">NFT: ${(featuredCampaign.nftSalesUSD || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          <span className="text-white/40">·</span>
                          <span className="text-purple-300 font-medium">Gifts: ${(featuredCampaign.giftsUSD || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                      </div>
                      <span className="text-white/70 font-semibold">{featuredCampaign.progress}%</span>
                    </div>
                    <div className={`h-2.5 rounded-full overflow-hidden ${featuredCampaign.isTestnet ? 'bg-orange-500/20' : 'bg-green-500/20'}`}>
                      <div 
                        className={`h-full rounded-full ${featuredCampaign.isTestnet ? 'bg-gradient-to-r from-orange-400 to-yellow-500' : 'bg-gradient-to-r from-green-400 to-emerald-500'}`}
                        style={{ width: `${Math.min(100, featuredCampaign.progress)}%` }}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <h3 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors mb-2">
                    {featuredCampaign.title}
                  </h3>
                  <p className="text-white/60 text-sm line-clamp-2 mb-4">{featuredCampaign.snippet}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-white/50 text-sm">Goal: ${featuredCampaign.goal.toLocaleString()}</span>
                    <span className="text-blue-400 font-medium group-hover:text-blue-300 flex items-center gap-1">
                      Support Now
                      <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            </Link>

            {/* Right: Video or Info */}
            <div className="space-y-6">
              {(featuredCampaign as ExtendedNFTItem).videoUrl ? (
                <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
                  <div className="aspect-video">
                    <iframe
                      src={(featuredCampaign as ExtendedNFTItem).videoUrl?.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                      title={`${featuredCampaign.title} Video`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 p-8">
                  <h3 className="text-xl font-bold text-white mb-4">How It Works</h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm shrink-0">1</div>
                      <div>
                        <h4 className="font-semibold text-white">Connect Wallet</h4>
                        <p className="text-sm text-white/60">Click the campaign and connect your MetaMask wallet</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">2</div>
                      <div>
                        <h4 className="font-semibold text-white">Purchase NFT</h4>
                        <p className="text-sm text-white/60">Choose quantity and confirm the transaction</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm shrink-0">3</div>
                      <div>
                        <h4 className="font-semibold text-white">Make an Impact</h4>
                        <p className="text-sm text-white/60">98% goes directly to the campaign creator</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Quick Actions */}
              <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link 
                    href={`/story/${featuredCampaign.id}`}
                    className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-center hover:from-blue-500 hover:to-purple-500 transition-all"
                  >
                    Support This Campaign
                  </Link>
                  <Link 
                    href="/tutorials"
                    className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 font-medium text-center hover:bg-white/10 hover:text-white transition-all"
                  >
                    📚 How To Guide
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Why PatriotPledge - After Featured Campaign */}
      <section className="container py-16">
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

      {/* CTA Section - Ready to Make a Difference */}
      <section className="container py-16">
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
                Support a Cause
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* More Campaigns */}
      {highlights.length > 0 && (
        <section className="container py-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-white">More Campaigns</h2>
              <p className="text-white/50 mt-1">Discover verified causes from veterans, families, and communities</p>
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
            <h3 className="font-semibold text-white mb-2">Low 2% Total Fees</h3>
            <p className="text-sm text-white/50">1% platform fee + 1% nonprofit fee · 98% goes to campaign recipient</p>
          </div>
        </div>
      </section>
    </div>
  )
}
