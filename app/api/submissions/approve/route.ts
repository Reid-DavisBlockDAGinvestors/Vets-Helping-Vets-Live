import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getRelayerSigner, getContract } from '@/lib/onchain'
import { sendEmail } from '@/lib/mailer'

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
    
    try {
      let uname: string | null = null
      try {
        const { data: profU } = await supabaseAdmin.from('profiles').select('username').eq('email', sub.creator_email).maybeSingle()
        uname = profU?.username || null
      } catch {}
      await sendEmail({
        to: sub.creator_email,
        subject: 'Your submission was approved',
        html: `<p>${uname ? `Hi ${uname},` : 'Good news!'}</p><p>Your submission was approved and your fundraiser campaign is now live!</p><p>ID: ${id}</p>`
      })
    } catch {}

    const signer = getRelayerSigner()
    const contract = getContract(signer)
    
    // V5: Create campaign on-chain
    // Convert goal/copies to numbers first (handles string values from Supabase)
    const goalNum = Number(merged.goal) || 0
    const copiesNum = Number(merged.num_copies) || 0
    
    // Price per NFT = Goal ÷ Copies (or explicit price if set)
    const priceNum = merged.price_per_copy 
      ? Number(merged.price_per_copy)
      : (goalNum > 0 && copiesNum > 0 ? goalNum / copiesNum : 0)
    
    // Convert to wei (assuming 18 decimals) - multiply by 10^18
    const goalWei = BigInt(Math.floor(goalNum * 1e18))
    const priceWei = BigInt(Math.floor(priceNum * 1e18))
    const maxEditions = BigInt(copiesNum)
    const feeRateBps = 100n // 1% nonprofit fee
    
    console.log(`[approve] Creating campaign: goal=$${goalNum} (${goalWei} wei), copies=${copiesNum}, price=$${priceNum} (${priceWei} wei)`)
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

    // Update submission with campaign info
    const contractAddress = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || null
    const { error: updateError } = await supabaseAdmin
      .from('submissions')
      .update({ 
        status: 'minted', // Using 'minted' status to indicate campaign is live
        campaign_id: campaignId, 
        tx_hash: txHash, 
        contract_address: contractAddress, 
        visible_on_marketplace: true 
      })
      .eq('id', id)
    
    if (updateError) {
      console.error('[approve] Failed to update submission:', updateError)
    } else {
      console.log(`[approve] Submission ${id} updated: campaign_id=${campaignId}, status=minted`)
    }
    
    try {
      let uname: string | null = null
      try {
        const { data: profU } = await supabaseAdmin.from('profiles').select('username').eq('email', sub.creator_email).maybeSingle()
        uname = profU?.username || null
      } catch {}
      const base = process.env.NEXT_PUBLIC_EXPLORER_BASE || ''
      const link = txHash && base ? `${base}/tx/${txHash}` : txHash || ''
      await sendEmail({
        to: sub.creator_email,
        subject: 'Your fundraiser campaign is live!',
        html: `<p>${uname ? `Hi ${uname},` : 'Congratulations!'}</p><p>Your fundraiser campaign is now live on the marketplace. Donors can now contribute and receive edition NFTs.</p><p>Campaign ID: ${campaignId}</p><p>Tx: <a href="${link}">${txHash}</a></p>`
      })
    } catch {}

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
