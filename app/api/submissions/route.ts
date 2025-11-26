import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendEmail } from '@/lib/mailer'

// POST /api/submissions  -> create a new creator submission (status=pending)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(()=>null)
    if (!body) return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
    const { title, story, category, goal, creator_wallet, creator_email, image_uri, metadata_uri } = body
    if (!creator_wallet) return NextResponse.json({ error: 'MISSING_WALLET' }, { status: 400 })
    if (!creator_email) return NextResponse.json({ error: 'MISSING_EMAIL' }, { status: 400 })
    if (!metadata_uri) return NextResponse.json({ error: 'MISSING_METADATA_URI' }, { status: 400 })

    const payload = {
      title: title || null,
      story: story || null,
      category: category || 'general',
      goal: typeof goal === 'number' ? goal : null,
      creator_wallet,
      creator_email,
      image_uri: image_uri || null,
      metadata_uri,
      status: 'pending',
    }
    const { data, error } = await supabaseAdmin.from('submissions').insert(payload).select('*').single()
    if (error) {
      return NextResponse.json({ error: 'SUBMISSION_INSERT_FAILED', code: error.code, details: error.message }, { status: 500 })
    }
    // Best-effort: ensure a profiles row exists for this email (for wallet-only users)
    try {
      // Try update-by-email if such row exists
      const { data: prof } = await supabaseAdmin.from('profiles').select('email').eq('email', creator_email).maybeSingle()
      if (prof) {
        await supabaseAdmin.from('profiles').update({ email: creator_email }).eq('email', creator_email)
      } else {
        // Attempt insert; schema may require id — ignore errors
        await supabaseAdmin.from('profiles').insert({ email: creator_email })
      }
    } catch {}
    // Send receipt email (best-effort)
    try {
      // Personalize with username when available
      let uname: string | null = null
      try {
        const { data: profU } = await supabaseAdmin.from('profiles').select('username').eq('email', creator_email).maybeSingle()
        uname = profU?.username || null
      } catch {}
      await sendEmail({
        to: creator_email,
        subject: 'Submission received',
        html: `<p>${uname ? `Hi ${uname},` : 'Thanks for your submission.'}</p><p>ID: ${data.id}</p><p>We will review and notify you on approval.</p>`
      })
    } catch {}
    return NextResponse.json({ id: data.id, status: data.status })
  } catch (e:any) {
    return NextResponse.json({ error: 'SUBMISSION_CREATE_ERROR', details: e?.message || String(e) }, { status: 500 })
  }
}

// GET /api/submissions -> list submissions (basic, unauthenticated; restrict in future via RLS or admin auth)
export async function GET(req: NextRequest) {
  try {
    // Require admin role (temporary fallback: allow secret header while migrating to Supabase Auth)
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    const { data: userData } = token ? await supabaseAdmin.auth.getUser(token) : { data: null as any }
    const uid = userData?.user?.id
    const { data: profile } = uid ? await supabaseAdmin.from('profiles').select('role').eq('id', uid).single() : { data: null as any }
    const secretHdr = req.headers.get('x-admin-secret')
    const isSecretOk = !!secretHdr && process.env.ADMIN_SECRET && secretHdr === process.env.ADMIN_SECRET
    if ((profile?.role || '') !== 'admin' && !isSecretOk) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

    const { data, error, count } = await supabaseAdmin
      .from('submissions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) return NextResponse.json({ error: 'SUBMISSION_LIST_FAILED', details: error.message }, { status: 500 })
    const items = data || []
    const emails = Array.from(new Set(items.map((s: any) => s.creator_email).filter(Boolean)))
    let usernames: Record<string, string> = {}
    if (emails.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from('profiles')
        .select('email, username')
        .in('email', emails as any)
      for (const p of profs || []) {
        if (p?.email && p?.username) usernames[p.email] = p.username
      }
    }
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const dbg = process.env.NODE_ENV === 'production' ? undefined : { dbCount: count ?? null }
    return new NextResponse(JSON.stringify({ items, usernames, count: items.length, ...dbg }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Supabase-Url': supaUrl }
    })
  } catch (e:any) {
    return NextResponse.json({ error: 'SUBMISSION_LIST_ERROR', details: e?.message || String(e) }, { status: 500 })
  }
}
