import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()

import { ethers } from 'ethers'
import * as fs from 'fs'
import * as path from 'path'

// Simple verification script for PatriotPledgeNFTV2
// Reads CONTRACT_ADDRESS from env and prints basic on-chain state

async function main() {
  const rpc = process.env.BLOCKDAG_RPC || process.env.BLOCKDAG_RELAYER_RPC
  const addr = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS

  if (!rpc) throw new Error('Missing BLOCKDAG_RPC/BLOCKDAG_RELAYER_RPC in env')
  if (!addr) throw new Error('Missing CONTRACT_ADDRESS/NEXT_PUBLIC_CONTRACT_ADDRESS in env')

  const provider = new ethers.JsonRpcProvider(rpc)

  // Load ABI from Hardhat artifact
  const candidates = [
    path.join(process.cwd(), 'artifacts', 'contracts', 'PatriotPledgeNFTV2.sol', 'PatriotPledgeNFTV2.json'),
    path.join(process.cwd(), 'artifacts', 'contracts', 'PatriotPledgeNFTV2.json')
  ]
  const found = candidates.find(p => fs.existsSync(p))
  if (!found) throw new Error('Missing compiled artifact. Expected one of:\n' + candidates.join('\n'))

  const artifact = JSON.parse(fs.readFileSync(found, 'utf8'))
  const contract = new ethers.Contract(addr, artifact.abi, provider)

  console.log('Verifying PatriotPledgeNFTV2 at', addr)
  console.log('RPC:', rpc)

  const [name, symbol, owner, totalSupply] = await Promise.all([
    contract.name(),
    contract.symbol(),
    contract.owner(),
    contract.totalSupply()
  ])

  console.log('name         :', name)
  console.log('symbol       :', symbol)
  console.log('owner        :', owner)
  console.log('totalSupply  :', totalSupply.toString())

  if (totalSupply > 0n) {
    try {
      const uri0 = await contract.tokenURI(0n)
      console.log('tokenURI(0)  :', uri0)
    } catch (e) {
      console.log('tokenURI(0)  : <error reading tokenURI(0)>', e instanceof Error ? e.message : e)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
