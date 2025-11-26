import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>({})) as any
  const secret = body?.secret
  const email = (body?.email || '').toString().trim().toLowerCase()
  const password = body?.password

  // Secret-based auth
  if (secret && process.env.ADMIN_SECRET && secret === process.env.ADMIN_SECRET) {
    return NextResponse.json({ ok: true, mode: 'secret' })
  }
  // Email/password env-based auth
  const envEmail = (process.env.ADMIN_EMAIL || '').toLowerCase()
  const envPass = process.env.ADMIN_PASSWORD || ''
  if (envEmail && envPass && email === envEmail && password === envPass) {
    return NextResponse.json({ ok: true, mode: 'password' })
  }
  return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
}
