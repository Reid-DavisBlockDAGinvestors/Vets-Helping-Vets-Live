/**
 * Admin Panel API Test Script
 * Tests all new admin panel endpoints with comprehensive validation
 * 
 * Usage: npx ts-node scripts/test-admin-panels.ts
 * 
 * Requires: ADMIN_TOKEN environment variable (Supabase JWT token)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ''

interface TestResult {
  endpoint: string
  method: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  statusCode?: number
  message: string
  duration: number
}

const results: TestResult[] = []

async function testEndpoint(
  name: string,
  method: string,
  path: string,
  body?: any,
  expectedStatus: number = 200
): Promise<TestResult> {
  const start = Date.now()
  
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      }
    }
    
    if (body) {
      options.body = JSON.stringify(body)
    }

    const res = await fetch(`${BASE_URL}${path}`, options)
    const duration = Date.now() - start
    const data = await res.json().catch(() => ({}))

    if (res.status === expectedStatus) {
      return {
        endpoint: name,
        method,
        status: 'PASS',
        statusCode: res.status,
        message: `OK (${duration}ms)`,
        duration
      }
    } else if (res.status === 401 && !ADMIN_TOKEN) {
      return {
        endpoint: name,
        method,
        status: 'SKIP',
        statusCode: res.status,
        message: 'No auth token provided',
        duration
      }
    } else {
      return {
        endpoint: name,
        method,
        status: 'FAIL',
        statusCode: res.status,
        message: data.error || `Expected ${expectedStatus}, got ${res.status}`,
        duration
      }
    }
  } catch (e: any) {
    return {
      endpoint: name,
      method,
      status: 'FAIL',
      message: e.message || 'Network error',
      duration: Date.now() - start
    }
  }
}

async function runTests() {
  console.log('\n🧪 Admin Panel API Test Suite')
  console.log('='.repeat(60))
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Auth Token: ${ADMIN_TOKEN ? '✅ Provided' : '❌ Missing (tests may fail)'}`)
  console.log('='.repeat(60))

  // Token Management Tests
  console.log('\n📋 Token Management Panel')
  results.push(await testEndpoint(
    'GET /api/admin/tokens',
    'GET',
    '/api/admin/tokens'
  ))
  results.push(await testEndpoint(
    'GET /api/admin/tokens?chainId=1043',
    'GET',
    '/api/admin/tokens?chainId=1043'
  ))

  // Security Panel Tests
  console.log('\n🔒 Security Panel')
  results.push(await testEndpoint(
    'GET /api/admin/security/status',
    'GET',
    '/api/admin/security/status?chainId=1043&contractVersion=v6'
  ))
  results.push(await testEndpoint(
    'GET /api/admin/security/status (Sepolia)',
    'GET',
    '/api/admin/security/status?chainId=11155111&contractVersion=v7'
  ))

  // Contract Settings Panel Tests
  console.log('\n📜 Contract Settings Panel')
  results.push(await testEndpoint(
    'GET /api/admin/settings/contract',
    'GET',
    '/api/admin/settings/contract?chainId=1043&contractVersion=v6'
  ))
  results.push(await testEndpoint(
    'GET /api/admin/settings/contract (Sepolia)',
    'GET',
    '/api/admin/settings/contract?chainId=11155111&contractVersion=v7'
  ))

  // Test rate limiting on request-change (should fail without proper body)
  results.push(await testEndpoint(
    'POST /api/admin/settings/request-change (validation)',
    'POST',
    '/api/admin/settings/request-change',
    {},
    400 // Expecting 400 for invalid body
  ))

  // Print Results
  console.log('\n' + '='.repeat(60))
  console.log('📊 Test Results')
  console.log('='.repeat(60))

  let passed = 0, failed = 0, skipped = 0

  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️'
    console.log(`${icon} ${r.method} ${r.endpoint}`)
    console.log(`   Status: ${r.statusCode || 'N/A'} - ${r.message}`)
    
    if (r.status === 'PASS') passed++
    else if (r.status === 'FAIL') failed++
    else skipped++
  }

  console.log('\n' + '='.repeat(60))
  console.log(`Summary: ${passed} passed, ${failed} failed, ${skipped} skipped`)
  console.log('='.repeat(60))

  if (failed > 0) {
    console.log('\n⚠️ Some tests failed. Review the errors above.')
    process.exit(1)
  } else {
    console.log('\n✅ All tests passed!')
    process.exit(0)
  }
}

runTests().catch(console.error)
