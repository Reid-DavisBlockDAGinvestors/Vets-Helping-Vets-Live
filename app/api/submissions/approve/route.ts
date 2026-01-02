import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getRelayerSigner } from '@/lib/onchain'
import { sendCampaignApproved } from '@/lib/mailer'
import { getActiveContractVersion, getContractByVersion, getContractAddress, getContractInfo } from '@/lib/contracts'
import { logger } from '@/lib/logger'

// Chain info mapping for multi-chain support
const CHAIN_INFO: Record<number, { name: string; isTestnet: boolean }> = {
  1043: { name: 'BlockDAG Testnet', isTestnet: true },
  1: { name: 'Ethereum Mainnet', isTestnet: false },
  11155111: { name: 'Sepolia Testnet', isTestnet: true },
  137: { name: 'Polygon Mainnet', isTestnet: false },
  80001: { name: 'Polygon Mumbai', isTestnet: true },
  8453: { name: 'Base Mainnet', isTestnet: false },
  84531: { name: 'Base Goerli', isTestnet: true },
}

// Force dynamic rendering (no caching)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Extended timeout for blockchain confirmation
// Netlify Pro: 26s, Vercel Pro: 60s, self-hosted: unlimited
// We set 120s (2 min) - falls back to platform max if exceeded
export const maxDuration = 120

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
    
    // Target network selection from admin UI
    const targetChainId = body.targetChainId || updates.chain_id || 1043  // Default: BlockDAG
    const targetContractVersion = body.targetContractVersion || updates.contract_version || 'v6'
    const isTestnet = body.isTestnet ?? updates.is_testnet ?? true
    
    logger.info(`[approve] Target network: chainId=${targetChainId}, contract=${targetContractVersion}, testnet=${isTestnet}`)

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
    // Determine if using creator's wallet or platform wallet
    const hasCreatorWallet = !!merged.creator_wallet
    const creatorWallet: string = merged.creator_wallet || relayerAddress || ''
    const usingPlatformWallet = !hasCreatorWallet && creatorWallet === relayerAddress
    
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
        details: 'No wallet available. Either add a wallet address or ensure RELAYER_ADDRESS is set in env.'
      }, { status: 400 })
    }
    
    // Log platform wallet usage for admin awareness
    if (usingPlatformWallet) {
      logger.info(`[approve] Using PLATFORM WALLET for submission ${id} - creator "${merged.creator_name}" (${merged.creator_email}) has no wallet. Funds will be held for future migration.`)
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
    // Track wallet status for future migration if using platform wallet
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
      price_per_copy: merged.price_per_copy || null,
      // Track the wallet used and whether it's the platform wallet
      creator_wallet: creatorWallet,
      uses_platform_wallet: usingPlatformWallet
    }).eq('id', id)
    
    // Email will be sent after campaign is created on-chain with campaignId

    // Get signer for the target network
    // For Sepolia (11155111), use ETH_DEPLOYER_KEY with Sepolia RPC
    // For BlockDAG (1043), use BDAG_RELAYER_KEY with BlockDAG RPC
    let signer: any
    const { ethers } = await import('ethers')
    
    if (targetChainId === 11155111) {
      // Sepolia network
      const sepoliaRpc = process.env.ETHEREUM_SEPOLIA_RPC || process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com'
      const sepoliaKey = process.env.ETH_DEPLOYER_KEY || process.env.SEPOLIA_DEPLOYER_KEY
      
      if (!sepoliaKey) {
        return NextResponse.json({ 
          error: 'MISSING_SEPOLIA_KEY', 
          details: 'ETH_DEPLOYER_KEY not configured for Sepolia deployment' 
        }, { status: 500 })
      }
      
      const provider = new ethers.JsonRpcProvider(sepoliaRpc)
      signer = new ethers.Wallet(sepoliaKey, provider)
      logger.info(`[approve] Using Sepolia signer: ${signer.address}`)
    } else {
      // BlockDAG network (default)
      signer = getRelayerSigner()
      logger.info(`[approve] Using BlockDAG signer`)
    }
    
    // Use the TARGET contract version, not the default active one
    const contractVersion = targetContractVersion as any
    const contractAddress = getContractAddress(contractVersion)
    const contract = getContractByVersion(contractVersion, signer)
    
    if (!contractAddress) {
      return NextResponse.json({ 
        error: 'CONTRACT_NOT_FOUND', 
        details: `Contract ${contractVersion} not registered` 
      }, { status: 400 })
    }
    
    logger.info(`[approve] Using contract ${contractVersion} at ${contractAddress} on chain ${targetChainId}`)
    
    // IDEMPOTENCY CHECK: Search on-chain for existing campaign with same metadata URI
    // This prevents duplicate campaigns from RPC retries
    try {
      const checkContract = getContractByVersion(contractVersion, signer)
      const totalOnChain = Number(await checkContract.totalCampaigns())
      logger.debug(`[approve] Idempotency check: searching ${totalOnChain} campaigns for URI match`)
      
      for (let i = 0; i < totalOnChain; i++) {
        try {
          const existingCamp = await checkContract.getCampaign(BigInt(i))
          const existingUri = existingCamp.baseURI ?? existingCamp[1]
          
          if (existingUri === uri) {
            // Campaign already exists on-chain! Update DB and return success
            logger.debug(`[approve] IDEMPOTENCY: Found existing campaign ${i} with matching URI`)
            
            await supabaseAdmin.from('submissions').update({
              status: 'minted',
              campaign_id: i,
              contract_address: contractAddress
            }).eq('id', id)
            
            // Send approval email
            if (merged.creator_email) {
              try {
                await sendCampaignApproved({
                  email: merged.creator_email,
                  title: merged.title,
                  campaignId: i,
                  imageUrl: toHttpUrl(merged.image_uri) || undefined
                })
              } catch {}
            }
            
            return NextResponse.json({
              ok: true,
              alreadyCreated: true,
              campaignId: i,
              contractAddress,
              message: 'Campaign already exists on-chain (idempotency check)'
            })
          }
        } catch { continue }
      }
      
      logger.debug(`[approve] No existing campaign found with URI, proceeding to create`)
    } catch (idempotencyErr: any) {
      logger.debug(`[approve] Idempotency check failed (proceeding anyway):`, idempotencyErr?.message)
    }
    
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
    
    // Convert USD to native currency for on-chain storage
    // For Sepolia/Ethereum: use ETH (assume ~$2300/ETH for testnet)
    // For BlockDAG: use BDAG ($0.05/BDAG)
    let goalWei: bigint
    let priceWei: bigint
    
    if (targetChainId === 11155111 || targetChainId === 1) {
      // Ethereum / Sepolia - use ETH
      const ETH_USD_RATE = Number(process.env.ETH_USD_RATE || '2300')  // 1 ETH = $2300
      const goalETH = goalUSD / ETH_USD_RATE
      const priceETH = priceUSD / ETH_USD_RATE
      goalWei = BigInt(Math.floor(goalETH * 1e18))
      priceWei = BigInt(Math.floor(priceETH * 1e18))
      logger.debug(`[approve] ETH pricing: goal=$${goalUSD} = ${goalETH} ETH, price=$${priceUSD} = ${priceETH} ETH`)
    } else {
      // BlockDAG - use BDAG
      const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || process.env.NEXT_PUBLIC_BDAG_USD_RATE || '0.05')
      const USD_TO_BDAG = 1 / BDAG_USD_RATE  // 20 BDAG per 1 USD
      const goalBDAG = goalUSD * USD_TO_BDAG
      const priceBDAG = priceUSD * USD_TO_BDAG
      goalWei = BigInt(Math.floor(goalBDAG * 1e18))
      priceWei = BigInt(Math.floor(priceBDAG * 1e18))
      logger.debug(`[approve] BDAG pricing: goal=$${goalUSD} = ${goalBDAG} BDAG, price=$${priceUSD} = ${priceBDAG} BDAG`)
    }
    const maxEditions = BigInt(copiesNum)
    const feeRateBps = 100n // 1% nonprofit fee
    
    logger.debug(`[approve] Creating campaign: goal=$${goalUSD} USD (${goalWei} wei), copies=${copiesNum}, price=$${priceUSD} USD (${priceWei} wei)`)
    logger.debug(`[approve] Creator wallet: ${creatorWallet}, metadata: ${uri.slice(0, 50)}...`)

    let campaignId: number | null = null
    let txHash: string | null = null

    // Create campaign and WAIT for blockchain confirmation
    // Parse CampaignCreated event to get the ACTUAL campaignId - no guessing!
    const CONFIRMATION_TIMEOUT_MS = 120000 // 2 minutes max wait for confirmation
    
    async function createCampaignWithConfirmation(maxRetries = 3): Promise<{ hash: string; campaignId: number; confirmed: boolean }> {
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
          
          logger.debug(`[createCampaign] Attempt ${attempt + 1}: nonce=${nonce}, gasPrice=${gasPrice}`)
          const tx = await contract.createCampaign(
            category,
            uri,
            goalWei,
            maxEditions,
            priceWei,
            feeRateBps,
            creatorWallet,
            { nonce, gasPrice }
          )
          
          logger.debug(`[createCampaign] Tx submitted: ${tx.hash}`)
          
          // IMPORTANT: Save tx hash immediately in case of platform timeout
          // This allows recovery via verify-campaign endpoint
          await supabaseAdmin.from('submissions').update({
            tx_hash: tx.hash,
            status: 'pending_onchain'
          }).eq('id', id)
          logger.debug(`[createCampaign] Saved tx_hash to DB, waiting for blockchain confirmation...`)
          
          // WAIT for confirmation with timeout
          const receipt = await Promise.race([
            tx.wait(1), // Wait for 1 confirmation
            new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('CONFIRMATION_TIMEOUT')), CONFIRMATION_TIMEOUT_MS)
            )
          ])
          
          if (!receipt) {
            throw new Error('No receipt received')
          }
          
          logger.debug(`[createCampaign] Tx confirmed in block ${receipt.blockNumber}`)
          
          // Parse CampaignCreated event from receipt logs
          // Support both V6 and V7 event signatures
          const iface = new (await import('ethers')).Interface([
            // V6 signature
            'event CampaignCreated(uint256 indexed campaignId, address indexed nonprofit, string category, uint256 goal, uint256 maxEditions, uint256 pricePerEdition)',
            // V7 signature (has submitter and immediatePayoutEnabled)
            'event CampaignCreated(uint256 indexed campaignId, address indexed nonprofit, address indexed submitter, string category, uint256 goal, uint256 maxEditions, uint256 pricePerEdition, bool immediatePayoutEnabled)'
          ])
          
          let actualCampaignId: number | null = null
          
          for (const log of receipt.logs) {
            try {
              const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data })
              if (parsed && parsed.name === 'CampaignCreated') {
                actualCampaignId = Number(parsed.args.campaignId)
                logger.debug(`[createCampaign] Parsed CampaignCreated event: campaignId=${actualCampaignId}`)
                break
              }
            } catch {
              // Not our event, skip
            }
          }
          
          if (actualCampaignId === null) {
            // Fallback: try to find by metadata URI if event parsing failed
            logger.debug(`[createCampaign] Event parsing failed, searching by metadata URI...`)
            const verifyContract = getContractByVersion(contractVersion, signer)
            const total = Number(await verifyContract.totalCampaigns())
            
            for (let i = total - 1; i >= 0; i--) {
              try {
                const camp = await verifyContract.getCampaign(BigInt(i))
                const onChainUri = camp.baseURI ?? camp[1]
                if (onChainUri === uri) {
                  actualCampaignId = i
                  logger.debug(`[createCampaign] Found campaign ${i} by URI match`)
                  break
                }
              } catch { continue }
            }
          }
          
          if (actualCampaignId === null) {
            throw new Error('Could not determine campaign ID from blockchain')
          }
          
          return { hash: tx.hash, campaignId: actualCampaignId, confirmed: true }
          
        } catch (err: any) {
          lastError = err
          const msg = err?.message || ''
          const code = err?.code || ''
          
          // Handle timeout - tx may still be pending
          if (msg === 'CONFIRMATION_TIMEOUT') {
            logger.debug(`[createCampaign] Confirmation timeout after ${CONFIRMATION_TIMEOUT_MS}ms`)
            // Return with pending status - verify endpoint can be used later
            throw new Error('CONFIRMATION_TIMEOUT: Transaction submitted but confirmation timed out. Use verify endpoint.')
          }
          
          if (msg.includes('already known')) {
            logger.debug(`[createCampaign] Tx already in mempool, waiting for confirmation...`)
            // Wait and then search for the campaign
            await new Promise(r => setTimeout(r, 10000))
            
            const verifyContract = getContractByVersion(contractVersion, signer)
            const total = Number(await verifyContract.totalCampaigns())
            
            for (let i = total - 1; i >= 0; i--) {
              try {
                const camp = await verifyContract.getCampaign(BigInt(i))
                const onChainUri = camp.baseURI ?? camp[1]
                if (onChainUri === uri) {
                  logger.debug(`[createCampaign] Found existing campaign ${i} by URI`)
                  return { hash: '(existing tx)', campaignId: i, confirmed: true }
                }
              } catch { continue }
            }
            
            throw new Error('Transaction in mempool but campaign not found on-chain yet')
          }
          
          if (msg.includes('nonce') || msg.includes('NONCE') || 
              msg.includes('replacement') || code === 'REPLACEMENT_UNDERPRICED' ||
              code === 'NONCE_EXPIRED') {
            logger.debug(`[createCampaign] Tx error on attempt ${attempt + 1}: ${code || msg.slice(0, 50)}... retrying...`)
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
            continue
          }
          throw err
        }
      }
      throw lastError
    }

    const result = await createCampaignWithConfirmation()
    campaignId = result.campaignId // ACTUAL campaign ID from blockchain
    txHash = result.hash
    
    // Campaign was confirmed on-chain - no guessing!
    let verifiedCampaignId = campaignId
    let finalStatus = result.confirmed ? 'minted' : 'pending_onchain'
    
    // Double-verify the campaign data matches (belt and suspenders)
    if (result.confirmed) {
      try {
        const verifyContract = getContractByVersion(contractVersion, signer)
        const camp = await verifyContract.getCampaign(BigInt(campaignId))
        const onChainUri = camp.baseURI ?? camp[1]
        
        if (onChainUri === uri) {
          logger.debug(`[approve] Verified campaign ${campaignId} metadata matches`)
        } else {
          logger.error(`[approve] WARNING: Campaign ${campaignId} URI mismatch! Expected: ${uri.slice(0,50)}... Got: ${onChainUri?.slice(0,50)}...`)
        }
      } catch (verifyErr: any) {
        logger.debug(`[approve] Post-confirm verification failed: ${verifyErr?.message}`)
      }
    }

    // Get chain info from contract version for multi-chain support
    const contractInfo = getContractInfo(contractVersion)
    const chainId = contractInfo?.chainId || 1043
    const chainInfo = CHAIN_INFO[chainId] || { name: 'BlockDAG Testnet', isTestnet: true }

    // Update submission with verified or pending status
    const { error: updateError } = await supabaseAdmin
      .from('submissions')
      .update({ 
        status: finalStatus,
        campaign_id: verifiedCampaignId,
        tx_hash: txHash, 
        contract_address: contractAddress,
        contract_version: contractVersion,
        // Multi-chain support - store chain info for explorer links
        chain_id: chainId,
        chain_name: chainInfo.name,
        is_testnet: chainInfo.isTestnet,
        visible_on_marketplace: true,
        // Save NFT settings that were used for on-chain campaign
        num_copies: copiesNum || null,
        price_per_copy: priceUSD || null
      })
      .eq('id', id)
    
    if (updateError) {
      logger.error('[approve] Failed to update submission:', updateError)
    } else {
      logger.debug(`[approve] Submission ${id} updated: campaign_id=${verifiedCampaignId}, status=${finalStatus}, tx=${txHash}`)
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
      logger.debug(`[approve] Sent campaign approved email to ${sub.creator_email} with txHash: ${txHash}`)
    } catch (emailErr) {
      logger.error('[approve] Failed to send campaign approved email:', emailErr)
    }

    const message = finalStatus === 'minted'
      ? `Campaign created and verified! Campaign ID: ${verifiedCampaignId}. Now live on marketplace.`
      : 'Campaign transaction submitted. Awaiting blockchain confirmation. Use "Verify" button to check status.'

    return NextResponse.json({
      ok: true,
      txHash,
      campaignId: verifiedCampaignId,
      contractVersion,
      contractAddress,
      status: finalStatus,
      message
    })
  } catch (e:any) {
    logger.error('[approve] Error:', e?.message || String(e))
    logger.error('[approve] Full error:', e)
    return NextResponse.json({ error: 'APPROVE_AND_CREATE_CAMPAIGN_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}
