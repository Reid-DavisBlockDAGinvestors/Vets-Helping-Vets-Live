import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ethers } from 'ethers'
import { getContractInfo, getContractAddress } from '@/lib/contracts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Debug endpoint to check Sepolia configuration
 * Only accessible to admins
 */
export async function GET(req: NextRequest) {
  try {
    // Require admin auth
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    
    const { data: userData } = await supabaseAdmin.auth.getUser(token)
    const uid = userData?.user?.id
    if (!uid) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single()
    if (!['admin', 'super_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    // Check Sepolia configuration
    const sepoliaRpc = process.env.ETHEREUM_SEPOLIA_RPC || process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com'
    const sepoliaKey = process.env.ETH_DEPLOYER_KEY || process.env.SEPOLIA_DEPLOYER_KEY
    const hasSepoliaKey = !!sepoliaKey
    
    let signerAddress = null
    let signerBalance = null
    let rpcConnected = false
    let contractCallSuccess = false
    let totalCampaigns = null
    let errorDetails = null
    
    // Get V7 contract info
    const v7Info = getContractInfo('v7')
    const v7Address = getContractAddress('v7')
    
    if (hasSepoliaKey) {
      try {
        const provider = new ethers.JsonRpcProvider(sepoliaRpc)
        const signer = new ethers.Wallet(sepoliaKey, provider)
        signerAddress = signer.address
        
        // Check RPC connection
        try {
          const network = await provider.getNetwork()
          rpcConnected = true
          
          // Check balance
          const balance = await provider.getBalance(signerAddress)
          signerBalance = ethers.formatEther(balance)
          
          // Try to call contract
          if (v7Address) {
            const contract = new ethers.Contract(v7Address, [
              'function totalCampaigns() view returns (uint256)'
            ], provider)
            
            try {
              totalCampaigns = Number(await contract.totalCampaigns())
              contractCallSuccess = true
            } catch (contractErr: any) {
              errorDetails = `Contract call failed: ${contractErr?.message}`
            }
          }
        } catch (rpcErr: any) {
          errorDetails = `RPC connection failed: ${rpcErr?.message}`
        }
      } catch (walletErr: any) {
        errorDetails = `Wallet creation failed: ${walletErr?.message}`
      }
    }
    
    return NextResponse.json({
      sepolia: {
        keyConfigured: hasSepoliaKey,
        keyEnvVar: hasSepoliaKey ? (process.env.ETH_DEPLOYER_KEY ? 'ETH_DEPLOYER_KEY' : 'SEPOLIA_DEPLOYER_KEY') : null,
        rpcUrl: sepoliaRpc,
        rpcConnected,
        signerAddress,
        signerBalance: signerBalance ? `${signerBalance} ETH` : null
      },
      v7Contract: {
        address: v7Address,
        chainId: v7Info?.chainId,
        isActive: v7Info?.isActive,
        contractCallSuccess,
        totalCampaigns
      },
      error: errorDetails
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'DEBUG_FAILED', details: e?.message }, { status: 500 })
  }
}
