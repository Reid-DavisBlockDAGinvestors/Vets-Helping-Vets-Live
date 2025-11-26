import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// POST /api/cleanup/run -> process a small batch of cleanup_tasks
export async function POST(req: NextRequest) {
  try {
    // Admin auth: allow secret header or Supabase Auth bearer with admin role
    const secretHdr = req.headers.get('x-admin-secret')
    const isSecretOk = !!secretHdr && process.env.ADMIN_SECRET && secretHdr === process.env.ADMIN_SECRET

    let isAdmin = false
    if (!isSecretOk) {
      const auth = req.headers.get('authorization') || ''
      const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
      if (token) {
        const { data: userData } = await supabaseAdmin.auth.getUser(token)
        const uid = userData?.user?.id
        if (uid) {
          const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single()
          isAdmin = (profile?.role || '') === 'admin'
        }
      }
    }
    if (!isSecretOk && !isAdmin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

    // Load a small batch
    const { data: tasks, error: loadErr } = await supabaseAdmin
      .from('cleanup_tasks')
      .select('id, uri, asset_type, attempts, status')
      .in('status', ['queued','failed'])
      .lt('attempts', 3)
      .order('created_at', { ascending: true })
      .limit(10)
    if (loadErr) return NextResponse.json({ error: 'LOAD_FAILED', details: loadErr.message }, { status: 500 })

    const results: any[] = []
    for (const t of tasks || []) {
      const id = t.id
      try {
        const r = await tryDeleteUri(t.uri)
        const next = r.ok ? { status: 'done', attempts: t.attempts + 1, last_error: null } : { status: r.skip ? 'skipped' : 'failed', attempts: t.attempts + 1, last_error: r.error || 'unknown' }
        await supabaseAdmin.from('cleanup_tasks').update(next).eq('id', id)
        results.push({ id, uri: t.uri, ...r })
      } catch (e:any) {
        await supabaseAdmin.from('cleanup_tasks').update({ status: 'failed', attempts: t.attempts + 1, last_error: e?.message || String(e) }).eq('id', id)
        results.push({ id, uri: t.uri, ok: false, error: e?.message || String(e) })
      }
    }

    return NextResponse.json({ processed: results.length, results })
  } catch (e:any) {
    return NextResponse.json({ error: 'CLEANUP_RUN_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}

async function tryDeleteUri(uri: string): Promise<{ ok: boolean; skip?: boolean; error?: string }>{
  try {
    // Basic strategy:
    // - If Supabase Storage URL, delete via Supabase Storage API
    // - If STORACHA_DELETE_URL is provided, call it with API key for ipfs:// URIs
    // - Otherwise, if STORACHA_UPLOAD_URL is provided but no delete endpoint, return skip
    // - If no known handler, return skip
    const isIpfs = /^ipfs:\/\//i.test(uri)
    const delUrl = process.env.STORACHA_DELETE_URL || ''
    const bridge = process.env.STORACHA_UPLOAD_URL || ''
    const apiKey = process.env.STORACHA_API_KEY || ''
    const did = process.env.STORACHA_DID || ''
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

    // 1) Supabase Storage deletion
    try {
      const supa = new URL(supaUrl)
      const u = new URL(uri)
      const sameHost = !!supa.host && supa.host === u.host
      const isStoragePath = /\/storage\/v1\/object\//.test(u.pathname)
      if (sameHost && isStoragePath) {
        // Expected formats:
        // - /storage/v1/object/public/<bucket>/<path>
        // - /storage/v1/object/sign/<bucket>/<path>?token=...
        const parts = u.pathname.split('/') // ['', 'storage','v1','object','public|sign', '<bucket>', ...pathParts]
        const mode = parts[4] // 'public' | 'sign'
        const bucket = parts[5]
        const keyParts = parts.slice(6)
        if (bucket && keyParts.length > 0) {
          const key = decodeURIComponent(keyParts.join('/'))
          const { error } = await supabaseAdmin.storage.from(bucket).remove([key])
          if (error) return { ok: false, error: error.message }
          return { ok: true }
        }
      }
    } catch {}

    if (isIpfs && delUrl && apiKey) {
      const cid = uri.replace(/^ipfs:\/\//i, '').replace(/^ipfs\//i, '')
      const res = await fetch(delUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ cid, did: did || undefined })
      })
      if (!res.ok) {
        const data = await res.json().catch(()=>({}))
        return { ok: false, error: data?.error || `delete failed ${res.status}` }
      }
      return { ok: true }
    }

    if (isIpfs && bridge && apiKey) {
      // Unknown delete endpoint for this bridge; skip rather than guess
      return { ok: false, skip: true, error: 'no delete endpoint configured for bridge' }
    }

    // Unknown scheme -> skip
    return { ok: false, skip: true, error: 'no handler for uri' }
  } catch (e:any) {
    return { ok: false, error: e?.message || String(e) }
  }
}
