#!/usr/bin/env node
/**
 * BUILD-TIME BUG REPORT CHECKER
 * 
 * Run this before each build to review outstanding bug reports.
 * Usage: node scripts/check-bug-reports.js
 * 
 * Add to package.json scripts:
 *   "prebuild": "node scripts/check-bug-reports.js"
 */
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('\n🐛 BUG REPORT CHECK')
  console.log('='.repeat(60))
  console.log(`Date: ${new Date().toISOString()}\n`)

  // Fetch all unresolved bug reports
  const { data: reports, error } = await supabase
    .from('bug_reports')
    .select('*')
    .in('status', ['new', 'investigating', 'in_progress'])
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Failed to fetch bug reports:', error.message)
    process.exit(0) // Don't block build
  }

  if (!reports?.length) {
    console.log('✅ No outstanding bug reports! 🎉\n')
    return
  }

  // Group by priority
  const critical = reports.filter(r => r.priority === 'critical')
  const high = reports.filter(r => r.priority === 'high')
  const medium = reports.filter(r => r.priority === 'medium')
  const low = reports.filter(r => r.priority === 'low')

  console.log(`📊 SUMMARY: ${reports.length} unresolved bug reports`)
  console.log(`   🔴 Critical: ${critical.length}`)
  console.log(`   🟠 High: ${high.length}`)
  console.log(`   🟡 Medium: ${medium.length}`)
  console.log(`   🟢 Low: ${low.length}`)
  console.log('')

  // Display reports by priority
  const displayReports = (title, color, list) => {
    if (list.length === 0) return
    console.log(`${color} ${title}`)
    console.log('-'.repeat(60))
    for (const r of list) {
      console.log(`  📝 ${r.title}`)
      console.log(`     ID: ${r.id}`)
      console.log(`     Status: ${r.status} | Category: ${r.category}`)
      console.log(`     Reported: ${new Date(r.created_at).toLocaleDateString()}`)
      console.log(`     By: ${r.user_email || 'anonymous'}`)
      if (r.description) {
        const shortDesc = r.description.slice(0, 100).replace(/\n/g, ' ')
        console.log(`     Desc: ${shortDesc}${r.description.length > 100 ? '...' : ''}`)
      }
      console.log('')
    }
  }

  displayReports('CRITICAL BUGS - FIX IMMEDIATELY', '🔴', critical)
  displayReports('HIGH PRIORITY BUGS', '🟠', high)
  displayReports('MEDIUM PRIORITY BUGS', '🟡', medium)
  displayReports('LOW PRIORITY BUGS', '🟢', low)

  // Warn if there are critical bugs
  if (critical.length > 0) {
    console.log('⚠️  WARNING: There are CRITICAL bugs that should be fixed before deploying!')
    console.log('')
  }

  console.log('='.repeat(60))
  console.log('💡 To resolve bugs, update their status in the admin portal')
  console.log('   or use: node scripts/resolve-bug.js <bug-id>\n')
}

main().catch(console.error)
