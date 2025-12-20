/**
 * Test production API to diagnose why NFTs aren't loading
 */

const PROD_URL = 'https://vetshelpingvets.life'
const WALLET = '0x07b3c4BB8842a9eE0698F1A3c6778bcC456d9362'

async function testEndpoint(name, url) {
  console.log(`\n=== Testing: ${name} ===`)
  console.log(`URL: ${url}`)
  
  const start = Date.now()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    
    const res = await fetch(url, { 
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    })
    clearTimeout(timeout)
    
    const elapsed = Date.now() - start
    console.log(`Status: ${res.status} (${elapsed}ms)`)
    
    if (res.ok) {
      const data = await res.json()
      console.log('Response keys:', Object.keys(data))
      
      if (data.nfts) {
        console.log(`NFTs count: ${data.nfts.length}`)
        console.log(`Balance: ${data.balance}`)
      }
      if (data.error) {
        console.log(`Error: ${data.error}`)
        console.log(`Details: ${data.details}`)
      }
      return data
    } else {
      const text = await res.text()
      console.log('Error response:', text.slice(0, 200))
      return null
    }
  } catch (e) {
    const elapsed = Date.now() - start
    console.log(`FAILED (${elapsed}ms):`, e.message)
    return null
  }
}

async function main() {
  console.log('===========================================')
  console.log('Production API Diagnostic Test')
  console.log('===========================================')
  
  // Test 1: Simple health check
  await testEndpoint('Health Check', `${PROD_URL}/api/health`)
  
  // Test 2: Analytics summary (simple endpoint)
  await testEndpoint('Analytics Summary', `${PROD_URL}/api/analytics/summary`)
  
  // Test 3: Wallet NFTs (the problematic endpoint)
  await testEndpoint('Wallet NFTs', `${PROD_URL}/api/wallet/nfts?address=${WALLET}`)
  
  // Test 4: Check if there's a simpler debug endpoint
  await testEndpoint('Debug NFT', `${PROD_URL}/api/debug/nft/124`)
  
  console.log('\n=== Done ===')
}

main().catch(console.error)
