import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { createClient } from '@supabase/supabase-js'
import { ethers } from 'ethers'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET - Get all platform users with their stats
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    
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

    // Get all profiles (registered users)
    const { data: profiles, error: profilesErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (profilesErr) {
      logger.error('[admin/users] profiles error:', profilesErr)
    }

    // Build purchase stats from multiple sources
    const userPurchaseStats: Record<string, { 
      count: number
      total: number
      nfts: number
      wallet_address: string
      first_purchase: string | null
    }> = {}

    // 1. Query blockchain for NFT owners (primary source of truth)
    let blockchainQueried = false
    let blockchainError = ''
    try {
      // Get contract addresses from marketplace_contracts or env
      const { data: mktRows } = await supabaseAdmin
        .from('marketplace_contracts')
        .select('contract_address')
        .eq('enabled', true)

      const enabledAddrs = (mktRows || [])
        .map(r => (r as any).contract_address?.trim())
        .filter(Boolean) as string[]

      const fallbackEnv = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()
      const targetContracts = enabledAddrs.length > 0 ? enabledAddrs : (fallbackEnv ? [fallbackEnv] : [])

      logger.debug('[admin/users] Target contracts:', targetContracts)
      logger.debug('[admin/users] RPC URL:', process.env.BLOCKDAG_RPC ? 'set' : 'not set')

      if (targetContracts.length > 0) {
        const provider = getProvider()
        
        for (const addr of targetContracts) {
          try {
            const contract = new ethers.Contract(addr, PatriotPledgeV5ABI, provider)
            
            // Add timeout for totalSupply call
            const totalSupplyPromise = contract.totalSupply()
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('RPC timeout')), 10000)
            )
            
            const totalSupply = await Promise.race([totalSupplyPromise, timeoutPromise]) as bigint
            const total = Number(totalSupply)
            logger.debug(`[admin/users] Contract ${addr}: ${total} NFTs`)

            // Fetch owners in parallel batches with timeout
            const batchSize = 5
            for (let start = 0; start < total; start += batchSize) {
              const end = Math.min(start + batchSize, total)
              const promises: Promise<{ owner: string } | null>[] = []
              
              for (let i = start; i < end; i++) {
                promises.push(
                  (async () => {
                    try {
                      const tokenId = await contract.tokenByIndex(i)
                      const owner = await contract.ownerOf(tokenId)
                      return { owner }
                    } catch {
                      return null
                    }
                  })()
                )
              }
              
              // Race batch against timeout
              const batchTimeout = new Promise<({ owner: string } | null)[]>((resolve) => 
                setTimeout(() => resolve(promises.map(() => null)), 8000)
              )
              
              const results = await Promise.race([
                Promise.all(promises),
                batchTimeout
              ])
              
              for (const r of results) {
                if (!r) continue
                const ownerLower = r.owner.toLowerCase()
                if (!userPurchaseStats[ownerLower]) {
                  userPurchaseStats[ownerLower] = {
                    count: 0, total: 0, nfts: 0,
                    wallet_address: r.owner,
                    first_purchase: null
                  }
                }
                userPurchaseStats[ownerLower].nfts += 1
                userPurchaseStats[ownerLower].count += 1
              }
            }
            blockchainQueried = true
          } catch (contractErr: any) {
            blockchainError = contractErr?.message || 'Unknown error'
            logger.error(`[admin/users] Contract ${addr} error:`, blockchainError)
          }
        }
      }
    } catch (e: any) {
      blockchainError = e?.message || 'Unknown error'
      logger.error('[admin/users] Blockchain query failed:', blockchainError)
    }

    logger.debug('[admin/users] Blockchain queried:', blockchainQueried, 'Wallet owners:', Object.keys(userPurchaseStats).length, 'Error:', blockchainError)

    // 2. Query purchases table for spending data (primary source for USD amounts)
    const { data: purchases } = await supabaseAdmin
      .from('purchases')
      .select('wallet_address, amount_usd, tip_usd, email, user_id, created_at')
      .order('created_at', { ascending: false })

    logger.debug('[admin/users] DB: purchases:', purchases?.length)

    // Build spending stats from purchases table
    const walletSpending: Record<string, { total: number, count: number, first_purchase: string | null }> = {}
    const walletToEmail: Record<string, string> = {} // Map wallet addresses to emails
    const emailSpending: Record<string, { total: number, count: number }> = {}
    const userIdSpending: Record<string, { total: number, count: number }> = {}

    for (const p of (purchases || [])) {
      const spent = (p.amount_usd || 0) + (p.tip_usd || 0)
      
      // Track by wallet
      if (p.wallet_address) {
        const key = p.wallet_address.toLowerCase()
        if (!walletSpending[key]) {
          walletSpending[key] = { total: 0, count: 0, first_purchase: null }
        }
        walletSpending[key].total += spent
        walletSpending[key].count += 1
        if (!walletSpending[key].first_purchase) {
          walletSpending[key].first_purchase = p.created_at
        }
        // Capture email associated with this wallet (use most recent)
        if (p.email && !walletToEmail[key]) {
          walletToEmail[key] = p.email
        }
      }
      
      // Track by email for profile matching
      if (p.email) {
        const key = p.email.toLowerCase()
        if (!emailSpending[key]) {
          emailSpending[key] = { total: 0, count: 0 }
        }
        emailSpending[key].total += spent
        emailSpending[key].count += 1
      }
      
      // Track by user_id for direct profile matching
      if (p.user_id) {
        if (!userIdSpending[p.user_id]) {
          userIdSpending[p.user_id] = { total: 0, count: 0 }
        }
        userIdSpending[p.user_id].total += spent
        userIdSpending[p.user_id].count += 1
      }
    }

    // Merge wallet spending into userPurchaseStats
    for (const [wallet, stats] of Object.entries(walletSpending)) {
      if (!userPurchaseStats[wallet]) {
        userPurchaseStats[wallet] = {
          count: stats.count,
          total: stats.total,
          nfts: stats.count,
          wallet_address: wallet,
          first_purchase: stats.first_purchase
        }
      } else {
        userPurchaseStats[wallet].total = stats.total // Use purchases table as source of truth
        userPurchaseStats[wallet].count = Math.max(userPurchaseStats[wallet].count, stats.count)
        if (!userPurchaseStats[wallet].first_purchase) {
          userPurchaseStats[wallet].first_purchase = stats.first_purchase
        }
      }
    }

    logger.debug('[admin/users] Final: profiles:', profiles?.length, 'wallet owners:', Object.keys(userPurchaseStats).length)

    // Get campaigns created per user (by email) and also get sold_count data
    const { data: submissions } = await supabaseAdmin
      .from('submissions')
      .select('creator_email, campaign_id, sold_count, status')
      .in('status', ['minted', 'approved', 'pending'])

    // Log minted campaigns with sales for debugging
    const mintedWithSales = (submissions || []).filter((s: any) => s.status === 'minted' && s.sold_count > 0)
    logger.debug('[admin/users] Minted campaigns with sales:', mintedWithSales.map((s: any) => ({
      campaign_id: s.campaign_id,
      sold_count: s.sold_count
    })))

    const campaignsCreated: Record<string, number> = {}
    for (const s of (submissions || [])) {
      if (s.creator_email) {
        campaignsCreated[s.creator_email.toLowerCase()] = (campaignsCreated[s.creator_email.toLowerCase()] || 0) + 1
      }
    }

    // Build user list from profiles (registered users)
    const users: any[] = []
    const addedWallets = new Set<string>()
    
    for (const p of (profiles || [])) {
      const emailKey = p.email?.toLowerCase()
      
      // Get spending data from user_id first, then email
      const userIdStats = userIdSpending[p.id]
      const emailStats = emailKey ? emailSpending[emailKey] : null
      const spending = userIdStats || emailStats || { total: 0, count: 0 }
      
      users.push({
        id: p.id,
        email: p.email,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role: p.role || 'user',
        created_at: p.created_at,
        last_sign_in_at: p.last_sign_in_at,
        wallet_address: p.wallet_address || null,
        purchases_count: spending.count,
        nfts_owned: spending.count,
        total_spent_usd: spending.total,
        campaigns_created: campaignsCreated[emailKey] || 0,
        source: 'profile'
      })
      
      // Track wallet if profile has one to avoid duplicates
      if (p.wallet_address) {
        addedWallets.add(p.wallet_address.toLowerCase())
      }
    }

    // Add ALL wallet-based purchasers (these are separate from profile users)
    for (const [walletKey, stats] of Object.entries(userPurchaseStats)) {
      if (addedWallets.has(walletKey)) continue
      addedWallets.add(walletKey)
      
      // Get email from purchases table if available
      const purchaseEmail = walletToEmail[walletKey] || null
      const displayName = purchaseEmail 
        ? purchaseEmail.split('@')[0] 
        : `${walletKey.slice(0, 6)}...${walletKey.slice(-4)}`
      
      users.push({
        id: walletKey,
        email: purchaseEmail,
        display_name: displayName,
        avatar_url: null,
        role: 'buyer',
        created_at: stats.first_purchase,
        last_sign_in_at: null,
        wallet_address: stats.wallet_address,
        purchases_count: stats.count,
        nfts_owned: stats.nfts,
        total_spent_usd: stats.total,
        campaigns_created: 0,
        source: 'purchase'
      })
    }

    // Sort by created_at descending
    users.sort((a, b) => {
      const aDate = new Date(a.created_at || 0).getTime()
      const bDate = new Date(b.created_at || 0).getTime()
      return bDate - aDate
    })

    return NextResponse.json({ 
      users, 
      total: users.length,
      debug: {
        profilesCount: profiles?.length || 0,
        walletOwnersCount: Object.keys(userPurchaseStats).length,
        mintedCampaignsWithSales: mintedWithSales.length,
        blockchainQueried,
        blockchainError: blockchainError || null
      }
    })
  } catch (e: any) {
    logger.error('[admin/users] Error:', e)
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}
