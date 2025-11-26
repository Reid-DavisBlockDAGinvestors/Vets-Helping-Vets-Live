// Storage helpers: Supabase Storage only (unwired Storacha). Placeholder as last resort.

import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'


async function uploadToSupabase(bytes: Uint8Array, filename: string, contentType: string, bucket = 'nft-assets') {
  try {
    const client = process.env.SUPABASE_SERVICE_ROLE_KEY ? supabaseAdmin : supabase
    const { data, error } = await client.storage.from(bucket).upload(filename, bytes, { contentType, upsert: true })
    if (error) throw error
    const { data: pub } = client.storage.from(bucket).getPublicUrl(filename)
    const uri = pub?.publicUrl
    return uri ? { cid: undefined as any, uri } : null
  } catch {
    return null
  }
}

// Storacha upload disabled

export async function uploadJson(json: any) {
  const payload = JSON.stringify(json)
  const bytes = new TextEncoder().encode(payload)
  // Try Supabase first
  const ts = Date.now()
  const supa = await uploadToSupabase(bytes, `metadata/${ts}.json`, 'application/json')
  if (supa) return supa
  // Fallback placeholder
  const cid = 'bafyplaceholderjson'
  return { cid, uri: `ipfs://${cid}` }
}

export async function uploadFileBase64(dataUrl: string) {
  // data:[mime];base64,....
  const m = /^data:([^;]+);base64,(.*)$/i.exec(dataUrl || '')
  if (!m) return { cid: undefined as any, uri: dataUrl }
  const mime = m[1]
  const b64 = m[2]
  const bytes = Uint8Array.from(Buffer.from(b64, 'base64'))
  // Try Supabase first
  const ts = Date.now()
  const supa = await uploadToSupabase(bytes, `media/${ts}`, mime)
  if (supa) return supa
  // Fallback placeholder
  const cid = 'bafyplaceholderfile'
  return { cid, uri: `ipfs://${cid}` }
}
