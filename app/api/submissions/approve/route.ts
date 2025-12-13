import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getRelayerSigner, getContract } from '@/lib/onchain'
import { sendCampaignApproved } from '@/lib/mailer'

// Convert IPFS URI to HTTP gateway URL
function toHttpUrl(uri: string | null): string | null {
  if (!uri) return null
  if (uri.startsWith('ipfs://')) {
    return `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`
  }
  return uri
}

/**
 * V5 Approve Flow:
 * 1. Admin approves submission
 * 2. Creates a Campaign on-chain (no NFT minted yet)
 * 3. Campaign goes live in marketplace
 * 4. Donors purchase editions → NFT minted to their wallet
 */
export async function POST(req: NextRequest) {
  try {
    // Require admin via Supabase bearer token
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    const { data: userData } = await supabaseAdmin.auth.getUser(token)
    const uid = userData?.user?.id
    if (!uid) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single()
    if ((profile?.role || '') !== 'admin') return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const body = await req.json().catch(()=>null)
    if (!body?.id) return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })
    const id: string = body.id
    const updates = body.updates || {}

    // Load existing submission
    const { data: sub, error: fetchErr } = await supabaseAdmin.from('submissions').select('*').eq('id', id).single()
    if (fetchErr || !sub) return NextResponse.json({ error: 'SUBMISSION_NOT_FOUND', details: fetchErr?.message }, { status: 404 })

    // Apply edits from admin
    const merged = { ...sub, ...updates }
    // Creator wallet is optional for submission but required for campaign
    // Use relayer address as fallback if no creator wallet (funds go to platform initially)
    let relayerAddress = process.env.RELAYER_ADDRESS || process.env.NEXT_PUBLIC_RELAYER_ADDRESS
    if (!relayerAddress) {
      // Compute from relayer key
      try {
        const { ethers } = await import('ethers')
        const key = process.env.BDAG_RELAYER_KEY || process.env.RELAYER_PRIVATE_KEY || ''
        if (key) {
          const wallet = new ethers.Wallet(key)
          relayerAddress = wallet.address
        }
      } catch {}
    }
    const creatorWallet: string = merged.creator_wallet || relayerAddress || ''
    const uri: string = merged.metadata_uri
    const category: string = merged.category || 'general'
    
    if (!uri) {
      return NextResponse.json({
        error: 'SUBMISSION_INVALID_FIELDS',
        details: 'metadata_uri is required'
      }, { status: 400 })
    }
    
    if (!creatorWallet) {
      return NextResponse.json({
        error: 'SUBMISSION_INVALID_FIELDS',
        details: 'creator_wallet is required. Either add a wallet address to the submission or set RELAYER_ADDRESS in env.'
      }, { status: 400 })
    }

    // Check if already has campaign (prevents duplicate creates from retries)
    if (sub.status === 'minted' && sub.campaign_id != null) {
      return NextResponse.json({
        ok: true,
        alreadyCreated: true,
        campaignId: sub.campaign_id,
        message: 'Campaign was already created'
      })
    }

    // Mark approved and email
    await supabaseAdmin.from('submissions').update({ 
      status: 'approved', 
      reviewer_notes: merged.reviewer_notes || sub.reviewer_notes, 
      title: merged.title, 
      story: merged.story, 
      category: merged.category, 
      image_uri: merged.image_uri, 
      metadata_uri: merged.metadata_uri 
    }).eq('id', id)
    
    // Email will be sent after campaign is created on-chain with campaignId

    const signer = getRelayerSigner()
    const contract = getContract(signer)
    
    // V5: Create campaign on-chain
    // Convert goal/copies to numbers first (handles string values from Supabase)
    const goalUSD = Number(merged.goal) || 100  // Default $100 goal if not set
    
    // Default to 100 copies if not set, or calculate from goal ($1 per copy minimum)
    let copiesNum = Number(merged.num_copies) || Number(merged.nft_editions) || 0
    if (copiesNum === 0 && goalUSD > 0) {
      copiesNum = Math.max(100, Math.floor(goalUSD)) // Default: goal amount as copies (min 100)
    }
    
    // Price per NFT = Goal ÷ Copies (or explicit price if set) - in USD
    // Allow decimal prices (e.g., $0.50 for $50 goal / 100 copies)
    const priceUSD = merged.price_per_copy || merged.nft_price
      ? Number(merged.price_per_copy || merged.nft_price)
      : (goalUSD > 0 && copiesNum > 0 ? goalUSD / copiesNum : 0.01)
    
    // Convert USD to BDAG for on-chain storage
    // BDAG_USD_RATE = 0.05 means 1 BDAG = $0.05, so 1 USD = 20 BDAG
    const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || process.env.NEXT_PUBLIC_BDAG_USD_RATE || '0.05')
    const USD_TO_BDAG = 1 / BDAG_USD_RATE  // 20 BDAG per 1 USD at current rate
    
    const goalBDAG = goalUSD * USD_TO_BDAG
    const priceBDAG = priceUSD * USD_TO_BDAG
    
    // Convert to wei (18 decimals) - on-chain values are in BDAG
    const goalWei = BigInt(Math.floor(goalBDAG * 1e18))
    const priceWei = BigInt(Math.floor(priceBDAG * 1e18))
    const maxEditions = BigInt(copiesNum)
    const feeRateBps = 100n // 1% nonprofit fee
    
    console.log(`[approve] Creating campaign: goal=$${goalUSD} USD = ${goalBDAG} BDAG (${goalWei} wei), copies=${copiesNum}, price=$${priceUSD} USD = ${priceBDAG} BDAG (${priceWei} wei)`)
    console.log(`[approve] Creator wallet: ${creatorWallet}, metadata: ${uri.slice(0, 50)}...`)

    let campaignId: number | null = null
    let txHash: string | null = null

    // Create campaign with retry on nonce/gas errors
    async function createCampaignWithRetry(maxRetries = 5): Promise<{ hash: string; campaignId: number | null }> {
      let lastError: any = null
      const provider = signer.provider!
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const nonceType = attempt === 0 ? 'pending' : 'latest'
          const nonce = await signer.getNonce(nonceType)
          
          const feeData = await provider.getFeeData()
          const baseGasPrice = feeData.gasPrice || 1000000000n
          const multiplier = 100n + BigInt(attempt * 20)
          const gasPrice = (baseGasPrice * multiplier) / 100n
          
          // Predict campaignId from totalCampaigns
          let predictedId: number | null = null
          try {
            const total: bigint = await (contract as any).totalCampaigns()
            predictedId = Number(total)
          } catch {}
          
          console.log(`[createCampaign] Attempt ${attempt + 1}: nonce=${nonce}, gasPrice=${gasPrice}`)
          const tx = await contract.createCampaign(
            category,
            uri,
            goalWei,
            maxEditions,
            priceWei,
            feeRateBps,
            creatorWallet, // submitter address
            { nonce, gasPrice }
          )
          return { hash: tx.hash, campaignId: predictedId }
        } catch (err: any) {
          lastError = err
          const msg = err?.message || ''
          const code = err?.code || ''
          
          if (msg.includes('already known')) {
            console.log(`[createCampaign] Tx already in mempool, treating as success`)
            let predictedId: number | null = null
            try {
              const total: bigint = await (contract as any).totalCampaigns()
              predictedId = Number(total)
            } catch {}
            return { hash: '(pending in mempool)', campaignId: predictedId }
          }
          
          if (msg.includes('nonce') || msg.includes('NONCE') || 
              msg.includes('replacement') || code === 'REPLACEMENT_UNDERPRICED' ||
              code === 'NONCE_EXPIRED') {
            console.log(`[createCampaign] Tx error on attempt ${attempt + 1}: ${code || msg.slice(0, 50)}... retrying...`)
            await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
            continue
          }
          throw err
        }
      }
      throw lastError
    }

    const result = await createCampaignWithRetry()
    campaignId = result.campaignId
    txHash = result.hash

    // Update submission with campaign info and NFT settings
    const contractAddress = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || null
    const { error: updateError } = await supabaseAdmin
      .from('submissions')
      .update({ 
        status: 'minted', // Using 'minted' status to indicate campaign is live
        campaign_id: campaignId, 
        tx_hash: txHash, 
        contract_address: contractAddress, 
        visible_on_marketplace: true,
        // Save NFT settings that were used for on-chain campaign
        num_copies: copiesNum || null,
        price_per_copy: priceUSD || null,
        nft_editions: copiesNum || null,
        nft_price: priceUSD || null
      })
      .eq('id', id)
    
    if (updateError) {
      console.error('[approve] Failed to update submission:', updateError)
    } else {
      console.log(`[approve] Submission ${id} updated: campaign_id=${campaignId}, status=minted`)
    }
    
    // Send campaign approved email with proper template
    if (campaignId != null) {
      try {
        await sendCampaignApproved({
          email: sub.creator_email,
          title: sub.title || 'Your Campaign',
          campaignId: campaignId,
          creatorName: sub.creator_name,
          imageUrl: toHttpUrl(sub.image_uri) || undefined
        })
        console.log(`[approve] Sent campaign approved email to ${sub.creator_email}`)
      } catch (emailErr) {
        console.error('[approve] Failed to send campaign approved email:', emailErr)
      }
    }

    return NextResponse.json({
      ok: true,
      txHash,
      campaignId: campaignId != null ? campaignId : undefined
    })
  } catch (e:any) {
    console.error('[approve] Error:', e?.message || String(e))
    console.error('[approve] Full error:', e)
    return NextResponse.json({ error: 'APPROVE_AND_CREATE_CAMPAIGN_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}
