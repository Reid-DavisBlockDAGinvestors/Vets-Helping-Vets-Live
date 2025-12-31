#!/usr/bin/env node
/**
 * FULL PLATFORM AUDIT - Military Precision Data Integrity Check
 * 
 * Phase 1: Database Audit
 * Phase 2: On-Chain Audit  
 * Phase 3: Cross-Reference All Data Sources
 * 
 * Run: npx ts-node scripts/full-platform-audit.ts
 */

const { createClient } = require('@supabase/supabase-js')
const { ethers } = require('ethers')
const fs = require('fs')

require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const RPC_URL = process.env.BLOCKDAG_RPC || 'https://rpc.primev2.bdagscan.com'
const NOWNODES_KEY = process.env.NOWNODES_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Contract addresses from lib/contracts.ts
const CONTRACT_V5 = process.env.CONTRACT_ADDRESS_V5 || '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const CONTRACT_V6 = process.env.CONTRACT_ADDRESS_V6 || '0xaE54e4E8A75a81780361570c17b8660CEaD27053'

// ABIs
const CAMPAIGN_ABI = [
  'function getCampaign(uint256 campaignId) view returns (tuple(uint256 size, uint256 price, uint256 goal, uint256 sold, address creator, string baseURI, uint8 category, bool active))',
  'function campaignCount() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)'
]

interface AuditReport {
  timestamp: string
  database: {
    tables: Record<string, { count: number; issues: string[] }>
    campaigns: any[]
    purchases: any[]
    profiles: any[]
  }
  onChain: {
    v5: { campaignCount: number; totalSupply: number; campaigns: any[] }
    v6: { campaignCount: number; totalSupply: number; campaigns: any[] }
  }
  discrepancies: {
    soldCountMismatches: any[]
    raisedAmountMismatches: any[]
    contractVersionMismatches: any[]
    missingEmails: number
    duplicateCampaigns: any[]
  }
  totals: {
    dbTotalRaised: number
    dbTotalNFTsSold: number
    chainTotalNFTsSold: number
    purchasesWithEmail: number
    purchasesTotal: number
  }
}

const report: AuditReport = {
  timestamp: new Date().toISOString(),
  database: { tables: {}, campaigns: [], purchases: [], profiles: [] },
  onChain: { 
    v5: { campaignCount: 0, totalSupply: 0, campaigns: [] },
    v6: { campaignCount: 0, totalSupply: 0, campaigns: [] }
  },
  discrepancies: {
    soldCountMismatches: [],
    raisedAmountMismatches: [],
    contractVersionMismatches: [],
    missingEmails: 0,
    duplicateCampaigns: []
  },
  totals: {
    dbTotalRaised: 0,
    dbTotalNFTsSold: 0,
    chainTotalNFTsSold: 0,
    purchasesWithEmail: 0,
    purchasesTotal: 0
  }
}

async function createProvider() {
  const fetchRequest = new ethers.FetchRequest(RPC_URL)
  if (RPC_URL?.includes('nownodes') && NOWNODES_KEY) {
    fetchRequest.setHeader('api-key', NOWNODES_KEY)
  }
  return new ethers.JsonRpcProvider(fetchRequest)
}

// ============================================
// PHASE 1: DATABASE AUDIT
// ============================================

async function auditDatabase() {
  console.log('\n' + '='.repeat(70))
  console.log('📊 PHASE 1: DATABASE AUDIT')
  console.log('='.repeat(70))

  // 1.1 Audit submissions table
  console.log('\n▶ Auditing submissions table...')
  const { data: submissions, error: subErr } = await supabase
    .from('submissions')
    .select('*')
    .order('campaign_id', { ascending: true })

  if (subErr) {
    console.error('  ❌ Error:', subErr.message)
  } else {
    report.database.campaigns = submissions || []
    report.database.tables['submissions'] = { 
      count: submissions?.length || 0, 
      issues: [] 
    }
    console.log(`  ✓ Found ${submissions?.length || 0} campaigns`)

    // Check for issues
    for (const s of submissions || []) {
      if (!s.campaign_id && s.status === 'minted') {
        report.database.tables['submissions'].issues.push(
          `Campaign "${s.title}" is minted but has no campaign_id`
        )
      }
      if (s.status === 'minted' && !s.contract_address) {
        report.database.tables['submissions'].issues.push(
          `Campaign #${s.campaign_id} "${s.title}" has no contract_address`
        )
      }
    }
  }

  // 1.2 Audit purchases table
  console.log('\n▶ Auditing purchases table...')
  const { data: purchases, error: purchErr } = await supabase
    .from('purchases')
    .select('*')
    .order('created_at', { ascending: false })

  if (purchErr) {
    console.error('  ❌ Error:', purchErr.message)
  } else {
    report.database.purchases = purchases || []
    report.database.tables['purchases'] = { 
      count: purchases?.length || 0, 
      issues: [] 
    }
    console.log(`  ✓ Found ${purchases?.length || 0} purchases`)

    // Calculate totals
    let totalUSD = 0
    let totalQty = 0
    let withEmail = 0
    
    for (const p of purchases || []) {
      totalUSD += (p.amount_usd || 0) + (p.tip_usd || 0)
      totalQty += p.quantity || 1
      if (p.email) withEmail++
    }
    
    report.totals.dbTotalRaised = totalUSD
    report.totals.dbTotalNFTsSold = totalQty
    report.totals.purchasesWithEmail = withEmail
    report.totals.purchasesTotal = purchases?.length || 0
    
    console.log(`  ✓ Total USD raised: $${totalUSD.toFixed(2)}`)
    console.log(`  ✓ Total NFTs sold: ${totalQty}`)
    console.log(`  ✓ Purchases with email: ${withEmail}/${purchases?.length || 0}`)
  }

  // 1.3 Audit profiles table
  console.log('\n▶ Auditing profiles table...')
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('*')

  if (profErr) {
    console.error('  ❌ Error:', profErr.message)
  } else {
    report.database.profiles = profiles || []
    report.database.tables['profiles'] = { 
      count: profiles?.length || 0, 
      issues: [] 
    }
    console.log(`  ✓ Found ${profiles?.length || 0} profiles`)
  }

  // 1.4 Check sold_count vs actual purchases
  console.log('\n▶ Cross-checking sold_count vs purchases...')
  const purchasesByCampaign: Record<number, { count: number; total: number }> = {}
  
  for (const p of report.database.purchases) {
    const cid = p.campaign_id
    if (!purchasesByCampaign[cid]) {
      purchasesByCampaign[cid] = { count: 0, total: 0 }
    }
    purchasesByCampaign[cid].count += p.quantity || 1
    purchasesByCampaign[cid].total += (p.amount_usd || 0) + (p.tip_usd || 0)
  }

  for (const campaign of report.database.campaigns) {
    if (!campaign.campaign_id) continue
    
    const purchaseData = purchasesByCampaign[campaign.campaign_id] || { count: 0, total: 0 }
    const dbSold = campaign.sold_count || 0
    
    if (purchaseData.count !== dbSold) {
      report.discrepancies.soldCountMismatches.push({
        campaignId: campaign.campaign_id,
        title: campaign.title,
        dbSoldCount: dbSold,
        actualPurchases: purchaseData.count,
        difference: purchaseData.count - dbSold
      })
    }
  }

  if (report.discrepancies.soldCountMismatches.length > 0) {
    console.log(`  ⚠️  Found ${report.discrepancies.soldCountMismatches.length} sold_count mismatches`)
  } else {
    console.log('  ✓ All sold_count values match purchases')
  }

  // 1.5 Check for duplicate campaigns
  console.log('\n▶ Checking for duplicate campaigns...')
  const titleMap = new Map<string, any[]>()
  for (const c of report.database.campaigns) {
    const key = c.title?.toLowerCase().trim() || ''
    if (!titleMap.has(key)) titleMap.set(key, [])
    titleMap.get(key)!.push(c)
  }
  
  for (const [title, campaigns] of titleMap) {
    if (campaigns.length > 1) {
      report.discrepancies.duplicateCampaigns.push({
        title: campaigns[0].title,
        count: campaigns.length,
        campaigns: campaigns.map((c: any) => ({
          id: c.id,
          campaignId: c.campaign_id,
          status: c.status,
          soldCount: c.sold_count
        }))
      })
    }
  }

  if (report.discrepancies.duplicateCampaigns.length > 0) {
    console.log(`  ⚠️  Found ${report.discrepancies.duplicateCampaigns.length} sets of duplicates`)
  } else {
    console.log('  ✓ No duplicate campaigns found')
  }
}

// ============================================
// PHASE 2: ON-CHAIN AUDIT
// ============================================

async function auditOnChain() {
  console.log('\n' + '='.repeat(70))
  console.log('⛓️  PHASE 2: ON-CHAIN AUDIT')
  console.log('='.repeat(70))

  let provider: any
  try {
    provider = await createProvider()
    console.log(`\n▶ Connected to RPC: ${RPC_URL?.slice(0, 30)}...`)
  } catch (e: any) {
    console.error('  ❌ Failed to connect to RPC:', e.message)
    return
  }

  // 2.1 Audit V6 Contract (Active)
  console.log('\n▶ Auditing V6 Contract:', CONTRACT_V6)
  try {
    const v6 = new ethers.Contract(CONTRACT_V6, CAMPAIGN_ABI, provider)
    
    const campaignCount = await v6.campaignCount()
    report.onChain.v6.campaignCount = Number(campaignCount)
    console.log(`  ✓ Campaign count: ${campaignCount}`)
    
    const totalSupply = await v6.totalSupply()
    report.onChain.v6.totalSupply = Number(totalSupply)
    console.log(`  ✓ Total NFTs minted: ${totalSupply}`)

    // Get each campaign's data
    for (let i = 1; i <= Number(campaignCount); i++) {
      try {
        const data = await v6.getCampaign(i)
        const campaignData = {
          campaignId: i,
          size: Number(data.size),
          price: Number(ethers.formatEther(data.price)),
          goal: Number(ethers.formatEther(data.goal)),
          sold: Number(data.sold),
          creator: data.creator,
          active: data.active,
          contract: 'V6'
        }
        report.onChain.v6.campaigns.push(campaignData)
        report.totals.chainTotalNFTsSold += campaignData.sold
      } catch (e) {
        // Campaign may not exist
      }
    }
    console.log(`  ✓ Retrieved ${report.onChain.v6.campaigns.length} campaigns from V6`)
  } catch (e: any) {
    console.error('  ❌ V6 Contract error:', e.message)
  }

  // 2.2 Audit V5 Contract (Legacy)
  console.log('\n▶ Auditing V5 Contract:', CONTRACT_V5)
  try {
    const v5 = new ethers.Contract(CONTRACT_V5, CAMPAIGN_ABI, provider)
    
    const campaignCount = await v5.campaignCount()
    report.onChain.v5.campaignCount = Number(campaignCount)
    console.log(`  ✓ Campaign count: ${campaignCount}`)
    
    const totalSupply = await v5.totalSupply()
    report.onChain.v5.totalSupply = Number(totalSupply)
    console.log(`  ✓ Total NFTs minted: ${totalSupply}`)

    // Get each campaign's data
    for (let i = 1; i <= Number(campaignCount); i++) {
      try {
        const data = await v5.getCampaign(i)
        const campaignData = {
          campaignId: i,
          size: Number(data.size),
          price: Number(ethers.formatEther(data.price)),
          goal: Number(ethers.formatEther(data.goal)),
          sold: Number(data.sold),
          creator: data.creator,
          active: data.active,
          contract: 'V5'
        }
        report.onChain.v5.campaigns.push(campaignData)
        report.totals.chainTotalNFTsSold += campaignData.sold
      } catch (e) {
        // Campaign may not exist
      }
    }
    console.log(`  ✓ Retrieved ${report.onChain.v5.campaigns.length} campaigns from V5`)
  } catch (e: any) {
    console.error('  ❌ V5 Contract error:', e.message)
  }
}

// ============================================
// PHASE 3: CROSS-REFERENCE AUDIT
// ============================================

async function crossReferenceAudit() {
  console.log('\n' + '='.repeat(70))
  console.log('🔍 PHASE 3: CROSS-REFERENCE AUDIT')
  console.log('='.repeat(70))

  // Build chain data lookup
  const chainCampaigns = new Map<number, any>()
  
  for (const c of report.onChain.v5.campaigns) {
    chainCampaigns.set(c.campaignId, { ...c, contract: 'V5' })
  }
  for (const c of report.onChain.v6.campaigns) {
    // V6 campaigns might override V5 if same ID
    chainCampaigns.set(c.campaignId, { ...c, contract: 'V6' })
  }

  console.log('\n▶ Comparing DB campaigns with on-chain data...')
  
  for (const dbCampaign of report.database.campaigns) {
    if (!dbCampaign.campaign_id) continue
    
    const chainData = chainCampaigns.get(dbCampaign.campaign_id)
    
    if (!chainData) {
      console.log(`  ⚠️  Campaign #${dbCampaign.campaign_id} "${dbCampaign.title?.slice(0, 30)}" - NOT FOUND ON CHAIN`)
      continue
    }

    // Check sold count
    const dbSold = dbCampaign.sold_count || 0
    const chainSold = chainData.sold
    
    if (dbSold !== chainSold) {
      report.discrepancies.soldCountMismatches.push({
        campaignId: dbCampaign.campaign_id,
        title: dbCampaign.title,
        dbSoldCount: dbSold,
        chainSoldCount: chainSold,
        difference: chainSold - dbSold,
        source: 'chain-vs-db'
      })
      console.log(`  ⚠️  Campaign #${dbCampaign.campaign_id}: DB sold=${dbSold}, Chain sold=${chainSold}`)
    }

    // Check contract version
    const dbContractVersion = dbCampaign.contract_version
    const chainContract = chainData.contract
    
    if (dbContractVersion && dbContractVersion !== chainContract) {
      report.discrepancies.contractVersionMismatches.push({
        campaignId: dbCampaign.campaign_id,
        title: dbCampaign.title,
        dbVersion: dbContractVersion,
        actualVersion: chainContract
      })
    }
  }

  // Print specific campaigns of interest
  console.log('\n▶ Checking specific campaigns...')
  
  // Larry Odom (Campaign #4)
  const larry = report.database.campaigns.find((c: any) => c.campaign_id === 4)
  const larryChain = chainCampaigns.get(4)
  console.log('\n  📍 Larry Odom Campaign (#4):')
  console.log(`     DB: sold_count=${larry?.sold_count || 0}, status=${larry?.status}`)
  console.log(`     Chain: sold=${larryChain?.sold || 0}, size=${larryChain?.size || 0}, active=${larryChain?.active}`)
  if (larryChain && larryChain.sold >= larryChain.size) {
    console.log('     ⚠️  SOLD OUT on chain but may not be reflected in UI')
  }

  // Antonty Turner (Campaign #38)
  const antonty = report.database.campaigns.find((c: any) => c.campaign_id === 38)
  const antontyChain = chainCampaigns.get(38)
  console.log('\n  📍 Antonty Turner Campaign (#38):')
  console.log(`     DB: sold_count=${antonty?.sold_count || 0}, status=${antonty?.status}`)
  console.log(`     Chain: sold=${antontyChain?.sold || 0}, size=${antontyChain?.size || 0}`)
  console.log(`     DB contract_version: ${antonty?.contract_version || 'NOT SET'}`)
}

// ============================================
// GENERATE REPORT
// ============================================

async function generateReport() {
  console.log('\n' + '='.repeat(70))
  console.log('📋 AUDIT REPORT SUMMARY')
  console.log('='.repeat(70))

  console.log('\n📊 DATABASE TOTALS:')
  console.log(`   Total campaigns: ${report.database.campaigns.length}`)
  console.log(`   Total purchases: ${report.totals.purchasesTotal}`)
  console.log(`   Total USD raised (purchases): $${report.totals.dbTotalRaised.toFixed(2)}`)
  console.log(`   Total NFTs sold (purchases): ${report.totals.dbTotalNFTsSold}`)
  console.log(`   Purchases with email: ${report.totals.purchasesWithEmail}/${report.totals.purchasesTotal}`)

  console.log('\n⛓️  ON-CHAIN TOTALS:')
  console.log(`   V5 campaigns: ${report.onChain.v5.campaignCount}`)
  console.log(`   V5 NFTs minted: ${report.onChain.v5.totalSupply}`)
  console.log(`   V6 campaigns: ${report.onChain.v6.campaignCount}`)
  console.log(`   V6 NFTs minted: ${report.onChain.v6.totalSupply}`)
  console.log(`   Total chain NFTs sold: ${report.totals.chainTotalNFTsSold}`)

  console.log('\n⚠️  DISCREPANCIES FOUND:')
  console.log(`   Sold count mismatches: ${report.discrepancies.soldCountMismatches.length}`)
  console.log(`   Contract version mismatches: ${report.discrepancies.contractVersionMismatches.length}`)
  console.log(`   Duplicate campaigns: ${report.discrepancies.duplicateCampaigns.length}`)

  if (report.discrepancies.soldCountMismatches.length > 0) {
    console.log('\n   Sold Count Mismatches:')
    for (const m of report.discrepancies.soldCountMismatches) {
      console.log(`   - Campaign #${m.campaignId} "${m.title?.slice(0, 30)}": DB=${m.dbSoldCount || m.dbSold}, Actual=${m.chainSoldCount || m.actualPurchases}`)
    }
  }

  if (report.discrepancies.contractVersionMismatches.length > 0) {
    console.log('\n   Contract Version Mismatches:')
    for (const m of report.discrepancies.contractVersionMismatches) {
      console.log(`   - Campaign #${m.campaignId}: DB says ${m.dbVersion}, actually ${m.actualVersion}`)
    }
  }

  // Save report to file
  const reportPath = 'audit-report-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\n📁 Full report saved to: ${reportPath}`)

  console.log('\n' + '='.repeat(70))
  console.log('🔧 RECOMMENDED FIXES')
  console.log('='.repeat(70))
  
  if (report.discrepancies.soldCountMismatches.length > 0) {
    console.log('\n1. RUN SOLD COUNT SYNC:')
    console.log('   npx ts-node scripts/fix-campaign-data.ts')
  }

  console.log('\n2. VERIFY HOMEPAGE TOTAL:')
  console.log('   Check /api/stats endpoint returns correct total')

  console.log('\n3. VERIFY ADMIN DASHBOARD:')
  console.log('   - Check /api/admin/campaigns returns correct data')
  console.log('   - Check /api/admin/users returns emails from purchases')

  console.log('\n4. MARKETPLACE SOLD OUT STATUS:')
  console.log('   Check campaigns where sold >= size are marked correctly')

  console.log('\n')
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('\n' + '█'.repeat(70))
  console.log('█  PATRIOTPLEDGE FULL PLATFORM AUDIT - MILITARY PRECISION')
  console.log('█  ' + new Date().toISOString())
  console.log('█'.repeat(70))

  await auditDatabase()
  await auditOnChain()
  await crossReferenceAudit()
  await generateReport()
}

main().catch(console.error)
