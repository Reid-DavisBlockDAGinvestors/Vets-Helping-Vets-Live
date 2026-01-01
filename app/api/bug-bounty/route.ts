import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// Bounty tier definitions (in-code fallback)
const BOUNTY_TIERS = {
  low: { name: 'Low', minUsd: 5, maxUsd: 25, minBdag: 100, maxBdag: 500 },
  medium: { name: 'Medium', minUsd: 25, maxUsd: 100, minBdag: 500, maxBdag: 2000 },
  high: { name: 'High', minUsd: 100, maxUsd: 500, minBdag: 2000, maxBdag: 10000 },
  critical: { name: 'Critical', minUsd: 500, maxUsd: 2500, minBdag: 10000, maxBdag: 50000 },
}

// GET - Get bounty tiers and leaderboard
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'tiers'

    if (action === 'tiers') {
      // Get bounty tiers
      const { data: tiers } = await supabaseAdmin
        .from('bug_bounty_tiers')
        .select('*')
        .order('min_reward_usd')

      return NextResponse.json({ tiers: tiers || Object.entries(BOUNTY_TIERS).map(([id, t]) => ({ id, ...t })) })
    }

    if (action === 'leaderboard') {
      const limit = parseInt(searchParams.get('limit') || '20')
      
      // Get leaderboard with user display names
      const { data: leaderboard } = await supabaseAdmin
        .from('bug_bounty_stats')
        .select(`
          user_id,
          total_reports,
          valid_reports,
          total_rewards_usd,
          total_rewards_bdag,
          current_rank,
          rank_title,
          badges
        `)
        .gt('valid_reports', 0)
        .order('current_rank', { ascending: true })
        .limit(limit)

      // Get user profiles for display names
      if (leaderboard && leaderboard.length > 0) {
        const userIds = leaderboard.map(l => l.user_id)
        const { data: profiles } = await supabaseAdmin
          .from('community_profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', userIds)

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || [])
        
        const enrichedLeaderboard = leaderboard.map(entry => ({
          ...entry,
          display_name: profileMap.get(entry.user_id)?.display_name || 'Anonymous Hunter',
          avatar_url: profileMap.get(entry.user_id)?.avatar_url || null
        }))

        return NextResponse.json({ leaderboard: enrichedLeaderboard })
      }

      return NextResponse.json({ leaderboard: leaderboard || [] })
    }

    if (action === 'my-stats') {
      // Get current user's stats
      const authHeader = req.headers.get('authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
      }

      const token = authHeader.slice(7)
      const { data: { user } } = await supabaseAdmin.auth.getUser(token)
      if (!user) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
      }

      const { data: stats } = await supabaseAdmin
        .from('bug_bounty_stats')
        .select('*')
        .eq('user_id', user.id)
        .single()

      const { data: rewards } = await supabaseAdmin
        .from('bug_bounty_rewards')
        .select('*, bug_reports(title, status)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      return NextResponse.json({ 
        stats: stats || { total_reports: 0, valid_reports: 0, total_rewards_usd: 0, total_rewards_bdag: 0 },
        rewards: rewards || []
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (e: any) {
    logger.error('[bug-bounty] GET error:', e)
    return NextResponse.json({ error: 'Failed to fetch bounty data' }, { status: 500 })
  }
}

// POST - Create a bounty reward for a bug report (admin only)
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    // Check admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    const body = await req.json()
    const { bug_report_id, tier_id, reward_amount_usd, reward_amount_bdag, reward_type, admin_notes } = body

    if (!bug_report_id) {
      return NextResponse.json({ error: 'Bug report ID required' }, { status: 400 })
    }

    // Get the bug report to verify it exists and get user_id
    const { data: report } = await supabaseAdmin
      .from('bug_reports')
      .select('id, user_id, title, bounty_claimed')
      .eq('id', bug_report_id)
      .single()

    if (!report) {
      return NextResponse.json({ error: 'Bug report not found' }, { status: 404 })
    }

    if (!report.user_id) {
      return NextResponse.json({ error: 'Bug report has no associated user' }, { status: 400 })
    }

    if (report.bounty_claimed) {
      return NextResponse.json({ error: 'Bounty already claimed for this report' }, { status: 400 })
    }

    // Create bounty reward
    const { data: reward, error } = await supabaseAdmin
      .from('bug_bounty_rewards')
      .insert({
        bug_report_id,
        user_id: report.user_id,
        tier_id: tier_id || 'medium',
        reward_amount_usd: reward_amount_usd || 0,
        reward_amount_bdag: reward_amount_bdag || 0,
        reward_type: reward_type || 'bdag',
        status: 'approved',
        admin_notes,
        approved_by: user.id,
        approved_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      logger.error('[bug-bounty] Create reward error:', error)
      return NextResponse.json({ error: 'Failed to create reward', details: error.message }, { status: 500 })
    }

    // Update bug report
    await supabaseAdmin
      .from('bug_reports')
      .update({
        bounty_claimed: true,
        bounty_tier: tier_id,
        bounty_reward_id: reward.id,
        status: 'resolved'
      })
      .eq('id', bug_report_id)

    logger.debug(`[bug-bounty] Reward created for report ${bug_report_id}: $${reward_amount_usd} / ${reward_amount_bdag} BDAG`)

    return NextResponse.json({ success: true, reward })
  } catch (e: any) {
    logger.error('[bug-bounty] POST error:', e)
    return NextResponse.json({ error: 'Failed to create bounty reward' }, { status: 500 })
  }
}

// PATCH - Update reward status (mark as paid, etc.)
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    // Check admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    const body = await req.json()
    const { reward_id, status, payment_method, payment_wallet_address, payment_tx_hash, admin_notes, rejected_reason } = body

    if (!reward_id) {
      return NextResponse.json({ error: 'Reward ID required' }, { status: 400 })
    }

    const updates: any = { updated_at: new Date().toISOString() }
    
    if (status) updates.status = status
    if (payment_method) updates.payment_method = payment_method
    if (payment_wallet_address) updates.payment_wallet_address = payment_wallet_address
    if (payment_tx_hash) {
      updates.payment_tx_hash = payment_tx_hash
      updates.payment_date = new Date().toISOString()
    }
    if (admin_notes) updates.admin_notes = admin_notes
    if (rejected_reason) updates.rejected_reason = rejected_reason

    const { data, error } = await supabaseAdmin
      .from('bug_bounty_rewards')
      .update(updates)
      .eq('id', reward_id)
      .select()
      .single()

    if (error) {
      logger.error('[bug-bounty] Update reward error:', error)
      return NextResponse.json({ error: 'Failed to update reward' }, { status: 500 })
    }

    logger.debug(`[bug-bounty] Reward ${reward_id} updated: status=${status}`)

    return NextResponse.json({ success: true, reward: data })
  } catch (e: any) {
    logger.error('[bug-bounty] PATCH error:', e)
    return NextResponse.json({ error: 'Failed to update reward' }, { status: 500 })
  }
}
