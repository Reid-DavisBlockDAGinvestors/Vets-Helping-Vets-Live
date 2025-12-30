import { NextRequest, NextResponse } from 'next/server'
import { createVerificationSession } from '@/lib/didit'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

/**
 * Create a Didit verification session
 * POST /api/didit/session
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { submissionId, email, phone, vendorData } = body

    // Need either submissionId or email
    if (!submissionId && !email) {
      return NextResponse.json({ error: 'Missing submissionId or email' }, { status: 400 })
    }

    let sessionEmail = email
    let sessionPhone = phone

    // If we have a submissionId, fetch submission details
    if (submissionId) {
      const { data: submission, error: fetchError } = await supabaseAdmin
        .from('submissions')
        .select('id, creator_email, creator_phone, didit_session_id')
        .eq('id', submissionId)
        .single()

      if (fetchError || !submission) {
        return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
      }

      // Check if there's already an active session
      if (submission.didit_session_id) {
        logger.debug('[Didit Session] Submission already has session, creating new one')
      }

      sessionEmail = email || submission.creator_email
      sessionPhone = phone || submission.creator_phone
    }

    // Create Didit verification session
    // Use submissionId as vendorData if available, otherwise use email
    const identifier = submissionId || vendorData || email
    
    const result = await createVerificationSession({
      vendorData: identifier,
      email: sessionEmail,
      phone: sessionPhone,
      metadata: {
        submission_id: submissionId || undefined,
        email: sessionEmail,
        source: 'vets-helping-vets',
      },
    })

    if (!result.success || !result.session) {
      logger.error('[Didit Session] Failed to create session:', result.error)
      return NextResponse.json({ error: result.error || 'Failed to create session' }, { status: 500 })
    }

    // Store session ID in submission if we have one
    if (submissionId) {
      const { error: updateError } = await supabaseAdmin
        .from('submissions')
        .update({
          didit_session_id: result.session.session_id,
          didit_status: result.session.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', submissionId)

      if (updateError) {
        logger.error('[Didit Session] Failed to update submission:', updateError)
      }
    }

    return NextResponse.json({
      success: true,
      sessionId: result.session.session_id,
      verificationUrl: result.session.url,
      status: result.session.status,
    })
  } catch (error: any) {
    logger.error('[Didit Session] Error:', error)
    return NextResponse.json({ error: 'Session creation failed' }, { status: 500 })
  }
}

/**
 * Get session status
 * GET /api/didit/session?sessionId=xxx
 */
export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('sessionId')
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const { getSession } = await import('@/lib/didit')
    const result = await getSession(sessionId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      session: result.session,
    })
  } catch (error: any) {
    logger.error('[Didit Session] Get error:', error)
    return NextResponse.json({ error: 'Failed to get session' }, { status: 500 })
  }
}
