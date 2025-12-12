/**
 * Persona KYC Integration
 * 
 * Persona provides identity verification including:
 * - Government ID verification (driver's license, passport, etc.)
 * - Selfie verification with liveness detection
 * - Face matching between selfie and ID photo
 * - Document data extraction (name, DOB, address)
 * 
 * Setup:
 * 1. Create account at https://withpersona.com
 * 2. Create an Inquiry Template for your verification flow
 * 3. Get your API key and Template ID
 * 4. Add to .env.local:
 *    PERSONA_API_KEY=persona_sandbox_xxx (or persona_production_xxx)
 *    PERSONA_TEMPLATE_ID=itmpl_xxx
 *    PERSONA_WEBHOOK_SECRET=whs_xxx
 */

const PERSONA_API_KEY = process.env.PERSONA_API_KEY || ''
const PERSONA_TEMPLATE_ID = process.env.PERSONA_TEMPLATE_ID || ''
const PERSONA_API_BASE = 'https://withpersona.com/api/v1'

// Check if we're in sandbox mode
export const isPersonaSandbox = PERSONA_API_KEY.startsWith('persona_sandbox_')

export interface PersonaInquiry {
  id: string
  type: 'inquiry'
  attributes: {
    status: 'created' | 'pending' | 'completed' | 'failed' | 'expired' | 'needs_review'
    reference_id: string
    note: string | null
    created_at: string
    completed_at: string | null
    expired_at: string | null
  }
}

export interface CreateInquiryOptions {
  referenceId: string  // Our submission ID
  email?: string
  name?: string
  phone?: string
  fields?: Record<string, string>
}

/**
 * Create a new Persona inquiry (verification session)
 */
export async function createPersonaInquiry(options: CreateInquiryOptions): Promise<{
  success: boolean
  inquiryId?: string
  sessionToken?: string
  error?: string
}> {
  if (!PERSONA_API_KEY) {
    return { success: false, error: 'Persona API key not configured' }
  }
  if (!PERSONA_TEMPLATE_ID) {
    return { success: false, error: 'Persona template ID not configured' }
  }

  try {
    const response = await fetch(`${PERSONA_API_BASE}/inquiries`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERSONA_API_KEY}`,
        'Content-Type': 'application/json',
        'Persona-Version': '2023-01-05'
      },
      body: JSON.stringify({
        data: {
          attributes: {
            'inquiry-template-id': PERSONA_TEMPLATE_ID,
            'reference-id': options.referenceId,
            'fields': {
              'email-address': options.email || undefined,
              'name-first': options.name?.split(' ')[0] || undefined,
              'name-last': options.name?.split(' ').slice(1).join(' ') || undefined,
              'phone-number': options.phone || undefined,
              ...options.fields
            }
          }
        }
      })
    })

    const data = await response.json()

    console.log('[Persona] Create inquiry response status:', response.status)

    if (!response.ok) {
      console.error('[Persona] Create inquiry failed:', JSON.stringify(data, null, 2))
      return { 
        success: false, 
        error: data?.errors?.[0]?.detail || 'Failed to create verification session' 
      }
    }

    const inquiry = data.data
    const sessionToken = data.meta?.['session-token']

    console.log('[Persona] Inquiry created:', { 
      inquiryId: inquiry?.id, 
      hasSessionToken: !!sessionToken,
      inquiryStatus: inquiry?.attributes?.status 
    })

    return {
      success: true,
      inquiryId: inquiry.id,
      sessionToken
    }
  } catch (error: any) {
    console.error('[Persona] Create inquiry error:', error)
    return { success: false, error: error?.message || 'Network error' }
  }
}

/**
 * Resume an existing Persona inquiry
 */
export async function resumePersonaInquiry(inquiryId: string): Promise<{
  success: boolean
  sessionToken?: string
  error?: string
}> {
  if (!PERSONA_API_KEY) {
    return { success: false, error: 'Persona API key not configured' }
  }

  try {
    const response = await fetch(`${PERSONA_API_BASE}/inquiries/${inquiryId}/resume`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERSONA_API_KEY}`,
        'Content-Type': 'application/json',
        'Persona-Version': '2023-01-05'
      }
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[Persona] Resume inquiry failed:', data)
      return { 
        success: false, 
        error: data?.errors?.[0]?.detail || 'Failed to resume verification' 
      }
    }

    return {
      success: true,
      sessionToken: data.meta?.['session-token']
    }
  } catch (error: any) {
    console.error('[Persona] Resume inquiry error:', error)
    return { success: false, error: error?.message || 'Network error' }
  }
}

/**
 * Get inquiry status and details
 */
export async function getPersonaInquiry(inquiryId: string): Promise<{
  success: boolean
  inquiry?: PersonaInquiry
  error?: string
}> {
  if (!PERSONA_API_KEY) {
    return { success: false, error: 'Persona API key not configured' }
  }

  try {
    const response = await fetch(`${PERSONA_API_BASE}/inquiries/${inquiryId}`, {
      headers: {
        'Authorization': `Bearer ${PERSONA_API_KEY}`,
        'Persona-Version': '2023-01-05'
      }
    })

    const data = await response.json()

    if (!response.ok) {
      return { 
        success: false, 
        error: data?.errors?.[0]?.detail || 'Failed to get inquiry' 
      }
    }

    return {
      success: true,
      inquiry: data.data
    }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Network error' }
  }
}

/**
 * Verify webhook signature
 */
export function verifyPersonaWebhook(
  payload: string, 
  signature: string,
  secret: string = process.env.PERSONA_WEBHOOK_SECRET || ''
): boolean {
  if (!secret) return false
  
  // Persona uses HMAC-SHA256 for webhook signatures
  const crypto = require('crypto')
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

/**
 * Parse verification results from Persona webhook
 */
export function parsePersonaVerificationResult(webhookData: any): {
  inquiryId: string
  referenceId: string
  status: string
  faceMatch: boolean | null
  docVerified: boolean | null
  extractedData: {
    firstName?: string
    lastName?: string
    dateOfBirth?: string
    address?: {
      street?: string
      city?: string
      state?: string
      postalCode?: string
      country?: string
    }
    documentNumber?: string
    documentType?: string
    expirationDate?: string
  } | null
} {
  const inquiry = webhookData.data
  const included = webhookData.included || []
  
  // Find verification results in included resources
  const verifications = included.filter((r: any) => r.type === 'verification/government-id')
  const selfieVerification = included.find((r: any) => r.type === 'verification/selfie')
  
  // Extract document data
  let extractedData = null
  let docVerified = null
  
  if (verifications.length > 0) {
    const docVerification = verifications[0]
    docVerified = docVerification.attributes?.status === 'passed'
    
    const attrs = docVerification.attributes || {}
    extractedData = {
      firstName: attrs['name-first'],
      lastName: attrs['name-last'],
      dateOfBirth: attrs['birthdate'],
      address: {
        street: attrs['address-street-1'],
        city: attrs['address-city'],
        state: attrs['address-subdivision'],
        postalCode: attrs['address-postal-code'],
        country: attrs['address-country-code']
      },
      documentNumber: attrs['identification-number'],
      documentType: attrs['id-class'],
      expirationDate: attrs['expiration-date']
    }
  }
  
  // Check face match
  let faceMatch = null
  if (selfieVerification) {
    faceMatch = selfieVerification.attributes?.status === 'passed'
  }
  
  return {
    inquiryId: inquiry.id,
    referenceId: inquiry.attributes?.['reference-id'] || '',
    status: inquiry.attributes?.status || 'unknown',
    faceMatch,
    docVerified,
    extractedData
  }
}
