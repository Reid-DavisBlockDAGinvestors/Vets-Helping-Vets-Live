import { NextRequest, NextResponse } from 'next/server'
import { uploadJson, uploadFileBase64 } from '@/lib/storacha'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const meta: any = { ...body }
    
    // Debug logging
    const hasImage = typeof meta.image === 'string'
    const isDataUrl = hasImage && /^data:[^;]+;base64,/i.test(meta.image)
    console.log('[ipfs-json] Received:', { hasImage, isDataUrl, imageLength: meta.image?.length || 0 })
    
    // If image is a data URL, upload it first and replace field with returned URI
    let uploadedImageUri: string | null = null
    if (isDataUrl) {
      try {
        console.log('[ipfs-json] Uploading image to IPFS...')
        const up = await uploadFileBase64(meta.image)
        meta.image = up.uri
        uploadedImageUri = up.uri
        console.log('[ipfs-json] Image uploaded:', uploadedImageUri)
      } catch (imgErr: any) {
        console.error('[ipfs-json] Image upload failed:', imgErr?.message || imgErr)
      }
    }
    const { uri } = await uploadJson(meta)
    // Best-effort backend hint for debugging (avoid multi-line ternary to satisfy TS parser)
    let backend = 'fallback'
    if (typeof uri === 'string') {
      if (uri.startsWith('ipfs://')) backend = 'storacha'
      else if (uri.includes('.supabase.co/')) backend = 'supabase'
      else backend = 'fallback'
    }
    return NextResponse.json({ uri, backend, imageUri: uploadedImageUri })
  } catch (e: any) {
    console.error('ipfs-json error', e)
    return NextResponse.json({ error: 'UPLOAD_FAILED' }, { status: 500 })
  }
}
