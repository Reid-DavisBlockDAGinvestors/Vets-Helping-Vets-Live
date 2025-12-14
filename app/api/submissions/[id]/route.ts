import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET /api/submissions/[id] - Fetch a submission by ID
// Creators can fetch their own submissions (by email match), admins can fetch any
export async function GET(req: NextRequest, context: { params: { id: string } }) {
  try {
    const { id } = context.params
    if (!id) return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 })

    // Get auth token
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    
    let userEmail: string | null = null
    let isAdmin = false
    
    if (token) {
      const { data: userData } = await supabaseAdmin.auth.getUser(token)
      const uid = userData?.user?.id
      userEmail = userData?.user?.email || null
      
      if (uid) {
        const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single()
        isAdmin = (profile?.role || '') === 'admin'
      }
    }

    // Fetch the submission
    const { data: submission, error } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !submission) {
      return NextResponse.json({ error: 'SUBMISSION_NOT_FOUND' }, { status: 404 })
    }

    // Check authorization: admin or creator (by email match)
    const isCreator = userEmail && submission.creator_email && 
      userEmail.toLowerCase() === submission.creator_email.toLowerCase()
    
    if (!isAdmin && !isCreator) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'You can only view your own submissions' }, { status: 403 })
    }

    return NextResponse.json({ ok: true, submission })
  } catch (e: any) {
    return NextResponse.json({ error: 'SUBMISSION_FETCH_ERROR', details: e?.message || String(e) }, { status: 500 })
  }
}

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
    console.log(`[delete] Attempting to delete submission ${id}, existing:`, existing ? 'found' : 'not found')
    
    const { error, count } = await supabaseAdmin.from('submissions').delete({ count: 'exact' }).eq('id', id)
    console.log(`[delete] Delete result: error=${error?.message || 'none'}, count=${count}`)
    
    if (error) return NextResponse.json({ error: 'SUBMISSION_DELETE_FAILED', code: error.code, details: error.message }, { status: 500 })
    
    // Verify deletion actually occurred
    if (count === 0) {
      console.log(`[delete] WARNING: No rows deleted for id ${id}`)
      return NextResponse.json({ error: 'SUBMISSION_NOT_DELETED', details: 'Row may be protected by RLS or does not exist' }, { status: 400 })
    }
    
    // Double-check the row is gone
    const { data: stillExists } = await supabaseAdmin.from('submissions').select('id').eq('id', id).single()
    if (stillExists) {
      console.log(`[delete] ERROR: Row still exists after delete!`)
      return NextResponse.json({ error: 'SUBMISSION_DELETE_FAILED', details: 'Row persisted after delete - check RLS policies' }, { status: 500 })
    }

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
