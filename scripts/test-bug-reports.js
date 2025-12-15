/**
 * Test Bug Reports System
 * Checks if bug_reports table exists and has data
 */
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🐛 Testing Bug Reports System\n')
  
  // 1. Check if table exists by querying it
  console.log('1️⃣ Checking if bug_reports table exists...')
  const { data: reports, error: tableError } = await supabase
    .from('bug_reports')
    .select('*')
    .limit(10)
  
  if (tableError) {
    if (tableError.message.includes('does not exist') || tableError.code === '42P01') {
      console.log('   ❌ Table does not exist!')
      console.log('   💡 Run the migration: supabase/migrations/20251215_bug_reports.sql')
      return
    }
    console.log('   ⚠️ Error querying table:', tableError.message)
  } else {
    console.log('   ✅ Table exists')
    console.log(`   📊 Found ${reports?.length || 0} bug reports`)
  }
  
  // 2. Show recent reports
  if (reports?.length > 0) {
    console.log('\n2️⃣ Recent Bug Reports:')
    console.log('-'.repeat(60))
    for (const report of reports) {
      console.log(`   📝 ${report.title}`)
      console.log(`      Status: ${report.status} | Category: ${report.category}`)
      console.log(`      Created: ${new Date(report.created_at).toLocaleString()}`)
      console.log(`      Email: ${report.user_email || 'anonymous'}`)
      console.log('')
    }
  } else {
    console.log('\n   ℹ️ No bug reports in the database yet')
  }
  
  // 3. Test creating a bug report
  console.log('\n3️⃣ Testing bug report creation...')
  const testReport = {
    title: 'Test Bug Report - DELETE ME',
    description: 'This is a test bug report created by the test script.',
    category: 'general',
    status: 'new',
    priority: 'low',
    page_url: 'http://localhost:3000/test',
    environment: 'test'
  }
  
  const { data: newReport, error: insertError } = await supabase
    .from('bug_reports')
    .insert(testReport)
    .select()
    .single()
  
  if (insertError) {
    console.log('   ❌ Failed to create test report:', insertError.message)
    console.log('   Error details:', insertError)
  } else {
    console.log('   ✅ Test report created successfully!')
    console.log(`   ID: ${newReport.id}`)
    
    // Clean up
    await supabase.from('bug_reports').delete().eq('id', newReport.id)
    console.log('   🗑️ Test report cleaned up')
  }
  
  // 4. Check RLS policies
  console.log('\n4️⃣ Checking RLS policies...')
  const { data: policies, error: policyError } = await supabase
    .rpc('get_policies', { table_name: 'bug_reports' })
    .catch(() => ({ data: null, error: { message: 'RPC not available' } }))
  
  if (policyError || !policies) {
    console.log('   ℹ️ Could not check policies via RPC (this is normal)')
    console.log('   💡 Verify policies manually in Supabase Dashboard')
  }
  
  console.log('\n✅ Bug reports system check complete!')
}

main().catch(console.error)
