/**
 * Orphan Campaign Audit Script
 * 
 * Identifies on-chain campaigns that don't have matching database records
 * These are likely duplicates from RPC issues during campaign creation
 * 
 * Run: npx ts-node scripts/audit-orphan-campaigns.ts
 */

import { ethers } from 'ethers'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'
import * as fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const V5_ABI = [
  'function totalSupply() view returns (uint256)',
  'function totalCampaigns() view returns (uint256)',
  'function getCampaign(uint256 campaignId) view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)',
]

const V5_ADDRESS = process.env.CONTRACT_ADDRESS_V5 || '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const RPC_URL = process.env.BLOCKDAG_RPC || 'https://bdag.nownodes.io'
const NOWNODES_API_KEY = process.env.NOWNODES_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface CampaignComparison {
  campaignId: number
  onChain: {
    baseURI: string
    goal: string
    grossRaised: string
    editionsMinted: number
    active: boolean
    closed: boolean
  }
  database: {
    id: string
    title: string
    image_uri: string
    goal: number
    status: string
  } | null
  status: 'matched' | 'orphan_onchain' | 'orphan_db' | 'mismatch'
  notes: string[]
}

async function createProvider(): Promise<ethers.JsonRpcProvider> {
  const fetchRequest = new ethers.FetchRequest(RPC_URL)
  if (NOWNODES_API_KEY && RPC_URL.includes('nownodes')) {
    fetchRequest.setHeader('api-key', NOWNODES_API_KEY)
  }
  return new ethers.JsonRpcProvider(fetchRequest, 1043)
}

async function main() {
  console.log('=' .repeat(70))
  console.log('🔍 ORPHAN CAMPAIGN AUDIT')
  console.log('=' .repeat(70))
  console.log(`Timestamp: ${new Date().toISOString()}\n`)

  const provider = await createProvider()
  const contract = new ethers.Contract(V5_ADDRESS, V5_ABI, provider)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Get on-chain campaign count
  const totalCampaigns = Number(await contract.totalCampaigns())
  console.log(`📊 On-chain campaigns: ${totalCampaigns}`)

  // Get database submissions with campaign_id
  const { data: submissions, error } = await supabase
    .from('submissions')
    .select('id, title, campaign_id, image_uri, goal, status, contract_address')
    .not('campaign_id', 'is', null)
    .order('campaign_id', { ascending: true })

  if (error) {
    console.error('Database error:', error)
    return
  }

  console.log(`📊 Database submissions with campaign_id: ${submissions?.length || 0}\n`)

  // Create lookup by campaign_id
  const dbByCampaignId: Record<number, any> = {}
  for (const sub of submissions || []) {
    if (sub.campaign_id !== null) {
      dbByCampaignId[sub.campaign_id] = sub
    }
  }

  const comparisons: CampaignComparison[] = []
  const orphanOnChain: number[] = []
  const matched: number[] = []
  const zeroSales: number[] = []

  // Check each on-chain campaign
  for (let i = 0; i < totalCampaigns; i++) {
    try {
      const campaign = await contract.getCampaign(i)
      const dbRecord = dbByCampaignId[i] || null
      const notes: string[] = []

      const onChainData = {
        baseURI: campaign.baseURI || campaign[1] || '',
        goal: ethers.formatEther(campaign.goal || campaign[2] || 0n),
        grossRaised: ethers.formatEther(campaign.grossRaised || campaign[3] || 0n),
        editionsMinted: Number(campaign.editionsMinted || campaign[5] || 0),
        active: campaign.active ?? campaign[8] ?? true,
        closed: campaign.closed ?? campaign[9] ?? false,
      }

      let status: CampaignComparison['status'] = 'matched'

      if (!dbRecord) {
        status = 'orphan_onchain'
        orphanOnChain.push(i)
        notes.push('No database record found')
        
        if (onChainData.editionsMinted === 0) {
          notes.push('Zero sales - likely a test/duplicate campaign')
          zeroSales.push(i)
        }
      } else {
        matched.push(i)
        
        // Check for mismatches
        if (!dbRecord.image_uri && onChainData.baseURI) {
          notes.push('DB missing image_uri but on-chain has baseURI')
        }
        if (dbRecord.image_uri && !onChainData.baseURI) {
          notes.push('DB has image_uri but on-chain missing baseURI')
        }
      }

      comparisons.push({
        campaignId: i,
        onChain: onChainData,
        database: dbRecord ? {
          id: dbRecord.id,
          title: dbRecord.title,
          image_uri: dbRecord.image_uri,
          goal: dbRecord.goal,
          status: dbRecord.status,
        } : null,
        status,
        notes,
      })
    } catch (e) {
      console.error(`Error fetching campaign ${i}:`, (e as Error).message)
    }
  }

  // Print summary
  console.log('=' .repeat(70))
  console.log('📊 AUDIT SUMMARY')
  console.log('=' .repeat(70))
  console.log(`Total on-chain campaigns: ${totalCampaigns}`)
  console.log(`Matched to database: ${matched.length}`)
  console.log(`Orphan on-chain (no DB record): ${orphanOnChain.length}`)
  console.log(`  - With zero sales: ${zeroSales.length}`)
  console.log(`  - With sales: ${orphanOnChain.length - zeroSales.length}`)

  // Print orphan details
  if (orphanOnChain.length > 0) {
    console.log('\n' + '=' .repeat(70))
    console.log('🔴 ORPHAN CAMPAIGNS (On-chain but not in database)')
    console.log('=' .repeat(70))
    
    for (const id of orphanOnChain) {
      const comp = comparisons.find(c => c.campaignId === id)!
      const salesInfo = comp.onChain.editionsMinted === 0 ? '(NO SALES - safe to ignore)' : `(${comp.onChain.editionsMinted} sales!)`
      console.log(`\nCampaign #${id} ${salesInfo}`)
      console.log(`  BaseURI: ${comp.onChain.baseURI.slice(0, 60)}...`)
      console.log(`  Goal: ${comp.onChain.goal} BDAG`)
      console.log(`  Raised: ${comp.onChain.grossRaised} BDAG`)
      console.log(`  Editions: ${comp.onChain.editionsMinted}`)
      console.log(`  Active: ${comp.onChain.active}, Closed: ${comp.onChain.closed}`)
    }
  }

  // Print matched campaigns that might have thumbnail issues
  console.log('\n' + '=' .repeat(70))
  console.log('✅ MATCHED CAMPAIGNS (On-chain + Database)')
  console.log('=' .repeat(70))
  
  for (const id of matched) {
    const comp = comparisons.find(c => c.campaignId === id)!
    const hasImage = comp.database?.image_uri ? '✓' : '✗'
    console.log(`Campaign #${id}: ${comp.database?.title?.slice(0, 40) || 'Untitled'}`)
    console.log(`  Status: ${comp.database?.status}, Image: ${hasImage}`)
    if (!comp.database?.image_uri) {
      console.log(`  ⚠️ MISSING THUMBNAIL`)
    }
  }

  // Save full report
  const reportPath = path.join(__dirname, '..', 'AUDIT_REPORTS', `${new Date().toISOString().split('T')[0]}_orphan_audit.json`)
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      totalOnChain: totalCampaigns,
      matched: matched.length,
      orphanOnChain: orphanOnChain.length,
      orphanWithZeroSales: zeroSales.length,
      orphanWithSales: orphanOnChain.length - zeroSales.length,
    },
    orphanCampaigns: orphanOnChain,
    matchedCampaigns: matched,
    zeroSalesCampaigns: zeroSales,
    comparisons,
  }, null, 2))
  
  console.log(`\n✅ Full report saved to: ${reportPath}`)

  // Recommendations
  console.log('\n' + '=' .repeat(70))
  console.log('📋 RECOMMENDATIONS')
  console.log('=' .repeat(70))
  
  if (zeroSales.length > 0) {
    console.log(`\n1. SAFE TO IGNORE: ${zeroSales.length} orphan campaigns with zero sales`)
    console.log(`   These are likely duplicates from RPC issues. No action needed.`)
  }
  
  const orphansWithSales = orphanOnChain.filter(id => !zeroSales.includes(id))
  if (orphansWithSales.length > 0) {
    console.log(`\n2. NEEDS ATTENTION: ${orphansWithSales.length} orphan campaigns WITH sales`)
    console.log(`   Campaign IDs: ${orphansWithSales.join(', ')}`)
    console.log(`   These may need database records created or investigation.`)
  }

  const missingThumbnails = matched.filter(id => {
    const comp = comparisons.find(c => c.campaignId === id)!
    return !comp.database?.image_uri
  })
  if (missingThumbnails.length > 0) {
    console.log(`\n3. MISSING THUMBNAILS: ${missingThumbnails.length} matched campaigns without image_uri`)
    console.log(`   Campaign IDs: ${missingThumbnails.join(', ')}`)
  }
}

main().catch(console.error)
