import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET: return { username, email, role } for the authenticated user
export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'MISSING_TOKEN' }, { status: 401 })

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) return NextResponse.json({ error: 'INVALID_TOKEN', details: userErr?.message }, { status: 401 })

    const uid = userData.user.id
    const email = userData.user.email || ''

    // Ensure profile row exists for this uid
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role, username')
      .eq('id', uid)
      .single()

    if (!profile) {
      // Create a minimal profile row
      await supabaseAdmin.from('profiles').insert({ id: uid, email }).select('username, email, role').single()
      return NextResponse.json({ username: null, email, role: 'user' })
    }

    return NextResponse.json({ username: profile?.username || null, email: profile?.email || email, role: profile?.role || 'user' })
  } catch (e: any) {
    return NextResponse.json({ error: 'PROFILE_GET_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}

// PATCH: { username } validates and updates own row; returns { ok: true, username }
export async function PATCH(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'MISSING_TOKEN' }, { status: 401 })

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) return NextResponse.json({ error: 'INVALID_TOKEN', details: userErr?.message }, { status: 401 })
    const uid = userData.user.id
    const email = userData.user.email || ''

    const body = await req.json().catch(() => null)
    const usernameRaw: string | undefined = body?.username
    if (!usernameRaw || typeof usernameRaw !== 'string') return NextResponse.json({ error: 'INVALID_USERNAME' }, { status: 400 })

    const username = usernameRaw.trim().toLowerCase()
    // Basic validation: 3-20 chars, letters/numbers/_ only, must start with letter
    if (!/^[a-z][a-z0-9_]{2,19}$/.test(username)) {
      return NextResponse.json({ error: 'USERNAME_INVALID_FORMAT', details: 'Use 3-20 chars, letters/numbers/underscore, start with a letter.' }, { status: 400 })
    }

    // Ensure profile row exists
    await supabaseAdmin.from('profiles').upsert({ id: uid, email }).eq('id', uid)

    // Try update; rely on DB unique constraint to enforce uniqueness
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ username })
      .eq('id', uid)
      .select('username')
      .single()

    if (error) {
      // If unique violation
      if ((error as any)?.code === '23505') {
        return NextResponse.json({ error: 'USERNAME_TAKEN' }, { status: 409 })
      }
      // Fallback check for uniqueness if DB constraint missing
      const { data: exists } = await supabaseAdmin.from('profiles').select('id').eq('username', username).maybeSingle()
      if (exists && exists.id !== uid) {
        return NextResponse.json({ error: 'USERNAME_TAKEN' }, { status: 409 })
      }
      return NextResponse.json({ error: 'USERNAME_UPDATE_FAILED', details: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, username: data?.username || username })
  } catch (e: any) {
    return NextResponse.json({ error: 'PROFILE_PATCH_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}
