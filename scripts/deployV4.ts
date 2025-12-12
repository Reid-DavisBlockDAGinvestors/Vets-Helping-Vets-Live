const hre = require('hardhat')
const { ethers } = hre

async function main() {
  console.log('Deploying PatriotPledgeNFTV4...')
  
  const [deployer] = await ethers.getSigners()
  console.log('Deployer address:', deployer.address)
  console.log('Deployer balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'BDAG')

  const Contract = await ethers.getContractFactory('PatriotPledgeNFTV4')
  console.log('Deploying contract...')
  
  // Get current gas price and add a buffer
  const feeData = await ethers.provider.getFeeData()
  console.log('Gas price:', ethers.formatUnits(feeData.gasPrice || 0, 'gwei'), 'gwei')
  
  // Bump gas price to ensure it goes through (and replaces any stuck tx)
  const gasPrice = (feeData.gasPrice || 1000000000n) * 3n  // 3x multiplier
  console.log('Using gas price:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei')
  
  const contract = await Contract.deploy({
    gasLimit: 5000000,
    gasPrice: gasPrice
  })
  console.log('Transaction sent, waiting for confirmation...')
  await contract.waitForDeployment()

  const address = await contract.getAddress()
  console.log('PatriotPledgeNFTV4 deployed to:', address)
  console.log('')
  console.log('=== IMPORTANT: Update your .env.local ===')
  console.log(`CONTRACT_ADDRESS=${address}`)
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`)
  console.log('')
  console.log('=== For Contract Verification ===')
  console.log('1. Run: npx hardhat flatten contracts/PatriotPledgeNFTV4.sol > PatriotPledgeNFTV4_flat.sol')
  console.log('2. Go to BlockDAG Explorer')
  console.log('3. Verify with:')
  console.log('   - Compiler: 0.8.24')
  console.log('   - Optimization: Enabled, 200 runs')
  console.log('   - License: MIT')
  
  return address
}

main()
  .then((address) => {
    console.log('\nDeployment successful!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Deployment failed:', error)
    process.exit(1)
  })
