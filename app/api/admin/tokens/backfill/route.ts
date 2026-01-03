import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/tokens/backfill
 * Backfill the tokens cache table from existing purchases data
 * This is a one-time operation to populate tokens for NFTs minted before caching was implemented
 */
export async function POST(req: NextRequest) {
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

    logger.info('[backfill] Starting tokens table backfill...')

    // Get all purchases with their submission data
    const { data: purchases, error: purchaseError } = await supabaseAdmin
      .from('purchases')
      .select(`
        id,
        token_id,
        campaign_id,
        buyer_wallet,
        tx_hash,
        chain_id,
        quantity,
        created_at
      `)
      .order('created_at', { ascending: true })

    if (purchaseError) {
      logger.error('[backfill] Failed to fetch purchases:', purchaseError)
      return NextResponse.json({ error: 'Failed to fetch purchases', details: purchaseError.message }, { status: 500 })
    }

    logger.info(`[backfill] Found ${purchases?.length || 0} purchases to process`)

    // Get all submissions for contract info
    const { data: submissions, error: subError } = await supabaseAdmin
      .from('submissions')
      .select('campaign_id, contract_address, contract_version, chain_id, image_uri')
      .not('campaign_id', 'is', null)

    if (subError) {
      logger.error('[backfill] Failed to fetch submissions:', subError)
      return NextResponse.json({ error: 'Failed to fetch submissions', details: subError.message }, { status: 500 })
    }

    // Create lookup map for submissions by campaign_id
    const submissionMap = new Map(
      submissions?.map(s => [s.campaign_id, s]) || []
    )

    // Process each purchase and create token records
    let inserted = 0
    let skipped = 0
    let errors = 0

    for (const purchase of purchases || []) {
      try {
        // Get submission info for this campaign
        const submission = submissionMap.get(purchase.campaign_id)
        
        // Determine chain_id - use purchase chain_id, or submission, or default to 1043 (BlockDAG)
        const chainId = purchase.chain_id || submission?.chain_id || 1043
        const contractAddress = submission?.contract_address || ''
        const contractVersion = submission?.contract_version || 'v5'
        
        // For purchases with quantity > 1, we need to create multiple token records
        // Token IDs are sequential starting from the purchase token_id
        const quantity = purchase.quantity || 1
        
        for (let i = 0; i < quantity; i++) {
          const tokenId = (purchase.token_id || 0) + i
          
          // Skip if token_id is 0 or invalid
          if (!tokenId || tokenId <= 0) {
            skipped++
            continue
          }

          // Upsert token record
          const { error: upsertError } = await supabaseAdmin
            .from('tokens')
            .upsert({
              token_id: tokenId,
              campaign_id: purchase.campaign_id,
              chain_id: chainId,
              contract_address: contractAddress,
              contract_version: contractVersion,
              owner_wallet: (purchase.buyer_wallet || '').toLowerCase(),
              edition_number: tokenId, // Edition number typically matches token ID in V5
              total_editions: null, // Unknown without RPC call
              is_frozen: false,
              is_soulbound: false,
              metadata_uri: submission?.image_uri || '',
              mint_tx_hash: purchase.tx_hash || null,
              minted_at: purchase.created_at
            }, {
              onConflict: 'token_id,chain_id,contract_address',
              ignoreDuplicates: true
            })

          if (upsertError) {
            logger.warn(`[backfill] Failed to upsert token ${tokenId}:`, upsertError)
            errors++
          } else {
            inserted++
          }
        }
      } catch (e: any) {
        logger.error(`[backfill] Error processing purchase ${purchase.id}:`, e)
        errors++
      }
    }

    logger.info(`[backfill] Complete: ${inserted} inserted, ${skipped} skipped, ${errors} errors`)

    return NextResponse.json({
      success: true,
      message: `Backfill complete`,
      stats: {
        purchases: purchases?.length || 0,
        tokensInserted: inserted,
        skipped,
        errors
      }
    })

  } catch (e: any) {
    logger.error('[backfill] Fatal error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
