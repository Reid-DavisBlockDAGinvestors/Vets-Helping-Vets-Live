import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/campaign-updates
 * Submit a new campaign update request (creator portal)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
    }

    const {
      submission_id,
      creator_wallet,
      title,
      story_update,
      funds_utilization,
      benefits,
      still_needed,
      new_image_uri,
      media_uris
    } = body

    // Validate required fields
    if (!submission_id) {
      return NextResponse.json({ error: 'MISSING_SUBMISSION_ID' }, { status: 400 })
    }
    if (!creator_wallet || !ethers.isAddress(creator_wallet)) {
      return NextResponse.json({ error: 'INVALID_WALLET' }, { status: 400 })
    }
    // Allow updates with text content OR media
    const hasMedia = Array.isArray(media_uris) && media_uris.length > 0
    if (!story_update && !funds_utilization && !benefits && !still_needed && !hasMedia) {
      return NextResponse.json({ error: 'NO_UPDATE_CONTENT' }, { status: 400 })
    }

    // Verify the wallet owns this submission
    const { data: submission, error: subError } = await supabaseAdmin
      .from('submissions')
      .select('id, campaign_id, creator_wallet, creator_email, status')
      .eq('id', submission_id)
      .single()

    if (subError || !submission) {
      return NextResponse.json({ error: 'SUBMISSION_NOT_FOUND' }, { status: 404 })
    }

    // Verify ownership (case-insensitive)
    if (submission.creator_wallet?.toLowerCase() !== creator_wallet.toLowerCase()) {
      return NextResponse.json({ error: 'NOT_AUTHORIZED' }, { status: 403 })
    }

    // Check submission is approved/minted (has a campaign on-chain)
    const validStatuses = ['approved', 'minted']
    if (!validStatuses.includes(submission.status) || !submission.campaign_id) {
      return NextResponse.json({ error: 'CAMPAIGN_NOT_ACTIVE', details: 'Only active campaigns can be updated' }, { status: 400 })
    }

    // Create the update request
    const { data: update, error: insertError } = await supabaseAdmin
      .from('campaign_updates')
      .insert({
        submission_id,
        campaign_id: submission.campaign_id,
        creator_wallet: creator_wallet.toLowerCase(),
        creator_email: submission.creator_email,
        title: title || null,
        story_update: story_update || null,
        funds_utilization: funds_utilization || null,
        benefits: benefits || null,
        still_needed: still_needed || null,
        new_image_uri: new_image_uri || null,
        media_uris: hasMedia ? media_uris : null,
        status: 'pending'
      })
      .select('*')
      .single()

    if (insertError) {
      logger.error('[campaign-updates] Insert error:', insertError)
      return NextResponse.json({ error: 'INSERT_FAILED', details: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      id: update.id,
      status: update.status,
      message: 'Update submitted for admin review'
    })
  } catch (e: any) {
    logger.error('[campaign-updates] POST error:', e)
    return NextResponse.json({ error: 'SUBMIT_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}

/**
 * GET /api/campaign-updates
 * List campaign updates (for admins, or filtered by creator wallet)
 */
export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get('wallet')
    const submissionId = req.nextUrl.searchParams.get('submission_id')
    const status = req.nextUrl.searchParams.get('status')
    const isAdmin = req.nextUrl.searchParams.get('admin') === 'true'

    // Admin auth check for listing all
    if (isAdmin) {
      const secretHdr = req.headers.get('x-admin-secret')
      const isSecretOk = !!secretHdr && process.env.ADMIN_SECRET && secretHdr === process.env.ADMIN_SECRET

      if (!isSecretOk) {
        // Try bearer token auth
        const auth = req.headers.get('authorization') || ''
        const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
        if (token) {
          const { data: userData } = await supabaseAdmin.auth.getUser(token)
          const uid = userData?.user?.id
          if (uid) {
            const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single()
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
    }

    let query = supabaseAdmin
      .from('campaign_updates')
      .select('*, submissions(title, image_uri, category, goal)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (wallet && ethers.isAddress(wallet)) {
      query = query.ilike('creator_wallet', wallet)
    }
    if (submissionId) {
      query = query.eq('submission_id', submissionId)
    }
    if (status) {
      query = query.eq('status', status)
    }
    
    // Non-admin users can only see approved updates (unless they own the wallet)
    if (!isAdmin && !wallet) {
      query = query.eq('status', 'approved')
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: 'QUERY_FAILED', details: error.message }, { status: 500 })
    }

    return NextResponse.json({
      count: data?.length || 0,
      updates: data || []
    })
  } catch (e: any) {
    logger.error('[campaign-updates] GET error:', e)
    return NextResponse.json({ error: 'FETCH_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}
