import { NextRequest, NextResponse } from 'next/server'
import { uploadJson, uploadFileBase64 } from '@/lib/storacha'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const meta: any = { ...body }
    // If image is a data URL, upload it first and replace field with returned URI
    let uploadedImageUri: string | null = null
    if (typeof meta.image === 'string' && /^data:[^;]+;base64,/i.test(meta.image)) {
      try {
        const up = await uploadFileBase64(meta.image)
        meta.image = up.uri
        uploadedImageUri = up.uri
      } catch {}
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
