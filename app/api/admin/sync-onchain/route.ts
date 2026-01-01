import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ethers } from 'ethers'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const V5_CONTRACT = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const V6_CONTRACT = '0xaE54e4E8A75a81780361570c17b8660CEaD27053'
const RPC_URL = 'https://rpc.awakening.bdagscan.com'
const BDAG_USD_RATE = 0.05

const CAMPAIGN_ABI = [
  'function totalSupply() view returns (uint256)',
  'function getCampaign(uint256 campaignId) view returns (string, string, uint256, uint256, uint256, uint256, uint256, uint256, bool, bool)',
]

async function getProvider() {
  return new ethers.JsonRpcProvider(RPC_URL, 1043, { staticNetwork: true })
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const expectedKey = process.env.ADMIN_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!authHeader || !authHeader.includes(expectedKey?.slice(0, 20) || '')) {
      logger.warn('[sync-onchain] Unauthorized sync attempt')
    }
    
    const provider = await getProvider()
    const v5 = new ethers.Contract(V5_CONTRACT, CAMPAIGN_ABI, provider)
    const v6 = new ethers.Contract(V6_CONTRACT, CAMPAIGN_ABI, provider)
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )
    
    const { data: submissions } = await supabase
      .from('submissions')
      .select('id, campaign_id, sold_count, num_copies, contract_address')
      .eq('status', 'minted')
    
    const results: any[] = []
    let synced = 0
    let errors = 0
    
    for (const sub of submissions || []) {
      if (!sub.campaign_id) continue
      
      try {
        const contract = sub.contract_address?.toLowerCase() === V6_CONTRACT.toLowerCase() ? v6 : v5
        const camp = await contract.getCampaign(BigInt(sub.campaign_id))
        
        const chainEditions = Number(camp[5])
        const chainMax = Number(camp[6])
        const chainContract = sub.contract_address?.toLowerCase() === V6_CONTRACT.toLowerCase() ? V6_CONTRACT : V5_CONTRACT
        
        const updates: any = {}
        
        if (sub.sold_count !== chainEditions) {
          updates.sold_count = chainEditions
        }
        if (sub.num_copies !== chainMax && chainMax > 0) {
          updates.num_copies = chainMax
        }
        
        if (Object.keys(updates).length > 0) {
          await supabase.from('submissions').update(updates).eq('id', sub.id)
          results.push({ campaignId: sub.campaign_id, updates })
          synced++
        }
      } catch (e: any) {
        errors++
        logger.error(`[sync-onchain] Error syncing campaign ${sub.campaign_id}:`, e.message)
      }
    }
    
    logger.api(`[sync-onchain] Synced ${synced} campaigns, ${errors} errors`)
    
    return NextResponse.json({
      success: true,
      synced,
      errors,
      results
    })
  } catch (e: any) {
    logger.error('[sync-onchain] Sync failed:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to trigger sync',
    contracts: { v5: V5_CONTRACT, v6: V6_CONTRACT }
  })
}
