/**
 * Email Wrapper - Consistent email styling
 */

import { EMAIL_CONFIG } from './config'

/**
 * Wraps email content in consistent PatriotPledge branding
 */
export function wrapEmail(content: string): string {
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
                  1% platform fee + 1% nonprofit fee · 98% to recipients · Transparent and auditable
                </p>
                <p style="margin-top: 10px;">
                  <a href="${EMAIL_CONFIG.SITE_URL}" style="color: #3b82f6; text-decoration: none; font-size: 12px;">Visit Website</a>
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
