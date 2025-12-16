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
    if (!['admin', 'super_admin'].includes(profile?.role || '')) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

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

    // Mark approved and save all edits including benchmarks
    await supabaseAdmin.from('submissions').update({ 
      status: 'approved', 
      reviewer_notes: merged.reviewer_notes || sub.reviewer_notes, 
      title: merged.title, 
      story: merged.story, 
      category: merged.category, 
      goal: merged.goal,
      image_uri: merged.image_uri, 
      metadata_uri: merged.metadata_uri,
      benchmarks: merged.benchmarks || null,
      num_copies: merged.num_copies || null,
      price_per_copy: merged.price_per_copy || null
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

    // Create campaign - optimized for Netlify's 10-second timeout
    // We predict the campaignId and don't wait for confirmation
    // The fix-campaign endpoint can correct the ID if needed
    async function createCampaignFast(maxRetries = 3): Promise<{ hash: string; campaignId: number }> {
      let lastError: any = null
      const provider = signer.provider!
      
      // Get predicted campaign ID first (before tx)
      let predictedCampaignId: number
      try {
        const total: bigint = await (contract as any).totalCampaigns()
        predictedCampaignId = Number(total) // Next ID will be current total
        console.log(`[createCampaign] Predicted campaignId: ${predictedCampaignId}`)
      } catch (e) {
        console.error(`[createCampaign] Failed to get totalCampaigns:`, e)
        throw new Error('Could not predict campaignId')
      }
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const nonceType = attempt === 0 ? 'pending' : 'latest'
          const nonce = await signer.getNonce(nonceType)
          
          const feeData = await provider.getFeeData()
          const baseGasPrice = feeData.gasPrice || 1000000000n
          const multiplier = 100n + BigInt(attempt * 20)
          const gasPrice = (baseGasPrice * multiplier) / 100n
          
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
          
          console.log(`[createCampaign] Tx submitted: ${tx.hash}`)
          
          // Don't wait for confirmation - Netlify has a 10-second timeout
          // Return immediately with predicted campaignId
          return { hash: tx.hash, campaignId: predictedCampaignId }
        } catch (err: any) {
          lastError = err
          const msg = err?.message || ''
          const code = err?.code || ''
          
          if (msg.includes('already known')) {
            console.log(`[createCampaign] Tx already in mempool`)
            return { hash: '(pending in mempool)', campaignId: predictedCampaignId }
          }
          
          if (msg.includes('nonce') || msg.includes('NONCE') || 
              msg.includes('replacement') || code === 'REPLACEMENT_UNDERPRICED' ||
              code === 'NONCE_EXPIRED') {
            console.log(`[createCampaign] Tx error on attempt ${attempt + 1}: ${code || msg.slice(0, 50)}... retrying...`)
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
            continue
          }
          throw err
        }
      }
      throw lastError
    }

    const result = await createCampaignFast()
    campaignId = result.campaignId // This is just a prediction, will be verified
    txHash = result.hash

    // Try to verify the campaign was created correctly (quick check)
    // This helps avoid the "Fix Campaign" step in most cases
    let verifiedCampaignId = campaignId
    let finalStatus = 'pending_onchain'
    
    try {
      // Wait a moment for the tx to propagate
      await new Promise(r => setTimeout(r, 2000))
      
      // Check if the predicted campaign ID has our metadata URI
      const verifyContract = getContract(signer)
      const camp = await verifyContract.getCampaign(BigInt(campaignId))
      const onChainUri = camp.baseURI ?? camp[1]
      
      if (onChainUri === uri) {
        // Predicted ID is correct!
        console.log(`[approve] Verified campaign ${campaignId} matches metadata URI`)
        finalStatus = 'minted'
        verifiedCampaignId = campaignId
      } else {
        // Predicted ID doesn't match - search for correct one
        console.log(`[approve] Predicted ID ${campaignId} has different URI, searching...`)
        const total = Number(await verifyContract.totalCampaigns())
        
        for (let i = Math.max(0, campaignId - 5); i < total; i++) {
          try {
            const c = await verifyContract.getCampaign(BigInt(i))
            if ((c.baseURI ?? c[1]) === uri) {
              verifiedCampaignId = i
              finalStatus = 'minted'
              console.log(`[approve] Found correct campaign ID: ${i}`)
              break
            }
          } catch { continue }
        }
      }
    } catch (verifyErr: any) {
      console.log(`[approve] Quick verification failed (tx may still be pending): ${verifyErr?.message}`)
      // Keep pending_onchain status - user can verify later
    }

    // Update submission with verified or pending status
    const contractAddress = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || null
    const { error: updateError } = await supabaseAdmin
      .from('submissions')
      .update({ 
        status: finalStatus,
        campaign_id: verifiedCampaignId,
        tx_hash: txHash, 
        contract_address: contractAddress, 
        visible_on_marketplace: true,
        // Save NFT settings that were used for on-chain campaign
        num_copies: copiesNum || null,
        price_per_copy: priceUSD || null
      })
      .eq('id', id)
    
    if (updateError) {
      console.error('[approve] Failed to update submission:', updateError)
    } else {
      console.log(`[approve] Submission ${id} updated: campaign_id=${verifiedCampaignId}, status=${finalStatus}, tx=${txHash}`)
    }
    
    // Send campaign approved email
    try {
      await sendCampaignApproved({
        email: sub.creator_email,
        title: sub.title || 'Your Campaign',
        campaignId: verifiedCampaignId,
        creatorName: sub.creator_name,
        imageUrl: toHttpUrl(sub.image_uri) || undefined,
        txHash: txHash || undefined
      })
      console.log(`[approve] Sent campaign approved email to ${sub.creator_email} with txHash: ${txHash}`)
    } catch (emailErr) {
      console.error('[approve] Failed to send campaign approved email:', emailErr)
    }

    const message = finalStatus === 'minted'
      ? `Campaign created and verified! Campaign ID: ${verifiedCampaignId}. Now live on marketplace.`
      : 'Campaign transaction submitted. Awaiting blockchain confirmation. Use "Verify" button to check status.'

    return NextResponse.json({
      ok: true,
      txHash,
      campaignId: verifiedCampaignId,
      status: finalStatus,
      message
    })
  } catch (e:any) {
    console.error('[approve] Error:', e?.message || String(e))
    console.error('[approve] Full error:', e)
    return NextResponse.json({ error: 'APPROVE_AND_CREATE_CAMPAIGN_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}
