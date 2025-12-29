/**
 * Email Configuration - Centralized email settings
 */

export const EMAIL_CONFIG = {
  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://patriotpledgenfts.netlify.app',
  CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890',
  EXPLORER_URL: 'https://awakening.bdagscan.com',
  FROM_EMAIL: process.env.FROM_EMAIL || 'patriotpledgenfts@vetshelpingvets.life',
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  ADMIN_EMAIL: process.env.ADMIN_NOTIFICATION_EMAIL || 'reid@blockdaginvestors.com',
} as const

export const STATUS_LABELS: Record<string, string> = {
  new: '🆕 New',
  investigating: '🔍 Investigating',
  in_progress: '🔧 In Progress',
  resolved: '✅ Resolved',
  wont_fix: '❌ Won\'t Fix',
  duplicate: '📋 Duplicate',
}
