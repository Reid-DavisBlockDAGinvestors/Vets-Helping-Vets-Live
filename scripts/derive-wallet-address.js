/**
 * Derive wallet address from private key
 * Run with: node scripts/derive-wallet-address.js
 */
const { ethers } = require('ethers')
require('dotenv').config({ path: '.env.local' })

const privateKey = process.env.ETH_DEPLOYER_KEY || process.env.BDAG_RELAYER_KEY

if (!privateKey) {
  console.error('No private key found in .env.local')
  process.exit(1)
}

try {
  const wallet = new ethers.Wallet(privateKey)
  console.log('='.repeat(60))
  console.log('WALLET ADDRESS DERIVED FROM PRIVATE KEY')
  console.log('='.repeat(60))
  console.log('Address:', wallet.address)
  console.log('')
  console.log('⚠️  SECURITY CHECK:')
  console.log('   If this address is 0x07b3c4BB8842a9eE0698F1A3c6778bcC456d9362')
  console.log('   then the private key is COMPROMISED and must be changed!')
  console.log('='.repeat(60))
} catch (e) {
  console.error('Error deriving address:', e.message)
}
