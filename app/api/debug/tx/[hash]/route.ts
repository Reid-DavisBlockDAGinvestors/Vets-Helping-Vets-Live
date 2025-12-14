import { NextRequest, NextResponse } from 'next/server'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'

export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to check a specific transaction
 * GET /api/debug/tx/[hash]
 * 
 * Returns transaction details and parsed events
 */
export async function GET(_req: NextRequest, context: { params: { hash: string } }) {
  try {
    const txHash = context.params.hash
    if (!txHash || txHash.length < 10) {
      return NextResponse.json({ error: 'Invalid transaction hash' }, { status: 400 })
    }

    const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()
    const provider = getProvider()

    // Get transaction
    let tx
    try {
      tx = await provider.getTransaction(txHash)
    } catch (e: any) {
      return NextResponse.json({ 
        error: 'TRANSACTION_NOT_FOUND',
        details: e?.message,
        txHash
      }, { status: 404 })
    }

    if (!tx) {
      return NextResponse.json({ 
        error: 'TRANSACTION_NOT_FOUND',
        txHash,
        message: 'Transaction not found on chain'
      }, { status: 404 })
    }

    // Get receipt
    let receipt
    try {
      receipt = await provider.getTransactionReceipt(txHash)
    } catch (e: any) {
      return NextResponse.json({
        txHash,
        tx: {
          from: tx.from,
          to: tx.to,
          value: ethers.formatEther(tx.value),
          nonce: tx.nonce,
          blockNumber: tx.blockNumber,
        },
        receipt: null,
        status: 'pending',
        message: 'Transaction found but not yet confirmed'
      })
    }

    if (!receipt) {
      return NextResponse.json({
        txHash,
        tx: {
          from: tx.from,
          to: tx.to,
          value: ethers.formatEther(tx.value),
          nonce: tx.nonce,
          blockNumber: tx.blockNumber,
        },
        receipt: null,
        status: 'pending',
        message: 'Transaction found but not yet confirmed'
      })
    }

    // Parse events from receipt
    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)
    const events: any[] = []
    
    for (const log of receipt.logs || []) {
      try {
        const parsed = contract.interface.parseLog({
          topics: log.topics as string[],
          data: log.data
        })
        if (parsed) {
          events.push({
            name: parsed.name,
            args: parsed.args.map((a: any) => 
              typeof a === 'bigint' ? a.toString() : a
            )
          })
        }
      } catch {
        // Not our event
      }
    }

    // Find CampaignCreated event
    const campaignCreatedEvent = events.find(e => e.name === 'CampaignCreated')
    const campaignId = campaignCreatedEvent ? Number(campaignCreatedEvent.args[0]) : null

    return NextResponse.json({
      txHash,
      status: receipt.status === 1 ? 'success' : 'failed',
      blockNumber: Number(receipt.blockNumber),
      from: receipt.from,
      to: receipt.to,
      gasUsed: receipt.gasUsed.toString(),
      events,
      campaignId,
      contractAddress,
      timestamp: new Date().toISOString()
    })

  } catch (e: any) {
    return NextResponse.json({ 
      error: 'TX_CHECK_FAILED', 
      details: e?.message || String(e) 
    }, { status: 500 })
  }
}
