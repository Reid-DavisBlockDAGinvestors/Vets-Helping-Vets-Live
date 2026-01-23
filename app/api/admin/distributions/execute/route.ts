import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ethers } from 'ethers'
import { getSignerForChain, getContractAddress, getProviderForChain, CHAIN_CONFIGS, type ChainId } from '@/lib/chains'
import { V5_ABI, V6_ABI, V7_ABI, V8_ABI } from '@/lib/contracts'
import { logger } from '@/lib/logger'
import { sendDistributionNotifications } from '@/lib/email'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Get the appropriate ABI for a contract version
function getAbiForVersion(version: string): string[] {
  if (version === 'v8') return V8_ABI
  if (version === 'v7') return V7_ABI
  if (version === 'v6') return V6_ABI
  return V5_ABI
}

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

    // For Ethereum mainnet, use on-chain data for accuracy
    const campaignChainId = (campaign.chain_id || 1043) as ChainId
    const isMainnet = campaignChainId === 1
    
    if (type === 'tips' && tipSplit) {
      let totalTips = 0
      
      if (isMainnet && campaign.contract_address && campaign.campaign_id != null) {
        // Use on-chain tipsReceived for Ethereum mainnet
        try {
          const provider = getProviderForChain(campaignChainId)
          const version = campaign.contract_version || 'v8'
          const abi = getAbiForVersion(version)
          const contract = new ethers.Contract(campaign.contract_address, abi, provider)
          const onchainCampaign = await contract.getCampaign(BigInt(campaign.campaign_id))
          const onchainTipsWei = BigInt(onchainCampaign.tipsReceived ?? 0n)
          totalTips = Number(onchainTipsWei) / 1e18
          logger.info(`[Distribution] On-chain tips for campaign ${campaign.campaign_id}: ${totalTips} ETH`)
        } catch (e) {
          logger.error(`[Distribution] Failed to fetch on-chain tips:`, e)
          // Fallback to purchases table
          const { data: purchases } = await supabase
            .from('purchases')
            .select('tip_bdag, tip_eth')
            .eq('campaign_id', campaign.campaign_id)
          totalTips = purchases?.reduce((sum, p) => sum + (p.tip_eth || p.tip_bdag || 0), 0) || 0
        }
      } else {
        // Use purchases table for non-mainnet
        const { data: purchases } = await supabase
          .from('purchases')
          .select('tip_bdag, tip_eth')
          .eq('campaign_id', campaign.campaign_id)
        totalTips = purchases?.reduce((sum, p) => sum + (p.tip_eth || p.tip_bdag || 0), 0) || 0
      }
      
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

    // Execute on-chain withdrawal
    const chainId = (campaign.chain_id || 1043) as ChainId
    const version = campaign.contract_version || 'v6'
    const contractAddress = getContractAddress(chainId, version as any)
    
    if (!contractAddress) {
      return NextResponse.json({ 
        error: `No contract address found for chain ${chainId} version ${version}` 
      }, { status: 400 })
    }

    const recipientWallet = recipient || campaign.creator_wallet
    if (!recipientWallet || !ethers.isAddress(recipientWallet)) {
      return NextResponse.json({ 
        error: 'Invalid recipient wallet address' 
      }, { status: 400 })
    }

    try {
      // Get signer for the chain
      const signer = getSignerForChain(chainId)
      const abi = getAbiForVersion(version)
      const contract = new ethers.Contract(contractAddress, abi, signer)

      // Convert amount to wei (18 decimals)
      const amountWei = ethers.parseEther(totalAmount.toString())

      logger.info(`[Distribution] Executing withdraw: ${totalAmount} ${nativeCurrency} to ${recipientWallet}`)
      logger.info(`[Distribution] Contract: ${contractAddress}, Chain: ${chainId}, Version: ${version}`)

      // Call withdraw function on contract
      const tx = await contract.withdraw(recipientWallet, amountWei)
      logger.info(`[Distribution] Transaction submitted: ${tx.hash}`)

      // Wait for confirmation
      const receipt = await tx.wait(1)
      logger.info(`[Distribution] Transaction confirmed in block ${receipt.blockNumber}`)

      // Update distribution record with tx hash and status
      await supabase
        .from('distributions')
        .update({
          status: 'completed',
          tx_hash: tx.hash,
          completed_at: new Date().toISOString()
        })
        .eq('id', distribution.id)

      // Update campaign distributed totals if applicable
      if (type === 'funds') {
        await supabase
          .from('submissions')
          .update({ 
            funds_distributed: (Number(campaign.funds_distributed) || 0) + totalAmount 
          })
          .eq('id', campaignId)
      } else if (type === 'tips') {
        await supabase
          .from('submissions')
          .update({ 
            tips_distributed: (Number(campaign.tips_distributed) || 0) + totalAmount 
          })
          .eq('id', campaignId)
      }

      // Send email notifications to submitter and nonprofit (if applicable)
      try {
        // Get submitter profile for email
        const { data: submitterProfile } = await supabase
          .from('profiles')
          .select('email, display_name')
          .eq('wallet_address', campaign.creator_wallet)
          .single()

        // Get nonprofit info if tip split includes nonprofit
        let nonprofitProfile = null
        if (type === 'tips' && nonprofitAmount > 0 && campaign.nonprofit_wallet) {
          const { data: np } = await supabase
            .from('profiles')
            .select('email, display_name')
            .eq('wallet_address', campaign.nonprofit_wallet)
            .single()
          nonprofitProfile = np
        }

        const emailResults = await sendDistributionNotifications({
          campaignTitle: campaign.title,
          campaignId: campaign.campaign_id || campaignId,
          distributionType: type,
          chainId: chainId,
          txHash: tx.hash,
          submitterEmail: submitterProfile?.email || campaign.email,
          submitterName: submitterProfile?.display_name || campaign.name,
          submitterWallet: recipientWallet,
          submitterAmount: submitterAmount,
          nonprofitEmail: nonprofitProfile?.email,
          nonprofitName: nonprofitProfile?.display_name,
          nonprofitWallet: campaign.nonprofit_wallet,
          nonprofitAmount: nonprofitAmount,
          totalAmount: totalAmount,
          submitterPercent: submitterPct,
          nonprofitPercent: nonprofitPct,
        })

        logger.info(`[Distribution] Email notifications sent:`, emailResults)
      } catch (emailError) {
        // Don't fail the distribution if email fails
        logger.error(`[Distribution] Failed to send email notifications:`, emailError)
      }

      return NextResponse.json({
        success: true,
        distributionId: distribution.id,
        status: 'completed',
        txHash: tx.hash,
        message: `✅ Distribution completed! ${totalAmount} ${nativeCurrency} sent to ${recipientWallet.slice(0, 6)}...${recipientWallet.slice(-4)}. Tx: ${tx.hash.slice(0, 10)}...`,
        distribution: { ...distribution, tx_hash: tx.hash, status: 'completed' }
      })

    } catch (txError: any) {
      logger.error(`[Distribution] Transaction failed:`, txError)

      // Update distribution record with error
      await supabase
        .from('distributions')
        .update({
          status: 'failed',
          error_message: txError.message || 'Transaction failed'
        })
        .eq('id', distribution.id)

      return NextResponse.json({
        success: false,
        distributionId: distribution.id,
        status: 'failed',
        message: `❌ Transaction failed: ${txError.shortMessage || txError.message}`,
        error: txError.message
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error in distributions/execute:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
