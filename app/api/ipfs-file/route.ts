import { NextRequest, NextResponse } from 'next/server'
import { uploadFileBase64 } from '@/lib/storacha'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const { dataUrl } = await req.json()
    if (!dataUrl) return NextResponse.json({ error: 'NO_FILE' }, { status: 400 })
    const { uri } = await uploadFileBase64(dataUrl)
    return NextResponse.json({ uri })
  } catch (e: any) {
    logger.error('[ipfs-file] Error:', e)
    return NextResponse.json({ error: 'UPLOAD_FAILED' }, { status: 500 })
  }
}
