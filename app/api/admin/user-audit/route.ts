import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Deep audit of a user's Supabase account
 * GET /api/admin/user-audit?email=user@example.com
 */
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email')
  
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }
  
  // Use service role key for admin access
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  
  try {
    // Find user by email - paginate through all users if needed
    let user = null
    let page = 1
    const perPage = 1000
    
    while (!user) {
      const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage
      })
      
      if (listError) {
        return NextResponse.json({ error: listError.message }, { status: 500 })
      }
      
      user = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
      
      // If no more users to check, break
      if (authUsers.users.length < perPage) break
      page++
      
      // Safety limit
      if (page > 100) break
    }
    
    if (!user) {
      return NextResponse.json({
        found: false,
        message: 'User not found in auth.users'
      })
    }
    
    // Check profiles table
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    // Check community_profiles table
    const { data: communityProfile } = await supabaseAdmin
      .from('community_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    // Note: auth.audit_log_entries is not directly accessible via PostgREST
    
    // Calculate account age and status
    const createdAt = new Date(user.created_at)
    const now = new Date()
    const accountAgeDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
    
    // Check recovery token expiry (if any)
    const recoveryTimestamp = user.recovery_sent_at ? new Date(user.recovery_sent_at) : null
    const recoveryExpired = recoveryTimestamp 
      ? (now.getTime() - recoveryTimestamp.getTime()) > (60 * 60 * 1000) // 1 hour default
      : null
    
    // Build comprehensive audit report
    const audit = {
      found: true,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone || null,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_sign_in_at: user.last_sign_in_at,
        
        // Email verification
        email_confirmed_at: user.email_confirmed_at,
        is_email_confirmed: !!user.email_confirmed_at,
        
        // Account status
        banned_until: (user as any).banned_until || null,
        is_banned: !!(user as any).banned_until,
        
        // Password recovery
        recovery_sent_at: user.recovery_sent_at || null,
        recovery_expired: recoveryExpired,
        
        // Confirmation
        confirmation_sent_at: user.confirmation_sent_at || null,
        confirmed_at: user.confirmed_at || null,
        
        // User metadata
        user_metadata: user.user_metadata,
        app_metadata: user.app_metadata,
        
        // Identities (OAuth providers)
        identities: user.identities?.map(i => ({
          provider: i.provider,
          created_at: i.created_at,
          last_sign_in_at: i.last_sign_in_at,
        })) || [],
        
        // Factors (MFA)
        factors: user.factors || [],
      },
      
      account_status: {
        age_days: accountAgeDays,
        is_new: accountAgeDays < 7,
        has_signed_in: !!user.last_sign_in_at,
        sign_in_count: user.identities?.[0]?.identity_data?.sign_in_count || 'unknown',
      },
      
      profile: profile || null,
      community_profile: communityProfile || null,
      
      // Diagnosis
      diagnosis: {
        email_status: user.email_confirmed_at ? 'CONFIRMED' : 'NOT_CONFIRMED',
        recovery_status: recoveryTimestamp 
          ? (recoveryExpired ? 'RECOVERY_LINK_EXPIRED' : 'RECOVERY_LINK_ACTIVE')
          : 'NO_RECOVERY_REQUESTED',
        account_status: (user as any).banned_until ? 'BANNED' : 'ACTIVE',
      },
      
      // Recommendations
      recommendations: [] as string[],
    }
    
    // Add recommendations based on diagnosis
    if (!user.email_confirmed_at) {
      audit.recommendations.push('User email is not confirmed - they should check spam or request new confirmation')
    }
    if (recoveryExpired) {
      audit.recommendations.push('Password recovery link has expired - user needs to request a new one')
    }
    if (!user.last_sign_in_at) {
      audit.recommendations.push('User has never signed in successfully')
    }
    if (user.identities?.length === 0) {
      audit.recommendations.push('No identity providers linked - this is unusual')
    }
    
    return NextResponse.json(audit)
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 })
  }
}

/**
 * Admin actions for user management
 * POST /api/admin/user-audit
 * Body: { email: string, action: 'confirm_email' | 'send_recovery' | 'reset_mfa' | 'set_password', password?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, action, password } = body
    
    if (!email || !action) {
      return NextResponse.json({ error: 'Email and action required' }, { status: 400 })
    }
    
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    
    // Find user by email - paginate through all users if needed
    let user = null
    let page = 1
    const perPage = 1000
    
    while (!user) {
      const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage
      })
      
      if (listError) {
        return NextResponse.json({ error: listError.message }, { status: 500 })
      }
      
      user = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
      
      if (authUsers.users.length < perPage) break
      page++
      if (page > 100) break
    }
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    switch (action) {
      case 'confirm_email': {
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
          email_confirm: true
        })
        if (error) throw error
        return NextResponse.json({ 
          success: true, 
          message: `Email confirmed for ${email}`,
          email_confirmed_at: data.user.email_confirmed_at
        })
      }
      
      case 'send_recovery': {
        // Generate a new password reset link
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: email,
          options: {
            redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://patriotpledgenfts.netlify.app'}/reset-password`
          }
        })
        if (error) throw error
        return NextResponse.json({ 
          success: true, 
          message: `Recovery link generated for ${email}`,
          link_properties: data.properties,
          // Don't expose the actual link in production - just for debugging
          recovery_link: process.env.NODE_ENV === 'development' ? data.properties?.action_link : '[hidden in production]'
        })
      }
      
      case 'reset_mfa': {
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
          // @ts-ignore - factors reset
          factors: []
        })
        if (error) throw error
        return NextResponse.json({ 
          success: true, 
          message: `MFA reset for ${email}`
        })
      }
      
      case 'set_password': {
        if (!password || password.length < 6) {
          return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
        }
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
          password: password
        })
        if (error) throw error
        return NextResponse.json({ 
          success: true, 
          message: `Password updated for ${email}. User can now login with the new password.`,
          user_id: data.user.id
        })
      }
      
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
