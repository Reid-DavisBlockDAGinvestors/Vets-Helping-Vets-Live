import { NextRequest, NextResponse } from 'next/server'
import { getRelayerSigner, getContract } from '@/lib/onchain'

/**
 * Admin endpoint to reactivate a campaign on-chain
 * POST /api/admin/reactivate-campaign
 * Body: { campaignId: number }
 */
export async function POST(req: NextRequest) {
  try {
    // Simple auth check - require admin token
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { campaignId } = body

    if (campaignId == null || campaignId < 0) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
    }

    console.log(`[reactivate-campaign] Reactivating campaign #${campaignId}`)

    const signer = getRelayerSigner()
    const contract = getContract(signer)

    // Check current state
    let currentState: any
    try {
      currentState = await (contract as any).getCampaign(BigInt(campaignId))
      console.log(`[reactivate-campaign] Current state: active=${currentState.active}, closed=${currentState.closed}`)
      
      if (currentState.active === true) {
        return NextResponse.json({ 
          success: true, 
          message: 'Campaign is already active',
          alreadyActive: true 
        })
      }
      
      if (currentState.closed === true) {
        return NextResponse.json({ 
          error: 'Campaign is permanently closed and cannot be reactivated' 
        }, { status: 400 })
      }
    } catch (e: any) {
      console.error(`[reactivate-campaign] Error fetching campaign:`, e.message)
      return NextResponse.json({ 
        error: 'Failed to fetch campaign state', 
        details: e.message 
      }, { status: 500 })
    }

    // Reactivate the campaign
    try {
      const tx = await (contract as any).reactivateCampaign(BigInt(campaignId))
      console.log(`[reactivate-campaign] Tx submitted: ${tx.hash}`)
      
      const receipt = await tx.wait(1)
      console.log(`[reactivate-campaign] Tx confirmed in block ${receipt?.blockNumber}`)

      return NextResponse.json({ 
        success: true, 
        message: `Campaign #${campaignId} reactivated`,
        txHash: tx.hash
      })
    } catch (e: any) {
      console.error(`[reactivate-campaign] Error reactivating:`, e.message)
      return NextResponse.json({ 
        error: 'Failed to reactivate campaign', 
        details: e.message 
      }, { status: 500 })
    }
  } catch (e: any) {
    console.error('[reactivate-campaign] Error:', e)
    return NextResponse.json({ 
      error: 'Reactivate campaign failed', 
      details: e?.message 
    }, { status: 500 })
  }
}
