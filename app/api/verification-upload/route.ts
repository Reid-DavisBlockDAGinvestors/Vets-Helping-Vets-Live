import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// Supported document types
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// Document categories
type DocCategory = 'selfie' | 'id_front' | 'id_back' | 'supporting'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const category = formData.get('category') as DocCategory | null
    const submissionId = formData.get('submission_id') as string | null
    const uniqueId = formData.get('unique_id') as string | null  // Can be wallet or email
    const walletAddress = formData.get('wallet_address') as string | null
    const email = formData.get('email') as string | null
    const docName = formData.get('doc_name') as string | null // For supporting docs: "DD-214", "Insurance Policy", etc.

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (!category || !['selfie', 'id_front', 'id_back', 'supporting'].includes(category)) {
      return NextResponse.json({ error: 'Invalid document category' }, { status: 400 })
    }
    // Require either wallet address OR email as identifier
    if (!uniqueId && !walletAddress && !email) {
      return NextResponse.json({ error: 'Wallet address or email required' }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Allowed: JPEG, PNG, WebP, PDF' 
      }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: 'File too large. Maximum size is 10MB' 
      }, { status: 400 })
    }

    // Generate unique filename - use wallet if available, otherwise use email hash
    const timestamp = Date.now()
    const identifier = uniqueId || walletAddress || email || 'unknown'
    // Create a safe folder name from the identifier
    const safeId = identifier.includes('@') 
      ? identifier.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)  // Email: sanitize
      : identifier.slice(0, 10).toLowerCase()                   // Wallet: first 10 chars
    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `${safeId}/${category}_${timestamp}.${ext}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage (verification-docs bucket)
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('verification-docs')
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error('[verification-upload] Storage error:', uploadError)
      return NextResponse.json({ 
        error: 'Upload failed', 
        details: uploadError.message 
      }, { status: 500 })
    }

    // Get the URL (private - requires signed URL for access)
    const { data: urlData } = supabaseAdmin.storage
      .from('verification-docs')
      .getPublicUrl(filename)

    // For private buckets, we store the path and generate signed URLs when needed
    const storedPath = `verification-docs/${filename}`

    // If we have a submission ID, update the submission record
    if (submissionId) {
      const updateField = category === 'selfie' ? 'verification_selfie'
        : category === 'id_front' ? 'verification_id_front'
        : category === 'id_back' ? 'verification_id_back'
        : null

      if (updateField) {
        // Update single field
        await supabaseAdmin
          .from('submissions')
          .update({ [updateField]: storedPath })
          .eq('id', submissionId)
      } else if (category === 'supporting') {
        // Append to supporting documents array
        const { data: existing } = await supabaseAdmin
          .from('submissions')
          .select('verification_documents')
          .eq('id', submissionId)
          .single()

        const docs = (existing?.verification_documents as any[]) || []
        docs.push({
          url: storedPath,
          type: docName || 'Supporting Document',
          name: file.name,
          uploaded_at: new Date().toISOString()
        })

        await supabaseAdmin
          .from('submissions')
          .update({ verification_documents: docs })
          .eq('id', submissionId)
      }
    }

    return NextResponse.json({
      success: true,
      path: storedPath,
      category,
      filename: file.name
    })

  } catch (error: any) {
    console.error('[verification-upload] Error:', error)
    return NextResponse.json({ 
      error: 'Upload failed', 
      details: error?.message 
    }, { status: 500 })
  }
}

// GET endpoint to generate signed URLs for viewing documents (admin only)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const path = searchParams.get('path')
    
    if (!path) {
      return NextResponse.json({ error: 'Path required' }, { status: 400 })
    }

    // TODO: Add admin authentication check here
    // For now, generate a signed URL that expires in 1 hour
    const bucketPath = path.replace('verification-docs/', '')
    
    const { data, error } = await supabaseAdmin.storage
      .from('verification-docs')
      .createSignedUrl(bucketPath, 3600) // 1 hour expiry

    if (error) {
      return NextResponse.json({ error: 'Failed to generate URL' }, { status: 500 })
    }

    return NextResponse.json({ url: data.signedUrl })

  } catch (error: any) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
