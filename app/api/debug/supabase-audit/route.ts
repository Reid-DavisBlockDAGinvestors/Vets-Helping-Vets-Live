import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Full Supabase Database Audit
 * Checks all tables, columns, row counts, and identifies issues
 */
export async function GET(req: NextRequest) {
  try {
    const audit: any = {
      timestamp: new Date().toISOString(),
      tables: {},
      issues: [],
      summary: {}
    }

    // 1. Check SUBMISSIONS table
    const { data: submissions, error: subErr } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .limit(1)
    
    if (subErr) {
      audit.tables.submissions = { error: subErr.message }
    } else {
      const { count } = await supabaseAdmin.from('submissions').select('*', { count: 'exact', head: true })
      const sample = submissions?.[0] || {}
      audit.tables.submissions = {
        exists: true,
        rowCount: count,
        columns: Object.keys(sample),
        hasChainId: 'chain_id' in sample,
        hasChainName: 'chain_name' in sample,
        hasContractVersion: 'contract_version' in sample,
        hasContractAddress: 'contract_address' in sample,
        hasCampaignId: 'campaign_id' in sample,
        hasTxHash: 'tx_hash' in sample
      }
      if (!('chain_id' in sample)) audit.issues.push('submissions: missing chain_id column')
      if (!('chain_name' in sample)) audit.issues.push('submissions: missing chain_name column')
    }

    // 2. Check PURCHASES table
    const { data: purchases, error: purErr } = await supabaseAdmin
      .from('purchases')
      .select('*')
      .limit(1)
    
    if (purErr) {
      audit.tables.purchases = { error: purErr.message }
    } else {
      const { count } = await supabaseAdmin.from('purchases').select('*', { count: 'exact', head: true })
      const sample = purchases?.[0] || {}
      audit.tables.purchases = {
        exists: true,
        rowCount: count,
        columns: Object.keys(sample),
        hasChainId: 'chain_id' in sample,
        hasDonorNote: 'donor_note' in sample,
        hasDonorName: 'donor_name' in sample,
        hasTipBdag: 'tip_bdag' in sample,
        hasTipUsd: 'tip_usd' in sample,
        hasContractVersion: 'contract_version' in sample
      }
      if (!('chain_id' in sample)) audit.issues.push('purchases: missing chain_id column')
      if (!('donor_note' in sample)) audit.issues.push('purchases: missing donor_note column')
      if (!('donor_name' in sample)) audit.issues.push('purchases: missing donor_name column')
    }

    // 3. Check EVENTS table
    const { data: events, error: evtErr } = await supabaseAdmin
      .from('events')
      .select('*')
      .limit(1)
    
    if (evtErr) {
      audit.tables.events = { error: evtErr.message }
    } else {
      const { count } = await supabaseAdmin.from('events').select('*', { count: 'exact', head: true })
      const sample = events?.[0] || {}
      audit.tables.events = {
        exists: true,
        rowCount: count,
        columns: Object.keys(sample),
        hasChainId: 'chain_id' in sample,
        hasContractVersion: 'contract_version' in sample
      }
      if (!('chain_id' in sample)) audit.issues.push('events: missing chain_id column')
    }

    // 4. Check PROFILES table
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .limit(1)
    
    if (profErr) {
      audit.tables.profiles = { error: profErr.message }
    } else {
      const { count } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true })
      const sample = profiles?.[0] || {}
      audit.tables.profiles = {
        exists: true,
        rowCount: count,
        columns: Object.keys(sample)
      }
    }

    // 5. Check CONTRACTS table
    const { data: contracts, error: conErr } = await supabaseAdmin
      .from('contracts')
      .select('*')
    
    if (conErr) {
      audit.tables.contracts = { exists: false, error: conErr.message }
      audit.issues.push('contracts: TABLE DOES NOT EXIST - needs to be created')
    } else {
      audit.tables.contracts = {
        exists: true,
        rowCount: contracts?.length || 0,
        data: contracts,
        columns: contracts?.[0] ? Object.keys(contracts[0]) : []
      }
    }

    // 6. Check CHAIN_CONFIGS table
    const { data: chainConfigs, error: chainErr } = await supabaseAdmin
      .from('chain_configs')
      .select('*')
    
    if (chainErr) {
      audit.tables.chain_configs = { exists: false, error: chainErr.message }
      audit.issues.push('chain_configs: TABLE DOES NOT EXIST - needs to be created')
    } else {
      audit.tables.chain_configs = {
        exists: true,
        rowCount: chainConfigs?.length || 0,
        data: chainConfigs
      }
    }

    // 7. Check CAMPAIGN_UPDATES table
    const { data: updates, error: updErr } = await supabaseAdmin
      .from('campaign_updates')
      .select('*')
      .limit(1)
    
    if (updErr) {
      audit.tables.campaign_updates = { error: updErr.message }
    } else {
      const { count } = await supabaseAdmin.from('campaign_updates').select('*', { count: 'exact', head: true })
      audit.tables.campaign_updates = {
        exists: true,
        rowCount: count,
        columns: updates?.[0] ? Object.keys(updates[0]) : []
      }
    }

    // 8. Check COMMUNITY_POSTS table
    const { data: posts, error: postsErr } = await supabaseAdmin
      .from('community_posts')
      .select('*')
      .limit(1)
    
    if (postsErr) {
      audit.tables.community_posts = { exists: false, error: postsErr.message }
    } else {
      const { count } = await supabaseAdmin.from('community_posts').select('*', { count: 'exact', head: true })
      audit.tables.community_posts = {
        exists: true,
        rowCount: count,
        columns: posts?.[0] ? Object.keys(posts[0]) : []
      }
    }

    // 9. Check BUG_REPORTS table
    const { data: bugs, error: bugErr } = await supabaseAdmin
      .from('bug_reports')
      .select('*')
      .limit(1)
    
    if (bugErr) {
      audit.tables.bug_reports = { exists: false, error: bugErr.message }
    } else {
      const { count } = await supabaseAdmin.from('bug_reports').select('*', { count: 'exact', head: true })
      audit.tables.bug_reports = {
        exists: true,
        rowCount: count,
        columns: bugs?.[0] ? Object.keys(bugs[0]) : []
      }
    }

    // 10. Check GOVERNANCE_PROPOSALS table
    const { data: proposals, error: propErr } = await supabaseAdmin
      .from('governance_proposals')
      .select('*')
      .limit(1)
    
    if (propErr) {
      audit.tables.governance_proposals = { exists: false, error: propErr.message }
    } else {
      const { count } = await supabaseAdmin.from('governance_proposals').select('*', { count: 'exact', head: true })
      audit.tables.governance_proposals = {
        exists: true,
        rowCount: count,
        columns: proposals?.[0] ? Object.keys(proposals[0]) : []
      }
    }

    // Summary
    const tableNames = Object.keys(audit.tables)
    const existingTables = tableNames.filter(t => audit.tables[t].exists !== false)
    const missingTables = tableNames.filter(t => audit.tables[t].exists === false)
    
    audit.summary = {
      totalTablesChecked: tableNames.length,
      existingTables: existingTables.length,
      missingTables: missingTables,
      issueCount: audit.issues.length,
      status: audit.issues.length === 0 ? '✅ ALL GOOD' : '⚠️ ISSUES FOUND'
    }

    return NextResponse.json(audit, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ 
      error: 'AUDIT_FAILED', 
      details: e?.message 
    }, { status: 500 })
  }
}
