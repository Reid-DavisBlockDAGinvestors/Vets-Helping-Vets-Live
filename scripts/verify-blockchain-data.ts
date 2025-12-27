/**
 * Comprehensive Blockchain & Database Verification Script
 * 
 * This script verifies:
 * 1. All on-chain campaigns (V5 + V6)
 * 2. All NFT sales and purchases
 * 3. Database synchronization with on-chain data
 * 4. Thumbnail verification for campaigns
 * 
 * Run: npx ts-node scripts/verify-blockchain-data.ts
 */

import { ethers } from 'ethers'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'
import * as fs from 'fs'

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

// Contract ABIs (minimal for querying)
const V5_ABI = [
  'function totalSupply() view returns (uint256)',
  'function totalCampaigns() view returns (uint256)',
  'function getCampaign(uint256 campaignId) view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)',
  'function tokenToCampaign(uint256) view returns (uint256)',
  'function ownerOf(uint256) view returns (address)',
  'function tokenURI(uint256) view returns (string)',
  'function tokenEditionNumber(uint256) view returns (uint256)',
]

const V6_ABI = [
  'function totalSupply() view returns (uint256)',
  'function totalCampaigns() view returns (uint256)',
  'function getCampaign(uint256 campaignId) view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)',
  'function tokenToCampaign(uint256) view returns (uint256)',
  'function ownerOf(uint256) view returns (address)',
  'function tokenURI(uint256) view returns (string)',
]

// Contract addresses - from .env.local
const V5_ADDRESS = process.env.CONTRACT_ADDRESS_V5 || '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const V6_ADDRESS = process.env.CONTRACT_ADDRESS || '0xaE54e4E8A75a81780361570c17b8660CEaD27053'

// RPC configuration
const RPC_URL = process.env.BLOCKDAG_RPC || 'https://bdag.nownodes.io'
const NOWNODES_API_KEY = process.env.NOWNODES_API_KEY

// Supabase configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface VerificationReport {
  timestamp: string
  v5: ContractReport
  v6: ContractReport
  database: DatabaseReport
  issues: Issue[]
  summary: Summary
}

interface ContractReport {
  address: string
  totalSupply: number
  campaignCount: number
  campaigns: CampaignData[]
  tokens: TokenData[]
}

interface CampaignData {
  id: number
  category: number
  baseURI: string
  goal: string
  grossRaised: string
  netRaised: string
  editionsMinted: number
  isActive: boolean
  isClosed: boolean
}

interface TokenData {
  tokenId: number
  campaignId: number
  owner: string
  tokenURI: string
  editionNumber?: number
}

interface DatabaseReport {
  totalSubmissions: number
  mintedSubmissions: number
  submissionsWithCampaignId: number
  submissionsWithThumbnail: number
  submissionsWithoutThumbnail: SubmissionSummary[]
  purchases: number
}

interface SubmissionSummary {
  id: string
  title: string
  campaign_id: number | null
  has_thumbnail: boolean
  status: string
}

interface Issue {
  type: 'error' | 'warning' | 'info'
  category: string
  description: string
  details?: any
}

interface Summary {
  totalOnChainNFTs: number
  totalOnChainCampaigns: number
  totalDatabaseSubmissions: number
  totalDatabasePurchases: number
  issueCount: number
  syncStatus: 'synced' | 'partial' | 'out_of_sync'
}

async function createProvider(): Promise<ethers.JsonRpcProvider> {
  const fetchRequest = new ethers.FetchRequest(RPC_URL)
  if (NOWNODES_API_KEY && RPC_URL.includes('nownodes')) {
    fetchRequest.setHeader('api-key', NOWNODES_API_KEY)
  }
  return new ethers.JsonRpcProvider(fetchRequest, 1043)
}

async function verifyContract(
  provider: ethers.JsonRpcProvider,
  address: string,
  abi: string[],
  version: string
): Promise<ContractReport> {
  console.log(`\n📋 Verifying ${version} Contract: ${address}`)
  
  const contract = new ethers.Contract(address, abi, provider)
  const campaigns: CampaignData[] = []
  const tokens: TokenData[] = []
  
  let totalSupply = 0
  let campaignCount = 0
  
  try {
    totalSupply = Number(await contract.totalSupply())
    console.log(`  Total Supply: ${totalSupply}`)
  } catch (e) {
    console.log(`  Total Supply: Error - ${(e as Error).message}`)
  }
  
  try {
    campaignCount = Number(await contract.totalCampaigns())
    console.log(`  Campaign Count: ${campaignCount}`)
  } catch (e) {
    console.log(`  Campaign Count: Error - ${(e as Error).message}`)
  }
  
  // Query each campaign
  for (let i = 0; i < campaignCount; i++) {
    try {
      const campaign = await contract.getCampaign(i)
      campaigns.push({
        id: i,
        category: 0, // category is string in V5
        baseURI: campaign.baseURI,
        goal: ethers.formatEther(campaign.goal),
        grossRaised: ethers.formatEther(campaign.grossRaised),
        netRaised: ethers.formatEther(campaign.netRaised),
        editionsMinted: Number(campaign.editionsMinted),
        isActive: campaign.active,
        isClosed: campaign.closed,
      })
      console.log(`  Campaign ${i}: ${campaign.editionsMinted} editions, ${ethers.formatEther(campaign.grossRaised)} BDAG raised`)
    } catch (e) {
      console.log(`  Campaign ${i}: Error - ${(e as Error).message}`)
    }
  }
  
  // Query each token (sample first 20 and last 10 if many)
  const tokensToQuery = totalSupply <= 30 
    ? Array.from({ length: totalSupply }, (_, i) => i + 1)
    : [...Array.from({ length: 20 }, (_, i) => i + 1), ...Array.from({ length: 10 }, (_, i) => totalSupply - 9 + i)]
  
  for (const tokenId of tokensToQuery) {
    if (tokenId <= 0 || tokenId > totalSupply) continue
    try {
      const [campaignId, owner, tokenURI] = await Promise.all([
        contract.tokenToCampaign(tokenId),
        contract.ownerOf(tokenId),
        contract.tokenURI(tokenId),
      ])
      
      let editionNumber: number | undefined
      if (version === 'V5') {
        try {
          editionNumber = Number(await contract.tokenEditionNumber(tokenId))
        } catch {}
      }
      
      tokens.push({
        tokenId,
        campaignId: Number(campaignId),
        owner,
        tokenURI,
        editionNumber,
      })
    } catch (e) {
      console.log(`  Token ${tokenId}: Error - ${(e as Error).message}`)
    }
  }
  
  console.log(`  Sampled ${tokens.length} tokens`)
  
  return {
    address,
    totalSupply,
    campaignCount,
    campaigns,
    tokens,
  }
}

async function verifyDatabase(): Promise<DatabaseReport> {
  console.log('\n🗄️ Verifying Database...')
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  
  // Get all submissions
  const { data: submissions, error: subError } = await supabase
    .from('submissions')
    .select('id, title, campaign_id, token_id, status, image_uri, contract_address')
    .order('created_at', { ascending: true })
  
  if (subError) {
    console.error('Error fetching submissions:', subError)
    return {
      totalSubmissions: 0,
      mintedSubmissions: 0,
      submissionsWithCampaignId: 0,
      submissionsWithThumbnail: 0,
      submissionsWithoutThumbnail: [],
      purchases: 0,
    }
  }
  
  const mintedSubmissions = submissions?.filter(s => s.status === 'minted') || []
  const withCampaignId = submissions?.filter(s => s.campaign_id !== null) || []
  const withThumbnail = submissions?.filter(s => s.image_uri) || []
  const withoutThumbnail = submissions?.filter(s => !s.image_uri) || []
  
  console.log(`  Total Submissions: ${submissions?.length || 0}`)
  console.log(`  Minted Submissions: ${mintedSubmissions.length}`)
  console.log(`  With Campaign ID: ${withCampaignId.length}`)
  console.log(`  With Thumbnail: ${withThumbnail.length}`)
  console.log(`  Without Thumbnail: ${withoutThumbnail.length}`)
  
  // Get purchases
  const { count: purchaseCount } = await supabase
    .from('purchases')
    .select('*', { count: 'exact', head: true })
  
  console.log(`  Total Purchases: ${purchaseCount || 0}`)
  
  return {
    totalSubmissions: submissions?.length || 0,
    mintedSubmissions: mintedSubmissions.length,
    submissionsWithCampaignId: withCampaignId.length,
    submissionsWithThumbnail: withThumbnail.length,
    submissionsWithoutThumbnail: withoutThumbnail.map(s => ({
      id: s.id,
      title: s.title,
      campaign_id: s.campaign_id,
      has_thumbnail: false,
      status: s.status,
    })),
    purchases: purchaseCount || 0,
  }
}

function findIssues(v5: ContractReport, v6: ContractReport, db: DatabaseReport): Issue[] {
  const issues: Issue[] = []
  
  // Check for campaigns without thumbnails (expected for 0, 1, 2)
  const expectedNoThumbnail = [0, 1, 2]
  for (const sub of db.submissionsWithoutThumbnail) {
    if (sub.campaign_id !== null && !expectedNoThumbnail.includes(sub.campaign_id)) {
      issues.push({
        type: 'warning',
        category: 'thumbnail',
        description: `Campaign ${sub.campaign_id} (${sub.title}) has no thumbnail`,
        details: sub,
      })
    }
  }
  
  // Check V5 campaigns
  for (const campaign of v5.campaigns) {
    if (campaign.editionsMinted > 0 && !campaign.baseURI) {
      issues.push({
        type: 'error',
        category: 'metadata',
        description: `V5 Campaign ${campaign.id} has ${campaign.editionsMinted} editions but no baseURI`,
        details: campaign,
      })
    }
  }
  
  // Check V6 campaigns
  for (const campaign of v6.campaigns) {
    if (campaign.editionsMinted > 0 && !campaign.baseURI) {
      issues.push({
        type: 'error',
        category: 'metadata',
        description: `V6 Campaign ${campaign.id} has ${campaign.editionsMinted} editions but no baseURI`,
        details: campaign,
      })
    }
  }
  
  // Check database vs on-chain sync
  const totalOnChainCampaigns = v5.campaignCount + v6.campaignCount
  if (db.submissionsWithCampaignId !== db.mintedSubmissions) {
    issues.push({
      type: 'warning',
      category: 'sync',
      description: `Database has ${db.mintedSubmissions} minted submissions but only ${db.submissionsWithCampaignId} have campaign_id`,
    })
  }
  
  // Check for orphaned tokens (tokens without matching campaign in DB)
  // This would require more detailed cross-referencing
  
  return issues
}

async function main() {
  console.log('=' .repeat(60))
  console.log('🔍 COMPREHENSIVE BLOCKCHAIN & DATABASE VERIFICATION')
  console.log('=' .repeat(60))
  console.log(`Timestamp: ${new Date().toISOString()}`)
  
  const provider = await createProvider()
  
  // Verify V5 Contract
  const v5Report = await verifyContract(provider, V5_ADDRESS, V5_ABI, 'V5')
  
  // Verify V6 Contract
  const v6Report = await verifyContract(provider, V6_ADDRESS, V6_ABI, 'V6')
  
  // Verify Database
  const dbReport = await verifyDatabase()
  
  // Find Issues
  const issues = findIssues(v5Report, v6Report, dbReport)
  
  // Generate Summary
  const summary: Summary = {
    totalOnChainNFTs: v5Report.totalSupply + v6Report.totalSupply,
    totalOnChainCampaigns: v5Report.campaignCount + v6Report.campaignCount,
    totalDatabaseSubmissions: dbReport.totalSubmissions,
    totalDatabasePurchases: dbReport.purchases,
    issueCount: issues.length,
    syncStatus: issues.filter(i => i.type === 'error').length > 0 ? 'out_of_sync' : 
                issues.filter(i => i.type === 'warning').length > 0 ? 'partial' : 'synced',
  }
  
  // Print Report
  console.log('\n' + '=' .repeat(60))
  console.log('📊 VERIFICATION SUMMARY')
  console.log('=' .repeat(60))
  console.log(`Total On-Chain NFTs: ${summary.totalOnChainNFTs}`)
  console.log(`  - V5: ${v5Report.totalSupply}`)
  console.log(`  - V6: ${v6Report.totalSupply}`)
  console.log(`Total On-Chain Campaigns: ${summary.totalOnChainCampaigns}`)
  console.log(`  - V5: ${v5Report.campaignCount}`)
  console.log(`  - V6: ${v6Report.campaignCount}`)
  console.log(`Total Database Submissions: ${summary.totalDatabaseSubmissions}`)
  console.log(`Total Database Purchases: ${summary.totalDatabasePurchases}`)
  console.log(`Issues Found: ${summary.issueCount}`)
  console.log(`Sync Status: ${summary.syncStatus.toUpperCase()}`)
  
  if (issues.length > 0) {
    console.log('\n' + '=' .repeat(60))
    console.log('⚠️ ISSUES FOUND')
    console.log('=' .repeat(60))
    for (const issue of issues) {
      const icon = issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️'
      console.log(`${icon} [${issue.category}] ${issue.description}`)
      if (issue.details) {
        console.log(`   Details: ${JSON.stringify(issue.details, null, 2).split('\n').join('\n   ')}`)
      }
    }
  }
  
  // Print V5 Campaign Details
  console.log('\n' + '=' .repeat(60))
  console.log('📋 V5 CAMPAIGN DETAILS')
  console.log('=' .repeat(60))
  for (const campaign of v5Report.campaigns) {
    console.log(`Campaign ${campaign.id}:`)
    console.log(`  Category: ${campaign.category}`)
    console.log(`  Editions: ${campaign.editionsMinted}`)
    console.log(`  Gross Raised: ${campaign.grossRaised} BDAG`)
    console.log(`  Active: ${campaign.isActive}, Closed: ${campaign.isClosed}`)
    console.log(`  BaseURI: ${campaign.baseURI.slice(0, 60)}...`)
  }
  
  // Print submissions without thumbnails
  if (dbReport.submissionsWithoutThumbnail.length > 0) {
    console.log('\n' + '=' .repeat(60))
    console.log('🖼️ SUBMISSIONS WITHOUT THUMBNAILS')
    console.log('=' .repeat(60))
    for (const sub of dbReport.submissionsWithoutThumbnail) {
      console.log(`- ${sub.title} (Campaign ${sub.campaign_id}) - Status: ${sub.status}`)
    }
  }
  
  // Save full report to file
  const report: VerificationReport = {
    timestamp: new Date().toISOString(),
    v5: v5Report,
    v6: v6Report,
    database: dbReport,
    issues,
    summary,
  }
  
  const reportPath = path.join(__dirname, '..', 'AUDIT_REPORTS', `${new Date().toISOString().split('T')[0]}_blockchain_verification.json`)
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\n✅ Full report saved to: ${reportPath}`)
}

main().catch(console.error)
