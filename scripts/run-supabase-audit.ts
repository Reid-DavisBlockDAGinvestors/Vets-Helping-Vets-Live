/**
 * Supabase Database Audit Script
 * Run with: npx ts-node scripts/run-supabase-audit.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function auditTable(tableName: string) {
  const { data, error, count } = await supabase
    .from(tableName)
    .select('*', { count: 'exact' })
    .limit(1)
  
  if (error) {
    return { exists: false, error: error.message }
  }
  
  return {
    exists: true,
    rowCount: count,
    columns: data?.[0] ? Object.keys(data[0]) : [],
    sample: data?.[0] || null
  }
}

async function main() {
  console.log('=' .repeat(60))
  console.log('SUPABASE DATABASE AUDIT')
  console.log('Timestamp:', new Date().toISOString())
  console.log('=' .repeat(60))
  console.log()

  const tables = [
    'submissions',
    'purchases', 
    'events',
    'profiles',
    'contracts',
    'chain_configs',
    'campaign_updates',
    'community_posts',
    'bug_reports',
    'governance_proposals',
    'contributions',
    'admin_requests',
    'email_templates'
  ]

  const issues: string[] = []
  const results: Record<string, any> = {}

  for (const table of tables) {
    const result = await auditTable(table)
    results[table] = result
    
    if (result.exists && result.columns) {
      console.log(`✅ ${table}: ${result.rowCount} rows, ${result.columns.length} columns`)
      console.log(`   Columns: ${result.columns.slice(0, 8).join(', ')}${result.columns.length > 8 ? '...' : ''}`)
    } else {
      console.log(`❌ ${table}: DOES NOT EXIST - ${result.error}`)
      issues.push(`${table}: TABLE MISSING`)
    }
    console.log()
  }

  // Check specific columns
  console.log('-'.repeat(60))
  console.log('COLUMN CHECKS')
  console.log('-'.repeat(60))
  
  // Submissions columns
  if (results.submissions?.exists) {
    const cols = results.submissions.columns
    const requiredCols = ['chain_id', 'chain_name', 'contract_version', 'contract_address', 'campaign_id', 'tx_hash']
    for (const col of requiredCols) {
      if (cols.includes(col)) {
        console.log(`✅ submissions.${col} exists`)
      } else {
        console.log(`❌ submissions.${col} MISSING`)
        issues.push(`submissions: missing ${col}`)
      }
    }
  }
  console.log()

  // Purchases columns
  if (results.purchases?.exists) {
    const cols = results.purchases.columns
    const requiredCols = ['chain_id', 'donor_note', 'donor_name', 'tip_bdag', 'tip_usd', 'contract_version']
    for (const col of requiredCols) {
      if (cols.includes(col)) {
        console.log(`✅ purchases.${col} exists`)
      } else {
        console.log(`❌ purchases.${col} MISSING`)
        issues.push(`purchases: missing ${col}`)
      }
    }
  }
  console.log()

  // Events columns
  if (results.events?.exists) {
    const cols = results.events.columns
    const requiredCols = ['chain_id', 'contract_version']
    for (const col of requiredCols) {
      if (cols.includes(col)) {
        console.log(`✅ events.${col} exists`)
      } else {
        console.log(`❌ events.${col} MISSING`)
        issues.push(`events: missing ${col}`)
      }
    }
  }

  // If contracts exists, show its data
  if (results.contracts?.exists) {
    console.log()
    console.log('-'.repeat(60))
    console.log('CONTRACTS TABLE DATA')
    console.log('-'.repeat(60))
    const { data: contracts } = await supabase.from('contracts').select('*')
    if (contracts) {
      for (const c of contracts) {
        console.log(`  ${c.version}: ${c.name} (chain_id: ${c.chain_id}, active: ${c.is_active})`)
      }
    }
  }

  // Summary
  console.log()
  console.log('='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))
  console.log(`Total Issues: ${issues.length}`)
  if (issues.length > 0) {
    console.log('Issues:')
    for (const issue of issues) {
      console.log(`  - ${issue}`)
    }
  } else {
    console.log('✅ All tables and columns are present!')
  }
  console.log()
}

main().catch(console.error)
