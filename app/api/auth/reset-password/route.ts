import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendPasswordResetEmail } from '@/lib/mailer'
import { logger } from '@/lib/logger'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://patriotpledgenfts.netlify.app'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : ''
    
    if (!token) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !userData?.user?.email) {
      return NextResponse.json({ error: 'INVALID_TOKEN' }, { status: 401 })
    }

    const email = userData.user.email
    
    // Get display name from community profile
    const { data: profile } = await supabaseAdmin
      .from('community_profiles')
      .select('display_name')
      .eq('user_id', userData.user.id)
      .maybeSingle()
    
    // Generate password reset link using Supabase
    const { data: resetData, error: resetErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${SITE_URL}/reset-password`
      }
    })

    if (resetErr || !resetData?.properties?.action_link) {
      logger.error('[reset-password] Failed to generate reset link:', resetErr)
      return NextResponse.json({ error: 'RESET_LINK_FAILED' }, { status: 500 })
    }

    // Send our custom email
    const emailResult = await sendPasswordResetEmail({
      email,
      resetLink: resetData.properties.action_link,
      displayName: profile?.display_name || undefined
    })

    if (emailResult.error) {
      logger.error('[reset-password] Failed to send email:', emailResult.error)
      return NextResponse.json({ error: 'EMAIL_SEND_FAILED' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, message: 'Password reset email sent' })
  } catch (e: any) {
    logger.error('[reset-password] Error:', e)
    return NextResponse.json({ error: 'RESET_FAILED', details: e?.message }, { status: 500 })
  }
}
