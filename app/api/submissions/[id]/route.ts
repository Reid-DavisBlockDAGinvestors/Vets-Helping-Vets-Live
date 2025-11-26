import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  try {
    const { id } = context.params
    const body = await req.json().catch(()=>null)
    if (!id || !body) return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 })

    // Admin auth: either secret header or Supabase Auth bearer with admin role
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

    if (!isSecretOk && !isAdmin) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }
    const allowed: Record<string, any> = {}
    for (const k of ['title','story','category','goal','creator_wallet','creator_email','image_uri','metadata_uri','reviewer_notes','status','price_per_copy','num_copies','benchmarks']) {
      if (k in body) allowed[k] = body[k]
    }
    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'NO_FIELDS' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.from('submissions').update(allowed).eq('id', id).select('*').single()
    if (error) return NextResponse.json({ error: 'SUBMISSION_UPDATE_FAILED', code: error.code, details: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, item: data })
  } catch (e:any) {
    return NextResponse.json({ error: 'SUBMISSION_UPDATE_ERROR', details: e?.message || String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: { params: { id: string } }) {
  try {
    const { id } = context.params
    if (!id) return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 })

    // Admin auth: either secret header or Supabase Auth bearer with admin role
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

    const { data: existing } = await supabaseAdmin.from('submissions').select('image_uri, metadata_uri').eq('id', id).single()
    const { error } = await supabaseAdmin.from('submissions').delete().eq('id', id)
    if (error) return NextResponse.json({ error: 'SUBMISSION_DELETE_FAILED', code: error.code, details: error.message }, { status: 500 })

    try {
      const tasks: any[] = []
      if (existing?.image_uri) tasks.push({ uri: existing.image_uri, asset_type: 'image' })
      if (existing?.metadata_uri) tasks.push({ uri: existing.metadata_uri, asset_type: 'metadata' })
      if (tasks.length > 0) {
        await supabaseAdmin.from('cleanup_tasks').insert(tasks)
      }
    } catch {}

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'SUBMISSION_DELETE_ERROR', details: e?.message || String(e) }, { status: 500 })
  }
}
