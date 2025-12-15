// Comprehensive Data Capture Audit - User Flow Analysis
// Checks every step of user journey to ensure all data is captured
// Run with: node scripts/data-capture-audit.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function auditUserFlow() {
  console.log('🔍 USER FLOW DATA CAPTURE AUDIT')
  console.log('=' .repeat(70))
  console.log('Date:', new Date().toISOString())
  
  const issues = []
  const recommendations = []

  // ===== 1. USER REGISTRATION =====
  console.log('\n\n📱 1. USER REGISTRATION/AUTH')
  console.log('-'.repeat(70))
  
  const { data: profiles } = await supabase.from('profiles').select('*')
  console.log(`   Profiles: ${profiles?.length || 0}`)
  
  // Check what we're capturing
  const profileFields = {
    'id': 'User UUID from Supabase Auth',
    'email': 'User email',
    'display_name': 'Display name',
    'avatar_url': 'Profile picture URL',
    'wallet_address': 'Connected wallet',
    'role': 'User role (user/admin/super_admin)',
    'created_at': 'Registration timestamp',
    'last_sign_in_at': 'Last login',
    'username': 'Unique username'
  }
  
  console.log('\n   Fields captured:')
  for (const [field, desc] of Object.entries(profileFields)) {
    const hasData = profiles?.some(p => p[field] !== null && p[field] !== '')
    console.log(`     ${hasData ? '✅' : '⚠️'} ${field}: ${desc}`)
    if (!hasData) {
      issues.push(`profiles.${field} - no data captured`)
    }
  }
  
  // Check for missing data
  const profilesWithoutWallet = profiles?.filter(p => !p.wallet_address)?.length || 0
  const profilesWithoutEmail = profiles?.filter(p => !p.email)?.length || 0
  console.log(`\n   ⚠️ Profiles without wallet: ${profilesWithoutWallet}`)
  console.log(`   ⚠️ Profiles without email: ${profilesWithoutEmail}`)

  // ===== 2. CAMPAIGN SUBMISSION =====
  console.log('\n\n📝 2. CAMPAIGN SUBMISSION')
  console.log('-'.repeat(70))
  
  const { data: submissions } = await supabase.from('submissions').select('*')
  console.log(`   Submissions: ${submissions?.length || 0}`)
  
  const submissionFields = {
    'id': 'Submission UUID',
    'campaign_id': 'On-chain campaign ID',
    'token_id': 'Legacy token ID (deprecated)',
    'creator_email': 'Creator email',
    'creator_name': 'Creator display name',
    'creator_first_name': 'First name',
    'creator_last_name': 'Last name',
    'company': 'Organization/company',
    'title': 'Campaign title',
    'story': 'Campaign description',
    'category': 'Campaign category',
    'goal': 'Funding goal (USD)',
    'image_uri': 'Main image IPFS/URL',
    'metadata_uri': 'NFT metadata IPFS',
    'status': 'pending/approved/minted/rejected',
    'sold_count': 'Number of NFTs sold',
    'tx_hash': 'On-chain transaction hash',
    'created_at': 'Submission timestamp'
  }
  
  console.log('\n   Fields captured:')
  for (const [field, desc] of Object.entries(submissionFields)) {
    const hasData = submissions?.some(s => s[field] !== null && s[field] !== '' && s[field] !== undefined)
    const nullCount = submissions?.filter(s => s[field] === null || s[field] === '' || s[field] === undefined)?.length || 0
    const pct = submissions?.length ? ((nullCount / submissions.length) * 100).toFixed(0) : 0
    const status = pct > 50 ? '⚠️' : pct > 0 ? '⚡' : '✅'
    console.log(`     ${status} ${field}: ${desc} (${pct}% null)`)
    if (pct > 50) {
      issues.push(`submissions.${field} - ${pct}% null`)
    }
  }

  // ===== 3. PURCHASE FLOW =====
  console.log('\n\n💰 3. PURCHASE FLOW')
  console.log('-'.repeat(70))
  
  const { data: purchases } = await supabase.from('purchases').select('*')
  const { data: events } = await supabase.from('events').select('*')
  
  console.log(`   Purchases: ${purchases?.length || 0}`)
  console.log(`   Events: ${events?.length || 0}`)
  
  // Check purchases table
  const purchaseFields = {
    'id': 'Purchase UUID',
    'wallet_address': 'Buyer wallet',
    'campaign_id': 'Campaign purchased',
    'token_id': 'Minted token ID',
    'tx_hash': 'Blockchain transaction',
    'amount_bdag': 'Amount in BDAG',
    'amount_usd': 'Amount in USD',
    'tip_bdag': 'Tip amount BDAG',
    'tip_usd': 'Tip amount USD',
    'quantity': 'Number of NFTs',
    'email': 'Buyer email (for receipt)',
    'created_at': 'Purchase timestamp'
  }
  
  console.log('\n   Purchases table:')
  for (const [field, desc] of Object.entries(purchaseFields)) {
    const hasData = purchases?.some(p => p[field] !== null && p[field] !== '' && p[field] !== undefined && p[field] !== 0)
    const nullCount = purchases?.filter(p => p[field] === null || p[field] === '' || p[field] === undefined)?.length || 0
    const pct = purchases?.length ? ((nullCount / purchases.length) * 100).toFixed(0) : 0
    const status = pct > 50 ? '⚠️' : pct > 0 ? '⚡' : '✅'
    console.log(`     ${status} ${field}: ${desc} (${pct}% null)`)
  }
  
  // Check events table
  console.log('\n   Events table:')
  const eventFields = {
    'event_type': 'Type of event',
    'campaign_id': 'Related campaign',
    'wallet_address': 'User wallet',
    'tx_hash': 'Transaction hash',
    'amount_bdag': 'BDAG amount',
    'amount_usd': 'USD amount',
    'metadata': 'Additional data (tips, qty, etc)'
  }
  
  for (const [field, desc] of Object.entries(eventFields)) {
    const hasData = events?.some(e => e[field] !== null && e[field] !== '' && e[field] !== undefined)
    const nullCount = events?.filter(e => e[field] === null || e[field] === '' || e[field] === undefined)?.length || 0
    const pct = events?.length ? ((nullCount / events.length) * 100).toFixed(0) : 0
    const status = pct > 50 ? '⚠️' : pct > 0 ? '⚡' : '✅'
    console.log(`     ${status} ${field}: ${desc} (${pct}% null)`)
  }

  // Cross-check purchases vs events
  console.log('\n   Data consistency:')
  const purchaseTxHashes = new Set(purchases?.map(p => p.tx_hash))
  const eventTxHashes = new Set(events?.map(e => e.tx_hash))
  
  const purchasesNotInEvents = purchases?.filter(p => !eventTxHashes.has(p.tx_hash))?.length || 0
  const eventsNotInPurchases = events?.filter(e => !purchaseTxHashes.has(e.tx_hash))?.length || 0
  
  console.log(`     Purchases without matching event: ${purchasesNotInEvents}`)
  console.log(`     Events without matching purchase: ${eventsNotInPurchases}`)
  
  if (purchasesNotInEvents > 0) {
    issues.push(`${purchasesNotInEvents} purchases have no matching event`)
  }
  if (eventsNotInPurchases > 0) {
    issues.push(`${eventsNotInPurchases} events have no matching purchase`)
  }

  // ===== 4. DATA TOTALS VERIFICATION =====
  console.log('\n\n📊 4. DATA TOTALS')
  console.log('-'.repeat(70))
  
  const totalPurchaseUSD = purchases?.reduce((sum, p) => sum + (p.amount_usd || 0), 0) || 0
  const totalTipsUSD = purchases?.reduce((sum, p) => sum + (p.tip_usd || 0), 0) || 0
  const totalBDAG = purchases?.reduce((sum, p) => sum + (p.amount_bdag || 0), 0) || 0
  const totalTipsBDAG = purchases?.reduce((sum, p) => sum + (p.tip_bdag || 0), 0) || 0
  
  console.log(`   Total NFT purchases: $${totalPurchaseUSD.toFixed(2)} USD`)
  console.log(`   Total tips: $${totalTipsUSD.toFixed(2)} USD`)
  console.log(`   Grand total: $${(totalPurchaseUSD + totalTipsUSD).toFixed(2)} USD`)
  console.log(`   Total BDAG: ${totalBDAG.toFixed(2)} (+ ${totalTipsBDAG.toFixed(2)} tips)`)
  
  // Compare with submissions sold_count
  const totalSoldCount = submissions?.reduce((sum, s) => sum + (s.sold_count || 0), 0) || 0
  console.log(`\n   Submissions sold_count total: ${totalSoldCount}`)
  console.log(`   Purchases table count: ${purchases?.length || 0}`)
  
  if (totalSoldCount !== (purchases?.length || 0)) {
    const diff = Math.abs(totalSoldCount - (purchases?.length || 0))
    console.log(`   ⚠️ MISMATCH: Difference of ${diff}`)
    issues.push(`sold_count (${totalSoldCount}) doesn't match purchases (${purchases?.length})`)
  }

  // ===== 5. MISSING DATA RECOMMENDATIONS =====
  console.log('\n\n🔧 5. RECOMMENDATIONS')
  console.log('-'.repeat(70))
  
  // Check for data we should be capturing but aren't
  recommendations.push('Capture buyer email on all purchases for receipts')
  recommendations.push('Link purchases to user profiles via user_id when logged in')
  recommendations.push('Track payment method (crypto vs fiat) in purchases')
  recommendations.push('Record IP/location for fraud prevention')
  recommendations.push('Track referral source for marketing analytics')
  
  console.log('\n   Data to consider capturing:')
  recommendations.forEach(r => console.log(`     📌 ${r}`))

  // ===== SUMMARY =====
  console.log('\n\n' + '='.repeat(70))
  console.log('AUDIT SUMMARY')
  console.log('='.repeat(70))
  
  console.log(`\n🔴 Issues found: ${issues.length}`)
  issues.forEach(i => console.log(`   • ${i}`))
  
  console.log(`\n🟢 Data being captured:`)
  console.log(`   • ${profiles?.length} user profiles`)
  console.log(`   • ${submissions?.length} campaign submissions`)
  console.log(`   • ${purchases?.length} purchase records`)
  console.log(`   • ${events?.length} event logs`)
  console.log(`   • $${(totalPurchaseUSD + totalTipsUSD).toFixed(2)} total USD tracked`)
  
  console.log('\n✅ Audit complete!')
}

auditUserFlow().catch(console.error)
