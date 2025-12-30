import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ethers } from 'ethers'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// GET: Get participation stats for a wallet address
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const wallet = searchParams.get('wallet')
    
    if (!wallet) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 })
    }

    if (!ethers.isAddress(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
    }

    const walletLower = wallet.toLowerCase()

    // Get NFTs owned by this wallet from blockchain
    let nftsOwned = 0
    try {
      const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()
      if (contractAddress) {
        const provider = getProvider()
        const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)
        const balance = await contract.balanceOf(wallet)
        nftsOwned = Number(balance)
      }
    } catch (e: any) {
      logger.error('[Participation] NFT balance error:', e?.message)
    }

    // Get campaigns created by this wallet from submissions table
    let campaignsCreated = 0
    try {
      const { data: campaigns, error: campError } = await supabaseAdmin
        .from('submissions')
        .select('id')
        .ilike('creator_wallet', walletLower)
      
      if (campError) logger.error('[Participation] Campaign query error:', campError)
      campaignsCreated = campaigns?.length || 0
    } catch (e: any) {
      logger.error('[Participation] Campaign query error:', e?.message)
    }

    // Get total donated by this wallet (from purchases table if it exists)
    let totalDonated = 0
    try {
      // Note: purchases table may not exist - donations are tracked differently
      // For now, we'll skip this since the platform primarily tracks NFT purchases on-chain
      // You could add a purchases or donations table later if needed
    } catch (e: any) {
      logger.error('[Participation] Purchase query error:', e?.message)
    }

    logger.api(`[Participation] ${wallet}: ${nftsOwned} NFTs, ${campaignsCreated} campaigns, $${totalDonated} donated`)

    return NextResponse.json({
      wallet,
      nftsOwned,
      campaignsCreated,
      totalDonated
    })
  } catch (e: any) {
    logger.error('[Participation] Error:', e)
    return NextResponse.json({ 
      nftsOwned: 0, 
      campaignsCreated: 0, 
      totalDonated: 0,
      error: e?.message 
    })
  }
}
