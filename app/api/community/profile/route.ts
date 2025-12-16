import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET - Get user's community profile
export async function GET(req: NextRequest) {
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

    const { data: profile } = await supabaseAdmin
      .from('community_profiles')
      .select('*')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (!profile) {
      // Return default profile
      return NextResponse.json({
        profile: {
          user_id: userData.user.id,
          display_name: userData.user.email?.split('@')[0] || 'User',
          first_name: null,
          last_name: null,
          bio: null,
          avatar_url: null,
          cover_url: null,
          website_url: null,
          twitter_handle: null,
          is_verified: false,
          is_creator: false,
          is_donor: false
        }
      })
    }

    return NextResponse.json({ profile })
  } catch (e: any) {
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}

// POST - Update user's community profile (including avatar)
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

    const body = await req.json()
    const { display_name, first_name, last_name, bio, avatar_url, cover_url, website_url, twitter_handle } = body

    // Upsert profile
    const { data: profile, error: upsertErr } = await supabaseAdmin
      .from('community_profiles')
      .upsert({
        user_id: userData.user.id,
        display_name: display_name || userData.user.email?.split('@')[0] || 'User',
        first_name: first_name || null,
        last_name: last_name || null,
        bio: bio || null,
        avatar_url: avatar_url || null,
        cover_url: cover_url || null,
        website_url: website_url || null,
        twitter_handle: twitter_handle || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select()
      .single()

    if (upsertErr) {
      return NextResponse.json({ error: 'UPDATE_FAILED', details: upsertErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, profile })
  } catch (e: any) {
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}
