import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * POST /api/admin/distributions/execute
 * Execute a fund or tip distribution
 * 
 * For V7 (Sepolia): Off-chain distribution - record in database, manual transfer
 * For V8 (Ethereum): Will use on-chain distribution (future)
 * 
 * Body: { type, campaignId, amount?, recipient?, tipSplit? }
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { type, campaignId, amount, recipient, tipSplit } = body

    // Validate required fields
    if (!type || !campaignId) {
      return NextResponse.json({ error: 'type and campaignId are required' }, { status: 400 })
    }

    if (!['funds', 'tips'].includes(type)) {
      return NextResponse.json({ error: 'type must be "funds" or "tips"' }, { status: 400 })
    }

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Calculate amounts based on type
    let totalAmount = 0
    let submitterAmount = 0
    let nonprofitAmount = 0
    let submitterPct = 100
    let nonprofitPct = 0

    if (type === 'tips' && tipSplit) {
      // Get pending tips from campaign balance view or calculate
      const { data: purchases } = await supabase
        .from('purchases')
        .select('tip_bdag, tip_eth')
        .eq('campaign_id', campaign.campaign_id)

      const totalTips = purchases?.reduce((sum, p) => 
        sum + (p.tip_eth || p.tip_bdag || 0), 0) || 0
      
      const tipsDistributed = Number(campaign.tips_distributed) || 0
      totalAmount = totalTips - tipsDistributed

      submitterPct = tipSplit.submitterPercent
      nonprofitPct = tipSplit.nonprofitPercent
      submitterAmount = (totalAmount * submitterPct) / 100
      nonprofitAmount = totalAmount - submitterAmount
    } else if (type === 'funds') {
      totalAmount = amount || 0
      submitterAmount = totalAmount
      nonprofitAmount = 0
    }

    if (totalAmount <= 0) {
      return NextResponse.json({ error: 'No funds available to distribute' }, { status: 400 })
    }

    // Determine native currency
    const nativeCurrency = campaign.chain_id === 1043 ? 'BDAG' : 'ETH'

    // Create distribution record
    const { data: distribution, error: insertError } = await supabase
      .from('distributions')
      .insert({
        campaign_id: campaignId,
        chain_id: campaign.chain_id,
        distribution_type: type,
        total_amount: totalAmount,
        submitter_amount: submitterAmount,
        nonprofit_amount: nonprofitAmount,
        platform_fee: 0,
        tip_split_submitter_pct: submitterPct,
        tip_split_nonprofit_pct: nonprofitPct,
        submitter_wallet: campaign.creator_wallet,
        nonprofit_wallet: null, // TODO: Add nonprofit wallet to campaign
        status: 'pending',
        initiated_by: user.id,
        native_currency: nativeCurrency
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating distribution:', insertError)
      return NextResponse.json({ error: 'Failed to create distribution record' }, { status: 500 })
    }

    // For V7 (off-chain distribution): Mark as pending for manual processing
    // The admin will need to manually transfer funds and then confirm the distribution
    // For V8: This will trigger an on-chain transaction

    // For now, just return the pending distribution
    // In a real implementation, you would:
    // 1. For immediate payout campaigns: Funds already distributed on mint
    // 2. For held funds: Trigger withdrawal from contract
    // 3. For off-chain: Queue for manual transfer

    return NextResponse.json({
      success: true,
      distributionId: distribution.id,
      status: 'pending',
      message: `Distribution created. Total: ${totalAmount} ${nativeCurrency}. ` +
        `Submitter: ${submitterAmount} ${nativeCurrency}, Nonprofit: ${nonprofitAmount} ${nativeCurrency}. ` +
        `Status: Pending manual transfer (V7 off-chain).`,
      distribution
    })

  } catch (error) {
    console.error('Error in distributions/execute:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
