import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// POST - Upload image to Supabase storage
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : ''
    
    if (!token) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !userData?.user?.id) {
      return NextResponse.json({ error: 'INVALID_TOKEN' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string || 'avatar' // avatar, cover, post

    if (!file) {
      return NextResponse.json({ error: 'NO_FILE' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'INVALID_TYPE', message: 'Only JPEG, PNG, GIF, and WebP images are allowed' }, { status: 400 })
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'FILE_TOO_LARGE', message: 'Max file size is 5MB' }, { status: 400 })
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `${userData.user.id}/${type}_${Date.now()}.${ext}`
    const bucket = 'community'

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase storage
    const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
      .from(bucket)
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: true
      })

    if (uploadErr) {
      console.error('Upload error:', uploadErr)
      // Check for common errors
      if (uploadErr.message?.includes('not found') || uploadErr.message?.includes('does not exist')) {
        return NextResponse.json({ 
          error: 'BUCKET_NOT_FOUND', 
          message: 'Storage bucket "community" not found. Please create it in Supabase Dashboard > Storage.' 
        }, { status: 500 })
      }
      if (uploadErr.message?.includes('Payload too large') || uploadErr.message?.includes('file size')) {
        return NextResponse.json({ 
          error: 'FILE_TOO_LARGE', 
          message: 'File is too large. Maximum size is 5MB.' 
        }, { status: 400 })
      }
      return NextResponse.json({ error: 'UPLOAD_FAILED', message: uploadErr.message }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(filename)
    const publicUrl = urlData?.publicUrl

    // If this is an avatar upload, update the profile
    if (type === 'avatar' && publicUrl) {
      await supabaseAdmin
        .from('community_profiles')
        .upsert({
          user_id: userData.user.id,
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
    }

    // If this is a cover upload, update the profile
    if (type === 'cover' && publicUrl) {
      await supabaseAdmin
        .from('community_profiles')
        .upsert({
          user_id: userData.user.id,
          cover_url: publicUrl,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
    }

    return NextResponse.json({ 
      ok: true, 
      url: publicUrl,
      path: uploadData?.path
    })
  } catch (e: any) {
    console.error('Upload error:', e)
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}
