/**
 * Verify V8 Contract on Etherscan
 * 
 * This script verifies the PatriotPledgeNFTV8 contract on Ethereum Mainnet.
 * Contract must be deployed before running this script.
 * 
 * Prerequisites:
 * 1. Add ETHERSCAN_API_KEY to .env.local
 * 2. Contract already deployed at known address
 * 
 * Run: npx hardhat run scripts/verify-v8-mainnet.ts --network ethereum
 * Or:  npx hardhat verify --network ethereum <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
 */

const CONTRACT_ADDRESS = '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e'
const CHAIN_ID = 1 // Ethereum Mainnet

// Constructor arguments for PatriotPledgeNFTV8
// constructor(uint256 _platformFeeBps, address _platformTreasury, uint256 _deploymentChainId)
const PLATFORM_FEE_BPS = 100 // 1%
const PLATFORM_TREASURY = '0x4E8E445A9957cD251059cd52A00777A25f8cD53e' // Deployer wallet
const DEPLOYMENT_CHAIN_ID = CHAIN_ID

async function main() {
  console.log('='.repeat(60))
  console.log('V8 Contract Verification for Etherscan')
  console.log('='.repeat(60))
  console.log('')
  console.log('Contract:', CONTRACT_ADDRESS)
  console.log('Network: Ethereum Mainnet (Chain ID:', CHAIN_ID, ')')
  console.log('')
  console.log('Constructor Arguments:')
  console.log('  - platformFeeBps:', PLATFORM_FEE_BPS)
  console.log('  - platformTreasury:', PLATFORM_TREASURY)
  console.log('  - deploymentChainId:', DEPLOYMENT_CHAIN_ID)
  console.log('')

  // Check for API key
  if (!process.env.ETHERSCAN_API_KEY) {
    console.log('❌ ERROR: ETHERSCAN_API_KEY not found in environment')
    console.log('')
    console.log('To get an API key:')
    console.log('1. Go to https://etherscan.io/register')
    console.log('2. Create an account')
    console.log('3. Go to https://etherscan.io/myapikey')
    console.log('4. Create a new API key')
    console.log('5. Add to .env.local: ETHERSCAN_API_KEY=your_key_here')
    console.log('')
    console.log('Then run:')
    console.log('npx hardhat verify --network ethereum', CONTRACT_ADDRESS, PLATFORM_FEE_BPS, PLATFORM_TREASURY, DEPLOYMENT_CHAIN_ID)
    return
  }

  console.log('✅ ETHERSCAN_API_KEY found')
  console.log('')
  console.log('Run the following command to verify:')
  console.log('')
  console.log(`npx hardhat verify --network ethereum ${CONTRACT_ADDRESS} ${PLATFORM_FEE_BPS} ${PLATFORM_TREASURY} ${DEPLOYMENT_CHAIN_ID}`)
  console.log('')
  console.log('Or programmatically:')
  
  try {
    const hre = require('hardhat')
    
    console.log('Starting verification...')
    await hre.run('verify:verify', {
      address: CONTRACT_ADDRESS,
      constructorArguments: [
        PLATFORM_FEE_BPS,
        PLATFORM_TREASURY,
        DEPLOYMENT_CHAIN_ID
      ],
      contract: 'contracts/PatriotPledgeNFTV8.sol:PatriotPledgeNFTV8'
    })
    
    console.log('')
    console.log('✅ Contract verified successfully!')
    console.log(`View at: https://etherscan.io/address/${CONTRACT_ADDRESS}#code`)
  } catch (error: any) {
    if (error.message.includes('Already Verified')) {
      console.log('')
      console.log('✅ Contract is already verified!')
      console.log(`View at: https://etherscan.io/address/${CONTRACT_ADDRESS}#code`)
    } else {
      console.log('')
      console.log('❌ Verification failed:', error.message)
      console.log('')
      console.log('Common issues:')
      console.log('- Contract bytecode mismatch (different compiler settings)')
      console.log('- Wrong constructor arguments')
      console.log('- API key invalid or rate limited')
      console.log('')
      console.log('Try manual verification at:')
      console.log(`https://etherscan.io/verifyContract?a=${CONTRACT_ADDRESS}`)
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
