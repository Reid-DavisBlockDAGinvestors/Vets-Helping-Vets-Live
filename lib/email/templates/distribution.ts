/**
 * Distribution Notification Email Templates
 * Notifies submitters and nonprofits when funds/tips are distributed
 */

import { EMAIL_CONFIG, getChainConfig } from '../config'
import { wrapEmail } from '../wrapper'
import { sendEmail } from '../sender'
import { logger } from '@/lib/logger'

export interface DistributionNotificationData {
  email: string
  recipientName?: string
  recipientType: 'submitter' | 'nonprofit'
  campaignTitle: string
  campaignId: number | string
  distributionType: 'funds' | 'tips'
  amount: number
  amountUSD?: number
  txHash: string
  walletAddress: string
  chainId?: number
  // For tip splits
  splitPercent?: number
  totalDistributed?: number
}

export async function sendDistributionNotification(data: DistributionNotificationData) {
  const { SITE_URL } = EMAIL_CONFIG
  
  // Get chain-specific configuration
  const chain = getChainConfig(data.chainId)
  const explorerTxUrl = `${chain.explorerUrl}/tx/${data.txHash}`
  const storyUrl = `${SITE_URL}/story/${data.campaignId}`
  
  const isSubmitter = data.recipientType === 'submitter'
  const isTips = data.distributionType === 'tips'
  
  // Testnet badge if applicable
  const testnetBadge = chain.isTestnet 
    ? `<span style="background: #f59e0b; color: #000; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">TESTNET</span>` 
    : ''

  const recipientLabel = isSubmitter ? 'Campaign Creator' : 'Nonprofit Partner'
  const fundTypeLabel = isTips ? 'Tips' : 'Funds'
  const emoji = isTips ? '💜' : '💰'

  const content = `
    <h1 style="color: #fff; font-size: 24px; margin: 0 0 20px 0;">${emoji} ${fundTypeLabel} Distributed!</h1>
    
    <p style="color: #94a3b8; font-size: 16px; line-height: 1.6;">
      ${data.recipientName ? `Hi ${data.recipientName},` : 'Hello,'}<br><br>
      Great news! ${isTips ? 'Tips' : 'Funds'} from your campaign have been distributed to your wallet on 
      <strong style="color: #fff;">${chain.name}</strong>.${testnetBadge}
    </p>
    
    <div style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.05)); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center;">
      <p style="color: #94a3b8; font-size: 14px; margin: 0 0 10px 0;">Amount Received</p>
      <p style="color: #22c55e; font-size: 32px; font-weight: bold; margin: 0;">
        ${data.amount.toFixed(4)} ${chain.symbol}
      </p>
      ${data.amountUSD ? `<p style="color: #94a3b8; font-size: 14px; margin: 5px 0 0 0;">≈ $${data.amountUSD.toFixed(2)} USD</p>` : ''}
      ${data.splitPercent && data.splitPercent < 100 ? `
        <p style="color: #a855f7; font-size: 12px; margin: 10px 0 0 0;">
          (${data.splitPercent}% of ${data.totalDistributed?.toFixed(4) || 'total'} ${chain.symbol} tip pool)
        </p>
      ` : ''}
    </div>
    
    <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h2 style="color: #fff; font-size: 18px; margin: 0 0 15px 0;">${data.campaignTitle}</h2>
      <table width="100%" style="color: #94a3b8; font-size: 14px;">
        <tr><td style="padding: 8px 0;">Distribution Type:</td><td style="text-align: right; color: #fff;">${fundTypeLabel}</td></tr>
        <tr><td style="padding: 8px 0;">Recipient Type:</td><td style="text-align: right; color: #fff;">${recipientLabel}</td></tr>
        <tr><td style="padding: 8px 0;">Network:</td><td style="text-align: right; color: #fff;">${chain.name}</td></tr>
        <tr><td style="padding: 8px 0;">Your Wallet:</td><td style="text-align: right; color: #3b82f6; font-family: monospace; font-size: 12px;">${data.walletAddress.slice(0, 6)}...${data.walletAddress.slice(-4)}</td></tr>
      </table>
    </div>
    
    <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #3b82f6; font-size: 16px; margin: 0 0 15px 0;">📋 Transaction Details</h3>
      <p style="color: #94a3b8; font-size: 14px; margin: 0 0 10px 0;"><strong style="color: #fff;">Transaction Hash:</strong></p>
      <code style="display: block; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; color: #3b82f6; font-size: 12px; word-break: break-all;">${data.txHash}</code>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${explorerTxUrl}" style="display: inline-block; background: #22c55e; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 5px;">Verify on ${chain.explorerName}</a>
      <a href="${storyUrl}" style="display: inline-block; background: rgba(255,255,255,0.1); color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 5px;">View Campaign</a>
    </div>
    
    <p style="color: #64748b; font-size: 13px; text-align: center; margin-top: 30px;">
      Thank you for being part of PatriotPledge! 🇺🇸
    </p>
  `

  logger.api(`[email] Sending distribution notification to ${data.email}`)
  
  return sendEmail({
    to: data.email,
    subject: `${emoji} ${fundTypeLabel} Distributed - ${data.campaignTitle}`,
    html: wrapEmail(content)
  })
}

/**
 * Send distribution notifications to all recipients (submitter and/or nonprofit)
 */
export async function sendDistributionNotifications(params: {
  campaignTitle: string
  campaignId: number | string
  distributionType: 'funds' | 'tips'
  chainId?: number
  txHash: string
  // Submitter info
  submitterEmail?: string
  submitterName?: string
  submitterWallet: string
  submitterAmount: number
  // Nonprofit info (for tip splits)
  nonprofitEmail?: string
  nonprofitName?: string
  nonprofitWallet?: string
  nonprofitAmount?: number
  // Totals
  totalAmount: number
  submitterPercent?: number
  nonprofitPercent?: number
}) {
  const results: { submitter?: any; nonprofit?: any } = {}

  // Send to submitter
  if (params.submitterEmail && params.submitterAmount > 0) {
    results.submitter = await sendDistributionNotification({
      email: params.submitterEmail,
      recipientName: params.submitterName,
      recipientType: 'submitter',
      campaignTitle: params.campaignTitle,
      campaignId: params.campaignId,
      distributionType: params.distributionType,
      amount: params.submitterAmount,
      txHash: params.txHash,
      walletAddress: params.submitterWallet,
      chainId: params.chainId,
      splitPercent: params.submitterPercent,
      totalDistributed: params.totalAmount,
    })
  }

  // Send to nonprofit (for tip splits)
  if (params.nonprofitEmail && params.nonprofitWallet && params.nonprofitAmount && params.nonprofitAmount > 0) {
    results.nonprofit = await sendDistributionNotification({
      email: params.nonprofitEmail,
      recipientName: params.nonprofitName,
      recipientType: 'nonprofit',
      campaignTitle: params.campaignTitle,
      campaignId: params.campaignId,
      distributionType: params.distributionType,
      amount: params.nonprofitAmount,
      txHash: params.txHash,
      walletAddress: params.nonprofitWallet,
      chainId: params.chainId,
      splitPercent: params.nonprofitPercent,
      totalDistributed: params.totalAmount,
    })
  }

  return results
}
