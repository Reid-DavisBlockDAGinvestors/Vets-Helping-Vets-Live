import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Admin endpoint to check user registration status
 * GET /api/admin/check-user?email=user@example.com
 */
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email')
  
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }
  
  // Use service role key for admin access
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  
  try {
    // Check auth.users table
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }
    
    const user = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    
    if (!user) {
      return NextResponse.json({
        found: false,
        message: 'User not found in auth.users - signup may have failed or email not registered'
      })
    }
    
    // Check profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    return NextResponse.json({
      found: true,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        email_confirmed_at: user.email_confirmed_at,
        last_sign_in_at: user.last_sign_in_at,
        confirmed: !!user.email_confirmed_at,
        user_metadata: user.user_metadata,
      },
      profile: profile || null,
      diagnosis: !user.email_confirmed_at 
        ? 'User exists but email NOT confirmed - Supabase email may not have been delivered'
        : 'User exists and email is confirmed'
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

/**
 * Admin endpoint to manually confirm a user's email
 * POST /api/admin/check-user
 * Body: { email: string, action: 'confirm' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, action } = body
    
    if (!email || action !== 'confirm') {
      return NextResponse.json({ error: 'Email and action=confirm required' }, { status: 400 })
    }
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    
    // Find the user
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 })
    }
    
    const user = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    // Manually confirm the user's email
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true
    })
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      message: `Email confirmed for ${email}`,
      user: {
        id: data.user.id,
        email: data.user.email,
        email_confirmed_at: data.user.email_confirmed_at
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
