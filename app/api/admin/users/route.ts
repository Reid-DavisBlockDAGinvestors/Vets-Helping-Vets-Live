import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ethers } from 'ethers'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'

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
      console.error('[admin/users] profiles error:', profilesErr)
    }

    // Query blockchain for NFT owners (primary source of truth)
    const contractAddress = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''
    const userPurchaseStats: Record<string, { 
      count: number
      total: number
      nfts: number
      wallet_address: string
      first_purchase: string | null
    }> = {}

    if (contractAddress) {
      try {
        const provider = getProvider()
        const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)
        
        // Get total supply of NFTs
        const totalSupply = await contract.totalSupply()
        const total = Number(totalSupply)
        console.log('[admin/users] Total NFTs on-chain:', total)

        // Get owner of each token
        for (let i = 0; i < total; i++) {
          try {
            const tokenId = await contract.tokenByIndex(i)
            const owner = await contract.ownerOf(tokenId)
            const ownerLower = owner.toLowerCase()
            
            if (!userPurchaseStats[ownerLower]) {
              userPurchaseStats[ownerLower] = {
                count: 0,
                total: 0,
                nfts: 0,
                wallet_address: owner,
                first_purchase: null
              }
            }
            userPurchaseStats[ownerLower].nfts += 1
            userPurchaseStats[ownerLower].count += 1
          } catch (e) {
            console.error(`[admin/users] Error getting token ${i}:`, e)
          }
        }
        console.log('[admin/users] Unique wallet owners:', Object.keys(userPurchaseStats).length)
      } catch (e) {
        console.error('[admin/users] Error querying blockchain:', e)
      }
    }

    // Also check database tables for additional data
    const { data: contributions } = await supabaseAdmin
      .from('contributions')
      .select('buyer_wallet, amount_gross, amount_net, token_id, created_at')
      .order('created_at', { ascending: false })

    const { data: purchaseEvents } = await supabaseAdmin
      .from('events')
      .select('wallet_address, amount_usd, created_at')
      .eq('event_type', 'purchase')

    // Add contribution amounts to wallet stats
    for (const c of (contributions || [])) {
      const key = c.buyer_wallet?.toLowerCase()
      if (!key) continue
      if (!userPurchaseStats[key]) {
        userPurchaseStats[key] = { 
          count: 0, total: 0, nfts: 0, 
          wallet_address: c.buyer_wallet,
          first_purchase: c.created_at
        }
      }
      userPurchaseStats[key].total += parseFloat(c.amount_gross) || parseFloat(c.amount_net) || 0
      if (!userPurchaseStats[key].first_purchase) {
        userPurchaseStats[key].first_purchase = c.created_at
      }
    }

    // Add event amounts
    for (const e of (purchaseEvents || [])) {
      const key = e.wallet_address?.toLowerCase()
      if (!key) continue
      if (userPurchaseStats[key]) {
        userPurchaseStats[key].total += parseFloat(e.amount_usd) || 0
      }
    }

    console.log('[admin/users] profiles:', profiles?.length, 'wallet owners:', Object.keys(userPurchaseStats).length)

    // Get campaigns created per user (by email)
    const { data: submissions } = await supabaseAdmin
      .from('submissions')
      .select('creator_email')
      .in('status', ['minted', 'approved', 'pending'])

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
      users.push({
        id: p.id,
        email: p.email,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role: p.role || 'user',
        created_at: p.created_at,
        last_sign_in_at: p.last_sign_in_at,
        wallet_address: null,
        purchases_count: 0,
        nfts_owned: 0,
        total_spent_usd: 0,
        campaigns_created: campaignsCreated[emailKey] || 0,
        source: 'profile'
      })
    }

    // Add ALL wallet-based purchasers (these are separate from profile users)
    for (const [walletKey, stats] of Object.entries(userPurchaseStats)) {
      if (addedWallets.has(walletKey)) continue
      addedWallets.add(walletKey)
      
      users.push({
        id: walletKey,
        email: null,
        display_name: `${walletKey.slice(0, 6)}...${walletKey.slice(-4)}`,
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

    return NextResponse.json({ users, total: users.length })
  } catch (e: any) {
    console.error('[admin/users] Error:', e)
    return NextResponse.json({ error: 'FAILED', details: e?.message }, { status: 500 })
  }
}
