import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { CHAIN_CONFIGS, type ChainId } from '@/lib/chains'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface TokenInfo {
  tokenId: number
  campaignId: number
  campaignTitle: string
  owner: string
  editionNumber: number
  tokenURI: string
  isFrozen: boolean
  isSoulbound: boolean
  chainId: number
  chainName: string
  contractVersion: string
  mintedAt?: string
}

/**
 * GET /api/admin/tokens
 * Fetch all tokens from database cache (fast, no RPC calls)
 * Tokens are cached when minted via /api/purchase/record
 */
export async function GET(req: NextRequest) {
  try {
    // Verify admin auth
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const { data: userData } = await supabaseAdmin.auth.getUser(token)
    const uid = userData?.user?.id
    if (!uid) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single()
    if (!['admin', 'super_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    // Parse filters
    const { searchParams } = new URL(req.url)
    const filterChainId = searchParams.get('chainId')
    const filterFrozen = searchParams.get('frozen')
    const filterSoulbound = searchParams.get('soulbound')
    const filterOwner = searchParams.get('owner')?.toLowerCase()
    const filterCampaignId = searchParams.get('campaignId')

    logger.info(`[admin/tokens] Filters: chainId=${filterChainId}, frozen=${filterFrozen}, soulbound=${filterSoulbound}, owner=${filterOwner}, campaignId=${filterCampaignId}`)

    // Build query for tokens table (database cache)
    let tokensQuery = supabaseAdmin
      .from('tokens')
      .select('*')
      .order('token_id', { ascending: false })

    // Apply filters
    if (filterChainId) {
      const chainIdNum = parseInt(filterChainId)
      logger.info(`[admin/tokens] Filtering by chain_id=${chainIdNum}`)
      tokensQuery = tokensQuery.eq('chain_id', chainIdNum)
    }
    if (filterCampaignId) {
      tokensQuery = tokensQuery.eq('campaign_id', parseInt(filterCampaignId))
    }
    if (filterFrozen === 'true') {
      tokensQuery = tokensQuery.eq('is_frozen', true)
    } else if (filterFrozen === 'false') {
      tokensQuery = tokensQuery.eq('is_frozen', false)
    }
    if (filterSoulbound === 'true') {
      tokensQuery = tokensQuery.eq('is_soulbound', true)
    } else if (filterSoulbound === 'false') {
      tokensQuery = tokensQuery.eq('is_soulbound', false)
    }
    if (filterOwner) {
      tokensQuery = tokensQuery.ilike('owner_wallet', filterOwner)
    }

    const { data: cachedTokens, error: tokensError } = await tokensQuery

    // Debug logging
    logger.info(`[admin/tokens] Query result: ${cachedTokens?.length || 0} tokens, error: ${tokensError?.message || 'none'}`)
    
    if (tokensError) {
      logger.error('[admin/tokens] Database query failed:', tokensError)
      return NextResponse.json({ error: 'Failed to fetch tokens', details: tokensError.message }, { status: 500 })
    }
    
    // If no tokens found, try a direct count query to debug
    if (!cachedTokens || cachedTokens.length === 0) {
      const { count, error: countError } = await supabaseAdmin
        .from('tokens')
        .select('*', { count: 'exact', head: true })
      logger.info(`[admin/tokens] Direct count: ${count}, error: ${countError?.message || 'none'}`)
      
      // Extra debug: check for Sepolia tokens specifically
      if (filterChainId === '11155111') {
        const { data: sepoliaTokens, error: sepoliaError } = await supabaseAdmin
          .from('tokens')
          .select('*')
          .eq('chain_id', 11155111)
        logger.info(`[admin/tokens] Sepolia debug: found ${sepoliaTokens?.length || 0} tokens, error: ${sepoliaError?.message || 'none'}`)
        if (sepoliaTokens && sepoliaTokens.length > 0) {
          logger.info(`[admin/tokens] Sepolia token sample: ${JSON.stringify(sepoliaTokens[0])}`)
        }
      }
    }

    // Get campaign titles for display
    const campaignIds = [...new Set(cachedTokens?.map(t => t.campaign_id) || [])]
    const { data: campaigns } = await supabaseAdmin
      .from('submissions')
      .select('campaign_id, title')
      .in('campaign_id', campaignIds.length > 0 ? campaignIds : [0])

    const campaignTitles = new Map(campaigns?.map(c => [c.campaign_id, c.title]) || [])

    // Transform cached tokens to response format
    const tokens: TokenInfo[] = (cachedTokens || []).map(t => {
      const chainConfig = CHAIN_CONFIGS[t.chain_id as ChainId]
      return {
        tokenId: t.token_id,
        campaignId: t.campaign_id,
        campaignTitle: campaignTitles.get(t.campaign_id) || `Campaign #${t.campaign_id}`,
        owner: t.owner_wallet,
        editionNumber: t.edition_number || 0,
        tokenURI: t.metadata_uri || '',
        isFrozen: t.is_frozen || false,
        isSoulbound: t.is_soulbound || false,
        chainId: t.chain_id,
        chainName: chainConfig?.name || 'Unknown',
        contractVersion: t.contract_version || 'v5',
        mintedAt: t.minted_at
      }
    })

    logger.debug(`[admin/tokens] Returning ${tokens.length} tokens from cache`)
    return NextResponse.json({ tokens })

  } catch (e: any) {
    logger.error('[admin/tokens] Error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
