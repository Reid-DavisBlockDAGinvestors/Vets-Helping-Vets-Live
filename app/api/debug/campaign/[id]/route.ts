import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ethers } from 'ethers'

export const runtime = 'nodejs'
import { getProvider } from '@/lib/onchain'
import { V5_ABI, V6_ABI } from '@/lib/contracts'
import { debugGuard } from '@/lib/debugGuard'

export const dynamic = 'force-dynamic'

const V5_CONTRACT = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const V6_CONTRACT = '0xaE54e4E8A75a81780361570c17b8660CEaD27053'
const BDAG_USD_RATE = 0.05

/**
 * Debug endpoint to check a specific campaign's data
 * GET /api/debug/campaign/54
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = debugGuard()
  if (blocked) return blocked
  const { id } = await params
  const campaignId = parseInt(id)
  
  if (isNaN(campaignId)) {
    return NextResponse.json({ error: 'Invalid campaign ID' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false } }
  )

  // 1. Get submission from Supabase
  const { data: submission, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('campaign_id', campaignId)
    .single()

  if (error) {
    return NextResponse.json({ 
      error: 'Campaign not found in database',
      details: error.message,
      campaignId 
    }, { status: 404 })
  }

  // 2. Get on-chain data
  const provider = getProvider()
  const contractAddr = submission.contract_address || V5_CONTRACT
  const isV5 = contractAddr.toLowerCase() === V5_CONTRACT.toLowerCase()
  const abi = isV5 ? V5_ABI : V6_ABI
  
  let onchainData: any = null
  try {
    const contract = new ethers.Contract(contractAddr, abi, provider)
    const camp = await contract.getCampaign(campaignId)
    
    const grossRaisedWei = BigInt(camp.grossRaised ?? camp[3] ?? 0n)
    const grossRaisedBDAG = Number(grossRaisedWei) / 1e18
    
    onchainData = {
      category: camp.category ?? camp[0],
      baseURI: camp.baseURI ?? camp[1],
      goal: Number(BigInt(camp.goal ?? camp[2] ?? 0n)) / 1e18,
      grossRaisedBDAG,
      grossRaisedUSD: grossRaisedBDAG * BDAG_USD_RATE,
      editionsMinted: Number(camp.editionsMinted ?? camp[5] ?? 0),
      maxEditions: Number(camp.maxEditions ?? camp[6] ?? 0),
      active: camp.active ?? camp[8],
      closed: camp.closed ?? camp[9]
    }
  } catch (e: any) {
    onchainData = { error: e?.message }
  }

  return NextResponse.json({
    campaignId,
    database: {
      id: submission.id,
      title: submission.title,
      status: submission.status,
      creator_wallet: submission.creator_wallet,
      contract_address: submission.contract_address || 'MISSING (will use V5)',
      contract_version: submission.contract_version,
      category: submission.category,
      goal: submission.goal,
      num_copies: submission.num_copies,
      price_per_copy: submission.price_per_copy,
      image_uri: submission.image_uri?.slice(0, 80),
      created_at: submission.created_at
    },
    onchain: onchainData,
    dashboardVisibility: {
      willShowInOwnedNFTs: 'Only if wallet owns NFT from this campaign',
      willShowInMyFundraisers: submission.creator_wallet 
        ? `Yes, for wallet ${submission.creator_wallet}`
        : 'NO - creator_wallet is missing!',
      issue: !submission.creator_wallet 
        ? 'MISSING creator_wallet - campaign won\'t show in dashboard'
        : !submission.contract_address
        ? 'MISSING contract_address - on-chain stats may fail'
        : 'None detected'
    }
  })
}
