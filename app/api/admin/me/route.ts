import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'MISSING_TOKEN' }, { status: 401 })

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) return NextResponse.json({ error: 'INVALID_TOKEN', details: userErr?.message }, { status: 401 })

    const uid = userData.user.id
    const userEmail = userData.user.email || ''
    const bootstrapAdminEmail = process.env.ADMIN_EMAIL || ''
    let profileRole = 'user'

    let { data: profile } = await supabaseAdmin.from('profiles').select('role,email').eq('id', uid).maybeSingle()

    if (!profile) {
      // Create profile row if missing
      const roleToSet = userEmail && bootstrapAdminEmail && userEmail.toLowerCase() === bootstrapAdminEmail.toLowerCase() ? 'admin' : 'user'
      await supabaseAdmin.from('profiles').upsert({ id: uid, email: userEmail, role: roleToSet }).eq('id', uid)
      profileRole = roleToSet
    } else {
      profileRole = profile?.role || 'user'
      // Promote to admin if bootstrap email matches (idempotent)
      if (userEmail && bootstrapAdminEmail && userEmail.toLowerCase() === bootstrapAdminEmail.toLowerCase() && profileRole !== 'admin') {
        await supabaseAdmin.from('profiles').update({ role: 'admin' }).eq('id', uid)
        profileRole = 'admin'
      }
    }

    return NextResponse.json({ userId: uid, email: profile?.email || userEmail, role: profileRole })
  } catch (e:any) {
    return NextResponse.json({ error: 'ADMIN_ME_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}
