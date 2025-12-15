/**
 * Test Submission API - Debug submission errors
 */
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const BASE_URL = 'http://localhost:3000'

async function testSubmissionAPI() {
  console.log('📝 SUBMISSION API TEST')
  console.log('='.repeat(50))

  // 1. Check if user is logged in and email verified
  console.log('\n1️⃣ Checking user authentication requirements...')
  
  // Get the admin user to simulate auth
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('role', 'super_admin')
    .single()
  
  if (!adminProfile) {
    console.log('   ❌ No super_admin user found')
    return
  }
  console.log('   ✅ Found super_admin user:', adminProfile.id)

  // 2. Check what's required for submission
  console.log('\n2️⃣ Submission API requirements:')
  console.log('   Required fields:')
  console.log('   - title (non-empty)')
  console.log('   - background OR need (story)')
  console.log('   - firstName + lastName')
  console.log('   - phone')
  console.log('   - email')
  console.log('   - image')
  console.log('   - metadata_uri (generated from preview)')
  console.log('   - Auth token (logged in user)')
  console.log('   - Email verified')

  // 3. Check recent submission errors in logs
  console.log('\n3️⃣ Checking recent submissions...')
  const { data: recentSubs, error: subError } = await supabase
    .from('submissions')
    .select('id, title, status, created_at, creator_email')
    .order('created_at', { ascending: false })
    .limit(5)

  if (subError) {
    console.log('   ❌ Error:', subError.message)
  } else {
    console.log(`   Found ${recentSubs?.length || 0} recent submissions:`)
    for (const s of recentSubs || []) {
      console.log(`      • [${s.status}] ${s.title?.slice(0, 30)}... by ${s.creator_email || 'unknown'}`)
    }
  }

  // 4. Test submission API endpoint directly (without auth - expect error)
  console.log('\n4️⃣ Testing submission API without auth (should fail)...')
  try {
    const res = await fetch(`${BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Submission',
        story: 'Test story',
        metadata_uri: 'ipfs://test'
      })
    })
    const data = await res.json()
    console.log(`   Status: ${res.status}`)
    console.log(`   Response: ${JSON.stringify(data)}`)
    if (res.status === 401 && data.error === 'AUTHENTICATION_REQUIRED') {
      console.log('   ✅ Auth check working correctly')
    }
  } catch (e) {
    console.log('   ❌ Request failed:', e.message)
  }

  // 5. Common submission errors
  console.log('\n5️⃣ Common submission errors and causes:')
  console.log('   • AUTHENTICATION_REQUIRED - User not logged in')
  console.log('   • EMAIL_NOT_VERIFIED - User logged in but email not verified')
  console.log('   • MISSING_METADATA_URI - Preview not generated first')
  console.log('   • Network/IPFS errors - Pinata upload failed')

  // 6. Check Pinata config
  console.log('\n6️⃣ Checking Pinata configuration...')
  const pinataJwt = process.env.PINATA_JWT
  if (pinataJwt) {
    console.log('   ✅ PINATA_JWT is configured')
    console.log(`   JWT starts with: ${pinataJwt.slice(0, 20)}...`)
  } else {
    console.log('   ❌ PINATA_JWT not configured - IPFS uploads will fail!')
  }

  console.log('\n' + '='.repeat(50))
  console.log('💡 To debug user submission error:')
  console.log('   1. Check browser console for error messages')
  console.log('   2. Check if user is logged in')
  console.log('   3. Check if user email is verified')
  console.log('   4. Check if preview was generated before submit')
}

testSubmissionAPI().catch(console.error)
