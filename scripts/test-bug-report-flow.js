/**
 * TEST-DRIVEN VERIFICATION: Bug Report Flow
 * 
 * Tests the entire bug report flow:
 * 1. Database table exists
 * 2. Create bug report (simulates user submission)
 * 3. Query bug reports (simulates admin view)
 * 4. Update bug report status
 * 5. Cleanup test data
 * 
 * Run with: node scripts/test-bug-report-flow.js
 */
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const RESULTS = { passed: 0, failed: 0, tests: [] }

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

async function main() {
  console.log('🐛 BUG REPORT FLOW TEST SUITE')
  console.log('='.repeat(50))
  console.log(`Date: ${new Date().toISOString()}\n`)

  let testReportId = null

  // =========================================================================
  // TEST 1: Table exists
  // =========================================================================
  console.log('1️⃣ DATABASE TABLE')
  console.log('-'.repeat(40))
  
  const { data: tableCheck, error: tableError } = await supabase
    .from('bug_reports')
    .select('id')
    .limit(1)
  
  if (tableError) {
    fail('bug_reports table exists', tableError.message)
    console.log('\n❌ Cannot continue - table does not exist')
    return
  }
  pass('bug_reports table exists')

  // =========================================================================
  // TEST 2: Create bug report (user submission)
  // =========================================================================
  console.log('\n2️⃣ CREATE BUG REPORT (User Flow)')
  console.log('-'.repeat(40))
  
  const testReport = {
    title: 'Test Bug Report - TDD Verification',
    description: 'This is a test bug report created by the TDD test suite to verify the bug report flow works correctly.',
    steps_to_reproduce: '1. Run test script\n2. Observe results',
    expected_behavior: 'Bug report should be created successfully',
    category: 'general',
    page_url: 'http://localhost:3000/test',
    user_agent: 'TestScript/1.0',
    screen_size: '1920x1080',
    user_email: 'test@example.com',
    environment: 'test',
    tags: ['test', 'automated']
  }

  const { data: newReport, error: createError } = await supabase
    .from('bug_reports')
    .insert(testReport)
    .select()
    .single()

  if (createError) {
    fail('Create bug report', createError.message)
  } else {
    testReportId = newReport.id
    pass('Create bug report', `ID: ${testReportId.slice(0, 8)}...`)
    
    // Verify all fields
    if (newReport.status === 'new') pass('Default status is "new"')
    else fail('Default status', `Expected "new", got "${newReport.status}"`)
    
    if (newReport.priority === 'medium') pass('Default priority is "medium"')
    else fail('Default priority', `Expected "medium", got "${newReport.priority}"`)
    
    if (newReport.category === 'general') pass('Category stored correctly')
    else fail('Category', `Expected "general", got "${newReport.category}"`)
  }

  // =========================================================================
  // TEST 3: Query bug reports (admin view)
  // =========================================================================
  console.log('\n3️⃣ QUERY BUG REPORTS (Admin Flow)')
  console.log('-'.repeat(40))

  const { data: reports, count, error: queryError } = await supabase
    .from('bug_reports')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(10)

  if (queryError) {
    fail('Query bug reports', queryError.message)
  } else {
    pass('Query bug reports', `Found ${count} total`)
    
    // Verify our test report is in the results
    const found = reports?.find(r => r.id === testReportId)
    if (found) pass('Test report found in query results')
    else fail('Test report not found in query')
  }

  // Filter by status
  const { data: newReports, error: filterError } = await supabase
    .from('bug_reports')
    .select('id')
    .eq('status', 'new')

  if (filterError) {
    fail('Filter by status', filterError.message)
  } else {
    pass('Filter by status works', `${newReports?.length} new reports`)
  }

  // Filter by category
  const { data: categoryReports, error: catError } = await supabase
    .from('bug_reports')
    .select('id')
    .eq('category', 'general')

  if (catError) {
    fail('Filter by category', catError.message)
  } else {
    pass('Filter by category works', `${categoryReports?.length} general reports`)
  }

  // =========================================================================
  // TEST 4: Update bug report (admin action)
  // =========================================================================
  console.log('\n4️⃣ UPDATE BUG REPORT (Admin Action)')
  console.log('-'.repeat(40))

  if (testReportId) {
    // Update status
    const { error: updateError } = await supabase
      .from('bug_reports')
      .update({ 
        status: 'investigating',
        priority: 'high'
      })
      .eq('id', testReportId)

    if (updateError) {
      fail('Update status/priority', updateError.message)
    } else {
      pass('Update status to "investigating"')
      pass('Update priority to "high"')
    }

    // Verify update
    const { data: updated, error: verifyError } = await supabase
      .from('bug_reports')
      .select('status, priority')
      .eq('id', testReportId)
      .single()

    if (verifyError) {
      fail('Verify update', verifyError.message)
    } else {
      if (updated.status === 'investigating') pass('Status update verified')
      else fail('Status update verification', `Got "${updated.status}"`)
      
      if (updated.priority === 'high') pass('Priority update verified')
      else fail('Priority update verification', `Got "${updated.priority}"`)
    }

    // Test resolution
    const { error: resolveError } = await supabase
      .from('bug_reports')
      .update({
        status: 'resolved',
        resolution_notes: 'Test resolved successfully',
        resolved_at: new Date().toISOString()
      })
      .eq('id', testReportId)

    if (resolveError) {
      fail('Resolve bug report', resolveError.message)
    } else {
      pass('Resolve bug report')
    }
  }

  // =========================================================================
  // TEST 5: Delete test data (cleanup)
  // =========================================================================
  console.log('\n5️⃣ CLEANUP')
  console.log('-'.repeat(40))

  if (testReportId) {
    const { error: deleteError } = await supabase
      .from('bug_reports')
      .delete()
      .eq('id', testReportId)

    if (deleteError) {
      fail('Delete test report', deleteError.message)
    } else {
      pass('Test report cleaned up')
    }
  }

  // =========================================================================
  // TEST 6: Check for existing bug reports
  // =========================================================================
  console.log('\n6️⃣ EXISTING BUG REPORTS')
  console.log('-'.repeat(40))

  const { data: existingReports, error: existingError } = await supabase
    .from('bug_reports')
    .select('id, title, status, category, created_at, user_email')
    .order('created_at', { ascending: false })
    .limit(5)

  if (existingError) {
    fail('Query existing reports', existingError.message)
  } else if (existingReports?.length > 0) {
    console.log(`   📊 Found ${existingReports.length} existing bug reports:`)
    for (const r of existingReports) {
      console.log(`      • [${r.status}] ${r.title.slice(0, 40)}...`)
      console.log(`        Category: ${r.category} | From: ${r.user_email || 'anonymous'}`)
    }
  } else {
    console.log('   ℹ️ No existing bug reports (this is expected if none submitted yet)')
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n' + '='.repeat(50))
  console.log('TEST SUMMARY')
  console.log('='.repeat(50))
  console.log(`   ✅ Passed: ${RESULTS.passed}`)
  console.log(`   ❌ Failed: ${RESULTS.failed}`)
  console.log('')

  if (RESULTS.failed > 0) {
    console.log('❌ SOME TESTS FAILED')
    process.exit(1)
  } else {
    console.log('✅ ALL TESTS PASSED - Bug report flow is working!')
  }
}

main().catch(console.error)
