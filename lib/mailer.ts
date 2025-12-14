type EmailPayload = {
  to: string
  subject: string
  html: string
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://patriotpledgenfts.netlify.app'
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const EXPLORER_URL = 'https://awakening.bdagscan.com'

export async function sendEmail(payload: EmailPayload) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.FROM_EMAIL || 'PatriotPledgeNFTs@vetshelpingvets.life'
  
  console.log('[mailer] Attempting to send email:', {
    to: payload.to,
    subject: payload.subject,
    from,
    hasApiKey: !!apiKey,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'NOT SET'
  })
  
  if (!apiKey) {
    console.log('[mailer] RESEND_API_KEY not set, skipping email')
    return { skipped: true }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html
      })
    })
    const data = await res.json().catch(()=>({}))
    console.log('[mailer] Resend API response:', { status: res.status, data })
    if (!res.ok) throw new Error(data?.message || `RESEND_ERROR: ${res.status}`)
    console.log('[mailer] Email sent successfully, id:', data?.id)
    return { id: data?.id }
  } catch (e) {
    console.error('[mailer] error sending email:', e)
    return { error: (e as any)?.message || String(e) }
  }
}

// Email wrapper with consistent styling
function wrapEmail(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PatriotPledge NFTs</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
          <tr>
            <td style="padding: 40px;">
              <!-- Logo -->
              <div style="text-align: center; margin-bottom: 30px;">
                <span style="font-size: 24px; font-weight: bold; color: #fff;">🎖️ PatriotPledge <span style="color: #ef4444;">NFTs</span></span>
              </div>
              ${content}
              <!-- Footer -->
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                <p style="color: #64748b; font-size: 12px; margin: 0;">
                  © ${new Date().getFullYear()} PatriotPledge NFTs - vetshelpingvets.life<br>
                  1% nonprofit fee for operations · Transparent and auditable
                </p>
                <p style="margin-top: 10px;">
                  <a href="${SITE_URL}" style="color: #3b82f6; text-decoration: none; font-size: 12px;">Visit Website</a>
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// Purchase receipt email
export type PurchaseReceiptData = {
  email: string
  campaignTitle: string
  campaignId: number
  tokenId?: number
  editionNumber?: number
  amountBDAG: number
  amountUSD?: number
  txHash: string
  walletAddress: string
  imageUrl?: string
}

export async function sendPurchaseReceipt(data: PurchaseReceiptData) {
  const explorerTxUrl = `${EXPLORER_URL}/tx/${data.txHash}`
  const explorerTokenUrl = data.tokenId ? `${EXPLORER_URL}/token/${CONTRACT_ADDRESS}?a=${data.tokenId}` : null
  const storyUrl = `${SITE_URL}/story/${data.campaignId}`
  
  const content = `
    <h1 style="color: #fff; font-size: 24px; margin: 0 0 20px 0;">🎉 Thank You for Your Purchase!</h1>
    
    <p style="color: #94a3b8; font-size: 16px; line-height: 1.6;">
      Your NFT purchase has been confirmed on the BlockDAG blockchain.
    </p>
    
    ${data.imageUrl ? `
    <div style="text-align: center; margin: 20px 0;">
      <img src="${data.imageUrl}" alt="${data.campaignTitle}" style="max-width: 200px; border-radius: 12px; border: 2px solid rgba(255,255,255,0.1);">
    </div>
    ` : ''}
    
    <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h2 style="color: #fff; font-size: 18px; margin: 0 0 15px 0;">${data.campaignTitle}</h2>
      <table width="100%" style="color: #94a3b8; font-size: 14px;">
        <tr><td style="padding: 8px 0;">Campaign ID:</td><td style="text-align: right; color: #fff;">#${data.campaignId}</td></tr>
        ${data.tokenId ? `<tr><td style="padding: 8px 0;">Token ID:</td><td style="text-align: right; color: #fff;">#${data.tokenId}</td></tr>` : ''}
        ${data.editionNumber ? `<tr><td style="padding: 8px 0;">Edition:</td><td style="text-align: right; color: #fff;">#${data.editionNumber}</td></tr>` : ''}
        <tr><td style="padding: 8px 0;">Amount Paid:</td><td style="text-align: right; color: #22c55e; font-weight: bold;">${data.amountBDAG} BDAG${data.amountUSD ? ` (~$${data.amountUSD.toFixed(2)})` : ''}</td></tr>
      </table>
    </div>
    
    <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #3b82f6; font-size: 16px; margin: 0 0 15px 0;">📋 Your NFT Details</h3>
      <p style="color: #94a3b8; font-size: 14px; margin: 0 0 10px 0;"><strong style="color: #fff;">Contract Address:</strong></p>
      <code style="display: block; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; color: #3b82f6; font-size: 12px; word-break: break-all;">${CONTRACT_ADDRESS}</code>
      
      ${data.tokenId ? `
      <p style="color: #94a3b8; font-size: 14px; margin: 15px 0 10px 0;"><strong style="color: #fff;">Token ID:</strong></p>
      <code style="display: block; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; color: #3b82f6; font-size: 12px;">${data.tokenId}</code>
      ` : ''}
      
      <p style="color: #94a3b8; font-size: 14px; margin: 15px 0 10px 0;"><strong style="color: #fff;">Transaction Hash:</strong></p>
      <code style="display: block; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; color: #3b82f6; font-size: 12px; word-break: break-all;">${data.txHash}</code>
    </div>
    
    <div style="background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #a855f7; font-size: 16px; margin: 0 0 15px 0;">🦊 How to Import Your NFT to MetaMask</h3>
      
      <p style="color: #94a3b8; font-size: 13px; margin: 0 0 15px 0; font-style: italic;">Save these details - you'll need them to view your NFT in your wallet:</p>
      
      <div style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
        <p style="color: #fff; font-size: 13px; margin: 0 0 8px 0;"><strong>Contract Address:</strong></p>
        <code style="display: block; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px; color: #a855f7; font-size: 11px; word-break: break-all; margin-bottom: 10px;">${CONTRACT_ADDRESS}</code>
        ${data.tokenId ? `
        <p style="color: #fff; font-size: 13px; margin: 0 0 8px 0;"><strong>Token ID:</strong></p>
        <code style="display: block; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px; color: #a855f7; font-size: 14px;">${data.tokenId}</code>
        ` : ''}
      </div>
      
      <p style="color: #fff; font-size: 14px; margin: 0 0 10px 0;"><strong>Step-by-Step Instructions:</strong></p>
      <ol style="color: #94a3b8; font-size: 13px; line-height: 1.8; margin: 0; padding-left: 20px;">
        <li><strong style="color: #fff;">Add BlockDAG Network</strong> (if not already added):
          <ul style="margin: 5px 0 10px 0; padding-left: 15px;">
            <li>Open MetaMask → Click network dropdown → "Add Network"</li>
            <li>Network Name: <code style="color: #a855f7;">BlockDAG</code></li>
            <li>RPC URL: <code style="color: #a855f7;">https://rpc.primordial.bdagscan.com</code></li>
            <li>Chain ID: <code style="color: #a855f7;">1043</code></li>
            <li>Symbol: <code style="color: #a855f7;">BDAG</code></li>
            <li>Explorer: <code style="color: #a855f7;">https://awakening.bdagscan.com</code></li>
          </ul>
        </li>
        <li><strong style="color: #fff;">Switch to BlockDAG network</strong> in MetaMask</li>
        <li>Go to the <strong style="color: #fff;">NFTs</strong> tab at the bottom</li>
        <li>Tap <strong style="color: #fff;">"Import NFT"</strong> (or "+" button)</li>
        <li>Paste the <strong style="color: #fff;">Contract Address</strong> shown above</li>
        ${data.tokenId ? `<li>Enter <strong style="color: #fff;">Token ID: ${data.tokenId}</strong></li>` : '<li>Enter the <strong style="color: #fff;">Token ID</strong> shown above</li>'}
        <li>Tap <strong style="color: #fff;">"Import"</strong> - Your NFT will appear!</li>
      </ol>
      
      <p style="color: #64748b; font-size: 12px; margin: 15px 0 0 0; font-style: italic;">💡 Tip: NFT images may take a moment to load as they're fetched from IPFS.</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${explorerTxUrl}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 5px;">View Transaction</a>
      <a href="${storyUrl}" style="display: inline-block; background: rgba(255,255,255,0.1); color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 5px;">View Campaign</a>
    </div>
  `
  
  return sendEmail({
    to: data.email,
    subject: `🎉 NFT Purchase Confirmed - ${data.campaignTitle}`,
    html: wrapEmail(content)
  })
}

// Submission confirmation email
export type SubmissionConfirmData = {
  email: string
  submissionId: string
  title: string
  creatorName?: string
}

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
    
    <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
      If you have any questions, please reach out to our support team.
    </p>
  `
  
  return sendEmail({
    to: data.email,
    subject: `📝 Submission Received - ${data.title}`,
    html: wrapEmail(content)
  })
}

// Campaign approved email
export type CampaignApprovedData = {
  email: string
  title: string
  campaignId: number
  creatorName?: string
  imageUrl?: string
  txHash?: string
}

export async function sendCampaignApproved(data: CampaignApprovedData) {
  const storyUrl = `${SITE_URL}/story/${data.campaignId}`
  const marketplaceUrl = `${SITE_URL}/marketplace`
  const explorerTxUrl = data.txHash ? `${EXPLORER_URL}/tx/${data.txHash}` : null
  const explorerContractUrl = `${EXPLORER_URL}/address/${CONTRACT_ADDRESS}`
  
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
    
    ${data.txHash ? `
    <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #22c55e; font-size: 16px; margin: 0 0 15px 0;">⛓️ On-Chain Verification</h3>
      <p style="color: #94a3b8; font-size: 14px; margin: 0 0 10px 0;">Your campaign is recorded on the BlockDAG blockchain for full transparency.</p>
      <p style="color: #94a3b8; font-size: 14px; margin: 0 0 10px 0;"><strong style="color: #fff;">Transaction Hash:</strong></p>
      <code style="display: block; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; color: #22c55e; font-size: 11px; word-break: break-all;">${data.txHash}</code>
      <div style="text-align: center; margin-top: 15px;">
        <a href="${explorerTxUrl}" style="display: inline-block; background: #22c55e; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">View on BlockDAG Explorer</a>
      </div>
    </div>
    ` : ''}
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${storyUrl}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">View Your Campaign</a>
    </div>
    
    <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #3b82f6; font-size: 16px; margin: 0 0 15px 0;">📢 Share Your Campaign</h3>
      <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0;">
        Share your campaign with friends, family, and on social media to maximize your reach. Every share helps!
      </p>
    </div>
  `
  
  return sendEmail({
    to: data.email,
    subject: `🎉 Campaign Approved - ${data.title} is Now Live!`,
    html: wrapEmail(content)
  })
}

// Governance: New proposal open for voting
export type ProposalVotingOpenData = {
  email: string
  proposalId: string
  proposalTitle: string
  proposalDescription: string
  recipientName?: string
}

export async function sendProposalVotingOpen(data: ProposalVotingOpenData) {
  const governanceUrl = `${SITE_URL}/governance`
  
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

// Governance: Vote confirmation
export type VoteConfirmationData = {
  email: string
  proposalTitle: string
  votedYes: boolean
  voterName?: string
}

export async function sendVoteConfirmation(data: VoteConfirmationData) {
  const governanceUrl = `${SITE_URL}/governance`
  
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

// Governance: Proposal submitted confirmation
export type ProposalSubmittedData = {
  email: string
  proposalId: string
  proposalTitle: string
  submitterName?: string
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
