import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

// GET - Get campaigns for a specific submitter
export async function GET(req: NextRequest, { params }: { params: { email: string } }) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const email = decodeURIComponent(params.email)
    
    // Create Supabase client with user's token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    // Use admin client for queries
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { auth: { persistSession: false } }
    )

    // Check if user is admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    // Get campaigns by creator_email
    const { data: submissions, error: submissionsErr } = await supabaseAdmin
      .from('submissions')
      .select('id, title, status, category, goal, sold_count, created_at, image_uri')
      .ilike('creator_email', email)
      .order('created_at', { ascending: false })

    if (submissionsErr) {
      logger.error('[admin/submitters/campaigns] error:', submissionsErr)
      return NextResponse.json({ error: 'QUERY_FAILED' }, { status: 500 })
    }

    // Get purchase stats per campaign
    const submissionIds = (submissions || []).map(s => s.id)
    let purchaseStats: Record<string, { total: number; nfts: number }> = {}
    
    if (submissionIds.length > 0) {
      const { data: purchases } = await supabaseAdmin
        .from('purchases')
        .select('submission_id, amount_usd, quantity')
        .in('submission_id', submissionIds)

      for (const p of (purchases || [])) {
        if (!p.submission_id) continue
        if (!purchaseStats[p.submission_id]) {
          purchaseStats[p.submission_id] = { total: 0, nfts: 0 }
        }
        purchaseStats[p.submission_id].total += p.amount_usd || 0
        purchaseStats[p.submission_id].nfts += p.quantity || 1
      }
    }

    const campaigns = (submissions || []).map(s => {
      const stats = purchaseStats[s.id] || { total: 0, nfts: 0 }
      return {
        id: s.id,
        title: s.title,
        status: s.status,
        category: s.category || 'general',
        goal: parseFloat(s.goal) || 0,
        raised: stats.total,
        nfts_sold: s.sold_count || stats.nfts,
        created_at: s.created_at,
        image_uri: s.image_uri
      }
    })

    return NextResponse.json({ campaigns })
  } catch (e: any) {
    logger.error('[admin/submitters/campaigns] Error:', e)
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}
