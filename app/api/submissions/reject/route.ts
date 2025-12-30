import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendEmail } from '@/lib/mailer'
import { logger } from '@/lib/logger'

// POST /api/submissions/reject -> reject a submission with reason and send email
export async function POST(req: NextRequest) {
  try {
    // Require admin auth
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    const { data: userData } = token ? await supabaseAdmin.auth.getUser(token) : { data: null as any }
    const uid = userData?.user?.id
    const { data: profile } = uid ? await supabaseAdmin.from('profiles').select('role').eq('id', uid).single() : { data: null as any }
    if (!['admin', 'super_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
    
    const { id, reason, sendEmail: shouldSendEmail } = body
    if (!id) return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })
    if (!reason?.trim()) return NextResponse.json({ error: 'MISSING_REASON' }, { status: 400 })

    // Get the submission
    const { data: submission, error: fetchError } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !submission) {
      return NextResponse.json({ error: 'SUBMISSION_NOT_FOUND' }, { status: 404 })
    }

    // Update the submission status and add rejection notes
    const { error: updateError } = await supabaseAdmin
      .from('submissions')
      .update({
        status: 'rejected',
        reviewer_notes: reason
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: 'UPDATE_FAILED', details: updateError.message }, { status: 500 })
    }

    // Send rejection email to creator
    let emailSent = false
    if (shouldSendEmail && submission.creator_email) {
      try {
        const creatorName = submission.creator_name || 'there'
        const campaignTitle = submission.title || 'Your Campaign'
        
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #dc2626 0%, #ea580c 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .reason-box { background: #fff; border-left: 4px solid #ea580c; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
    .cta-button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; font-size: 14px; }
    .steps { background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .step { display: flex; align-items: flex-start; margin: 10px 0; }
    .step-num { background: #2563eb; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; margin-right: 12px; flex-shrink: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">Campaign Review Update</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Patriot Pledge</p>
    </div>
    
    <div class="content">
      <p>Hi ${creatorName},</p>
      
      <p>Thank you for submitting your campaign "<strong>${campaignTitle}</strong>" to Patriot Pledge. After careful review, we've determined that some changes are needed before we can approve it.</p>
      
      <div class="reason-box">
        <h3 style="margin: 0 0 10px 0; color: #ea580c;">📝 Reviewer Feedback</h3>
        <p style="margin: 0; white-space: pre-wrap;">${reason}</p>
      </div>
      
      <div class="steps">
        <h3 style="margin: 0 0 15px 0;">How to Get Approved</h3>
        <div class="step">
          <div class="step-num">1</div>
          <div>Review the feedback above and understand what needs to be changed</div>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <div>Make the necessary updates to your campaign</div>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <div>Resubmit your campaign for another review</div>
        </div>
      </div>
      
      <p>We're here to help veterans and their families, and we want your campaign to succeed! If you have any questions about the feedback, please don't hesitate to reach out.</p>
      
      <center>
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://patriotpledgenfts.netlify.app'}/submit?edit=${id}" class="cta-button">
          Edit & Resubmit Your Campaign
        </a>
      </center>
      
      <p style="color: #6b7280; font-size: 14px;">
        <strong>Note:</strong> Your original submission has been saved. You can make edits and resubmit without losing your previous work.
      </p>
    </div>
    
    <div class="footer">
      <p style="margin: 0;">Patriot Pledge - Supporting Those Who Served</p>
      <p style="margin: 5px 0 0 0; font-size: 12px;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>
`

        await sendEmail({
          to: submission.creator_email,
          subject: `Action Required: Updates Needed for "${campaignTitle}"`,
          html: emailHtml
        })
        
        emailSent = true
      } catch (emailErr) {
        logger.error('[Reject] Email send failed:', emailErr)
        // Continue - email failure shouldn't block the rejection
      }
    }

    return NextResponse.json({ 
      success: true, 
      emailSent,
      submissionId: id 
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'REJECTION_ERROR', details: e?.message || String(e) }, { status: 500 })
  }
}
