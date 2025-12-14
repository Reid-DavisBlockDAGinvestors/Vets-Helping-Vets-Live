/**
 * Didit KYC Verification Integration
 * https://docs.didit.me/reference/api-full-flow
 */

const DIDIT_API_BASE = 'https://verification.didit.me'
const DIDIT_API_KEY = process.env.DIDIT_API_KEY || ''
const DIDIT_WEBHOOK_SECRET = process.env.DIDIT_WEBHOOK_SECRET || ''
const DIDIT_WORKFLOW_ID = process.env.DIDIT_WORKFLOW_ID || ''

export type DiditSessionStatus = 
  | 'Not Started'
  | 'In Progress' 
  | 'Pending Review'
  | 'Approved'
  | 'Declined'
  | 'Expired'

export type DiditSession = {
  session_id: string
  status: DiditSessionStatus
  url?: string
  session_number?: number
  session_token?: string
  vendor_data?: string
  workflow_id?: string
  metadata?: Record<string, any>
  callback?: string
}

export type CreateSessionOptions = {
  vendorData: string  // Our submission ID or user identifier
  email?: string
  phone?: string
  callbackUrl?: string
  metadata?: Record<string, any>
}

/**
 * Create a new verification session
 * Returns the session with URL to redirect user to
 */
export async function createVerificationSession(options: CreateSessionOptions): Promise<{
  success: boolean
  session?: DiditSession
  error?: string
}> {
  if (!DIDIT_API_KEY) {
    return { success: false, error: 'DIDIT_API_KEY not configured' }
  }

  if (!DIDIT_WORKFLOW_ID) {
    return { success: false, error: 'DIDIT_WORKFLOW_ID not configured - create a workflow at business.didit.me/workflows' }
  }

  try {
    // Determine base URL for callback - prioritize explicit config
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL 
      || process.env.NEXT_PUBLIC_BASE_URL 
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || (process.env.URL ? process.env.URL : null) // Netlify sets URL
      || 'https://patriotpledgenfts.netlify.app'
    
    console.log('[Didit] Using base URL for callback:', baseUrl)
    
    const body: Record<string, any> = {
      workflow_id: DIDIT_WORKFLOW_ID,
      vendor_data: options.vendorData,
      callback: options.callbackUrl || `${baseUrl}/verification-complete`,
    }

    // Add contact details if provided
    if (options.email || options.phone) {
      body.contact_details = {}
      if (options.email) body.contact_details.email = options.email
      if (options.phone) body.contact_details.phone = options.phone
    }

    // Add metadata if provided
    if (options.metadata) {
      body.metadata = options.metadata
    }

    console.log('[Didit] Creating session:', { vendorData: options.vendorData, email: options.email })

    const response = await fetch(`${DIDIT_API_BASE}/v2/session/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': DIDIT_API_KEY,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[Didit] Create session failed:', data)
      return { success: false, error: data?.message || data?.error || 'Failed to create session' }
    }

    console.log('[Didit] Session created:', data.session_id)
    return { success: true, session: data }
  } catch (error: any) {
    console.error('[Didit] Create session error:', error)
    return { success: false, error: error?.message || 'Network error' }
  }
}

/**
 * Get verification session decision/results
 */
export async function getSessionDecision(sessionId: string): Promise<{
  success: boolean
  decision?: any
  error?: string
}> {
  if (!DIDIT_API_KEY) {
    return { success: false, error: 'DIDIT_API_KEY not configured' }
  }

  try {
    const response = await fetch(`${DIDIT_API_BASE}/v2/session/${sessionId}/decision/`, {
      method: 'GET',
      headers: {
        'X-Api-Key': DIDIT_API_KEY,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[Didit] Get decision failed:', data)
      return { success: false, error: data?.message || 'Failed to get decision' }
    }

    return { success: true, decision: data }
  } catch (error: any) {
    console.error('[Didit] Get decision error:', error)
    return { success: false, error: error?.message || 'Network error' }
  }
}

/**
 * Get session status and details
 */
export async function getSession(sessionId: string): Promise<{
  success: boolean
  session?: DiditSession
  error?: string
}> {
  if (!DIDIT_API_KEY) {
    return { success: false, error: 'DIDIT_API_KEY not configured' }
  }

  // Use the /decision/ endpoint to get session status
  const url = `${DIDIT_API_BASE}/v2/session/${sessionId}/decision/`
  console.log('[Didit] Getting session decision from:', url)
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': DIDIT_API_KEY,
        'Content-Type': 'application/json',
      },
    })

    console.log('[Didit] Response status:', response.status, response.statusText)
    
    // Check if response is JSON
    const contentType = response.headers.get('content-type')
    console.log('[Didit] Response content-type:', contentType)
    
    const rawText = await response.text()
    console.log('[Didit] Raw response (first 500 chars):', rawText.slice(0, 500))
    
    // Try to parse as JSON
    let data: any
    try {
      data = JSON.parse(rawText)
    } catch (parseErr) {
      console.error('[Didit] Failed to parse response as JSON')
      return { success: false, error: `Invalid response from Didit API: ${rawText.slice(0, 100)}` }
    }
    
    console.log('[Didit] Get session parsed response:', JSON.stringify(data, null, 2))

    if (!response.ok) {
      console.error('[Didit] Get session failed:', data)
      return { success: false, error: data?.message || data?.detail || `HTTP ${response.status}` }
    }

    // Normalize the session data
    const session: DiditSession = {
      session_id: data.session_id || data.id,
      status: data.status,
      url: data.url || data.verification_url,
    }
    
    console.log('[Didit] Normalized session:', session)

    return { success: true, session }
  } catch (error: any) {
    console.error('[Didit] Get session error:', error?.message || error)
    return { success: false, error: error?.message || 'Network error' }
  }
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!DIDIT_WEBHOOK_SECRET) {
    console.warn('[Didit] Webhook secret not configured')
    return false
  }

  try {
    const crypto = require('crypto')
    const expectedSignature = crypto
      .createHmac('sha256', DIDIT_WEBHOOK_SECRET)
      .update(payload)
      .digest('base64')
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch (error) {
    console.error('[Didit] Signature verification error:', error)
    return false
  }
}

/**
 * Parse Didit verification status to our internal format
 */
export function parseVerificationStatus(diditStatus: DiditSessionStatus): {
  status: 'pending' | 'verified' | 'failed' | 'expired'
  passed: boolean
} {
  switch (diditStatus) {
    case 'Approved':
      return { status: 'verified', passed: true }
    case 'Declined':
      return { status: 'failed', passed: false }
    case 'Expired':
      return { status: 'expired', passed: false }
    case 'Not Started':
    case 'In Progress':
    case 'Pending Review':
    default:
      return { status: 'pending', passed: false }
  }
}
