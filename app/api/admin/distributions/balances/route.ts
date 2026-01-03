import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { CHAIN_CONFIGS, type ChainId } from '@/lib/chains'

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

    // Build query - use only columns that definitely exist
    // Some columns like total_distributed may not exist yet
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
        campaign_id
      `)
      .eq('status', 'minted')
      .not('campaign_id', 'is', null)

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
      // Try different column names since schema may vary
      const { data: purchaseData } = await supabase
        .from('purchases')
        .select('*')
        .eq('campaign_id', s.campaign_id)

      // Calculate totals from whatever columns exist
      const grossRaisedUsd = purchaseData?.reduce((sum, p) => {
        return sum + (p.amount_usd || p.price_usd || 0)
      }, 0) || 0
      
      const grossRaisedNative = purchaseData?.reduce((sum, p) => {
        return sum + (p.amount_native || p.amount_bdag || p.price_bdag || 0)
      }, 0) || 0
      
      const tipsReceivedUsd = purchaseData?.reduce((sum, p) => {
        return sum + (p.tip_usd || 0)
      }, 0) || 0
      
      const tipsReceivedNative = purchaseData?.reduce((sum, p) => {
        return sum + (p.tip_eth || p.tip_bdag || p.tip_native || 0)
      }, 0) || 0

      // Get tip split config (may not exist yet)
      let tipSplitConfig = null
      try {
        const { data } = await supabase
          .from('tip_split_configs')
          .select('submitter_percent, nonprofit_percent')
          .eq('campaign_id', s.id)
          .single()
        tipSplitConfig = data
      } catch {
        // Table may not exist
      }

      // Get distribution count (may not exist yet)
      let distributionCount = 0
      try {
        const { count } = await supabase
          .from('distributions')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', s.id)
        distributionCount = count || 0
      } catch {
        // Table may not exist
      }

      // Determine native currency and chain info from chain config
      const chainId = (s.chain_id || 1043) as ChainId
      const chainConfig = CHAIN_CONFIGS[chainId]
      const nativeCurrency = chainConfig?.nativeCurrency?.symbol || (chainId === 1043 ? 'BDAG' : 'ETH')
      const chainName = chainConfig?.name || s.chain_name || 'BlockDAG Testnet'
      const isTestnet = chainConfig?.isTestnet ?? s.is_testnet ?? true

      return {
        id: s.id,
        title: s.title,
        status: s.status,
        chain_id: chainId,
        chain_name: chainName,
        is_testnet: isTestnet,
        creator_wallet: s.creator_wallet,
        contract_version: s.contract_version || 'v6',
        campaign_id: s.campaign_id,
        immediate_payout_enabled: false,
        tip_split_submitter_pct: tipSplitConfig?.submitter_percent ?? 100,
        tip_split_nonprofit_pct: tipSplitConfig?.nonprofit_percent ?? 0,
        gross_raised_usd: grossRaisedUsd,
        gross_raised_native: grossRaisedNative,
        tips_received_usd: tipsReceivedUsd,
        tips_received_native: tipsReceivedNative,
        total_distributed: 0,
        tips_distributed: 0,
        last_distribution_at: null,
        pending_distribution_native: grossRaisedNative,
        pending_tips_native: tipsReceivedNative,
        native_currency: nativeCurrency,
        distribution_count: distributionCount,
        purchase_count: purchaseData?.length || 0
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
