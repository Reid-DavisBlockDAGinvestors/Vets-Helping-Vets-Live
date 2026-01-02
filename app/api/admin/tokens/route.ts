import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getProviderForChain, getContractAddress, type ChainId } from '@/lib/chains'
import { PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'
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
 * Fetch all tokens from on-chain and Supabase
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

    // Get all minted campaigns to know which chains/contracts to query
    let campaignsQuery = supabaseAdmin
      .from('submissions')
      .select('id, title, campaign_id, chain_id, chain_name, contract_version')
      .eq('status', 'minted')
      .not('campaign_id', 'is', null)

    if (filterChainId) {
      campaignsQuery = campaignsQuery.eq('chain_id', parseInt(filterChainId))
    }
    if (filterCampaignId) {
      campaignsQuery = campaignsQuery.eq('campaign_id', parseInt(filterCampaignId))
    }

    const { data: campaigns, error: campaignsError } = await campaignsQuery

    if (campaignsError) {
      return NextResponse.json({ error: 'Failed to fetch campaigns', details: campaignsError.message }, { status: 500 })
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({ tokens: [] })
    }

    // Group campaigns by chain/version for efficient querying
    const chainGroups = new Map<string, typeof campaigns>()
    for (const camp of campaigns) {
      const key = `${camp.chain_id || 1043}-${camp.contract_version || 'v6'}`
      if (!chainGroups.has(key)) {
        chainGroups.set(key, [])
      }
      chainGroups.get(key)!.push(camp)
    }

    const tokens: TokenInfo[] = []

    // Query each chain/version group
    for (const [key, groupCampaigns] of chainGroups) {
      const [chainIdStr, version] = key.split('-')
      const chainId = parseInt(chainIdStr) as ChainId

      try {
        const provider = getProviderForChain(chainId)
        const contractAddress = getContractAddress(chainId, version as any)

        if (!contractAddress) {
          logger.warn(`[admin/tokens] No contract address for chain ${chainId} version ${version}`)
          continue
        }

        const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)

        // For each campaign, get its editions
        for (const camp of groupCampaigns) {
          try {
            // Get campaign editions from contract
            const editionTokenIds = await contract.getCampaignEditions(BigInt(camp.campaign_id))

            for (const tokenIdBn of editionTokenIds) {
              const tokenId = Number(tokenIdBn)

              try {
                // Get token info from contract
                const owner = await contract.ownerOf(tokenIdBn)
                const tokenURI = await contract.tokenURI(tokenIdBn)
                const editionNumber = Number(await contract.tokenEditionNumber(tokenIdBn))

                // Check frozen/soulbound status (may not exist on all contracts)
                let isFrozen = false
                let isSoulbound = false
                try {
                  isFrozen = await contract.frozenTokens(tokenIdBn)
                } catch { /* Not all contracts have this */ }
                try {
                  isSoulbound = await contract.soulbound(tokenIdBn)
                } catch { /* Not all contracts have this */ }

                // Apply filters
                if (filterFrozen !== null && filterFrozen !== undefined) {
                  if ((filterFrozen === 'true') !== isFrozen) continue
                }
                if (filterSoulbound !== null && filterSoulbound !== undefined) {
                  if ((filterSoulbound === 'true') !== isSoulbound) continue
                }
                if (filterOwner && owner.toLowerCase() !== filterOwner) continue

                tokens.push({
                  tokenId,
                  campaignId: camp.campaign_id,
                  campaignTitle: camp.title,
                  owner,
                  editionNumber,
                  tokenURI,
                  isFrozen,
                  isSoulbound,
                  chainId,
                  chainName: camp.chain_name || 'BlockDAG',
                  contractVersion: version
                })
              } catch (e) {
                // Token might not exist or be burned
                logger.debug(`[admin/tokens] Error fetching token ${tokenId}: ${e}`)
              }
            }
          } catch (e) {
            logger.debug(`[admin/tokens] Error fetching editions for campaign ${camp.campaign_id}: ${e}`)
          }
        }
      } catch (e) {
        logger.error(`[admin/tokens] Error querying chain ${chainId}: ${e}`)
      }
    }

    // Sort by tokenId descending (newest first)
    tokens.sort((a, b) => b.tokenId - a.tokenId)

    return NextResponse.json({ tokens })

  } catch (e: any) {
    logger.error('[admin/tokens] Error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
