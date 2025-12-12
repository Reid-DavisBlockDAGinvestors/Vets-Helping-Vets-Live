import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createPersonaInquiry, resumePersonaInquiry, getPersonaInquiry } from '@/lib/persona'

export const dynamic = 'force-dynamic'

/**
 * POST /api/verification/persona
 * Create or resume a Persona verification session
 * Supports two modes:
 * 1. With submissionId - links to existing submission
 * 2. Without submissionId - pre-submission verification using email as reference
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { submissionId, email, name, phone, action, existingInquiryId } = body

    // MODE 1: Pre-submission verification (verify before submitting)
    if (!submissionId) {
      if (!email) {
        return NextResponse.json({ error: 'Email required for verification' }, { status: 400 })
      }

      // If resuming an existing inquiry
      if (action === 'resume' && existingInquiryId) {
        const resumeResult = await resumePersonaInquiry(existingInquiryId)
        
        if (!resumeResult.success) {
          return NextResponse.json({ error: resumeResult.error }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          inquiryId: existingInquiryId,
          sessionToken: resumeResult.sessionToken,
          status: 'pending'
        })
      }

      // Create a new inquiry with email as reference
      console.log('[verification/persona] Creating pre-submission inquiry for email:', email)
      const createResult = await createPersonaInquiry({
        referenceId: `pre_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
        email,
        name,
        phone
      })

      console.log('[verification/persona] Create result:', { 
        success: createResult.success, 
        inquiryId: createResult.inquiryId,
        hasSessionToken: !!createResult.sessionToken,
        error: createResult.error 
      })

      if (!createResult.success) {
        return NextResponse.json({ error: createResult.error }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        inquiryId: createResult.inquiryId,
        sessionToken: createResult.sessionToken,
        status: 'created'
      })
    }

    // MODE 2: Post-submission verification (original flow)
    // Get the submission
    const { data: submission, error: fetchError } = await supabaseAdmin
      .from('submissions')
      .select('id, persona_inquiry_id, persona_status, creator_email, creator_name, creator_phone')
      .eq('id', submissionId)
      .single()

    if (fetchError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    // If resuming an existing inquiry
    if (action === 'resume' && submission.persona_inquiry_id) {
      const resumeResult = await resumePersonaInquiry(submission.persona_inquiry_id)
      
      if (!resumeResult.success) {
        return NextResponse.json({ error: resumeResult.error }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        inquiryId: submission.persona_inquiry_id,
        sessionToken: resumeResult.sessionToken,
        status: submission.persona_status
      })
    }

    // Check if there's already an inquiry in progress
    if (submission.persona_inquiry_id && 
        ['created', 'pending'].includes(submission.persona_status || '')) {
      // Resume existing
      const resumeResult = await resumePersonaInquiry(submission.persona_inquiry_id)
      
      if (resumeResult.success) {
        return NextResponse.json({
          success: true,
          inquiryId: submission.persona_inquiry_id,
          sessionToken: resumeResult.sessionToken,
          status: submission.persona_status,
          resumed: true
        })
      }
      // If resume failed, create a new inquiry
    }

    // Create a new inquiry
    const createResult = await createPersonaInquiry({
      referenceId: submissionId,
      email: email || submission.creator_email,
      name: name || submission.creator_name,
      phone: phone || submission.creator_phone
    })

    if (!createResult.success) {
      return NextResponse.json({ error: createResult.error }, { status: 500 })
    }

    // Update submission with inquiry ID
    await supabaseAdmin
      .from('submissions')
      .update({
        persona_inquiry_id: createResult.inquiryId,
        persona_status: 'created',
        persona_reference_id: submissionId
      })
      .eq('id', submissionId)

    return NextResponse.json({
      success: true,
      inquiryId: createResult.inquiryId,
      sessionToken: createResult.sessionToken,
      status: 'created'
    })

  } catch (error: any) {
    console.error('[verification/persona] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/verification/persona?submissionId=xxx
 * Get verification status for a submission
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const submissionId = searchParams.get('submissionId')

    if (!submissionId) {
      return NextResponse.json({ error: 'Submission ID required' }, { status: 400 })
    }

    // Get the submission
    const { data: submission, error: fetchError } = await supabaseAdmin
      .from('submissions')
      .select(`
        id, 
        persona_inquiry_id, 
        persona_status, 
        persona_face_match,
        persona_doc_verified,
        persona_extracted_data,
        persona_verified_at,
        verification_status
      `)
      .eq('id', submissionId)
      .single()

    if (fetchError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    // If we have an inquiry, optionally refresh status from Persona
    if (submission.persona_inquiry_id && 
        ['created', 'pending'].includes(submission.persona_status || '')) {
      const inquiryResult = await getPersonaInquiry(submission.persona_inquiry_id)
      
      if (inquiryResult.success && inquiryResult.inquiry) {
        const newStatus = inquiryResult.inquiry.attributes.status
        
        // Update if status changed
        if (newStatus !== submission.persona_status) {
          await supabaseAdmin
            .from('submissions')
            .update({ persona_status: newStatus })
            .eq('id', submissionId)
          
          submission.persona_status = newStatus
        }
      }
    }

    return NextResponse.json({
      success: true,
      inquiryId: submission.persona_inquiry_id,
      personaStatus: submission.persona_status,
      faceMatch: submission.persona_face_match,
      docVerified: submission.persona_doc_verified,
      extractedData: submission.persona_extracted_data,
      verifiedAt: submission.persona_verified_at,
      overallStatus: submission.verification_status
    })

  } catch (error: any) {
    console.error('[verification/persona] GET Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
