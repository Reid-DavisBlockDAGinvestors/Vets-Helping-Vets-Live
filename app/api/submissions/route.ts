import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendSubmissionConfirmation, sendAdminNewSubmission } from '@/lib/mailer'

// POST /api/submissions  -> create a new creator submission (status=pending)
export async function POST(req: NextRequest) {
  console.log('[submissions] POST request received')
  try {
    // Require authentication
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : ''
    
    let userId: string | null = null
    let authEmail: string | null = null
    let isEmailVerified = false
    
    if (token) {
      const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token)
      if (!authErr && userData?.user) {
        userId = userData.user.id
        authEmail = userData.user.email || null
        isEmailVerified = !!userData.user.email_confirmed_at
      }
    }
    
    // Require authenticated user
    if (!userId || !authEmail) {
      console.log('[submissions] BLOCKED: No authenticated user')
      return NextResponse.json({ 
        error: 'AUTHENTICATION_REQUIRED', 
        message: 'Please log in to submit a campaign. Create an account if you don\'t have one.' 
      }, { status: 401 })
    }
    
    // Require verified email
    if (!isEmailVerified) {
      console.log('[submissions] BLOCKED: Email not verified for user:', authEmail)
      return NextResponse.json({ 
        error: 'EMAIL_NOT_VERIFIED', 
        message: 'Please verify your email address before submitting a campaign. Check your inbox for the verification link.' 
      }, { status: 403 })
    }
    
    const body = await req.json().catch(()=>null)
    console.log('[submissions] Body parsed:', body ? 'success' : 'failed')
    if (!body) return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
    const { 
      title, story, category, goal, 
      creator_wallet, creator_email, creator_name, creator_phone, creator_address,
      image_uri, metadata_uri,
      verification_selfie, verification_id_front, verification_id_back, verification_documents,
      // Didit KYC verification
      didit_session_id, didit_status
    } = body
    
    // Use authenticated email, not the one from the body (security)
    const verifiedEmail = authEmail
    
    if (!metadata_uri) return NextResponse.json({ error: 'MISSING_METADATA_URI' }, { status: 400 })

    const payload: Record<string, any> = {
      title: title || null,
      story: story || null,
      category: category || 'general',
      goal: typeof goal === 'number' ? goal : null,
      creator_wallet: creator_wallet || null,  // Optional - can be added later
      creator_email: verifiedEmail,  // Use authenticated email for security
      user_id: userId,  // Link to authenticated user
      creator_name: creator_name || null,
      creator_phone: creator_phone || null,
      creator_address: creator_address || null,
      image_uri: image_uri || null,
      metadata_uri,
      status: 'pending',
      // Verification documents
      verification_selfie: verification_selfie || null,
      verification_id_front: verification_id_front || null,
      verification_id_back: verification_id_back || null,
      verification_documents: verification_documents || [],
      verification_status: didit_status === 'Approved' ? 'verified' : 'pending',
      // Didit KYC verification
      didit_session_id: didit_session_id || null,
      didit_status: didit_status || 'Not Started',
    }
    console.log('[submissions] Inserting submission for:', creator_email)
    const { data, error } = await supabaseAdmin.from('submissions').insert(payload).select('*').single()
    if (error) {
      console.error('[submissions] Insert failed:', error.code, error.message)
      return NextResponse.json({ error: 'SUBMISSION_INSERT_FAILED', code: error.code, details: error.message }, { status: 500 })
    }
    console.log('[submissions] Insert successful, id:', data.id)
    // Best-effort: ensure a profiles row exists for this email (for wallet-only users)
    try {
      // Try update-by-email if such row exists
      const { data: prof } = await supabaseAdmin.from('profiles').select('email').eq('email', verifiedEmail).maybeSingle()
      if (prof) {
        await supabaseAdmin.from('profiles').update({ email: verifiedEmail }).eq('email', verifiedEmail)
      } else {
        // Attempt insert; schema may require id — ignore errors
        await supabaseAdmin.from('profiles').insert({ email: verifiedEmail, id: userId })
      }
    } catch {}
    // Send receipt email to creator (best-effort)
    try {
      console.log('[submissions] Sending confirmation email to:', verifiedEmail)
      const emailResult = await sendSubmissionConfirmation({
        email: verifiedEmail,
        submissionId: data.id,
        title: title || 'Your Campaign',
        creatorName: creator_name
      })
      console.log('[submissions] Email result:', emailResult)
    } catch (emailErr) {
      console.error('[submissions] Failed to send confirmation email:', emailErr)
    }
    
    // Send notification email to admins who can approve campaigns (best-effort)
    try {
      console.log('[submissions] Fetching admins with campaign approval permissions')
      // Get all admins with canManageCampaigns permission (super_admin and admin roles)
      const { data: admins } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .in('role', ['super_admin', 'admin'])
        .not('email', 'is', null)
      
      const adminEmails = admins?.map(a => a.email).filter(Boolean) as string[] || []
      console.log('[submissions] Found admins to notify:', adminEmails.length)
      
      if (adminEmails.length > 0) {
        const adminEmailResult = await sendAdminNewSubmission({
          submissionId: data.id,
          title: title || 'Untitled Campaign',
          creatorName: creator_name,
          creatorEmail: creator_email,
          category: category || 'general',
          goal: typeof goal === 'number' ? goal : undefined,
          adminEmails
        })
        console.log('[submissions] Admin notification result:', adminEmailResult)
      } else {
        console.log('[submissions] No admins found, using fallback email')
        await sendAdminNewSubmission({
          submissionId: data.id,
          title: title || 'Untitled Campaign',
          creatorName: creator_name,
          creatorEmail: creator_email,
          category: category || 'general',
          goal: typeof goal === 'number' ? goal : undefined
        })
      }
    } catch (adminEmailErr) {
      console.error('[submissions] Failed to send admin notification:', adminEmailErr)
    }
    
    return NextResponse.json({ id: data.id, status: data.status })
  } catch (e:any) {
    return NextResponse.json({ error: 'SUBMISSION_CREATE_ERROR', details: e?.message || String(e) }, { status: 500 })
  }
}

// PUT /api/submissions -> update a submission (admin only)
export async function PUT(req: NextRequest) {
  try {
    // Require admin auth
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    const { data: userData } = token ? await supabaseAdmin.auth.getUser(token) : { data: null as any }
    const uid = userData?.user?.id
    const { data: profile } = uid ? await supabaseAdmin.from('profiles').select('role').eq('id', uid).single() : { data: null as any }
    if (!['admin', 'super_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
    
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })

    // Allowed fields for update
    const allowedFields = [
      'title', 'story', 'category', 'goal', 'status',
      'creator_wallet', 'creator_email', 'creator_name', 'creator_phone', 'creator_address',
      'image_uri', 'metadata_uri',
      'verification_status', 'verification_selfie', 'verification_id_front', 'verification_id_back',
      'verification_documents',
      // NFT/Campaign settings
      'nft_price', 'nft_editions', 'nft_editions_remaining',
      'num_copies', 'price_per_copy', // legacy field names
      'campaign_id', 'tx_hash', 'minted_at', 'contract_address', 'visible_on_marketplace',
      // Admin notes
      'admin_notes', 'reviewed_by', 'reviewed_at'
    ]

    const updatePayload: Record<string, any> = {}
    for (const key of allowedFields) {
      if (key in updates) {
        updatePayload[key] = updates[key]
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'NO_VALID_FIELDS' }, { status: 400 })
    }

    // Add updated_at timestamp
    updatePayload.updated_at = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('submissions')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: 'UPDATE_FAILED', details: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: 'SUBMISSION_UPDATE_ERROR', details: e?.message || String(e) }, { status: 500 })
  }
}

// DELETE /api/submissions -> delete a submission and all related data (admin only)
export async function DELETE(req: NextRequest) {
  try {
    // Require admin auth
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    const { data: userData } = token ? await supabaseAdmin.auth.getUser(token) : { data: null as any }
    const uid = userData?.user?.id
    const { data: profile } = uid ? await supabaseAdmin.from('profiles').select('role').eq('id', uid).single() : { data: null as any }
    if (!['admin', 'super_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })

    // First, get the submission to check for related data
    const { data: submission, error: fetchError } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !submission) {
      return NextResponse.json({ error: 'SUBMISSION_NOT_FOUND' }, { status: 404 })
    }

    // Delete related campaign updates
    const { error: updatesError } = await supabaseAdmin
      .from('campaign_updates')
      .delete()
      .eq('submission_id', id)

    if (updatesError) {
      console.error('[DELETE] Failed to delete campaign updates:', updatesError)
      // Continue anyway - updates might not exist
    }

    // Delete any uploaded files from storage (if using Supabase storage)
    const filesToDelete: string[] = []
    if (submission.verification_selfie) filesToDelete.push(submission.verification_selfie)
    if (submission.verification_id_front) filesToDelete.push(submission.verification_id_front)
    if (submission.verification_id_back) filesToDelete.push(submission.verification_id_back)
    if (submission.verification_documents?.length) {
      for (const doc of submission.verification_documents) {
        if (doc.url) filesToDelete.push(doc.url)
      }
    }

    // Try to delete files from Supabase storage (best-effort)
    for (const fileUrl of filesToDelete) {
      try {
        // Extract path from Supabase storage URL
        const match = fileUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/)
        if (match) {
          const [, bucket, path] = match
          await supabaseAdmin.storage.from(bucket).remove([path])
        }
      } catch (fileErr) {
        console.error('[DELETE] File deletion failed (non-critical):', fileErr)
      }
    }

    // Finally, delete the submission itself
    const { error: deleteError } = await supabaseAdmin
      .from('submissions')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json({ error: 'DELETE_FAILED', details: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      deleted: {
        submission: id,
        updates: !updatesError,
        files: filesToDelete.length
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'SUBMISSION_DELETE_ERROR', details: e?.message || String(e) }, { status: 500 })
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
    if (!['admin', 'super_admin'].includes(profile?.role || '') && !isSecretOk) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

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
