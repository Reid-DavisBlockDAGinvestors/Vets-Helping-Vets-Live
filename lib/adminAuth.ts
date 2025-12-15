import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './supabaseAdmin'

/**
 * Verify admin authentication for API routes
 * Returns the user if authenticated and authorized, or an error response
 */
export async function verifyAdminAuth(req: NextRequest): Promise<
  | { authorized: true; user: any; profile: any }
  | { authorized: false; response: NextResponse }
> {
  const authHeader = req.headers.get('authorization')
  
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }
  }

  const token = authHeader.slice(7)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }
  }

  // Check admin role
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }
  }

  return { authorized: true, user, profile }
}
