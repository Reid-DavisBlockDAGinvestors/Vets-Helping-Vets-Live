import { logger } from './logger'

type EmailPayload = {
  to: string
  subject: string
  html: string
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://patriotpledgenfts.netlify.app'
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const EXPLORER_URL = 'https://awakening.bdagscan.com'

// Multi-chain configuration
const CHAIN_CONFIG: Record<number, {
  name: string
  symbol: string
  explorerUrl: string
  explorerName: string
  contractAddress: string
  isTestnet: boolean
}> = {
  1043: {
    name: 'BlockDAG',
    symbol: 'BDAG',
    explorerUrl: 'https://awakening.bdagscan.com',
    explorerName: 'BDAGScan',
    contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890',
    isTestnet: true,
  },
  11155111: {
    name: 'Sepolia',
    symbol: 'ETH',
    explorerUrl: 'https://sepolia.etherscan.io',
    explorerName: 'Etherscan',
    contractAddress: process.env.NEXT_PUBLIC_V7_CONTRACT_SEPOLIA || '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e',
    isTestnet: true,
  },
  1: {
    name: 'Ethereum',
    symbol: 'ETH',
    explorerUrl: 'https://etherscan.io',
    explorerName: 'Etherscan',
    contractAddress: '',
    isTestnet: false,
  },
}

function getChainConfig(chainId?: number) {
  if (!chainId || !CHAIN_CONFIG[chainId]) return CHAIN_CONFIG[1043]
  return CHAIN_CONFIG[chainId]
}

export async function sendEmail(payload: EmailPayload) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.FROM_EMAIL || 'patriotpledgenfts@vetshelpingvets.life'
  
  logger.debug('[mailer] Attempting to send email:', {
    to: payload.to,
    subject: payload.subject,
    from,
    hasApiKey: !!apiKey
  })
  
  if (!apiKey) {
    logger.debug('[mailer] RESEND_API_KEY not set, skipping email')
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
    logger.debug('[mailer] Resend API response:', { status: res.status, data })
    if (!res.ok) throw new Error(data?.message || `RESEND_ERROR: ${res.status}`)
    logger.debug('[mailer] Email sent successfully, id:', data?.id)
    return { id: data?.id }
  } catch (e) {
    logger.error('[mailer] error sending email:', e)
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
  amountCrypto?: number
  amountUSD?: number
  txHash: string
  walletAddress: string
  imageUrl?: string
  chainId?: number
  /** @deprecated Use amountCrypto instead */
  amountBDAG?: number
}

export async function sendPurchaseReceipt(data: PurchaseReceiptData) {
  const chain = getChainConfig(data.chainId)
  const explorerTxUrl = `${chain.explorerUrl}/tx/${data.txHash}`
  const storyUrl = `${SITE_URL}/story/${data.campaignId}`
  const cryptoAmount = data.amountCrypto ?? data.amountBDAG ?? 0
  const testnetBadge = chain.isTestnet ? ' <span style="background: #f59e0b; color: #000; font-size: 10px; padding: 2px 6px; border-radius: 4px;">(Testnet)</span>' : ''
  
  const content = `
    <h1 style="color: #fff; font-size: 24px; margin: 0 0 20px 0;">🎉 Thank You for Your Purchase!</h1>
    
    <p style="color: #94a3b8; font-size: 16px; line-height: 1.6;">
      Your NFT purchase has been confirmed on the <strong style="color: #fff;">${chain.name}</strong> blockchain.${testnetBadge}
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
        <tr><td style="padding: 8px 0;">Network:</td><td style="text-align: right; color: #fff;">${chain.name}${chain.isTestnet ? ' (Testnet)' : ''}</td></tr>
        <tr><td style="padding: 8px 0;">Amount Paid:</td><td style="text-align: right; color: #22c55e; font-weight: bold;">${cryptoAmount} ${chain.symbol}${data.amountUSD ? ` (~$${data.amountUSD.toFixed(2)})` : ''}</td></tr>
      </table>
    </div>
    
    <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #3b82f6; font-size: 16px; margin: 0 0 15px 0;">📋 Your NFT Details</h3>
      <p style="color: #94a3b8; font-size: 14px; margin: 0 0 10px 0;"><strong style="color: #fff;">Contract Address (${chain.name}):</strong></p>
      <code style="display: block; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; color: #3b82f6; font-size: 12px; word-break: break-all;">${chain.contractAddress}</code>
      
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
        <li><strong style="color: #fff;">Switch to ${chain.name} network</strong> in MetaMask</li>
        <li>Go to the <strong style="color: #fff;">NFTs</strong> tab at the bottom</li>
        <li>Tap <strong style="color: #fff;">"Import NFT"</strong> (or "+" button)</li>
        <li>Paste the <strong style="color: #fff;">Contract Address</strong> shown above</li>
        ${data.tokenId ? `<li>Enter <strong style="color: #fff;">Token ID: ${data.tokenId}</strong></li>` : '<li>Enter the <strong style="color: #fff;">Token ID</strong> shown above</li>'}
        <li>Tap <strong style="color: #fff;">"Import"</strong> - Your NFT will appear!</li>
      </ol>
      
      <p style="color: #64748b; font-size: 12px; margin: 15px 0 0 0; font-style: italic;">💡 Tip: NFT images may take a moment to load as they're fetched from IPFS.</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${explorerTxUrl}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 5px;">View on ${chain.explorerName}</a>
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

// Admin notification for new submissions
export type AdminNewSubmissionData = {
  submissionId: string
  title: string
  creatorName?: string
  creatorEmail: string
  category: string
  goal?: number
  adminEmails?: string[] // Optional: pass admin emails directly, otherwise will be fetched
}

export async function sendAdminNewSubmission(data: AdminNewSubmissionData) {
  const adminUrl = `${SITE_URL}/admin`
  
  const content = `
    <h1 style="color: #fff; font-size: 24px; margin: 0 0 20px 0;">🔔 New Submission Requires Review</h1>
    
    <p style="color: #94a3b8; font-size: 16px; line-height: 1.6;">
      A new campaign submission has been received and is awaiting your review.
    </p>
    
    <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h2 style="color: #fff; font-size: 18px; margin: 0 0 15px 0;">${data.title}</h2>
      <table width="100%" style="color: #94a3b8; font-size: 14px;">
        <tr><td style="padding: 8px 0;">Submission ID:</td><td style="text-align: right; color: #fff;">${data.submissionId}</td></tr>
        <tr><td style="padding: 8px 0;">Creator:</td><td style="text-align: right; color: #fff;">${data.creatorName || 'Not provided'}</td></tr>
        <tr><td style="padding: 8px 0;">Email:</td><td style="text-align: right; color: #3b82f6;">${data.creatorEmail}</td></tr>
        <tr><td style="padding: 8px 0;">Category:</td><td style="text-align: right; color: #fff;">${data.category}</td></tr>
        ${data.goal ? `<tr><td style="padding: 8px 0;">Goal:</td><td style="text-align: right; color: #22c55e;">$${data.goal.toLocaleString()}</td></tr>` : ''}
      </table>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${adminUrl}" style="display: inline-block; background: #ef4444; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Review in Admin Portal</a>
    </div>
    
    <p style="color: #64748b; font-size: 12px; text-align: center;">
      This is an automated notification. Please review and approve or reject this submission.
    </p>
  `
  
  // Get admin emails - use provided list or fallback
  const adminEmails = data.adminEmails && data.adminEmails.length > 0 
    ? data.adminEmails 
    : [process.env.ADMIN_NOTIFICATION_EMAIL || 'reid@blockdaginvestors.com']
  
  // Send to all admins
  const results = await Promise.all(
    adminEmails.map(email => 
      sendEmail({
        to: email,
        subject: `🔔 New Submission: ${data.title}`,
        html: wrapEmail(content)
      })
    )
  )
  
  return { sent: adminEmails.length, results }
}

// Notify campaign creator when someone purchases their NFT
export type CreatorPurchaseNotificationData = {
  creatorEmail: string
  creatorName?: string
  campaignTitle: string
  campaignId: number
  donorWallet: string
  donorName?: string        // Display name of donor (optional)
  donorNote?: string        // Personal message from donor (optional)
  amountCrypto?: number     // Multi-chain: generic crypto amount
  amountUSD?: number
  tokenId?: number
  editionNumber?: number
  totalRaised?: number
  goalAmount?: number
  txHash: string
  chainId?: number          // Multi-chain: which network was used
  /** @deprecated Use amountCrypto instead */
  amountBDAG?: number
}

export async function sendCreatorPurchaseNotification(data: CreatorPurchaseNotificationData) {
  const chain = getChainConfig(data.chainId)
  const storyUrl = `${SITE_URL}/story/${data.campaignId}`
  const explorerTxUrl = `${chain.explorerUrl}/tx/${data.txHash}`
  const cryptoAmount = data.amountCrypto ?? data.amountBDAG ?? 0
  const progressPercent = data.goalAmount && data.totalRaised 
    ? Math.min(100, Math.round((data.totalRaised / data.goalAmount) * 100))
    : null
  
  const content = `
    <h1 style="color: #fff; font-size: 24px; margin: 0 0 20px 0;">🎉 You Just Received a Donation!</h1>
    
    <p style="color: #94a3b8; font-size: 16px; line-height: 1.6;">
      ${data.creatorName ? `Great news ${data.creatorName}!` : 'Great news!'} Someone just purchased an NFT from your campaign on <strong style="color: #fff;">${chain.name}</strong>!
    </p>
    
    <div style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(16, 185, 129, 0.1) 100%); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h2 style="color: #22c55e; font-size: 28px; margin: 0 0 10px 0; text-align: center;">
        +${cryptoAmount.toFixed(cryptoAmount < 1 ? 6 : 2)} ${chain.symbol}
      </h2>
      ${data.amountUSD ? `<p style="color: #94a3b8; font-size: 16px; margin: 0; text-align: center;">≈ $${data.amountUSD.toFixed(2)} USD</p>` : ''}
    </div>
    
    <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #fff; font-size: 18px; margin: 0 0 15px 0;">${data.campaignTitle}</h3>
      <table width="100%" style="color: #94a3b8; font-size: 14px;">
        <tr><td style="padding: 8px 0;">Campaign ID:</td><td style="text-align: right; color: #fff;">#${data.campaignId}</td></tr>
        ${data.tokenId ? `<tr><td style="padding: 8px 0;">Token ID:</td><td style="text-align: right; color: #fff;">#${data.tokenId}</td></tr>` : ''}
        ${data.editionNumber ? `<tr><td style="padding: 8px 0;">Edition Sold:</td><td style="text-align: right; color: #fff;">#${data.editionNumber}</td></tr>` : ''}
        <tr><td style="padding: 8px 0;">Supporter:</td><td style="text-align: right; color: #fff;">${data.donorName || 'Anonymous'}</td></tr>
        <tr><td style="padding: 8px 0;">Wallet:</td><td style="text-align: right; color: #3b82f6; font-size: 12px;">${data.donorWallet.slice(0, 6)}...${data.donorWallet.slice(-4)}</td></tr>
      </table>
    </div>
    
    ${data.donorNote ? `
    <div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(124, 58, 237, 0.1) 100%); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #a78bfa; font-size: 16px; margin: 0 0 10px 0;">💌 Personal Message from ${data.donorName || 'Your Supporter'}</h3>
      <p style="color: #fff; font-size: 16px; line-height: 1.6; margin: 0; font-style: italic;">
        "${data.donorNote}"
      </p>
    </div>
    ` : ''}
    
    ${progressPercent !== null ? `
    <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #fff; font-size: 16px; margin: 0 0 15px 0;">📊 Campaign Progress</h3>
      <div style="background: rgba(255,255,255,0.1); border-radius: 8px; height: 20px; overflow: hidden;">
        <div style="background: linear-gradient(90deg, #22c55e, #10b981); height: 100%; width: ${progressPercent}%; transition: width 0.3s;"></div>
      </div>
      <p style="color: #94a3b8; font-size: 14px; margin: 10px 0 0 0; text-align: center;">
        <strong style="color: #22c55e;">${progressPercent}%</strong> of $${data.goalAmount?.toLocaleString()} goal reached
        ${data.totalRaised ? ` · $${data.totalRaised.toLocaleString()} raised` : ''}
      </p>
    </div>
    ` : ''}
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${storyUrl}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 5px;">View Campaign</a>
      <a href="${explorerTxUrl}" style="display: inline-block; background: rgba(255,255,255,0.1); color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 5px;">View Transaction</a>
    </div>
    
    <p style="color: #64748b; font-size: 12px; text-align: center;">
      Share your campaign to reach more supporters! Every share helps.
    </p>
  `
  
  return sendEmail({
    to: data.creatorEmail,
    subject: `🎉 New Donation! +${cryptoAmount.toFixed(cryptoAmount < 1 ? 6 : 2)} ${chain.symbol} for ${data.campaignTitle}`,
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

// Password reset email
export type PasswordResetData = {
  email: string
  resetLink: string
  displayName?: string
}

export async function sendPasswordResetEmail(data: PasswordResetData) {
  const content = `
    <h1 style="color: #fff; font-size: 24px; margin: 0 0 20px 0;">🔑 Password Reset Request</h1>
    
    <p style="color: #94a3b8; font-size: 16px; line-height: 1.6;">
      ${data.displayName ? `Hi ${data.displayName},` : 'Hello,'}
    </p>
    
    <p style="color: #94a3b8; font-size: 16px; line-height: 1.6;">
      We received a request to reset your password for your PatriotPledge NFTs account.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.resetLink}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: #fff; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
        Click Here to Reset Your Password
      </a>
    </div>
    
    <div style="background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <p style="color: #fbbf24; font-size: 14px; margin: 0;">
        ⚠️ This link will expire in 1 hour. If you didn't request this reset, you can safely ignore this email.
      </p>
    </div>
    
    <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
      If the button above doesn't work, copy and paste this link into your browser:
    </p>
    <code style="display: block; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; color: #3b82f6; font-size: 12px; word-break: break-all; margin-bottom: 20px;">${data.resetLink}</code>
  `
  
  return sendEmail({
    to: data.email,
    subject: '🔑 Reset Your PatriotPledge Password',
    html: wrapEmail(content)
  })
}

// Bug Report Status Update Email
export type BugReportStatusData = {
  email: string
  reportId: string
  reportTitle: string
  oldStatus: string
  newStatus: string
  resolutionNotes?: string
  adminMessage?: string
}

const STATUS_LABELS: Record<string, string> = {
  new: '🆕 New',
  investigating: '🔍 Investigating',
  in_progress: '🔧 In Progress',
  resolved: '✅ Resolved',
  wont_fix: '❌ Won\'t Fix',
  duplicate: '📋 Duplicate',
}

export async function sendBugReportStatusEmail(data: BugReportStatusData) {
  const reportUrl = `${SITE_URL}/my-bug-reports/${data.reportId}`
  const statusLabel = STATUS_LABELS[data.newStatus] || data.newStatus
  const isResolved = ['resolved', 'wont_fix', 'duplicate'].includes(data.newStatus)
  
  const content = `
    <h1 style="color: #fff; font-size: 24px; margin: 0 0 20px 0;">
      ${isResolved ? '🎉 Your Bug Report Has Been Addressed!' : '📬 Bug Report Status Update'}
    </h1>
    
    <p style="color: #94a3b8; font-size: 16px; line-height: 1.6;">
      Your bug report has been updated by our team.
    </p>
    
    <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <p style="color: #64748b; font-size: 12px; margin: 0 0 5px 0;">Bug Report</p>
      <h2 style="color: #fff; font-size: 18px; margin: 0;">${data.reportTitle}</h2>
    </div>
    
    <div style="display: flex; gap: 20px; margin: 20px 0;">
      <div style="flex: 1; background: rgba(255,255,255,0.05); border-radius: 12px; padding: 15px;">
        <p style="color: #64748b; font-size: 12px; margin: 0 0 5px 0;">Previous Status</p>
        <p style="color: #94a3b8; font-size: 14px; margin: 0;">${STATUS_LABELS[data.oldStatus] || data.oldStatus}</p>
      </div>
      <div style="flex: 1; background: rgba(59, 130, 246, 0.2); border-radius: 12px; padding: 15px;">
        <p style="color: #64748b; font-size: 12px; margin: 0 0 5px 0;">New Status</p>
        <p style="color: #3b82f6; font-size: 14px; font-weight: 600; margin: 0;">${statusLabel}</p>
      </div>
    </div>
    
    ${data.resolutionNotes ? `
    <div style="background: rgba(34, 197, 94, 0.1); border-left: 3px solid #22c55e; padding: 15px; margin: 20px 0; border-radius: 0 12px 12px 0;">
      <p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0;">Resolution Notes</p>
      <p style="color: #fff; font-size: 14px; line-height: 1.5; margin: 0;">${data.resolutionNotes}</p>
    </div>
    ` : ''}
    
    ${data.adminMessage ? `
    <div style="background: rgba(139, 92, 246, 0.1); border-left: 3px solid #8b5cf6; padding: 15px; margin: 20px 0; border-radius: 0 12px 12px 0;">
      <p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0;">Message from Admin</p>
      <p style="color: #fff; font-size: 14px; line-height: 1.5; margin: 0;">${data.adminMessage}</p>
    </div>
    ` : ''}
    
    <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
      You can view the full details and continue the conversation about this bug report by clicking the button below.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${reportUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">View Bug Report →</a>
    </div>
    
    <p style="color: #64748b; font-size: 12px; margin-top: 20px;">
      Report ID: ${data.reportId}
    </p>
  `
  
  return sendEmail({
    to: data.email,
    subject: isResolved 
      ? `✅ Your bug report has been resolved: ${data.reportTitle}`
      : `📬 Update on your bug report: ${data.reportTitle}`,
    html: wrapEmail(content)
  })
}

// Bug Report New Message Email
export type BugReportMessageData = {
  email: string
  reportId: string
  reportTitle: string
  senderName: string
  message: string
}

export async function sendBugReportMessageEmail(data: BugReportMessageData) {
  const reportUrl = `${SITE_URL}/my-bug-reports/${data.reportId}`
  
  const content = `
    <h1 style="color: #fff; font-size: 24px; margin: 0 0 20px 0;">💬 New Message on Your Bug Report</h1>
    
    <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <p style="color: #64748b; font-size: 12px; margin: 0 0 5px 0;">Bug Report</p>
      <h2 style="color: #fff; font-size: 18px; margin: 0;">${data.reportTitle}</h2>
    </div>
    
    <div style="background: rgba(139, 92, 246, 0.1); border-left: 3px solid #8b5cf6; padding: 15px; margin: 20px 0; border-radius: 0 12px 12px 0;">
      <p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0;">Message from ${data.senderName}</p>
      <p style="color: #fff; font-size: 14px; line-height: 1.5; margin: 0;">${data.message}</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${reportUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Reply to Message →</a>
    </div>
    
    <p style="color: #64748b; font-size: 12px; margin-top: 20px;">
      Report ID: ${data.reportId}
    </p>
  `
  
  return sendEmail({
    to: data.email,
    subject: `💬 New message on your bug report: ${data.reportTitle}`,
    html: wrapEmail(content)
  })
}
