/**
 * Check deployer wallet address and balance on Sepolia
 */
import { ethers } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function main() {
  const privateKey = process.env.ETH_DEPLOYER_KEY
  if (!privateKey) {
    console.error('❌ ETH_DEPLOYER_KEY not set in .env.local')
    process.exit(1)
  }

  const rpcUrl = process.env.ETHEREUM_SEPOLIA_RPC || 'https://rpc.sepolia.org'
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const wallet = new ethers.Wallet(privateKey, provider)

  console.log('='.repeat(50))
  console.log('DEPLOYER WALLET CHECK')
  console.log('='.repeat(50))
  console.log(`Address: ${wallet.address}`)
  
  try {
    const balance = await provider.getBalance(wallet.address)
    const balanceEth = ethers.formatEther(balance)
    console.log(`Balance: ${balanceEth} ETH`)
    
    if (balance < ethers.parseEther('0.01')) {
      console.log('\n⚠️  Low balance! Get Sepolia ETH from:')
      console.log('   - https://sepoliafaucet.com')
      console.log('   - https://www.alchemy.com/faucets/ethereum-sepolia')
      console.log('   - https://faucets.chain.link/sepolia')
    } else {
      console.log('\n✅ Balance sufficient for deployment!')
    }
  } catch (e: any) {
    console.error(`Error checking balance: ${e.message}`)
  }
  
  console.log('='.repeat(50))
}

main().catch(console.error)
