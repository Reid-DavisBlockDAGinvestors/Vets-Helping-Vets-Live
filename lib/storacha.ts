// Storage helpers: Pinata for IPFS, Supabase as fallback

import { PinataSDK } from 'pinata'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

const PINATA_JWT = process.env.PINATA_JWT || ''
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || 'gateway.pinata.cloud'

// Get Pinata client
function getPinataClient() {
  if (!PINATA_JWT) return null
  return new PinataSDK({ pinataJwt: PINATA_JWT, pinataGateway: PINATA_GATEWAY })
}

// Upload to IPFS via Pinata
async function uploadToPinata(bytes: Uint8Array, contentType: string, filename?: string): Promise<{ cid: string; uri: string } | null> {
  const pinata = getPinataClient()
  if (!pinata) {
    logger.debug('[Pinata] No JWT configured, skipping IPFS upload')
    return null
  }
  
  try {
    const ext = contentType.split('/')[1] || 'bin'
    const name = filename || `upload-${Date.now()}.${ext}`
    const file = new File([Buffer.from(bytes)], name, { type: contentType })
    
    logger.debug(`[Pinata] Uploading ${bytes.length} bytes as ${contentType}...`)
    const result = await pinata.upload.public.file(file)
    const cid = result.cid
    const uri = `ipfs://${cid}`
    logger.debug(`[Pinata] Uploaded: ${uri}`)
    return { cid, uri }
  } catch (e: any) {
    console.error('[Pinata] Upload failed:', e?.message || e)
    return null
  }
}

// Fallback: Upload to Supabase Storage
async function uploadToSupabase(bytes: Uint8Array, filename: string, contentType: string, bucket = 'nft-assets') {
  try {
    const client = process.env.SUPABASE_SERVICE_ROLE_KEY ? supabaseAdmin : supabase
    const { data, error } = await client.storage.from(bucket).upload(filename, bytes, { contentType, upsert: true })
    if (error) throw error
    const { data: pub } = client.storage.from(bucket).getPublicUrl(filename)
    const uri = pub?.publicUrl
    logger.debug(`[Supabase] Uploaded: ${uri}`)
    return uri ? { cid: undefined as any, uri } : null
  } catch (e) {
    console.error('[Supabase] Upload failed:', e)
    return null
  }
}

/**
 * Upload JSON metadata to IPFS (Pinata) or fallback to Supabase
 */
export async function uploadJson(json: any) {
  const payload = JSON.stringify(json)
  const bytes = new TextEncoder().encode(payload)
  
  // Try Pinata first (IPFS)
  const ipfs = await uploadToPinata(bytes, 'application/json', 'metadata.json')
  if (ipfs) return ipfs
  
  // Fallback to Supabase
  const ts = Date.now()
  const supa = await uploadToSupabase(bytes, `metadata/${ts}.json`, 'application/json')
  if (supa) return supa
  
  // Last resort placeholder
  const cid = 'bafyplaceholderjson'
  return { cid, uri: `ipfs://${cid}` }
}

/**
 * Upload image/file from base64 data URL to IPFS (Pinata) or fallback to Supabase
 */
export async function uploadFileBase64(dataUrl: string) {
  // Parse data:[mime];base64,...
  const m = /^data:([^;]+);base64,(.*)$/i.exec(dataUrl || '')
  if (!m) return { cid: undefined as any, uri: dataUrl }
  
  const mime = m[1]
  const b64 = m[2]
  const bytes = Uint8Array.from(Buffer.from(b64, 'base64'))
  
  // Try Pinata first (IPFS)
  const ipfs = await uploadToPinata(bytes, mime)
  if (ipfs) return ipfs
  
  // Fallback to Supabase
  const ts = Date.now()
  const supa = await uploadToSupabase(bytes, `media/${ts}`, mime)
  if (supa) return supa
  
  // Last resort placeholder
  const cid = 'bafyplaceholderfile'
  return { cid, uri: `ipfs://${cid}` }
}

// Note: Use ipfsToHttp from @/lib/ipfs for converting IPFS URIs to HTTP gateway URLs
