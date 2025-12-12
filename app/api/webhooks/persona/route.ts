import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyPersonaWebhook, parsePersonaVerificationResult } from '@/lib/persona'
import { sendEmail } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/persona
 * Receives webhook events from Persona when verification status changes
 * 
 * Events we care about:
 * - inquiry.completed: Verification finished successfully
 * - inquiry.failed: Verification failed
 * - inquiry.expired: Session expired
 * - inquiry.transitioned: Status changed (pending -> needs_review, etc.)
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('persona-signature') || ''
    
    // Verify webhook signature (skip in development if no secret)
    const webhookSecret = process.env.PERSONA_WEBHOOK_SECRET
    if (webhookSecret) {
      const isValid = verifyPersonaWebhook(rawBody, signature, webhookSecret)
      if (!isValid) {
        console.error('[webhook/persona] Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const payload = JSON.parse(rawBody)
    const eventType = payload.data?.attributes?.name || 'unknown'
    const eventPayload = payload.data?.attributes?.payload || payload

    console.log('[webhook/persona] Received event:', eventType)

    // Handle different event types
    if (eventType.startsWith('inquiry.')) {
      await handleInquiryEvent(eventType, eventPayload)
    }

    return NextResponse.json({ received: true })

  } catch (error: any) {
    console.error('[webhook/persona] Error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handleInquiryEvent(eventType: string, payload: any) {
  const result = parsePersonaVerificationResult(payload)
  
  console.log('[webhook/persona] Parsed result:', {
    inquiryId: result.inquiryId,
    referenceId: result.referenceId,
    status: result.status,
    faceMatch: result.faceMatch,
    docVerified: result.docVerified
  })

  // Find the submission by inquiry ID or reference ID
  const { data: submission, error: fetchError } = await supabaseAdmin
    .from('submissions')
    .select('id, creator_email, creator_name, title')
    .or(`persona_inquiry_id.eq.${result.inquiryId},persona_reference_id.eq.${result.referenceId}`)
    .maybeSingle()

  if (fetchError || !submission) {
    console.error('[webhook/persona] Submission not found for inquiry:', result.inquiryId)
    return
  }

  // Determine overall verification status
  let verificationStatus = 'pending'
  if (result.status === 'completed') {
    if (result.faceMatch && result.docVerified) {
      verificationStatus = 'verified'
    } else {
      verificationStatus = 'needs_review'
    }
  } else if (result.status === 'failed') {
    verificationStatus = 'rejected'
  } else if (result.status === 'needs_review') {
    verificationStatus = 'needs_review'
  }

  // Update the submission
  const updatePayload: Record<string, any> = {
    persona_status: result.status,
    persona_result: payload,
    persona_face_match: result.faceMatch,
    persona_doc_verified: result.docVerified,
    persona_extracted_data: result.extractedData,
    verification_status: verificationStatus
  }

  if (result.status === 'completed') {
    updatePayload.persona_verified_at = new Date().toISOString()
    updatePayload.verified_at = new Date().toISOString()
  }

  await supabaseAdmin
    .from('submissions')
    .update(updatePayload)
    .eq('id', submission.id)

  console.log('[webhook/persona] Updated submission:', submission.id, 'status:', verificationStatus)

  // Send notification email based on result
  if (submission.creator_email) {
    try {
      if (verificationStatus === 'verified') {
        await sendEmail({
          to: submission.creator_email,
          subject: '✓ Identity Verified - PatriotPledge',
          html: `
            <h2>Identity Verification Complete</h2>
            <p>Hi ${submission.creator_name || 'there'},</p>
            <p>Great news! Your identity has been verified for your campaign "${submission.title}".</p>
            <p>Your campaign is now one step closer to being approved. Our team will complete the final review shortly.</p>
            <p>Thank you for helping build trust in the PatriotPledge community!</p>
            <p>- The PatriotPledge Team</p>
          `
        })
      } else if (verificationStatus === 'rejected') {
        await sendEmail({
          to: submission.creator_email,
          subject: 'Identity Verification Issue - PatriotPledge',
          html: `
            <h2>Verification Needs Attention</h2>
            <p>Hi ${submission.creator_name || 'there'},</p>
            <p>We encountered an issue verifying your identity for the campaign "${submission.title}".</p>
            <p>This could happen if:</p>
            <ul>
              <li>The ID photo was blurry or cut off</li>
              <li>The selfie didn't match the ID photo</li>
              <li>The ID appeared expired or invalid</li>
            </ul>
            <p>Please visit your dashboard to try the verification again with clearer photos.</p>
            <p>If you continue to have issues, please contact our support team.</p>
            <p>- The PatriotPledge Team</p>
          `
        })
      } else if (verificationStatus === 'needs_review') {
        await sendEmail({
          to: submission.creator_email,
          subject: 'Verification Under Review - PatriotPledge',
          html: `
            <h2>Manual Review in Progress</h2>
            <p>Hi ${submission.creator_name || 'there'},</p>
            <p>Your identity verification for "${submission.title}" requires a quick manual review by our team.</p>
            <p>This usually happens when:</p>
            <ul>
              <li>Document quality needs human verification</li>
              <li>Additional checks are required</li>
            </ul>
            <p>We'll notify you once the review is complete, typically within 24-48 hours.</p>
            <p>- The PatriotPledge Team</p>
          `
        })
      }
    } catch (emailError) {
      console.error('[webhook/persona] Failed to send email:', emailError)
    }
  }
}

// Respond to Persona verification check
export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    status: 'Persona webhook endpoint active',
    configured: !!process.env.PERSONA_WEBHOOK_SECRET
  })
}
