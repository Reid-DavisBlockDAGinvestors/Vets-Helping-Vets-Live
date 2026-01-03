import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Auth Callback Handler
 * Handles email confirmation redirects from Supabase Auth
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')
  
  // Handle errors from Supabase
  if (error) {
    console.error('[auth/callback] Error:', error, error_description)
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(error_description || error)}`, requestUrl.origin)
    )
  }
  
  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    try {
      // Exchange the code for a session
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (exchangeError) {
        console.error('[auth/callback] Exchange error:', exchangeError)
        return NextResponse.redirect(
          new URL(`/?auth_error=${encodeURIComponent(exchangeError.message)}`, requestUrl.origin)
        )
      }
      
      console.log('[auth/callback] Session established for:', data.user?.email)
      
      // Redirect to home page with success message
      return NextResponse.redirect(
        new URL('/?auth_success=email_confirmed', requestUrl.origin)
      )
    } catch (e: any) {
      console.error('[auth/callback] Unexpected error:', e)
      return NextResponse.redirect(
        new URL(`/?auth_error=${encodeURIComponent(e.message || 'Unknown error')}`, requestUrl.origin)
      )
    }
  }
  
  // No code provided, redirect to home
  return NextResponse.redirect(new URL('/', requestUrl.origin))
}
