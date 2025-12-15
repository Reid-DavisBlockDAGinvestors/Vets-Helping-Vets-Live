import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// POST - Upload a screenshot for bug report
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)
    const extension = file.name.split('.').pop() || 'png'
    const filename = `bug-screenshot-${timestamp}-${randomId}.${extension}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from('bug-screenshots')
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (error) {
      console.error('[bug-reports/upload] Storage error:', error)
      
      // If bucket doesn't exist, try to create it
      if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
        // Try creating the bucket
        const { error: bucketError } = await supabaseAdmin.storage.createBucket('bug-screenshots', {
          public: true
        })
        
        if (!bucketError) {
          // Retry upload
          const { data: retryData, error: retryError } = await supabaseAdmin.storage
            .from('bug-screenshots')
            .upload(filename, buffer, {
              contentType: file.type,
              upsert: false
            })
          
          if (retryError) {
            return NextResponse.json(
              { error: 'Failed to upload screenshot', details: retryError.message },
              { status: 500 }
            )
          }
          
          // Get public URL
          const { data: urlData } = supabaseAdmin.storage
            .from('bug-screenshots')
            .getPublicUrl(filename)

          return NextResponse.json({
            success: true,
            url: urlData.publicUrl,
            filename
          })
        }
      }
      
      return NextResponse.json(
        { error: 'Failed to upload screenshot', details: error.message },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('bug-screenshots')
      .getPublicUrl(filename)

    console.log('[bug-reports/upload] Screenshot uploaded:', filename)

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      filename
    })
  } catch (e: any) {
    console.error('[bug-reports/upload] Error:', e)
    return NextResponse.json(
      { error: 'Failed to upload screenshot', details: e?.message },
      { status: 500 }
    )
  }
}
