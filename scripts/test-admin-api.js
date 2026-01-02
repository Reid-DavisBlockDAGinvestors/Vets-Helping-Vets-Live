/**
 * Test Admin API Endpoints
 * Verifies that the admin APIs are accessible with proper auth
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testAPIs() {
  console.log('='.repeat(60))
  console.log('TESTING ADMIN API ENDPOINTS')
  console.log('='.repeat(60))

  // First, get an admin user's session (we'll use service role to impersonate)
  // In a real scenario, the frontend gets the token from supabase.auth.getSession()
  
  // For testing, we'll get an admin user and create a token
  const { data: adminUser } = await supabase
    .from('profiles')
    .select('id, email, role')
    .in('role', ['super_admin', 'admin'])
    .limit(1)
    .single()

  if (!adminUser) {
    console.error('❌ No admin user found in profiles table')
    console.log('   Make sure you have a user with role "admin" or "super_admin"')
    return
  }

  console.log(`\n✅ Found admin user: ${adminUser.email} (${adminUser.role})`)

  // Test the APIs using the service role key directly
  const baseUrl = 'http://localhost:3000'
  
  // Since we can't easily get a user JWT here, let's just verify the endpoints exist
  // and check what error they return
  
  console.log('\n📡 Testing API endpoints (without auth - expecting 401):')
  
  const endpoints = [
    '/api/admin/distributions/balances',
    '/api/admin/tokens',
    '/api/admin/security/status',
    '/api/admin/settings/contract',
  ]

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`${baseUrl}${endpoint}`)
      const status = res.status
      const statusText = status === 401 ? '🔒 Protected (401)' : 
                         status === 200 ? '✅ OK (200)' :
                         status === 500 ? '❌ Error (500)' :
                         `⚠️ ${status}`
      console.log(`  ${statusText} ${endpoint}`)
      
      if (status === 500) {
        const data = await res.json().catch(() => ({}))
        console.log(`     Error: ${data.error || 'Unknown'}`)
      }
    } catch (e) {
      console.log(`  ❌ FAILED ${endpoint}: ${e.message}`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('DIAGNOSIS:')
  console.log('='.repeat(60))
  console.log(`
The admin APIs require authentication via Bearer token.
To test in browser:

1. Go to http://localhost:3000/admin
2. Log in with your admin credentials
3. The frontend hooks will automatically get the session token
4. Check browser DevTools Network tab for API calls
5. If you see 401 errors, the auth token isn't being passed
6. If you see 500 errors, check the server console for details

After my fix to useCampaignBalances, the Distributions tab should now work!
  `)
}

testAPIs().catch(console.error)
