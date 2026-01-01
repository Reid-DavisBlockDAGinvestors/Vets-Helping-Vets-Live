import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// Allowed file types for bug reports - comprehensive list
const ALLOWED_TYPES: Record<string, string[]> = {
  // Images
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'image/svg+xml': ['svg'],
  'image/bmp': ['bmp'],
  // Documents
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'application/vnd.ms-powerpoint': ['ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
  // Text
  'text/plain': ['txt'],
  'text/csv': ['csv'],
  'text/markdown': ['md'],
  'application/json': ['json'],
  // Archives
  'application/zip': ['zip'],
  'application/x-rar-compressed': ['rar'],
  'application/x-7z-compressed': ['7z'],
  // Video
  'video/mp4': ['mp4'],
  'video/webm': ['webm'],
  'video/quicktime': ['mov'],
  // Audio
  'audio/mpeg': ['mp3'],
  'audio/wav': ['wav'],
  'audio/ogg': ['ogg'],
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB for documents/videos

// POST - Upload an attachment for bug report
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedMimeTypes = Object.keys(ALLOWED_TYPES)
    if (!allowedMimeTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Supported: images, PDFs, documents, text, archives, audio, video.` },
        { status: 400 }
      )
    }

    // Validate file size (max 50MB)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB.' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)
    const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const filename = `bug-attachment-${timestamp}-${randomId}.${extension}`

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
      logger.error('[bug-reports/upload] Storage error:', error)
      
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

    logger.debug('[bug-reports/upload] Screenshot uploaded:', filename)

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      filename
    })
  } catch (e: any) {
    logger.error('[bug-reports/upload] Error:', e)
    return NextResponse.json(
      { error: 'Failed to upload screenshot', details: e?.message },
      { status: 500 }
    )
  }
}
