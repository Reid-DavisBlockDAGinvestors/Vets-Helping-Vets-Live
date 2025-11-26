import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()
import { ethers } from 'ethers'
import * as fs from 'fs'
import * as path from 'path'

// Deployment script for PatriotPledgeNFTV3 on BlockDAG
// Requires: BLOCKDAG_RELAYER_RPC (or BLOCKDAG_RPC) and BDAG_RELAYER_KEY

async function main() {
  const rpc = process.env.BLOCKDAG_RELAYER_RPC || process.env.BLOCKDAG_RPC
  const pk = process.env.BDAG_RELAYER_KEY
  if (!rpc || !pk) throw new Error('Missing BLOCKDAG_RELAYER_RPC/BLOCKDAG_RPC or BDAG_RELAYER_KEY')

  const provider = new ethers.JsonRpcProvider(rpc)
  const wallet = new ethers.Wallet(pk, provider)

  // Load ABI + bytecode (Hardhat artifacts)
  const candidates = [
    path.join(process.cwd(), 'artifacts', 'contracts', 'PatriotPledgeNFTV3.sol', 'PatriotPledgeNFTV3.json'),
    path.join(process.cwd(), 'artifacts', 'contracts', 'PatriotPledgeNFTV3.json')
  ]
  const found = candidates.find(p => fs.existsSync(p))
  if (!found) throw new Error('Missing compiled artifact for PatriotPledgeNFTV3. Expected one of:\n' + candidates.join('\n'))

  const artifact = JSON.parse(fs.readFileSync(found, 'utf8'))
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet)

  console.log('Deploying PatriotPledgeNFTV3...')
  const contract = await factory.deploy()
  const deployed = await contract.waitForDeployment()
  const addr = await deployed.getAddress()

  console.log('PatriotPledgeNFTV3 deployed at:', addr)
  console.log('\nNext steps:')
  console.log('- Update CONTRACT_ADDRESS and NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local to', addr)
  console.log('- Verify on explorer:', (process.env.NEXT_PUBLIC_EXPLORER_BASE || 'EXPLORER_URL') + '/address/' + addr)
}

main().catch((e)=>{ console.error(e); process.exit(1) })
