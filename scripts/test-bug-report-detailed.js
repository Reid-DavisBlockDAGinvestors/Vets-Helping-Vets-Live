/**
 * Detailed Bug Report Flow Test
 * Tests every step of the bug report submission process
 */
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const BASE_URL = 'http://localhost:3000'

async function testBugReportAPI() {
  console.log('🐛 DETAILED BUG REPORT API TEST')
  console.log('='.repeat(50))

  // Test 1: Check if bug_reports table exists and structure
  console.log('\n1️⃣ Checking bug_reports table structure...')
  const { data: tableInfo, error: tableError } = await supabase
    .from('bug_reports')
    .select('*')
    .limit(0)
  
  if (tableError) {
    console.log('   ❌ Table error:', tableError.message)
    if (tableError.code === '42P01') {
      console.log('   💡 Table does not exist! Run the migration.')
    }
    return
  }
  console.log('   ✅ Table exists')

  // Test 2: Direct database insert (bypassing API)
  console.log('\n2️⃣ Testing direct database insert...')
  const testReport = {
    title: 'Direct DB Test Report',
    description: 'Testing direct insert to verify table works',
    category: 'general',
    status: 'new',
    priority: 'medium',
    page_url: 'http://test',
    environment: 'test'
  }
  
  const { data: directInsert, error: insertError } = await supabase
    .from('bug_reports')
    .insert(testReport)
    .select()
    .single()
  
  if (insertError) {
    console.log('   ❌ Insert error:', insertError.message)
    console.log('   Details:', JSON.stringify(insertError, null, 2))
  } else {
    console.log('   ✅ Direct insert works, ID:', directInsert.id)
    // Clean up
    await supabase.from('bug_reports').delete().eq('id', directInsert.id)
    console.log('   🗑️ Cleaned up test report')
  }

  // Test 3: API POST request
  console.log('\n3️⃣ Testing API POST /api/bug-reports...')
  try {
    const apiReport = {
      title: 'API Test Report',
      description: 'Testing API endpoint',
      category: 'submission',
      page_url: 'http://localhost:3000/submit'
    }
    
    const res = await fetch(`${BASE_URL}/api/bug-reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiReport)
    })
    
    console.log('   Response status:', res.status)
    const data = await res.json()
    console.log('   Response body:', JSON.stringify(data, null, 2))
    
    if (res.ok && data.success) {
      console.log('   ✅ API POST works!')
      // Clean up
      if (data.id) {
        await supabase.from('bug_reports').delete().eq('id', data.id)
        console.log('   🗑️ Cleaned up API test report')
      }
    } else {
      console.log('   ❌ API POST failed')
    }
  } catch (e) {
    console.log('   ❌ Fetch error:', e.message)
  }

  // Test 4: Check all bug reports in DB
  console.log('\n4️⃣ Checking all bug reports in database...')
  const { data: allReports, error: listError } = await supabase
    .from('bug_reports')
    .select('id, title, status, category, created_at, user_email')
    .order('created_at', { ascending: false })
  
  if (listError) {
    console.log('   ❌ List error:', listError.message)
  } else {
    console.log(`   📊 Total reports in DB: ${allReports?.length || 0}`)
    if (allReports?.length > 0) {
      console.log('   Reports:')
      for (const r of allReports) {
        console.log(`      • [${r.status}] ${r.title}`)
        console.log(`        ID: ${r.id}`)
        console.log(`        Created: ${r.created_at}`)
      }
    }
  }

  // Test 5: Test admin GET endpoint simulation
  console.log('\n5️⃣ Simulating admin fetch (what AdminBugReports does)...')
  const { data: adminView, count, error: adminError } = await supabase
    .from('bug_reports')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 49)
  
  if (adminError) {
    console.log('   ❌ Admin view error:', adminError.message)
  } else {
    console.log(`   ✅ Admin view works: ${count} total reports`)
  }

  console.log('\n' + '='.repeat(50))
  console.log('✅ Bug report detailed test complete')
}

testBugReportAPI().catch(console.error)
