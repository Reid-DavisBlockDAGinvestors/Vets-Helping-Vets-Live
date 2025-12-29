/**
 * Governance Email Templates
 */

import { EMAIL_CONFIG } from '../config'
import { wrapEmail } from '../wrapper'
import { sendEmail } from '../sender'
import type { ProposalVotingOpenData, VoteConfirmationData, ProposalSubmittedData } from '../types'

export async function sendProposalVotingOpen(data: ProposalVotingOpenData) {
  const governanceUrl = `${EMAIL_CONFIG.SITE_URL}/governance`

  const content = `
    <h1 style="color: #fff; font-size: 24px; margin: 0 0 20px 0;">🗳️ New Proposal Open for Voting</h1>
    
    <p style="color: #94a3b8; font-size: 16px; line-height: 1.6;">
      ${data.recipientName ? `Hi ${data.recipientName},` : 'Hello,'} a new governance proposal is now open for voting.
    </p>
    
    <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h2 style="color: #fff; font-size: 18px; margin: 0 0 15px 0;">${data.proposalTitle}</h2>
      <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0;">
        ${data.proposalDescription.slice(0, 300)}${data.proposalDescription.length > 300 ? '...' : ''}
      </p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${governanceUrl}" style="display: inline-block; background: #8b5cf6; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Vote Now</a>
    </div>
    
    <p style="color: #64748b; font-size: 12px; text-align: center;">
      Your vote matters! NFT holders and campaign creators have voting power in our community governance.
    </p>
  `

  return sendEmail({
    to: data.email,
    subject: `🗳️ New Proposal: ${data.proposalTitle}`,
    html: wrapEmail(content)
  })
}

export async function sendVoteConfirmation(data: VoteConfirmationData) {
  const governanceUrl = `${EMAIL_CONFIG.SITE_URL}/governance`

  const content = `
    <h1 style="color: #fff; font-size: 24px; margin: 0 0 20px 0;">✅ Vote Recorded</h1>
    
    <p style="color: #94a3b8; font-size: 16px; line-height: 1.6;">
      ${data.voterName ? `Thank you ${data.voterName}!` : 'Thank you!'} Your vote has been recorded.
    </p>
    
    <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h2 style="color: #fff; font-size: 18px; margin: 0 0 15px 0;">${data.proposalTitle}</h2>
      <p style="color: ${data.votedYes ? '#22c55e' : '#ef4444'}; font-size: 20px; font-weight: bold; margin: 0;">
        You voted: ${data.votedYes ? '👍 YES' : '👎 NO'}
      </p>
    </div>
    
    <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
      We'll notify you when the voting period ends and the results are announced.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${governanceUrl}" style="display: inline-block; background: rgba(255,255,255,0.1); color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">View All Proposals</a>
    </div>
  `

  return sendEmail({
    to: data.email,
    subject: `✅ Vote Recorded - ${data.proposalTitle}`,
    html: wrapEmail(content)
  })
}

export async function sendProposalSubmitted(data: ProposalSubmittedData) {
  const content = `
    <h1 style="color: #fff; font-size: 24px; margin: 0 0 20px 0;">📋 Proposal Submitted</h1>
    
    <p style="color: #94a3b8; font-size: 16px; line-height: 1.6;">
      ${data.submitterName ? `Thank you ${data.submitterName}!` : 'Thank you!'} Your governance proposal has been submitted for review.
    </p>
    
    <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h2 style="color: #fff; font-size: 18px; margin: 0 0 15px 0;">${data.proposalTitle}</h2>
      <p style="color: #94a3b8; font-size: 14px; margin: 0;">
        <strong style="color: #fff;">Proposal ID:</strong> ${data.proposalId}
      </p>
    </div>
    
    <div style="background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #fbbf24; font-size: 16px; margin: 0 0 15px 0;">⏳ What Happens Next?</h3>
      <ol style="color: #94a3b8; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
        <li>Our admin team will review your proposal</li>
        <li>If approved, it will be opened for community voting</li>
        <li>You'll receive an email when voting begins</li>
        <li>Community members will vote on your proposal</li>
      </ol>
    </div>
  `

  return sendEmail({
    to: data.email,
    subject: `📋 Proposal Submitted - ${data.proposalTitle}`,
    html: wrapEmail(content)
  })
}
