/**
 * Purchase Receipt Email Template
 */

import { EMAIL_CONFIG } from '../config'
import { wrapEmail } from '../wrapper'
import { sendEmail } from '../sender'
import type { PurchaseReceiptData } from '../types'

export async function sendPurchaseReceipt(data: PurchaseReceiptData) {
  const { SITE_URL, CONTRACT_ADDRESS, EXPLORER_URL } = EMAIL_CONFIG
  const explorerTxUrl = `${EXPLORER_URL}/tx/${data.txHash}`
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
      <ol style="color: #94a3b8; font-size: 13px; line-height: 1.8; margin: 0; padding-left: 20px;">
        <li><strong style="color: #fff;">Add BlockDAG Network</strong> (if not already added)</li>
        <li><strong style="color: #fff;">Switch to BlockDAG network</strong> in MetaMask</li>
        <li>Go to the <strong style="color: #fff;">NFTs</strong> tab</li>
        <li>Tap <strong style="color: #fff;">"Import NFT"</strong></li>
        <li>Paste the Contract Address and Token ID</li>
        <li>Tap <strong style="color: #fff;">"Import"</strong></li>
      </ol>
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
