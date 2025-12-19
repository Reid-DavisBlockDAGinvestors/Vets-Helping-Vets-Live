#!/usr/bin/env node
/**
 * Direct V6 deployment using ethers.js with proper NowNodes headers
 */
require('dotenv').config({ path: '.env.local' })
const { ethers } = require('ethers')
const fs = require('fs')
const path = require('path')

async function main() {
  console.log('🚀 Deploying PatriotPledgeNFTV6...')
  
  // Use fallback RPC directly (NowNodes has caching issues)
  const rpc = 'https://rpc.awakening.bdagscan.com'
  const privateKey = process.env.BDAG_RELAYER_KEY
  
  const provider = new ethers.JsonRpcProvider(rpc, null, { staticNetwork: true })
  
  const wallet = new ethers.Wallet(privateKey, provider)
  console.log('Deployer:', wallet.address)
  
  // Check balance
  const balance = await provider.getBalance(wallet.address)
  console.log('Balance:', ethers.formatEther(balance), 'BDAG')
  
  // RPC returns inconsistent data, proceed if we know funds were sent
  if (balance === 0n) {
    console.log('⚠️ RPC shows 0 balance (may be stale), proceeding anyway...')
  }
  
  // Get nonce - RPC is unreliable, use known nonce
  const nonceLatest = await provider.getTransactionCount(wallet.address, 'latest')
  const noncePending = await provider.getTransactionCount(wallet.address, 'pending')
  // Known nonce from earlier: 1094 (pending transactions exist)
  const nonce = 1094
  console.log('Nonce (latest):', nonceLatest, '(pending):', noncePending, '(using):', nonce)
  
  // Load compiled contract
  const artifactPath = path.join(__dirname, '../artifacts/contracts/PatriotPledgeNFTV6.sol/PatriotPledgeNFTV6.json')
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
  
  // Create contract factory
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet)
  
  // Get gas price - use higher value to ensure transaction goes through
  const feeData = await provider.getFeeData()
  const gasPrice = ethers.parseUnits('1', 'gwei') // 1 gwei should be plenty
  console.log('Gas price:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei')
  
  console.log('Deploying...')
  const contract = await factory.deploy({
    nonce,
    gasLimit: 8000000n,
    gasPrice
  })
  
  console.log('Tx hash:', contract.deploymentTransaction().hash)
  console.log('Waiting for confirmation...')
  
  await contract.waitForDeployment()
  const address = await contract.getAddress()
  
  console.log('')
  console.log('=' .repeat(60))
  console.log('✅ PatriotPledgeNFTV6 deployed!')
  console.log('=' .repeat(60))
  console.log('Address:', address)
  console.log('')
  console.log('Update .env.local:')
  console.log(`CONTRACT_ADDRESS_V6=${address}`)
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS_V6=${address}`)
}

main().catch(console.error)
