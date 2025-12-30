import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getRelayerSigner, PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'
import { ipfsToHttp } from '@/lib/ipfs'
import { uploadJson } from '@/lib/storacha'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/campaign-updates/[id]
 * Get a specific campaign update
 */
export async function GET(_req: NextRequest, context: { params: { id: string } }) {
  try {
    const { id } = context.params
    if (!id) {
      return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('campaign_updates')
      .select('*, submissions(title, image_uri, category, goal, story, metadata_uri)')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: 'FETCH_FAILED', details: e?.message }, { status: 500 })
  }
}

/**
 * PATCH /api/campaign-updates/[id]
 * Admin: Approve or reject an update
 * When approved, triggers on-chain metadata update for Living NFT
 */
export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  try {
    const { id } = context.params
    if (!id) {
      return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })
    }

    // Admin auth check
    const secretHdr = req.headers.get('x-admin-secret')
    const isSecretOk = !!secretHdr && process.env.ADMIN_SECRET && secretHdr === process.env.ADMIN_SECRET

    let adminUid: string | null = null
    if (!isSecretOk) {
      const auth = req.headers.get('authorization') || ''
      const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
      if (token) {
        const { data: userData } = await supabaseAdmin.auth.getUser(token)
        adminUid = userData?.user?.id || null
        if (adminUid) {
          const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', adminUid).single()
          if (!['admin', 'super_admin'].includes(profile?.role || '')) {
            return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
          }
        } else {
          return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
        }
      } else {
        return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
      }
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
    }

    const { action, reviewer_notes, new_metadata_uri } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'INVALID_ACTION', details: 'action must be "approve" or "reject"' }, { status: 400 })
    }

    // Get the update with full submission data
    const { data: update, error: fetchError } = await supabaseAdmin
      .from('campaign_updates')
      .select('*, submissions(campaign_id, metadata_uri, title, story, category, goal, image_uri)')
      .eq('id', id)
      .single()

    if (fetchError || !update) {
      return NextResponse.json({ error: 'UPDATE_NOT_FOUND' }, { status: 404 })
    }

    if (update.status !== 'pending') {
      return NextResponse.json({ error: 'ALREADY_PROCESSED', details: `Update already ${update.status}` }, { status: 400 })
    }

    const campaignId = update.campaign_id || update.submissions?.campaign_id
    if (!campaignId && action === 'approve') {
      return NextResponse.json({ error: 'NO_CAMPAIGN_ID', details: 'Cannot update NFT without campaign ID' }, { status: 400 })
    }

    let txHash: string | null = null
    let metadataUri = new_metadata_uri

    // If approving, generate new metadata and update on-chain
    if (action === 'approve' && campaignId) {
      try {
        // Build the update content section with cleaner formatting
        const updateSections: string[] = []
        const updateDate = new Date().toLocaleDateString('en-US', { 
          year: 'numeric', month: 'long', day: 'numeric' 
        })
        
        // Header
        if (update.title) {
          updateSections.push(`━━━ ${update.title.toUpperCase()} ━━━`)
        } else {
          updateSections.push(`━━━ UPDATE: ${updateDate.toUpperCase()} ━━━`)
        }
        
        if (update.story_update) {
          updateSections.push(`▸ CURRENT SITUATION\n${update.story_update}`)
        }
        if (update.funds_utilization) {
          updateSections.push(`▸ FUNDS UTILIZED\n${update.funds_utilization}`)
        }
        if (update.benefits) {
          updateSections.push(`▸ IMPACT & BENEFITS\n${update.benefits}`)
        }
        if (update.still_needed) {
          updateSections.push(`▸ STILL NEEDED\n${update.still_needed}`)
        }
        
        // Add media gallery link hint
        const hasMedia = update.media_uris && Array.isArray(update.media_uris) && update.media_uris.length > 0
        if (hasMedia) {
          updateSections.push(`▸ MEDIA: ${update.media_uris.length} new photo(s)/video(s) - see full gallery on website`)
        }
        
        const updateContent = updateSections.join('\n\n')

        // Fetch existing metadata if available
        let existingMetadata: any = {}
        const existingUri = update.submissions?.metadata_uri
        if (existingUri) {
          try {
            const httpUrl = ipfsToHttp(existingUri)
            const res = await fetch(httpUrl, { cache: 'no-store' })
            if (res.ok) {
              existingMetadata = await res.json()
            }
          } catch (e) {
            logger.warn('[campaign-updates] Could not fetch existing metadata:', e)
          }
        }

        // Build new metadata with update appended to description
        const originalDescription = existingMetadata.description || update.submissions?.story || ''
        
        // Clean separator between original and updates
        const updateHeader = '\n\n════════════════════════════════════════\n📢 LIVING NFT UPDATES\n════════════════════════════════════════\n\n'
        const updatedDescription = originalDescription + updateHeader + updateContent

        // Collect all media (original + new)
        const mediaUris: string[] = []
        if (update.media_uris && Array.isArray(update.media_uris)) {
          mediaUris.push(...update.media_uris)
        }

        // Build external URL pointing to story page with full media gallery
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vetshelpingvets.life'
        const storyUrl = `${siteUrl}/story/${update.submission_id}`

        // Count existing updates
        const existingUpdatesCount = existingMetadata.attributes?.find((a: any) => a.trait_type === 'updates_count')?.value || 0

        // Build new metadata object
        const newMetadata = {
          name: existingMetadata.name || update.submissions?.title || 'Fundraiser NFT',
          description: updatedDescription,
          image: existingMetadata.image || update.submissions?.image_uri,
          external_url: storyUrl, // Link to full story page with media gallery
          attributes: [
            // Keep original attributes but filter out updates_count to avoid duplicates
            ...(existingMetadata.attributes || []).filter((a: any) => 
              a.trait_type !== 'last_updated' && a.trait_type !== 'updates_count'
            ),
            { trait_type: 'last_updated', value: updateDate },
            { trait_type: 'updates_count', value: existingUpdatesCount + 1 }
          ],
          // Store update media URIs for the story page to display
          ...(mediaUris.length > 0 && { update_media: mediaUris }),
          // Preserve animation if it exists
          ...(existingMetadata.animation_url && { animation_url: existingMetadata.animation_url })
        }

        // Clean undefined values
        Object.keys(newMetadata).forEach(key => {
          if (newMetadata[key as keyof typeof newMetadata] === undefined) {
            delete newMetadata[key as keyof typeof newMetadata]
          }
        })

        logger.blockchain('[campaign-update] Generating new metadata for campaign', campaignId)

        // Upload new metadata to IPFS
        const uploadResult = await uploadJson(newMetadata)
        metadataUri = uploadResult.uri

        logger.blockchain('[campaign-update] New metadata uploaded:', metadataUri)

        // Update on-chain
        const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()
        const signer = getRelayerSigner()
        const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, signer)

        const tx = await contract.updateCampaignMetadata(campaignId, metadataUri)
        const receipt = await tx.wait()
        txHash = receipt?.hash || tx.hash

        logger.blockchain(`[campaign-update] Updated campaign ${campaignId} metadata on-chain, tx: ${txHash}`)

        // Also update the submission's metadata_uri in Supabase
        await supabaseAdmin
          .from('submissions')
          .update({ metadata_uri: metadataUri })
          .eq('id', update.submission_id)

      } catch (e: any) {
        logger.error('[campaign-updates] Metadata update failed:', e)
        return NextResponse.json({ error: 'UPDATE_FAILED', details: e?.message }, { status: 500 })
      }
    }

    // Update the database record
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('campaign_updates')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewer_notes: reviewer_notes || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUid || null
      })
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) {
      return NextResponse.json({ error: 'UPDATE_FAILED', details: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      update: updated,
      txHash,
      metadataUri
    })
  } catch (e: any) {
    logger.error('[campaign-updates] PATCH error:', e)
    return NextResponse.json({ error: 'PROCESS_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}

/**
 * DELETE /api/campaign-updates/[id]
 * Admin: Delete a campaign update
 */
export async function DELETE(req: NextRequest, context: { params: { id: string } }) {
  try {
    const { id } = context.params
    if (!id) {
      return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })
    }

    // Admin auth check
    const secretHdr = req.headers.get('x-admin-secret')
    const isSecretOk = !!secretHdr && process.env.ADMIN_SECRET && secretHdr === process.env.ADMIN_SECRET

    if (!isSecretOk) {
      const auth = req.headers.get('authorization') || ''
      const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
      if (token) {
        const { data: userData } = await supabaseAdmin.auth.getUser(token)
        const adminUid = userData?.user?.id || null
        if (adminUid) {
          const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', adminUid).single()
          if (!['admin', 'super_admin'].includes(profile?.role || '')) {
            return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
          }
        } else {
          return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
        }
      } else {
        return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
      }
    }

    // Delete the update
    const { error: deleteError } = await supabaseAdmin
      .from('campaign_updates')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json({ error: 'DELETE_FAILED', details: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, deleted: id })
  } catch (e: any) {
    logger.error('[campaign-updates] DELETE error:', e)
    return NextResponse.json({ error: 'DELETE_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}
