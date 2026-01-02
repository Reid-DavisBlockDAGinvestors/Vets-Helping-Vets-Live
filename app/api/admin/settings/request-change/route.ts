import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getProviderForChain, getContractAddress, type ChainId } from '@/lib/chains'
import { PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Financial-grade security thresholds
const SECURITY = {
  FEE_CHANGE_THRESHOLD_BPS: 100,      // >1% requires multi-sig
  MAX_PLATFORM_FEE_BPS: 1000,         // 10% max
  MAX_ROYALTY_BPS: 1000,              // 10% max
  FEE_CHANGE_DELAY_HOURS: 24,
  TREASURY_CHANGE_DELAY_HOURS: 48,
  MAX_CHANGES_PER_HOUR: 3,
  COOLDOWN_MINUTES: 15,
}

/**
 * POST /api/admin/settings/request-change
 * Request a settings change with financial-grade security
 * - Rate limited
 * - Requires reason
 * - Timelocked
 * - Multi-sig for sensitive changes
 */
export async function POST(req: NextRequest) {
  try {
    // Verify admin auth
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const { data: userData } = await supabaseAdmin.auth.getUser(token)
    const uid = userData?.user?.id
    if (!uid) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const { data: profile } = await supabaseAdmin.from('profiles').select('role, email').eq('id', uid).single()
    if (!['admin', 'super_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const body = await req.json()
    const { chainId, contractVersion, changeType, newValue, reason } = body

    // Validate required fields
    if (!changeType || newValue === undefined || !reason) {
      return NextResponse.json({ 
        error: 'changeType, newValue, and reason are required' 
      }, { status: 400 })
    }

    const targetChainId = (chainId || 1043) as ChainId
    const targetVersion = contractVersion || 'v6'

    // Rate limiting: Check recent changes by this user
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recentChanges } = await supabaseAdmin
      .from('admin_audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid)
      .in('action', ['settings_fee_request', 'settings_treasury_request', 'settings_royalty_request'])
      .gte('created_at', oneHourAgo)

    if ((recentChanges || 0) >= SECURITY.MAX_CHANGES_PER_HOUR) {
      return NextResponse.json({
        error: `Rate limited: Maximum ${SECURITY.MAX_CHANGES_PER_HOUR} changes per hour exceeded`
      }, { status: 429 })
    }

    // Cooldown check
    const cooldownTime = new Date(Date.now() - SECURITY.COOLDOWN_MINUTES * 60 * 1000).toISOString()
    const { data: lastChange } = await supabaseAdmin
      .from('admin_audit_log')
      .select('created_at')
      .eq('user_id', uid)
      .in('action', ['settings_fee_request', 'settings_treasury_request', 'settings_royalty_request'])
      .gte('created_at', cooldownTime)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (lastChange) {
      const waitTime = Math.ceil((new Date(lastChange.created_at).getTime() + SECURITY.COOLDOWN_MINUTES * 60 * 1000 - Date.now()) / 1000 / 60)
      return NextResponse.json({
        error: `Cooldown active: Please wait ${waitTime} more minute(s) before requesting another change`
      }, { status: 429 })
    }

    // Get contract address
    const contractAddress = getContractAddress(targetChainId, targetVersion as any)
    if (!contractAddress) {
      return NextResponse.json({
        error: 'Contract not found',
        chainId: targetChainId,
        contractVersion: targetVersion
      }, { status: 400 })
    }

    // Get current value from contract
    let currentValue: string = ''
    let requiresMultiSig = false
    let delayHours = 24

    try {
      const provider = getProviderForChain(targetChainId)
      const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)

      switch (changeType) {
        case 'fee':
          // Validate fee
          const feeBps = parseInt(newValue)
          if (isNaN(feeBps) || feeBps < 0 || feeBps > SECURITY.MAX_PLATFORM_FEE_BPS) {
            return NextResponse.json({
              error: `Fee must be between 0 and ${SECURITY.MAX_PLATFORM_FEE_BPS} basis points`
            }, { status: 400 })
          }

          // Get current fee
          try {
            const feeConfig = await contract.feeConfig()
            currentValue = String(feeConfig.platformFeeBps || feeConfig[0] || 0)
          } catch {
            currentValue = '0'
          }

          // Check if multi-sig required
          const feeChange = Math.abs(feeBps - parseInt(currentValue))
          requiresMultiSig = feeChange > SECURITY.FEE_CHANGE_THRESHOLD_BPS
          delayHours = SECURITY.FEE_CHANGE_DELAY_HOURS
          break

        case 'treasury':
          // Validate address
          if (!/^0x[a-fA-F0-9]{40}$/.test(newValue)) {
            return NextResponse.json({
              error: 'Invalid Ethereum address format'
            }, { status: 400 })
          }

          // Get current treasury
          try {
            currentValue = await contract.platformTreasury()
          } catch {
            currentValue = ''
          }

          // Treasury changes ALWAYS require multi-sig
          requiresMultiSig = true
          delayHours = SECURITY.TREASURY_CHANGE_DELAY_HOURS
          break

        case 'royalty':
          // Validate royalty
          const royaltyBps = parseInt(newValue)
          if (isNaN(royaltyBps) || royaltyBps < 0 || royaltyBps > SECURITY.MAX_ROYALTY_BPS) {
            return NextResponse.json({
              error: `Royalty must be between 0 and ${SECURITY.MAX_ROYALTY_BPS} basis points`
            }, { status: 400 })
          }

          // Get current royalty
          try {
            currentValue = String(await contract.defaultRoyaltyBps())
          } catch {
            currentValue = '250'
          }
          delayHours = SECURITY.FEE_CHANGE_DELAY_HOURS
          break

        default:
          return NextResponse.json({ error: 'Invalid changeType' }, { status: 400 })
      }
    } catch (e: any) {
      logger.error(`[settings/request-change] Contract error: ${e?.message}`)
      return NextResponse.json({
        error: 'Failed to read current contract state',
        details: e?.message
      }, { status: 500 })
    }

    // Calculate expiry time
    const expiresAt = new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString()

    // Create pending change record
    const { data: pendingChange, error: insertError } = await supabaseAdmin
      .from('pending_settings_changes')
      .insert({
        chain_id: targetChainId,
        contract_version: targetVersion,
        contract_address: contractAddress,
        change_type: changeType,
        current_value: currentValue,
        new_value: String(newValue),
        reason,
        requested_by: uid,
        requested_by_email: profile?.email,
        expires_at: expiresAt,
        status: 'pending',
        requires_multi_sig: requiresMultiSig,
        approvals: [],
        required_approvals: requiresMultiSig ? 2 : 1 // 2 approvals for multi-sig
      })
      .select()
      .single()

    if (insertError) {
      logger.error(`[settings/request-change] Insert error: ${insertError.message}`)
      return NextResponse.json({
        error: 'Failed to create pending change',
        details: insertError.message
      }, { status: 500 })
    }

    // Log to audit trail
    await supabaseAdmin.from('admin_audit_log').insert({
      user_id: uid,
      action: `settings_${changeType}_request`,
      details: {
        chainId: targetChainId,
        contractVersion: targetVersion,
        changeType,
        currentValue,
        newValue: String(newValue),
        reason,
        requiresMultiSig,
        delayHours,
        pendingId: pendingChange.id
      },
      created_at: new Date().toISOString()
    })

    logger.info(`[settings/request-change] ${changeType} change requested by ${profile?.email}: ${currentValue} -> ${newValue}`)

    return NextResponse.json({
      ok: true,
      pendingId: pendingChange.id,
      requiresMultiSig,
      delayHours,
      expiresAt,
      message: requiresMultiSig 
        ? `Change requires multi-sig approval and ${delayHours}h timelock`
        : `Change will be executable after ${delayHours}h timelock`
    })

  } catch (e: any) {
    logger.error('[admin/settings/request-change] Error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
