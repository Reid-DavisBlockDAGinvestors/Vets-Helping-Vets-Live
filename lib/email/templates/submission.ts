/**
 * Submission Email Templates
 */

import { EMAIL_CONFIG } from '../config'
import { wrapEmail } from '../wrapper'
import { sendEmail } from '../sender'
import type { SubmissionConfirmData, CampaignApprovedData, CampaignRejectedData } from '../types'

export async function sendSubmissionConfirmation(data: SubmissionConfirmData) {
  const content = `
    <h1 style="color: #fff; font-size: 24px; margin: 0 0 20px 0;">📝 Submission Received!</h1>
    
    <p style="color: #94a3b8; font-size: 16px; line-height: 1.6;">
      ${data.creatorName ? `Hi ${data.creatorName},` : 'Thank you for your submission.'}
    </p>
    
    <p style="color: #94a3b8; font-size: 16px; line-height: 1.6;">
      Your campaign submission has been received and is pending review by our team.
    </p>
    
    <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h2 style="color: #fff; font-size: 18px; margin: 0 0 15px 0;">${data.title}</h2>
      <p style="color: #94a3b8; font-size: 14px; margin: 0;">
        <strong style="color: #fff;">Submission ID:</strong> ${data.submissionId}
      </p>
    </div>
    
    <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #22c55e; font-size: 16px; margin: 0 0 15px 0;">📋 What Happens Next?</h3>
      <ol style="color: #94a3b8; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
        <li>Our team will review your submission (usually within 24-48 hours)</li>
        <li>You'll receive an email when your campaign is approved</li>
        <li>Once approved, your campaign will be live on the marketplace</li>
        <li>Supporters can then purchase NFTs to fund your campaign</li>
      </ol>
    </div>
  `

  return sendEmail({
    to: data.email,
    subject: `📝 Submission Received - ${data.title}`,
    html: wrapEmail(content)
  })
}

export async function sendCampaignApproved(data: CampaignApprovedData) {
  const { SITE_URL, CONTRACT_ADDRESS, EXPLORER_URL } = EMAIL_CONFIG
  const storyUrl = `${SITE_URL}/story/${data.campaignId}`
  const explorerTxUrl = data.txHash ? `${EXPLORER_URL}/tx/${data.txHash}` : null

  const content = `
    <h1 style="color: #fff; font-size: 24px; margin: 0 0 20px 0;">🎉 Your Campaign is Live!</h1>
    
    <p style="color: #94a3b8; font-size: 16px; line-height: 1.6;">
      ${data.creatorName ? `Congratulations ${data.creatorName}!` : 'Congratulations!'} Your campaign has been approved and is now live on PatriotPledge NFTs.
    </p>
    
    ${data.imageUrl ? `
    <div style="text-align: center; margin: 20px 0;">
      <img src="${data.imageUrl}" alt="${data.title}" style="max-width: 300px; border-radius: 12px; border: 2px solid rgba(255,255,255,0.1);">
    </div>
    ` : ''}
    
    <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h2 style="color: #fff; font-size: 18px; margin: 0 0 15px 0;">${data.title}</h2>
      <table width="100%" style="color: #94a3b8; font-size: 14px;">
        <tr><td style="padding: 8px 0;">Campaign ID:</td><td style="text-align: right; color: #fff;">#${data.campaignId}</td></tr>
      </table>
      <p style="color: #94a3b8; font-size: 13px; margin: 15px 0 5px 0;"><strong style="color: #fff;">Contract Address:</strong></p>
      <code style="display: block; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; color: #3b82f6; font-size: 11px; word-break: break-all;">${CONTRACT_ADDRESS}</code>
    </div>
    
    ${data.txHash && explorerTxUrl ? `
    <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #22c55e; font-size: 16px; margin: 0 0 15px 0;">⛓️ On-Chain Verification</h3>
      <p style="color: #94a3b8; font-size: 14px; margin: 0 0 10px 0;">Your campaign is recorded on the BlockDAG blockchain.</p>
      <div style="text-align: center; margin-top: 15px;">
        <a href="${explorerTxUrl}" style="display: inline-block; background: #22c55e; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">View on Explorer</a>
      </div>
    </div>
    ` : ''}
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${storyUrl}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">View Your Campaign</a>
    </div>
  `

  return sendEmail({
    to: data.email,
    subject: `🎉 Campaign Approved - ${data.title} is Now Live!`,
    html: wrapEmail(content)
  })
}

export async function sendCampaignRejected(data: CampaignRejectedData) {
  const content = `
    <h1 style="color: #fff; font-size: 24px; margin: 0 0 20px 0;">Campaign Review Update</h1>
    
    <p style="color: #94a3b8; font-size: 16px; line-height: 1.6;">
      ${data.creatorName ? `Hi ${data.creatorName},` : 'Hello,'}
    </p>
    
    <p style="color: #94a3b8; font-size: 16px; line-height: 1.6;">
      We've reviewed your campaign submission and unfortunately, we're unable to approve it at this time.
    </p>
    
    <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #ef4444; font-size: 16px; margin: 0 0 15px 0;">Reason for Rejection</h3>
      <p style="color: #fff; font-size: 14px; line-height: 1.6; margin: 0;">
        ${data.reason}
      </p>
    </div>
    
    <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
      If you believe this was an error or would like to submit a revised campaign, please contact our support team.
    </p>
  `

  return sendEmail({
    to: data.email,
    subject: `Campaign Review - ${data.title}`,
    html: wrapEmail(content)
  })
}
