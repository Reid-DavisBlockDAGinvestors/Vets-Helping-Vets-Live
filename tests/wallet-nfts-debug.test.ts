/**
 * Comprehensive test suite for wallet NFT API debugging
 * 
 * Problem: Dashboard shows only 1 NFT when wallet should have 35+
 * Goal: Identify exactly where the data loss occurs
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { ethers } from 'ethers'

const WALLET_ADDRESS = '0x07b3c4BB8842a9eE0698F1A3c6778bcC456d9362'
const V5_CONTRACT = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const V6_CONTRACT = '0xaE54e4E8A75a81780361570c17b8660CEaD27053'

// Basic ABI for testing
const BASIC_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function getEditionInfo(uint256 tokenId) view returns (uint256 campaignId, uint256 editionNumber, uint256 totalEditions)',
  'function tokenToCampaign(uint256 tokenId) view returns (uint256)'
]

// Create NowNodes provider (since standard RPC is unreliable)
function createNowNodesProvider(): ethers.JsonRpcProvider {
  const rpc = 'https://bdag.nownodes.io'
  const apiKey = process.env.NOWNODES_API_KEY || 'aacc5205-a535-4578-92ed-d64821ae7704'
  const fetchReq = new ethers.FetchRequest(rpc)
  fetchReq.setHeader('api-key', apiKey)
  return new ethers.JsonRpcProvider(fetchReq, undefined, { staticNetwork: true })
}

describe('Wallet NFT Debug Tests', () => {
  let provider: ethers.JsonRpcProvider
  let v5Contract: ethers.Contract

  beforeAll(async () => {
    provider = createNowNodesProvider()
    v5Contract = new ethers.Contract(V5_CONTRACT, BASIC_ABI, provider)
  })

  describe('Step 1: Verify blockchain data', () => {
    it('should connect to blockchain and get block number', async () => {
      const blockNum = await provider.getBlockNumber()
      console.log('Current block:', blockNum)
      expect(blockNum).toBeGreaterThan(40000000)
    })

    it('should get V5 contract total supply', async () => {
      const totalSupply = await v5Contract.totalSupply()
      console.log('V5 Total Supply:', totalSupply.toString())
      expect(Number(totalSupply)).toBeGreaterThan(0)
    })

    it('should get wallet balance on V5 contract', async () => {
      const balance = await v5Contract.balanceOf(WALLET_ADDRESS)
      console.log('Wallet balance on V5:', balance.toString())
      expect(Number(balance)).toBeGreaterThan(0)
    })
  })

  describe('Step 2: Enumerate all tokens owned by wallet', () => {
    it('should list all token IDs owned by wallet', async () => {
      const balance = await v5Contract.balanceOf(WALLET_ADDRESS)
      const balanceNum = Number(balance)
      console.log(`\n=== Wallet owns ${balanceNum} NFTs on V5 ===`)
      
      const tokenIds: number[] = []
      for (let i = 0; i < balanceNum; i++) {
        try {
          const tokenId = await v5Contract.tokenOfOwnerByIndex(WALLET_ADDRESS, i)
          tokenIds.push(Number(tokenId))
        } catch (e: any) {
          console.log(`Error at index ${i}:`, e.message?.slice(0, 50))
        }
      }
      
      console.log('Token IDs owned:', tokenIds.join(', '))
      expect(tokenIds.length).toBe(balanceNum)
      
      // Group by campaigns
      console.log('\n=== Mapping tokens to campaigns ===')
      const campaignMap: Record<number, number[]> = {}
      
      for (const tokenId of tokenIds) {
        try {
          const campaignId = await v5Contract.tokenToCampaign(tokenId)
          const cid = Number(campaignId)
          if (!campaignMap[cid]) campaignMap[cid] = []
          campaignMap[cid].push(tokenId)
        } catch (e: any) {
          console.log(`Token ${tokenId} campaign lookup failed:`, e.message?.slice(0, 50))
        }
      }
      
      for (const [campaignId, tokens] of Object.entries(campaignMap)) {
        console.log(`  Campaign #${campaignId}: Tokens ${tokens.join(', ')}`)
      }
      
      return { tokenIds, campaignMap }
    })
  })

  describe('Step 3: Test token metadata retrieval', () => {
    it('should get tokenURI for first few tokens', async () => {
      const balance = await v5Contract.balanceOf(WALLET_ADDRESS)
      const balanceNum = Math.min(Number(balance), 5) // Test first 5
      
      console.log('\n=== Token metadata check ===')
      for (let i = 0; i < balanceNum; i++) {
        const tokenId = await v5Contract.tokenOfOwnerByIndex(WALLET_ADDRESS, i)
        try {
          const uri = await v5Contract.tokenURI(tokenId)
          console.log(`  Token #${tokenId}: ${uri?.slice(0, 60)}...`)
        } catch (e: any) {
          console.log(`  Token #${tokenId}: ERROR - ${e.message?.slice(0, 50)}`)
        }
      }
    })
  })
})
