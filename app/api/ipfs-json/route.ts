import { NextRequest, NextResponse } from 'next/server'
import { uploadJson } from '@/lib/storacha'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { uri } = await uploadJson(body)
    return NextResponse.json({ uri })
  } catch (e: any) {
    console.error('ipfs-json error', e)
    return NextResponse.json({ error: 'UPLOAD_FAILED' }, { status: 500 })
  }
}
