import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60 // Allow up to 60 seconds for this job

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'

interface VerificationResult {
  submissionId: string
  title: string
  status: 'fixed' | 'orphan' | 'error' | 'already_valid'
  details: string
  campaignId?: number
}

/**
 * Background verification job for campaign integrity
 * - Finds submissions marked as 'minted' but with invalid/missing campaign_id
 * - Scans on-chain to find matching campaigns by metadata URI
 * - Updates database records to fix mismatches
 * 
 * Can be triggered:
 * - Via cron (e.g., Vercel Cron, external scheduler)
 * - Manually from admin panel
 * - Via webhook after deployments
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  const results: VerificationResult[] = []
  
  try {
    // Optional auth check - allow cron secret or admin token
    const cronSecret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
    const authHeader = req.headers.get('authorization')
    
    const isValidCron = cronSecret === process.env.CRON_SECRET
    const isAdmin = authHeader?.startsWith('Bearer ') // Basic check, could be enhanced
    
    if (!isValidCron && !isAdmin && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.debug('[verify-campaigns] Starting background verification job')

    // Step 1: Find all submissions that claim to be minted
    const { data: mintedSubmissions, error: fetchError } = await supabaseAdmin
      .from('submissions')
      .select('id, title, campaign_id, metadata_uri, status, contract_address')
      .eq('status', 'minted')
      .order('created_at', { ascending: false })

    if (fetchError) {
      logger.error('[verify-campaigns] Failed to fetch submissions:', fetchError)
      return NextResponse.json({ error: 'Database error', details: fetchError.message }, { status: 500 })
    }

    if (!mintedSubmissions || mintedSubmissions.length === 0) {
      logger.debug('[verify-campaigns] No minted submissions found')
      return NextResponse.json({ 
        success: true, 
        message: 'No minted submissions to verify',
        results: [],
        duration: Date.now() - startTime
      })
    }

    logger.debug(`[verify-campaigns] Found ${mintedSubmissions.length} minted submissions to verify`)

    // Step 2: Get on-chain data
    const provider = getProvider()
    const contract = new ethers.Contract(CONTRACT_ADDRESS, PatriotPledgeV5ABI, provider)
    
    let totalCampaigns: number
    try {
      totalCampaigns = Number(await contract.totalCampaigns())
      logger.debug(`[verify-campaigns] Total on-chain campaigns: ${totalCampaigns}`)
    } catch (e: any) {
      logger.error('[verify-campaigns] Failed to get totalCampaigns:', e.message)
      return NextResponse.json({ error: 'Blockchain error', details: e.message }, { status: 500 })
    }

    // Step 3: Build a map of on-chain campaigns by metadata URI
    const onChainByUri: Map<string, { campaignId: number; active: boolean; closed: boolean }> = new Map()
    
    for (let i = 0; i < totalCampaigns; i++) {
      try {
        const camp = await contract.getCampaign(BigInt(i))
        const baseURI = camp.baseURI ?? camp[1]
        if (baseURI) {
          onChainByUri.set(baseURI, {
            campaignId: i,
            active: Boolean(camp.active ?? camp[8]),
            closed: Boolean(camp.closed ?? camp[9])
          })
        }
      } catch (e) {
        // Campaign might not exist at this index
        continue
      }
    }

    logger.debug(`[verify-campaigns] Indexed ${onChainByUri.size} on-chain campaigns`)

    // Step 4: Verify each submission
    for (const sub of mintedSubmissions) {
      try {
        const metadataUri = sub.metadata_uri
        
        if (!metadataUri) {
          results.push({
            submissionId: sub.id,
            title: sub.title || 'Untitled',
            status: 'error',
            details: 'No metadata_uri in submission'
          })
          continue
        }

        // Check if we have a matching on-chain campaign
        const onChainMatch = onChainByUri.get(metadataUri)
        
        if (!onChainMatch) {
          // Campaign not found on-chain - this is an orphan
          results.push({
            submissionId: sub.id,
            title: sub.title || 'Untitled',
            status: 'orphan',
            details: 'No matching campaign found on-chain'
          })
          continue
        }

        // Check if the campaign_id matches
        if (sub.campaign_id === onChainMatch.campaignId) {
          results.push({
            submissionId: sub.id,
            title: sub.title || 'Untitled',
            status: 'already_valid',
            details: `Campaign #${sub.campaign_id} matches on-chain`,
            campaignId: sub.campaign_id
          })
          continue
        }

        // Mismatch found - fix it
        const oldId = sub.campaign_id
        const { error: updateError } = await supabaseAdmin
          .from('submissions')
          .update({ 
            campaign_id: onChainMatch.campaignId,
            contract_address: CONTRACT_ADDRESS
          })
          .eq('id', sub.id)

        if (updateError) {
          results.push({
            submissionId: sub.id,
            title: sub.title || 'Untitled',
            status: 'error',
            details: `Failed to update: ${updateError.message}`
          })
          continue
        }

        results.push({
          submissionId: sub.id,
          title: sub.title || 'Untitled',
          status: 'fixed',
          details: `Updated campaign_id: ${oldId} -> ${onChainMatch.campaignId}`,
          campaignId: onChainMatch.campaignId
        })

        logger.debug(`[verify-campaigns] Fixed submission ${sub.id}: ${oldId} -> ${onChainMatch.campaignId}`)

      } catch (e: any) {
        results.push({
          submissionId: sub.id,
          title: sub.title || 'Untitled',
          status: 'error',
          details: e.message || 'Unknown error'
        })
      }
    }

    // Step 5: Summary
    const summary = {
      total: results.length,
      fixed: results.filter(r => r.status === 'fixed').length,
      orphans: results.filter(r => r.status === 'orphan').length,
      errors: results.filter(r => r.status === 'error').length,
      valid: results.filter(r => r.status === 'already_valid').length
    }

    logger.debug(`[verify-campaigns] Complete: ${summary.fixed} fixed, ${summary.orphans} orphans, ${summary.errors} errors, ${summary.valid} valid`)

    return NextResponse.json({
      success: true,
      summary,
      results,
      duration: Date.now() - startTime,
      onChainCampaigns: totalCampaigns
    })

  } catch (e: any) {
    logger.error('[verify-campaigns] Job failed:', e)
    return NextResponse.json({ 
      error: 'Verification job failed', 
      details: e.message,
      duration: Date.now() - startTime
    }, { status: 500 })
  }
}

// Also support POST for webhook triggers
export async function POST(req: NextRequest) {
  return GET(req)
}
