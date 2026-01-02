import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/admin/distributions/balances
 * Fetches campaign fund balances for admin distribution UI
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin auth
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Check admin status - profiles uses 'role' column, not 'is_admin'
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const chainId = searchParams.get('chainId')
    const isTestnet = searchParams.get('isTestnet')
    const hasPendingFunds = searchParams.get('hasPendingFunds') === 'true'
    const hasPendingTips = searchParams.get('hasPendingTips') === 'true'

    // Build query - fetch from campaign_fund_status view if it exists,
    // otherwise fall back to direct query
    let query = supabase
      .from('submissions')
      .select(`
        id,
        title,
        status,
        chain_id,
        chain_name,
        is_testnet,
        creator_wallet,
        contract_version,
        immediate_payout_enabled,
        total_distributed,
        tips_distributed,
        last_distribution_at,
        campaign_id
      `)
      .eq('status', 'minted')

    // Apply filters
    if (chainId) {
      query = query.eq('chain_id', parseInt(chainId))
    }
    if (isTestnet !== null && isTestnet !== undefined) {
      query = query.eq('is_testnet', isTestnet === 'true')
    }

    const { data: submissions, error: submissionsError } = await query

    if (submissionsError) {
      console.error('Error fetching submissions:', submissionsError)
      return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 })
    }

    // Get purchase aggregates for each submission
    const balances = await Promise.all((submissions || []).map(async (s) => {
      // Get purchase totals - join on on-chain campaign_id (INTEGER)
      const { data: purchaseData } = await supabase
        .from('purchases')
        .select('amount_usd, amount_native, tip_usd, tip_bdag, tip_eth')
        .eq('campaign_id', s.campaign_id)

      const grossRaisedUsd = purchaseData?.reduce((sum, p) => sum + (p.amount_usd || 0), 0) || 0
      const grossRaisedNative = purchaseData?.reduce((sum, p) => sum + (p.amount_native || 0), 0) || 0
      const tipsReceivedUsd = purchaseData?.reduce((sum, p) => sum + (p.tip_usd || 0), 0) || 0
      const tipsReceivedNative = purchaseData?.reduce((sum, p) => 
        sum + (p.tip_eth || p.tip_bdag || 0), 0) || 0

      // Get tip split config
      const { data: tipSplitConfig } = await supabase
        .from('tip_split_configs')
        .select('submitter_percent, nonprofit_percent')
        .eq('campaign_id', s.id)
        .single()

      // Get distribution count
      const { count: distributionCount } = await supabase
        .from('distributions')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', s.id)

      // Calculate pending amounts
      const totalDistributed = Number(s.total_distributed) || 0
      const tipsDistributed = Number(s.tips_distributed) || 0
      const pendingDistributionNative = grossRaisedNative - totalDistributed
      const pendingTipsNative = tipsReceivedNative - tipsDistributed

      // Determine native currency
      const nativeCurrency = s.chain_id === 1043 ? 'BDAG' : 'ETH'

      return {
        id: s.id,
        title: s.title,
        status: s.status,
        chain_id: s.chain_id,
        chain_name: s.chain_name,
        is_testnet: s.is_testnet ?? true,
        creator_wallet: s.creator_wallet,
        contract_version: s.contract_version,
        immediate_payout_enabled: s.immediate_payout_enabled ?? false,
        tip_split_submitter_pct: tipSplitConfig?.submitter_percent ?? 100,
        tip_split_nonprofit_pct: tipSplitConfig?.nonprofit_percent ?? 0,
        gross_raised_usd: grossRaisedUsd,
        gross_raised_native: grossRaisedNative,
        tips_received_usd: tipsReceivedUsd,
        tips_received_native: tipsReceivedNative,
        total_distributed: totalDistributed,
        tips_distributed: tipsDistributed,
        last_distribution_at: s.last_distribution_at,
        pending_distribution_native: pendingDistributionNative,
        pending_tips_native: pendingTipsNative,
        native_currency: nativeCurrency,
        distribution_count: distributionCount || 0
      }
    }))

    // Apply pending filters after aggregation
    let filteredBalances = balances
    if (hasPendingFunds) {
      filteredBalances = filteredBalances.filter(b => b.pending_distribution_native > 0)
    }
    if (hasPendingTips) {
      filteredBalances = filteredBalances.filter(b => b.pending_tips_native > 0)
    }

    return NextResponse.json({ balances: filteredBalances })

  } catch (error) {
    console.error('Error in distributions/balances:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
