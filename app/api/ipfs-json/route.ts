import { NextRequest, NextResponse } from 'next/server'
import { uploadJson, uploadFileBase64 } from '@/lib/storacha'
import { logger } from '@/lib/logger'

// Max image size: 10MB for mobile compatibility
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const meta: any = { ...body }
    
    // Debug logging
    const hasImage = typeof meta.image === 'string'
    const isDataUrl = hasImage && /^data:[^;]+;base64,/i.test(meta.image)
    const imageLength = meta.image?.length || 0
    logger.api('[ipfs-json] Received:', { hasImage, isDataUrl, imageLength })
    
    // Check image size (base64 is ~33% larger than binary)
    if (isDataUrl && imageLength > MAX_IMAGE_SIZE * 1.33) {
      logger.error('[ipfs-json] Image too large:', imageLength)
      return NextResponse.json({ 
        error: 'IMAGE_TOO_LARGE', 
        message: 'Image is too large. Please use an image under 10MB.',
        size: imageLength 
      }, { status: 400 })
    }
    
    // If image is a data URL, upload it first and replace field with returned URI
    let uploadedImageUri: string | null = null
    if (isDataUrl) {
      try {
        logger.api('[ipfs-json] Uploading image to IPFS...')
        const up = await uploadFileBase64(meta.image)
        meta.image = up.uri
        uploadedImageUri = up.uri
        logger.api('[ipfs-json] Image uploaded:', uploadedImageUri)
      } catch (imgErr: any) {
        logger.error('[ipfs-json] Image upload failed:', imgErr?.message || imgErr)
        return NextResponse.json({ 
          error: 'IMAGE_UPLOAD_FAILED', 
          message: 'Failed to upload image. Please try again or use a smaller image.',
          details: imgErr?.message 
        }, { status: 500 })
      }
    }
    
    try {
      const { uri } = await uploadJson(meta)
      // Best-effort backend hint for debugging
      let backend = 'fallback'
      if (typeof uri === 'string') {
        if (uri.startsWith('ipfs://')) backend = 'storacha'
        else if (uri.includes('.supabase.co/')) backend = 'supabase'
        else backend = 'fallback'
      }
      return NextResponse.json({ uri, backend, imageUri: uploadedImageUri })
    } catch (metaErr: any) {
      logger.error('[ipfs-json] Metadata upload failed:', metaErr?.message || metaErr)
      return NextResponse.json({ 
        error: 'METADATA_UPLOAD_FAILED', 
        message: 'Failed to save campaign data. Please try again.',
        details: metaErr?.message 
      }, { status: 500 })
    }
  } catch (e: any) {
    logger.error('[ipfs-json] Error:', e)
    return NextResponse.json({ 
      error: 'UPLOAD_FAILED', 
      message: 'Upload failed. Please check your internet connection and try again.',
      details: e?.message 
    }, { status: 500 })
  }
}
