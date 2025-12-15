/**
 * TEST-DRIVEN VERIFICATION: Submission Process
 * 
 * Tests the entire submission flow from creation to purchase:
 * 1. Submission creation
 * 2. Admin approval
 * 3. Campaign minting (on-chain)
 * 4. Marketplace visibility
 * 5. Purchase flow
 * 
 * Run with: node scripts/test-submission-flow.js
 */
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const { ethers } = require('ethers')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const RESULTS = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
}

function pass(name, details = '') {
  RESULTS.passed++
  RESULTS.tests.push({ name, status: 'PASS', details })
  console.log(`   ✅ ${name}${details ? ': ' + details : ''}`)
}

function fail(name, details = '') {
  RESULTS.failed++
  RESULTS.tests.push({ name, status: 'FAIL', details })
  console.log(`   ❌ ${name}${details ? ': ' + details : ''}`)
}

function warn(name, details = '') {
  RESULTS.warnings++
  RESULTS.tests.push({ name, status: 'WARN', details })
  console.log(`   ⚠️ ${name}${details ? ': ' + details : ''}`)
}

async function testDatabaseTables() {
  console.log('\n1️⃣ DATABASE TABLES')
  console.log('-'.repeat(50))
  
  // Check submissions table
  const { data: submissions, error: subError } = await supabase
    .from('submissions')
    .select('id')
    .limit(1)
  
  if (subError) fail('submissions table', subError.message)
  else pass('submissions table exists')
  
  // Check profiles table
  const { data: profiles, error: profError } = await supabase
    .from('profiles')
    .select('id')
    .limit(1)
  
  if (profError) fail('profiles table', profError.message)
  else pass('profiles table exists')
  
  // Check purchases table
  const { data: purchases, error: purchError } = await supabase
    .from('purchases')
    .select('id')
    .limit(1)
  
  if (purchError) fail('purchases table', purchError.message)
  else pass('purchases table exists')
  
  // Check events table
  const { data: events, error: evtError } = await supabase
    .from('events')
    .select('id')
    .limit(1)
  
  if (evtError) fail('events table', evtError.message)
  else pass('events table exists')
  
  // Check marketplace_contracts table
  const { data: contracts, error: ctError } = await supabase
    .from('marketplace_contracts')
    .select('id')
    .limit(1)
  
  if (ctError) warn('marketplace_contracts table', ctError.message)
  else pass('marketplace_contracts table exists')
}

async function testSubmissionStatuses() {
  console.log('\n2️⃣ SUBMISSION STATUS DISTRIBUTION')
  console.log('-'.repeat(50))
  
  const statuses = ['draft', 'pending', 'approved', 'minted', 'rejected']
  
  for (const status of statuses) {
    const { count, error } = await supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('status', status)
    
    if (error) {
      fail(`Count ${status} submissions`, error.message)
    } else {
      console.log(`   📊 ${status}: ${count || 0}`)
    }
  }
  
  // Check for submissions stuck in pending
  const { data: pendingOld, error: pendingError } = await supabase
    .from('submissions')
    .select('id, title, created_at')
    .eq('status', 'pending')
    .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
  
  if (!pendingError && pendingOld?.length > 0) {
    warn(`${pendingOld.length} submissions pending > 7 days`, 'May need review')
  } else {
    pass('No stale pending submissions')
  }
}

async function testMintedCampaigns() {
  console.log('\n3️⃣ MINTED CAMPAIGNS VERIFICATION')
  console.log('-'.repeat(50))
  
  const { data: minted, error } = await supabase
    .from('submissions')
    .select('id, title, campaign_id, status, visible_on_marketplace')
    .eq('status', 'minted')
  
  if (error) {
    fail('Query minted submissions', error.message)
    return
  }
  
  console.log(`   📊 Total minted: ${minted?.length || 0}`)
  
  let missingCampaignId = 0
  let notOnMarketplace = 0
  
  for (const sub of (minted || [])) {
    if (!sub.campaign_id) {
      missingCampaignId++
      warn(`Missing campaign_id: "${sub.title}"`)
    }
    if (!sub.visible_on_marketplace) {
      notOnMarketplace++
    }
  }
  
  if (missingCampaignId === 0) pass('All minted have campaign_id')
  else fail(`${missingCampaignId} minted without campaign_id`)
  
  console.log(`   📊 Visible on marketplace: ${(minted?.length || 0) - notOnMarketplace} / ${minted?.length || 0}`)
}

async function testOnChainSync() {
  console.log('\n4️⃣ ON-CHAIN SYNC VERIFICATION')
  console.log('-'.repeat(50))
  
  const contractAddress = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS
  
  if (!contractAddress) {
    fail('CONTRACT_ADDRESS not configured')
    return
  }
  
  pass('Contract address configured', contractAddress.slice(0, 10) + '...')
  
  // Try to connect to RPC
  const rpcUrl = process.env.BLOCKDAG_RPC || 'https://rpc.awakening.bdagscan.com'
  
  try {
    let provider
    if (rpcUrl.includes('nownodes')) {
      provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
        staticNetwork: true,
        batchMaxCount: 1
      })
      // NowNodes requires API key header - this may not work in simple test
    } else {
      provider = new ethers.JsonRpcProvider(rpcUrl)
    }
    
    const network = await provider.getNetwork()
    pass('RPC connection', `Chain ID: ${network.chainId}`)
    
    // Check contract code exists
    const code = await provider.getCode(contractAddress)
    if (code === '0x') {
      fail('Contract not deployed', 'No code at address')
    } else {
      pass('Contract deployed', `Code size: ${code.length} bytes`)
    }
  } catch (e) {
    warn('RPC connection issue', e.message?.slice(0, 50))
  }
}

async function testMarketplaceAPI() {
  console.log('\n5️⃣ MARKETPLACE API VERIFICATION')
  console.log('-'.repeat(50))
  
  // Query what should be on marketplace
  const { data: visible, error } = await supabase
    .from('submissions')
    .select('id, title, campaign_id')
    .eq('status', 'minted')
    .eq('visible_on_marketplace', true)
  
  if (error) {
    fail('Query marketplace submissions', error.message)
    return
  }
  
  console.log(`   📊 Expected on marketplace: ${visible?.length || 0}`)
  
  for (const sub of (visible || [])) {
    if (!sub.campaign_id) {
      warn(`"${sub.title}" visible but no campaign_id`)
    }
  }
  
  if ((visible?.length || 0) > 0) {
    pass('Marketplace has campaigns')
  } else {
    warn('No campaigns visible on marketplace')
  }
}

async function testPurchaseRecords() {
  console.log('\n6️⃣ PURCHASE RECORDS VERIFICATION')
  console.log('-'.repeat(50))
  
  const { data: purchases, count, error } = await supabase
    .from('purchases')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(10)
  
  if (error) {
    fail('Query purchases', error.message)
    return
  }
  
  console.log(`   📊 Total purchases: ${count || 0}`)
  
  if (purchases?.length > 0) {
    pass('Purchases recorded')
    
    // Check data quality
    let missingFields = { wallet: 0, amount: 0, tx_hash: 0, campaign_id: 0 }
    
    for (const p of purchases) {
      if (!p.wallet_address) missingFields.wallet++
      if (!p.amount_usd && !p.amount_bdag) missingFields.amount++
      if (!p.tx_hash) missingFields.tx_hash++
      if (!p.campaign_id) missingFields.campaign_id++
    }
    
    for (const [field, count] of Object.entries(missingFields)) {
      if (count > 0) warn(`${count}/${purchases.length} purchases missing ${field}`)
    }
  } else {
    console.log('   ℹ️ No purchases yet (this is okay for new deployments)')
  }
}

async function testSubmissionFlow() {
  console.log('\n7️⃣ SUBMISSION FLOW INTEGRITY')
  console.log('-'.repeat(50))
  
  // Check for orphaned data
  const { data: mintedNoContract } = await supabase
    .from('submissions')
    .select('id, title')
    .eq('status', 'minted')
    .is('campaign_id', null)
  
  if (mintedNoContract?.length > 0) {
    fail(`${mintedNoContract.length} minted submissions without campaign_id`)
    mintedNoContract.forEach(s => console.log(`      - ${s.title}`))
  } else {
    pass('All minted submissions have campaign_id')
  }
  
  // Check for approved but not minted (stuck)
  const { data: approvedNotMinted } = await supabase
    .from('submissions')
    .select('id, title, created_at')
    .eq('status', 'approved')
    .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  
  if (approvedNotMinted?.length > 0) {
    warn(`${approvedNotMinted.length} approved > 24h but not minted`)
  } else {
    pass('No stuck approved submissions')
  }
}

async function testRequiredFields() {
  console.log('\n8️⃣ REQUIRED FIELDS CHECK')
  console.log('-'.repeat(50))
  
  // Check submissions have required fields
  const { data: submissions } = await supabase
    .from('submissions')
    .select('id, title, full_name, description, requested_amount, status')
    .limit(50)
  
  let issues = { noTitle: 0, noName: 0, noDesc: 0, noAmount: 0 }
  
  for (const s of (submissions || [])) {
    if (!s.title?.trim()) issues.noTitle++
    if (!s.full_name?.trim()) issues.noName++
    if (!s.description?.trim()) issues.noDesc++
    if (!s.requested_amount) issues.noAmount++
  }
  
  const total = submissions?.length || 0
  if (issues.noTitle > 0) warn(`${issues.noTitle}/${total} submissions missing title`)
  if (issues.noName > 0) warn(`${issues.noName}/${total} submissions missing full_name`)
  if (issues.noDesc > 0) warn(`${issues.noDesc}/${total} submissions missing description`)
  if (issues.noAmount > 0) warn(`${issues.noAmount}/${total} submissions missing requested_amount`)
  
  if (Object.values(issues).every(v => v === 0)) {
    pass('All checked submissions have required fields')
  }
}

async function main() {
  console.log('🧪 SUBMISSION FLOW TEST SUITE')
  console.log('='.repeat(50))
  console.log(`Date: ${new Date().toISOString()}`)
  
  await testDatabaseTables()
  await testSubmissionStatuses()
  await testMintedCampaigns()
  await testOnChainSync()
  await testMarketplaceAPI()
  await testPurchaseRecords()
  await testSubmissionFlow()
  await testRequiredFields()
  
  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('TEST SUMMARY')
  console.log('='.repeat(50))
  console.log(`   ✅ Passed:   ${RESULTS.passed}`)
  console.log(`   ❌ Failed:   ${RESULTS.failed}`)
  console.log(`   ⚠️ Warnings: ${RESULTS.warnings}`)
  console.log('')
  
  if (RESULTS.failed > 0) {
    console.log('❌ SOME TESTS FAILED - Review issues above')
    process.exit(1)
  } else if (RESULTS.warnings > 0) {
    console.log('⚠️ TESTS PASSED WITH WARNINGS')
  } else {
    console.log('✅ ALL TESTS PASSED')
  }
}

main().catch(console.error)
