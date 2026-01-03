import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getProvider, getRelayerSigner, PatriotPledgeV5ABI } from '@/lib/onchain'
import { getActiveContractVersion, getContractByVersion, getContractAddress } from '@/lib/contracts'
import { ethers } from 'ethers'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120 // Extended timeout for blockchain operations

// Currency/USD conversion rates
const BDAG_USD_RATE = parseFloat(process.env.BDAG_USD_RATE || '0.05')
const ETH_USD_RATE = parseFloat(process.env.ETH_USD_RATE || '2300') // ~$2300/ETH

// Chain ID constants
const SEPOLIA_CHAIN_ID = 11155111
const ETHEREUM_CHAIN_ID = 1

/**
 * Verify and fix a campaign's on-chain status
 * POST /api/admin/verify-campaign
 * Body: { submissionId: string, createIfMissing?: boolean }
 * 
 * This endpoint:
 * 1. Checks if the stored campaign_id exists on-chain
 * 2. If not, searches for the campaign by metadata URI
 * 3. If still not found AND createIfMissing is true, CREATES the campaign on-chain
 * 4. Updates Supabase with the correct ID
 */
export async function POST(req: NextRequest) {
  try {
    // Auth check
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    
    const { data: userData } = await supabaseAdmin.auth.getUser(token)
    const uid = userData?.user?.id
    if (!uid) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single()
    if (!['admin', 'super_admin'].includes(profile?.role || '')) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const submissionId = body?.submissionId
    const createIfMissing = body?.createIfMissing !== false // Default to true
    if (!submissionId) {
      return NextResponse.json({ error: 'Missing submissionId' }, { status: 400 })
    }

    // Get submission
    const { data: sub, error: subErr } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single()

    if (subErr || !sub) {
      return NextResponse.json({ error: 'Submission not found', details: subErr?.message }, { status: 404 })
    }

    const metadataUri = sub.metadata_uri
    const storedCampaignId = sub.campaign_id

    // Setup contract
    const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()
    if (!contractAddress) {
      return NextResponse.json({ error: 'Contract not configured' }, { status: 500 })
    }

    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)

    // Get total campaigns
    const totalCampaigns = Number(await contract.totalCampaigns())
    logger.debug(`[verify-campaign] Total campaigns on-chain: ${totalCampaigns}`)

    // Check if stored campaign ID is valid
    let storedIdValid = false
    if (storedCampaignId != null && storedCampaignId < totalCampaigns) {
      try {
        const camp = await contract.getCampaign(BigInt(storedCampaignId))
        const baseURI = camp.baseURI ?? camp[1]
        if (baseURI === metadataUri) {
          storedIdValid = true
          logger.debug(`[verify-campaign] Stored ID ${storedCampaignId} is valid and matches metadata URI`)
        } else {
          logger.debug(`[verify-campaign] Stored ID ${storedCampaignId} exists but has different URI`)
        }
      } catch (e) {
        logger.debug(`[verify-campaign] Stored ID ${storedCampaignId} does not exist on-chain`)
      }
    }

    if (storedIdValid) {
      // Campaign is valid, check if active
      const camp = await contract.getCampaign(BigInt(storedCampaignId))
      const active = camp.active ?? camp[8]
      const closed = camp.closed ?? camp[9]
      
      return NextResponse.json({
        ok: true,
        status: 'valid',
        campaignId: storedCampaignId,
        active,
        closed,
        message: 'Campaign ID is correct and exists on-chain'
      })
    }

    // Search for campaign by metadata URI
    logger.debug(`[verify-campaign] Searching for campaign with URI: ${metadataUri?.slice(0, 50)}...`)
    let foundCampaignId: number | null = null
    let foundCampaign: any = null

    for (let i = 0; i < totalCampaigns; i++) {
      try {
        const camp = await contract.getCampaign(BigInt(i))
        const baseURI = camp.baseURI ?? camp[1]
        if (baseURI === metadataUri) {
          foundCampaignId = i
          foundCampaign = camp
          logger.debug(`[verify-campaign] Found matching campaign at ID ${i}`)
          break
        }
      } catch {
        continue
      }
    }

    if (foundCampaignId !== null) {
      // Update Supabase with correct ID and contract_address
      const { error: updateErr } = await supabaseAdmin
        .from('submissions')
        .update({ 
          campaign_id: foundCampaignId,
          status: 'minted',
          contract_address: contractAddress
        })
        .eq('id', submissionId)

      if (updateErr) {
        return NextResponse.json({ 
          error: 'Failed to update submission', 
          details: updateErr.message 
        }, { status: 500 })
      }

      const active = foundCampaign.active ?? foundCampaign[8]
      const closed = foundCampaign.closed ?? foundCampaign[9]

      return NextResponse.json({
        ok: true,
        status: 'fixed',
        oldCampaignId: storedCampaignId,
        newCampaignId: foundCampaignId,
        active,
        closed,
        message: `Campaign ID corrected from ${storedCampaignId} to ${foundCampaignId}`
      })
    }

    // Campaign not found on-chain - create it if requested
    if (!createIfMissing) {
      logger.debug(`[verify-campaign] Campaign not found on-chain, createIfMissing=false`)
      return NextResponse.json({
        ok: false,
        status: 'not_found',
        totalCampaigns,
        message: 'Campaign not found on-chain. Set createIfMissing=true to create it.'
      })
    }

    // Validate required fields for creation
    if (!metadataUri) {
      return NextResponse.json({ 
        error: 'Cannot create campaign', 
        details: 'Submission has no metadata_uri' 
      }, { status: 400 })
    }

    // Get relayer address for fallback
    let relayerAddress = process.env.RELAYER_ADDRESS || process.env.NEXT_PUBLIC_RELAYER_ADDRESS
    if (!relayerAddress) {
      try {
        const key = process.env.BDAG_RELAYER_KEY || process.env.RELAYER_PRIVATE_KEY || ''
        if (key) {
          const wallet = new ethers.Wallet(key)
          relayerAddress = wallet.address
        }
      } catch {}
    }

    const creatorWallet = sub.creator_wallet || relayerAddress || ''
    if (!creatorWallet) {
      return NextResponse.json({ 
        error: 'Cannot create campaign', 
        details: 'No creator_wallet and no relayer configured' 
      }, { status: 400 })
    }

    // Prepare campaign parameters
    const category = sub.category || 'general'
    const goalUsd = sub.goal || 100
    const maxEditions = sub.num_copies || 100
    const priceUsd = sub.price_per_copy || 1
    const feeRateBps = 100 // 1%
    
    // Chain-aware currency conversion
    // For ETH-based chains (Sepolia, Mainnet), convert USD to ETH
    // For BDAG chains, convert USD to BDAG
    const chainId = sub.chain_id || sub.target_chain_id || 1043 // Default to BlockDAG
    const isEthChain = chainId === SEPOLIA_CHAIN_ID || chainId === ETHEREUM_CHAIN_ID
    
    let goalWei: bigint
    let priceWei: bigint
    
    if (isEthChain) {
      // Convert USD to ETH (e.g., $10 / $2300 = 0.00434783 ETH)
      const goalEth = goalUsd / ETH_USD_RATE
      const priceEth = priceUsd / ETH_USD_RATE
      goalWei = ethers.parseEther(goalEth.toFixed(18))
      priceWei = ethers.parseEther(priceEth.toFixed(18))
      logger.debug(`[verify-campaign] ETH chain (${chainId}): goal=${goalEth}ETH, price=${priceEth}ETH`)
    } else {
      // Convert USD to BDAG (e.g., $10 / $0.05 = 200 BDAG)
      const goalBdag = goalUsd / BDAG_USD_RATE
      const priceBdag = priceUsd / BDAG_USD_RATE
      goalWei = ethers.parseEther(goalBdag.toFixed(6))
      priceWei = ethers.parseEther(priceBdag.toFixed(6))
      logger.debug(`[verify-campaign] BDAG chain (${chainId}): goal=${goalBdag}BDAG, price=${priceBdag}BDAG`)
    }

    logger.debug(`[verify-campaign] Creating campaign on-chain: goal=${goalUsd}USD, editions=${maxEditions}, price=${priceUsd}USD`)

    // Get signer and contract
    const contractVersion = getActiveContractVersion()
    const signer = await getRelayerSigner()
    const writeContract = getContractByVersion(contractVersion, signer)

    // Create the campaign on-chain with confirmation
    const CONFIRMATION_TIMEOUT_MS = 90000 // 90 seconds

    async function createCampaignWithConfirmation(maxRetries = 3): Promise<{ hash: string; campaignId: number }> {
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

          logger.debug(`[verify-campaign] Tx attempt ${attempt + 1}: nonce=${nonce}, gasPrice=${gasPrice}`)
          const tx = await writeContract.createCampaign(
            category,
            metadataUri,
            goalWei,
            maxEditions,
            priceWei,
            feeRateBps,
            creatorWallet,
            { nonce, gasPrice }
          )

          logger.debug(`[verify-campaign] Tx submitted: ${tx.hash}`)

          // Save tx hash immediately
          await supabaseAdmin.from('submissions').update({
            tx_hash: tx.hash,
            status: 'pending_onchain'
          }).eq('id', submissionId)

          // Wait for confirmation
          const receipt = await Promise.race([
            tx.wait(1),
            new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('CONFIRMATION_TIMEOUT')), CONFIRMATION_TIMEOUT_MS)
            )
          ])

          if (!receipt) throw new Error('No receipt received')

          logger.debug(`[verify-campaign] Tx confirmed in block ${receipt.blockNumber}`)

          // Parse CampaignCreated event
          const iface = new ethers.Interface([
            'event CampaignCreated(uint256 indexed campaignId, address indexed nonprofit, string category, uint256 goal, uint256 maxEditions, uint256 pricePerEdition)'
          ])

          let actualCampaignId: number | null = null
          for (const log of receipt.logs) {
            try {
              const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data })
              if (parsed && parsed.name === 'CampaignCreated') {
                actualCampaignId = Number(parsed.args.campaignId)
                logger.debug(`[verify-campaign] Parsed campaignId=${actualCampaignId} from event`)
                break
              }
            } catch { /* skip non-matching logs */ }
          }

          // Fallback: search by URI if event parsing failed
          if (actualCampaignId === null) {
            logger.debug(`[verify-campaign] Event parsing failed, searching by URI...`)
            const total = Number(await writeContract.totalCampaigns())
            for (let i = total - 1; i >= 0; i--) {
              try {
                const camp = await writeContract.getCampaign(BigInt(i))
                const onChainUri = camp.baseURI ?? camp[1]
                if (onChainUri === metadataUri) {
                  actualCampaignId = i
                  break
                }
              } catch { continue }
            }
          }

          if (actualCampaignId === null) {
            throw new Error('Could not determine campaign ID from blockchain')
          }

          return { hash: tx.hash, campaignId: actualCampaignId }

        } catch (err: any) {
          lastError = err
          const msg = err?.message || ''
          const code = err?.code || ''

          if (msg === 'CONFIRMATION_TIMEOUT') {
            throw new Error('Transaction submitted but confirmation timed out. Try verifying again later.')
          }

          if (msg.includes('already known')) {
            await new Promise(r => setTimeout(r, 10000))
            const total = Number(await writeContract.totalCampaigns())
            for (let i = total - 1; i >= 0; i--) {
              try {
                const camp = await writeContract.getCampaign(BigInt(i))
                const onChainUri = camp.baseURI ?? camp[1]
                if (onChainUri === metadataUri) {
                  return { hash: '(existing)', campaignId: i }
                }
              } catch { continue }
            }
            throw new Error('Transaction in mempool but campaign not found yet')
          }

          if (msg.includes('nonce') || msg.includes('replacement') || 
              code === 'REPLACEMENT_UNDERPRICED' || code === 'NONCE_EXPIRED') {
            logger.debug(`[verify-campaign] Retrying after nonce/replacement error...`)
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
            continue
          }

          throw err
        }
      }
      throw lastError
    }

    const result = await createCampaignWithConfirmation()

    // Update submission with confirmed campaign data
    const { error: updateErr } = await supabaseAdmin
      .from('submissions')
      .update({
        campaign_id: result.campaignId,
        status: 'minted',
        tx_hash: result.hash,
        contract_address: contractAddress,
        visible_on_marketplace: true
      })
      .eq('id', submissionId)

    if (updateErr) {
      return NextResponse.json({
        error: 'Campaign created but DB update failed',
        campaignId: result.campaignId,
        txHash: result.hash,
        details: updateErr.message
      }, { status: 500 })
    }

    logger.debug(`[verify-campaign] Campaign created successfully: id=${result.campaignId}, tx=${result.hash}`)

    return NextResponse.json({
      ok: true,
      status: 'created',
      campaignId: result.campaignId,
      txHash: result.hash,
      message: `Campaign created on-chain with ID ${result.campaignId}`
    })

  } catch (e: any) {
    logger.error('[verify-campaign] Error:', e)
    return NextResponse.json({ 
      error: 'Verification failed', 
      details: e?.message || String(e) 
    }, { status: 500 })
  }
}
