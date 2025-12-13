import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

// Create fresh Supabase client for each request to avoid caching issues
function getFreshSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false } }
  )
}

// BDAG to USD conversion rate (configurable via env)
const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || process.env.NEXT_PUBLIC_BDAG_USD_RATE || '0.05')

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') || 12)))
    const cursor = Number(url.searchParams.get('cursor') || '0')
    const offset = Number.isFinite(cursor) && cursor > 0 ? cursor : 0

    // Create fresh client for this request
    const supabase = getFreshSupabaseAdmin()
    
    // Load enabled contracts from marketplace_contracts table
    const { data: enabledContracts } = await supabase
      .from('marketplace_contracts')
      .select('contract_address')
      .eq('enabled', true)
    
    const enabledAddresses = (enabledContracts || [])
      .map((c: any) => (c.contract_address || '').toLowerCase())
      .filter(Boolean)
    
    // Fall back to env var if no enabled contracts configured
    const fallbackAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim().toLowerCase()
    if (enabledAddresses.length === 0 && fallbackAddress) {
      enabledAddresses.push(fallbackAddress)
    }
    
    if (enabledAddresses.length === 0) {
      return NextResponse.json({ items: [], total: 0 })
    }

    // Query ALL submissions and filter in code (workaround for Supabase .eq() inconsistency)
    const { data: allSubs, error } = await supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false })
    
    // Fetch approved update counts for all submissions
    const { data: updateCounts } = await supabase
      .from('campaign_updates')
      .select('submission_id')
      .eq('status', 'approved')
    
    // Build a map of submission_id -> update count
    const updateCountMap: Record<string, number> = {}
    for (const u of (updateCounts || [])) {
      updateCountMap[u.submission_id] = (updateCountMap[u.submission_id] || 0) + 1
    }
    
    // Also get the most recent update date per submission
    const { data: latestUpdates } = await supabase
      .from('campaign_updates')
      .select('submission_id, reviewed_at')
      .eq('status', 'approved')
      .order('reviewed_at', { ascending: false })
    
    const lastUpdateMap: Record<string, string> = {}
    for (const u of (latestUpdates || [])) {
      if (!lastUpdateMap[u.submission_id] && u.reviewed_at) {
        lastUpdateMap[u.submission_id] = u.reviewed_at
      }
    }
    
    // Filter by status='minted' in code
    const mintedSubs = (allSubs || []).filter((s: any) => s.status === 'minted')
    
    console.log(`[fundraisers] Total submissions: ${allSubs?.length || 0}, minted: ${mintedSubs.length}`)
    console.log('[fundraisers] Minted subs:', JSON.stringify(mintedSubs.map((s: any) => ({
      id: s.id?.slice(0,8),
      campaign_id: s.campaign_id,
      visible: s.visible_on_marketplace,
      contract: s.contract_address?.slice(0,10)
    }))))
    
    // Filter visible_on_marketplace in code (handles both boolean and string 'true')
    const visibleSubs = mintedSubs.filter((s: any) => 
      s.visible_on_marketplace === true || s.visible_on_marketplace === 'true'
    )

    if (error) {
      return NextResponse.json({ error: 'FUNDRAISER_QUERY_FAILED', details: error.message }, { status: 500 })
    }

    const provider = getProvider()
    // Cache contract instances by address
    const contractCache: Record<string, ethers.Contract> = {}
    const getContractForAddress = (addr: string) => {
      const key = addr.toLowerCase()
      if (!contractCache[key]) {
        contractCache[key] = new ethers.Contract(addr, PatriotPledgeV5ABI, provider)
      }
      return contractCache[key]
    }

    const items = await Promise.all(visibleSubs.map(async (sub: any) => {
      // Filter by enabled contracts (case-insensitive)
      const rowAddr = (sub.contract_address || '').toLowerCase()
      // MUST have a contract_address to appear in marketplace
      if (!rowAddr) {
        console.log(`[fundraisers] Skipping ${sub.id?.slice(0,8)} - no contract_address`)
        return null
      }
      if (!enabledAddresses.includes(rowAddr)) {
        console.log(`[fundraisers] Skipping ${sub.id?.slice(0,8)} - contract ${rowAddr} not in enabled list`)
        return null
      }
      
      const subContractAddr = sub.contract_address || ''
      // V5: Use campaign_id, fall back to token_id for legacy submissions
      const campaignId = sub.campaign_id ?? sub.token_id
      if (campaignId == null) return null
      
      // Use goal from Supabase submission (source of truth for display)
      let goal = Number(sub.goal || 0)
      let grossRaisedUSD = 0
      let editionsMinted = 0
      let maxEditions = Number(sub.num_copies || sub.nft_editions || 100) // Default 100 if not set
      
      try {
        const contract = getContractForAddress(subContractAddr)
        // V5 getCampaign returns: category, baseURI, goal, grossRaised, netRaised, editionsMinted, maxEditions, pricePerEdition, active, closed
        const camp = await (contract as any).getCampaign(BigInt(campaignId))
        // Convert grossRaised from wei (10^18) to BDAG, then to USD
        const grossRaisedWei = BigInt(camp.grossRaised ?? 0n)
        const grossRaisedBDAG = Number(grossRaisedWei) / 1e18
        grossRaisedUSD = grossRaisedBDAG * BDAG_USD_RATE
        editionsMinted = Number(camp.editionsMinted ?? 0n)
        // Use on-chain maxEditions if available and > 0
        const onchainMax = Number(camp.maxEditions ?? 0n)
        if (onchainMax > 0) maxEditions = onchainMax
      } catch {}

      // Price per NFT = Goal ÷ Max Editions (this is always correct for V5 model)
      const pricePerEdition = goal > 0 && maxEditions > 0 ? goal / maxEditions : 1

      const remaining = maxEditions > 0 ? Math.max(0, maxEditions - editionsMinted) : null // null = unlimited
      
      // Calculate NFT sales revenue = editions sold × price per edition (cap at gross raised)
      const calculatedNftSales = editionsMinted * pricePerEdition
      const nftSalesUSD = Math.min(calculatedNftSales, grossRaisedUSD) // Can't exceed total raised
      
      // Calculate tips = gross raised - NFT sales (tips are extra amounts above NFT price)
      const tipsUSD = Math.max(0, grossRaisedUSD - nftSalesUSD)
      
      // Total raised = gross raised from blockchain (most accurate)
      const raised = grossRaisedUSD
      
      // Progress should be based on editions sold for V5 model (or raised/goal as fallback)
      const progress = maxEditions > 0 
        ? Math.min(100, Math.round((editionsMinted / maxEditions) * 100))
        : (goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0)

      // Get update info for this submission
      const updateCount = updateCountMap[sub.id] || 0
      const lastUpdated = lastUpdateMap[sub.id] || null
      
      return {
        id: sub.id,
        title: sub.title || sub.story || `Fundraiser #${campaignId}`,
        image: sub.image_uri || '',
        story: sub.story || '',
        category: sub.category || 'general',
        campaignId: Number(campaignId),
        tokenId: Number(campaignId), // Legacy compat
        contract_address: subContractAddr,
        goal,
        raised,
        nftSalesUSD,
        tipsUSD,
        progress,
        editionsMinted,
        maxEditions,
        pricePerEdition,
        remaining,
        // Living NFT update info
        updateCount,
        lastUpdated,
        hasRecentUpdate: lastUpdated ? (Date.now() - new Date(lastUpdated).getTime()) < 7 * 24 * 60 * 60 * 1000 : false, // Updated within 7 days
      }
    }))

    const clean = items.filter(Boolean)
    
    // De-duplicate by contract_address + token_id (keep the most recent submission)
    const seen = new Set<string>()
    const deduplicated = clean.filter((item: any) => {
      const key = `${(item.contract_address || '').toLowerCase()}:${item.tokenId}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    
    // Apply offset and limit for pagination
    const paginated = deduplicated.slice(offset, offset + limit)
    const hasMore = offset + paginated.length < deduplicated.length
    
    return NextResponse.json({ 
      items: paginated, 
      total: deduplicated.length, 
      nextCursor: hasMore ? offset + paginated.length : null 
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'FUNDRAISER_LIST_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}
