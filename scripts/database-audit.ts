/**
 * Database Audit Script
 * Comprehensive audit of Supabase database schema and data integrity
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ecwqzakvbkdywnfsrsfs.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

interface AuditResult {
  category: string
  check: string
  status: 'pass' | 'warn' | 'fail'
  details: string
  data?: any
}

const results: AuditResult[] = []

function log(result: AuditResult) {
  const icon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️' : '❌'
  console.log(`${icon} [${result.category}] ${result.check}: ${result.details}`)
  results.push(result)
}

async function auditTableExists(tableName: string): Promise<boolean> {
  const { data, error } = await supabase.from(tableName).select('*').limit(1)
  return !error
}

async function auditSubmissions() {
  console.log('\n📋 SUBMISSIONS TABLE AUDIT')
  console.log('─'.repeat(50))
  
  const { data: submissions, error, count } = await supabase
    .from('submissions')
    .select('*', { count: 'exact' })
  
  if (error) {
    log({ category: 'submissions', check: 'table_access', status: 'fail', details: error.message })
    return
  }
  
  log({ category: 'submissions', check: 'table_access', status: 'pass', details: `${count} total records` })
  
  // Check status distribution
  const statusCounts: Record<string, number> = {}
  for (const s of submissions || []) {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1
  }
  log({ category: 'submissions', check: 'status_distribution', status: 'pass', details: JSON.stringify(statusCounts) })
  
  // Check for orphaned campaigns (minted but no campaign_id)
  const mintedWithoutCampaign = (submissions || []).filter(s => s.status === 'minted' && !s.campaign_id)
  if (mintedWithoutCampaign.length > 0) {
    log({ category: 'submissions', check: 'orphaned_campaigns', status: 'warn', details: `${mintedWithoutCampaign.length} minted without campaign_id`, data: mintedWithoutCampaign.map(s => s.id) })
  } else {
    log({ category: 'submissions', check: 'orphaned_campaigns', status: 'pass', details: 'All minted submissions have campaign_id' })
  }
  
  // Check for missing required fields
  const missingMetadata = (submissions || []).filter(s => !s.metadata_uri && s.status !== 'pending')
  if (missingMetadata.length > 0) {
    log({ category: 'submissions', check: 'missing_metadata', status: 'warn', details: `${missingMetadata.length} non-pending submissions without metadata_uri` })
  } else {
    log({ category: 'submissions', check: 'missing_metadata', status: 'pass', details: 'All approved/minted have metadata' })
  }
  
  // Check contract addresses
  const contractCounts: Record<string, number> = {}
  for (const s of submissions || []) {
    if (s.contract_address) {
      const addr = s.contract_address.toLowerCase()
      contractCounts[addr] = (contractCounts[addr] || 0) + 1
    }
  }
  log({ category: 'submissions', check: 'contract_distribution', status: 'pass', details: JSON.stringify(contractCounts) })
}

async function auditProfiles() {
  console.log('\n👤 PROFILES TABLE AUDIT')
  console.log('─'.repeat(50))
  
  const { data: profiles, error, count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' })
  
  if (error) {
    log({ category: 'profiles', check: 'table_access', status: 'fail', details: error.message })
    return
  }
  
  log({ category: 'profiles', check: 'table_access', status: 'pass', details: `${count} total profiles` })
  
  // Check role distribution
  const roleCounts: Record<string, number> = {}
  for (const p of profiles || []) {
    roleCounts[p.role || 'user'] = (roleCounts[p.role || 'user'] || 0) + 1
  }
  log({ category: 'profiles', check: 'role_distribution', status: 'pass', details: JSON.stringify(roleCounts) })
  
  // Check for admins
  const admins = (profiles || []).filter(p => ['admin', 'super_admin'].includes(p.role))
  log({ category: 'profiles', check: 'admin_count', status: admins.length > 0 ? 'pass' : 'warn', details: `${admins.length} admins found` })
}

async function auditPurchases() {
  console.log('\n💰 PURCHASES TABLE AUDIT')
  console.log('─'.repeat(50))
  
  const { data: purchases, error, count } = await supabase
    .from('purchases')
    .select('*', { count: 'exact' })
  
  if (error) {
    log({ category: 'purchases', check: 'table_access', status: 'fail', details: error.message })
    return
  }
  
  log({ category: 'purchases', check: 'table_access', status: 'pass', details: `${count} total purchases` })
  
  // Calculate total raised
  const totalUSD = (purchases || []).reduce((sum, p) => sum + (p.amount_usd || 0), 0)
  const totalBDAG = (purchases || []).reduce((sum, p) => sum + (p.amount_bdag || 0), 0)
  log({ category: 'purchases', check: 'total_raised', status: 'pass', details: `$${totalUSD.toFixed(2)} USD, ${totalBDAG.toFixed(2)} BDAG` })
  
  // Check payment methods
  const methodCounts: Record<string, number> = {}
  for (const p of purchases || []) {
    methodCounts[p.payment_method || 'unknown'] = (methodCounts[p.payment_method || 'unknown'] || 0) + 1
  }
  log({ category: 'purchases', check: 'payment_methods', status: 'pass', details: JSON.stringify(methodCounts) })
}

async function auditEvents() {
  console.log('\n📊 EVENTS TABLE AUDIT')
  console.log('─'.repeat(50))
  
  const { data: events, error, count } = await supabase
    .from('events')
    .select('*', { count: 'exact' })
  
  if (error) {
    log({ category: 'events', check: 'table_access', status: 'fail', details: error.message })
    return
  }
  
  log({ category: 'events', check: 'table_access', status: 'pass', details: `${count} total events` })
  
  // Event type distribution
  const typeCounts: Record<string, number> = {}
  for (const e of events || []) {
    typeCounts[e.event_type || 'unknown'] = (typeCounts[e.event_type || 'unknown'] || 0) + 1
  }
  log({ category: 'events', check: 'event_types', status: 'pass', details: JSON.stringify(typeCounts) })
}

async function auditCampaignUpdates() {
  console.log('\n📝 CAMPAIGN_UPDATES TABLE AUDIT')
  console.log('─'.repeat(50))
  
  const { data: updates, error, count } = await supabase
    .from('campaign_updates')
    .select('*', { count: 'exact' })
  
  if (error) {
    log({ category: 'campaign_updates', check: 'table_access', status: 'fail', details: error.message })
    return
  }
  
  log({ category: 'campaign_updates', check: 'table_access', status: 'pass', details: `${count} total updates` })
  
  // Status distribution
  const statusCounts: Record<string, number> = {}
  for (const u of updates || []) {
    statusCounts[u.status || 'unknown'] = (statusCounts[u.status || 'unknown'] || 0) + 1
  }
  log({ category: 'campaign_updates', check: 'status_distribution', status: 'pass', details: JSON.stringify(statusCounts) })
}

async function auditMarketplaceContracts() {
  console.log('\n📜 MARKETPLACE_CONTRACTS TABLE AUDIT')
  console.log('─'.repeat(50))
  
  const { data: contracts, error } = await supabase
    .from('marketplace_contracts')
    .select('*')
  
  if (error) {
    log({ category: 'marketplace_contracts', check: 'table_access', status: 'fail', details: error.message })
    return
  }
  
  log({ category: 'marketplace_contracts', check: 'table_access', status: 'pass', details: `${contracts?.length || 0} contracts configured` })
  
  const enabled = (contracts || []).filter(c => c.enabled)
  log({ category: 'marketplace_contracts', check: 'enabled_contracts', status: enabled.length > 0 ? 'pass' : 'warn', details: enabled.map(c => c.contract_address?.slice(0, 10) + '...').join(', ') || 'None' })
}

async function auditDataConsistency() {
  console.log('\n🔗 DATA CONSISTENCY AUDIT')
  console.log('─'.repeat(50))
  
  // Check submissions vs purchases consistency
  const { data: submissions } = await supabase.from('submissions').select('id, campaign_id, sold_count').eq('status', 'minted')
  const { data: purchases } = await supabase.from('purchases').select('campaign_id')
  
  if (submissions && purchases) {
    const purchaseCountByCampaign: Record<string, number> = {}
    for (const p of purchases) {
      if (p.campaign_id) {
        purchaseCountByCampaign[p.campaign_id] = (purchaseCountByCampaign[p.campaign_id] || 0) + 1
      }
    }
    
    let mismatches = 0
    for (const s of submissions) {
      const dbCount = s.sold_count || 0
      const actualCount = purchaseCountByCampaign[s.campaign_id] || 0
      if (dbCount !== actualCount) {
        mismatches++
        console.log(`  📌 Campaign ${s.campaign_id}: sold_count=${dbCount}, actual purchases=${actualCount}`)
      }
    }
    
    if (mismatches > 0) {
      log({ category: 'consistency', check: 'sold_count_accuracy', status: 'warn', details: `${mismatches} campaigns with mismatched sold_count` })
    } else {
      log({ category: 'consistency', check: 'sold_count_accuracy', status: 'pass', details: 'All sold_counts match purchase records' })
    }
  }
}

async function main() {
  console.log('🔍 PATRIOTPLEDGE DATABASE AUDIT')
  console.log('═'.repeat(50))
  console.log(`Supabase URL: ${supabaseUrl}`)
  console.log(`Timestamp: ${new Date().toISOString()}`)
  
  await auditSubmissions()
  await auditProfiles()
  await auditPurchases()
  await auditEvents()
  await auditCampaignUpdates()
  await auditMarketplaceContracts()
  await auditDataConsistency()
  
  console.log('\n' + '═'.repeat(50))
  console.log('📊 AUDIT SUMMARY')
  console.log('═'.repeat(50))
  
  const passed = results.filter(r => r.status === 'pass').length
  const warned = results.filter(r => r.status === 'warn').length
  const failed = results.filter(r => r.status === 'fail').length
  
  console.log(`✅ Passed: ${passed}`)
  console.log(`⚠️ Warnings: ${warned}`)
  console.log(`❌ Failed: ${failed}`)
  
  if (warned > 0) {
    console.log('\n⚠️ WARNINGS:')
    results.filter(r => r.status === 'warn').forEach(r => {
      console.log(`  - [${r.category}] ${r.check}: ${r.details}`)
    })
  }
  
  if (failed > 0) {
    console.log('\n❌ FAILURES:')
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`  - [${r.category}] ${r.check}: ${r.details}`)
    })
  }
}

main().catch(console.error)
