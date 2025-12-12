import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyWebhookSignature, parseVerificationStatus } from '@/lib/didit'

export const runtime = 'nodejs'

/**
 * Didit Webhook Handler
 * Receives verification status updates from Didit
 */
export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('x-signature') || ''
    const rawBody = await req.text()
    
    console.log('[Didit Webhook] Received webhook')
    
    // Verify signature (optional in dev, required in prod)
    const isProduction = process.env.NODE_ENV === 'production'
    if (isProduction && !verifyWebhookSignature(rawBody, signature)) {
      console.error('[Didit Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(rawBody)
    console.log('[Didit Webhook] Payload:', JSON.stringify(payload, null, 2))

    const {
      session_id,
      status,
      vendor_data, // Our submission ID
      features,    // Verification results
    } = payload

    if (!session_id || !vendor_data) {
      console.error('[Didit Webhook] Missing required fields')
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Parse status to our format
    const { status: verificationStatus, passed } = parseVerificationStatus(status)
    
    // Extract verification details from features
    const idVerification = features?.kyc?.id_document
    const livenessCheck = features?.kyc?.liveness
    const faceMatch = features?.kyc?.face_matching
    
    // Build update payload
    const updateData: Record<string, any> = {
      didit_session_id: session_id,
      didit_status: status,
      verification_status: verificationStatus,
      didit_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Add specific verification results if available
    if (idVerification) {
      updateData.didit_id_verified = idVerification.status === 'Approved'
      updateData.didit_extracted_data = {
        ...updateData.didit_extracted_data,
        id_document: idVerification,
      }
    }

    if (livenessCheck) {
      updateData.didit_liveness_passed = livenessCheck.status === 'Approved'
    }

    if (faceMatch) {
      updateData.didit_face_match = faceMatch.status === 'Approved'
    }

    // Store full features response
    if (features) {
      updateData.didit_features = features
    }

    console.log('[Didit Webhook] Updating submission:', vendor_data, 'Status:', verificationStatus)

    // Update submission in Supabase
    const { error: updateError } = await supabaseAdmin
      .from('submissions')
      .update(updateData)
      .eq('id', vendor_data)

    if (updateError) {
      console.error('[Didit Webhook] Update error:', updateError)
      // Don't fail the webhook - Didit will retry
    }

    // If verification passed, update verification_status to verified
    if (passed) {
      console.log('[Didit Webhook] Verification passed for:', vendor_data)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Didit Webhook] Error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

// Allow GET for webhook verification (some services ping the endpoint)
export async function GET() {
  return NextResponse.json({ status: 'Didit webhook endpoint active' })
}
