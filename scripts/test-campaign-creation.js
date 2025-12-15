#!/usr/bin/env node
/**
 * Test Campaign Creation Flow
 * Diagnoses issues with on-chain campaign creation
 */
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const { ethers } = require('ethers')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🔍 CAMPAIGN CREATION DIAGNOSIS')
  console.log('='.repeat(60))
  
  // 1. Check environment variables
  console.log('\n1️⃣ Environment Check:')
  const requiredEnv = [
    'BDAG_RELAYER_KEY',
    'CONTRACT_ADDRESS',
    'BLOCKDAG_RPC',
  ]
  
  let envOk = true
  for (const key of requiredEnv) {
    const val = process.env[key]
    if (val) {
      const display = key.includes('KEY') ? `${val.slice(0, 10)}...` : val
      console.log(`   ✅ ${key}: ${display}`)
    } else {
      console.log(`   ❌ ${key}: MISSING`)
      envOk = false
    }
  }
  
  if (!envOk) {
    console.log('\n❌ Missing required environment variables!')
    return
  }
  
  // 2. Check RPC connection
  console.log('\n2️⃣ RPC Connection:')
  const rpcUrl = process.env.BLOCKDAG_RPC
  const headers = {}
  if (rpcUrl?.includes('nownodes')) {
    headers['api-key'] = process.env.NOWNODES_API_KEY
  }
  
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
      staticNetwork: true,
      batchMaxCount: 1
    })
    // Set headers for NowNodes
    if (headers['api-key']) {
      provider._getConnection = () => ({
        url: rpcUrl,
        headers
      })
    }
    
    const blockNumber = await provider.getBlockNumber()
    console.log(`   ✅ Connected to RPC, block: ${blockNumber}`)
  } catch (e) {
    console.log(`   ❌ RPC connection failed: ${e.message}`)
    return
  }
  
  // 3. Check relayer wallet
  console.log('\n3️⃣ Relayer Wallet:')
  const relayerKey = process.env.BDAG_RELAYER_KEY || process.env.RELAYER_PRIVATE_KEY
  try {
    const wallet = new ethers.Wallet(relayerKey)
    console.log(`   Address: ${wallet.address}`)
    
    // Check balance
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true })
    const balance = await provider.getBalance(wallet.address)
    const balanceBDAG = ethers.formatEther(balance)
    console.log(`   Balance: ${balanceBDAG} BDAG`)
    
    if (parseFloat(balanceBDAG) < 1) {
      console.log(`   ⚠️ Low balance - may need more BDAG for gas`)
    } else {
      console.log(`   ✅ Sufficient balance for transactions`)
    }
  } catch (e) {
    console.log(`   ❌ Wallet error: ${e.message}`)
    return
  }
  
  // 4. Check contract
  console.log('\n4️⃣ Contract Check:')
  const contractAddress = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS
  console.log(`   Address: ${contractAddress}`)
  
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true })
    const code = await provider.getCode(contractAddress)
    if (code === '0x') {
      console.log(`   ❌ No contract deployed at this address!`)
      return
    }
    console.log(`   ✅ Contract exists (code length: ${code.length})`)
    
    // Try to get totalCampaigns
    const abi = ['function totalCampaigns() view returns (uint256)']
    const contract = new ethers.Contract(contractAddress, abi, provider)
    const total = await contract.totalCampaigns()
    console.log(`   ✅ totalCampaigns: ${total}`)
  } catch (e) {
    console.log(`   ❌ Contract error: ${e.message}`)
  }
  
  // 5. Check approved campaigns without campaign_id
  console.log('\n5️⃣ Stuck Campaigns (approved but not on-chain):')
  const { data: stuckCampaigns } = await supabase
    .from('submissions')
    .select('id, title, status, campaign_id, tx_hash, created_at')
    .eq('status', 'approved')
    .is('campaign_id', null)
    .order('created_at', { ascending: false })
    .limit(5)
  
  if (stuckCampaigns?.length) {
    console.log(`   Found ${stuckCampaigns.length} stuck campaigns:`)
    for (const c of stuckCampaigns) {
      console.log(`   ---`)
      console.log(`   Title: ${c.title?.slice(0, 40)}...`)
      console.log(`   ID: ${c.id}`)
      console.log(`   Status: ${c.status}`)
      console.log(`   Campaign ID: ${c.campaign_id || 'NULL'}`)
      console.log(`   Tx Hash: ${c.tx_hash || 'NULL'}`)
    }
  } else {
    console.log(`   ✅ No stuck campaigns`)
  }
  
  // 6. Check pending_onchain campaigns
  console.log('\n6️⃣ Pending On-Chain Verification:')
  const { data: pendingCampaigns } = await supabase
    .from('submissions')
    .select('id, title, status, campaign_id, tx_hash')
    .eq('status', 'pending_onchain')
    .order('created_at', { ascending: false })
    .limit(5)
  
  if (pendingCampaigns?.length) {
    console.log(`   Found ${pendingCampaigns.length} pending verification:`)
    for (const c of pendingCampaigns) {
      console.log(`   • ${c.title?.slice(0, 30)}... (ID: ${c.campaign_id}, Tx: ${c.tx_hash?.slice(0, 10)}...)`)
    }
  } else {
    console.log(`   ✅ No pending campaigns`)
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('💡 To fix stuck campaigns:')
  console.log('   1. Click "Retry Create Campaign" in admin portal')
  console.log('   2. If that fails, check the browser console for errors')
  console.log('   3. The error will be logged to bug reports')
}

main().catch(console.error)
