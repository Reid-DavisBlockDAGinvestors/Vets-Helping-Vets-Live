#!/usr/bin/env node
/**
 * Test Wallet Metadata Display - Diagnose why MetaMask isn't showing NFT metadata
 * 
 * ERC-721 Metadata Standard Requirements:
 * - tokenURI should return a URL to a JSON file
 * - JSON must have: name, description, image
 * - image should be a direct URL to an image file
 * - MetaMask resolves IPFS via its built-in gateway
 */
require('dotenv').config({ path: '.env.local' })
const { ethers } = require('ethers')

const CONTRACT_ADDRESS = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const TOKEN_ID = 256  // The token showing issues in MetaMask

const ABI = [
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function getEditionInfo(uint256 tokenId) view returns (uint256 campaignId, uint256 editionNumber, uint256 totalEditions)',
  'function getCampaign(uint256 campaignId) view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)'
]

// Multiple IPFS gateways to test accessibility
const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
  'https://w3s.link/ipfs/'
]

function getProvider() {
  const rpc = process.env.BLOCKDAG_RPC || 'https://rpc.awakening.bdagscan.com'
  const nowNodesKey = process.env.NOWNODES_API_KEY
  
  if (rpc.includes('nownodes.io') && nowNodesKey) {
    const fetchReq = new ethers.FetchRequest(rpc)
    fetchReq.setHeader('api-key', nowNodesKey)
    return new ethers.JsonRpcProvider(fetchReq, undefined, { staticNetwork: true })
  }
  
  return new ethers.JsonRpcProvider(rpc, undefined, { staticNetwork: true })
}

function ipfsToHttp(uri, gateway = IPFS_GATEWAYS[0]) {
  if (!uri) return null
  if (uri.startsWith('ipfs://')) {
    return gateway + uri.slice(7)
  }
  return uri
}

async function fetchWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    const res = await fetch(url, { 
      signal: controller.signal,
      headers: { 
        'Accept': 'application/json, image/*',
        'User-Agent': 'Mozilla/5.0 (compatible; NFT-Metadata-Test/1.0)'
      }
    })
    clearTimeout(timeout)
    return res
  } catch (e) {
    clearTimeout(timeout)
    throw e
  }
}

async function main() {
  console.log('🔍 METAMASK METADATA DISPLAY DIAGNOSIS')
  console.log('='.repeat(70))
  console.log(`Contract: ${CONTRACT_ADDRESS}`)
  console.log(`Token ID: ${TOKEN_ID}`)
  console.log('')
  
  const provider = getProvider()
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider)
  
  // Step 1: Verify token exists and get owner
  console.log('📋 STEP 1: Token Existence Check')
  console.log('-'.repeat(70))
  let owner
  try {
    owner = await contract.ownerOf(TOKEN_ID)
    console.log(`✅ Token exists`)
    console.log(`   Owner: ${owner}`)
  } catch (e) {
    console.log(`❌ Token does not exist: ${e.message}`)
    return
  }
  
  // Step 2: Get tokenURI
  console.log('\n📋 STEP 2: TokenURI Check')
  console.log('-'.repeat(70))
  let tokenUri
  try {
    tokenUri = await contract.tokenURI(TOKEN_ID)
    console.log(`✅ TokenURI retrieved`)
    console.log(`   Raw URI: ${tokenUri}`)
    
    if (!tokenUri || tokenUri === '') {
      console.log(`❌ CRITICAL: TokenURI is EMPTY!`)
      console.log(`   This is why MetaMask shows no image.`)
      console.log(`   FIX: Call updateCampaignMetadata() to set a valid URI`)
      return
    }
    
    // Check URI format
    if (tokenUri.startsWith('ipfs://')) {
      console.log(`   Format: IPFS protocol URI ✅`)
      console.log(`   CID: ${tokenUri.slice(7)}`)
    } else if (tokenUri.startsWith('http://') || tokenUri.startsWith('https://')) {
      console.log(`   Format: HTTP URL`)
    } else if (tokenUri.startsWith('data:')) {
      console.log(`   Format: Data URI (base64)`)
    } else {
      console.log(`   ⚠️ Format: Unknown - may cause issues`)
    }
  } catch (e) {
    console.log(`❌ Error getting tokenURI: ${e.message}`)
    return
  }
  
  // Step 3: Test IPFS gateway accessibility
  console.log('\n📋 STEP 3: IPFS Gateway Accessibility')
  console.log('-'.repeat(70))
  
  if (tokenUri.startsWith('ipfs://')) {
    const cid = tokenUri.slice(7)
    console.log(`Testing accessibility of CID: ${cid.slice(0, 20)}...`)
    console.log('')
    
    for (const gateway of IPFS_GATEWAYS) {
      const url = gateway + cid
      try {
        const start = Date.now()
        const res = await fetchWithTimeout(url, 15000)
        const elapsed = Date.now() - start
        
        if (res.ok) {
          const contentType = res.headers.get('content-type')
          console.log(`✅ ${gateway.replace('https://', '').slice(0, 25).padEnd(25)} | ${elapsed}ms | ${contentType}`)
        } else {
          console.log(`❌ ${gateway.replace('https://', '').slice(0, 25).padEnd(25)} | HTTP ${res.status}`)
        }
      } catch (e) {
        console.log(`❌ ${gateway.replace('https://', '').slice(0, 25).padEnd(25)} | ${e.message.slice(0, 30)}`)
      }
    }
  }
  
  // Step 4: Fetch and validate metadata JSON
  console.log('\n📋 STEP 4: Metadata JSON Validation')
  console.log('-'.repeat(70))
  
  const metadataUrl = ipfsToHttp(tokenUri)
  console.log(`Fetching from: ${metadataUrl.slice(0, 60)}...`)
  
  let metadata
  try {
    const res = await fetchWithTimeout(metadataUrl)
    if (!res.ok) {
      console.log(`❌ Failed to fetch metadata: HTTP ${res.status}`)
      return
    }
    
    const contentType = res.headers.get('content-type')
    console.log(`   Content-Type: ${contentType}`)
    
    if (!contentType?.includes('json')) {
      console.log(`⚠️ Warning: Content-Type is not application/json`)
      console.log(`   MetaMask expects JSON metadata`)
    }
    
    metadata = await res.json()
    console.log(`✅ Metadata JSON parsed successfully`)
  } catch (e) {
    console.log(`❌ Failed to parse metadata: ${e.message}`)
    return
  }
  
  // Step 5: Validate ERC-721 metadata fields
  console.log('\n📋 STEP 5: ERC-721 Metadata Standard Compliance')
  console.log('-'.repeat(70))
  
  const requiredFields = ['name', 'description', 'image']
  const optionalFields = ['external_url', 'attributes', 'background_color', 'animation_url']
  
  console.log('Required fields:')
  for (const field of requiredFields) {
    if (metadata[field]) {
      const value = String(metadata[field])
      const display = value.length > 50 ? value.slice(0, 50) + '...' : value
      console.log(`   ✅ ${field}: ${display}`)
    } else {
      console.log(`   ❌ ${field}: MISSING - This will break wallet display!`)
    }
  }
  
  console.log('\nOptional fields:')
  for (const field of optionalFields) {
    if (metadata[field]) {
      const value = typeof metadata[field] === 'object' ? JSON.stringify(metadata[field]).slice(0, 40) : String(metadata[field]).slice(0, 40)
      console.log(`   ✅ ${field}: ${value}...`)
    } else {
      console.log(`   ⬜ ${field}: not present`)
    }
  }
  
  // Step 6: Test image accessibility
  console.log('\n📋 STEP 6: Image Accessibility Check')
  console.log('-'.repeat(70))
  
  const imageUri = metadata.image
  if (!imageUri) {
    console.log(`❌ No image field in metadata!`)
    console.log(`   This is why MetaMask shows the placeholder diamonds.`)
    return
  }
  
  console.log(`Image URI: ${imageUri}`)
  
  // Test image through multiple gateways
  if (imageUri.startsWith('ipfs://')) {
    const imageCid = imageUri.slice(7)
    console.log(`Image CID: ${imageCid.slice(0, 30)}...`)
    console.log('')
    
    for (const gateway of IPFS_GATEWAYS.slice(0, 3)) { // Test first 3 gateways
      const imgUrl = gateway + imageCid
      try {
        const start = Date.now()
        const res = await fetchWithTimeout(imgUrl, 15000)
        const elapsed = Date.now() - start
        
        if (res.ok) {
          const contentType = res.headers.get('content-type')
          const contentLength = res.headers.get('content-length')
          console.log(`✅ ${gateway.replace('https://', '').slice(0, 25).padEnd(25)} | ${elapsed}ms | ${contentType} | ${contentLength ? Math.round(contentLength/1024) + 'KB' : 'unknown size'}`)
        } else {
          console.log(`❌ ${gateway.replace('https://', '').slice(0, 25).padEnd(25)} | HTTP ${res.status}`)
        }
      } catch (e) {
        console.log(`❌ ${gateway.replace('https://', '').slice(0, 25).padEnd(25)} | ${e.message.slice(0, 30)}`)
      }
    }
  } else {
    // Direct HTTP image
    try {
      const res = await fetchWithTimeout(imageUri)
      if (res.ok) {
        const contentType = res.headers.get('content-type')
        console.log(`✅ Image accessible: ${contentType}`)
      } else {
        console.log(`❌ Image not accessible: HTTP ${res.status}`)
      }
    } catch (e) {
      console.log(`❌ Image fetch failed: ${e.message}`)
    }
  }
  
  // Step 7: MetaMask-specific checks
  console.log('\n📋 STEP 7: MetaMask-Specific Compatibility')
  console.log('-'.repeat(70))
  
  const issues = []
  
  // Check if image is SVG (MetaMask has issues with some SVGs)
  if (imageUri.includes('.svg') || metadata.image_type === 'svg') {
    issues.push('Image is SVG format - some wallets have issues rendering SVGs')
  }
  
  // Check for data URIs (can cause issues)
  if (imageUri.startsWith('data:')) {
    issues.push('Image is a data URI - may cause display issues in some wallets')
  }
  
  // Check image size (very large images may not display)
  // Would need to fetch and check, but we can warn about IPFS latency
  if (imageUri.startsWith('ipfs://')) {
    console.log(`⚠️ IPFS images may be slow to load in MetaMask`)
    console.log(`   MetaMask uses its own IPFS gateway which can be slower`)
  }
  
  // Check if the chain is properly configured in MetaMask
  console.log(`\n   Note: BlockDAG (Chain ID 1043) must be added to MetaMask`)
  console.log(`   MetaMask fetches metadata via the chain's RPC - ensure it's working`)
  
  if (issues.length > 0) {
    console.log('\n   Potential Issues:')
    issues.forEach(issue => console.log(`   ⚠️ ${issue}`))
  } else {
    console.log('\n   ✅ No obvious compatibility issues detected')
  }
  
  // Summary
  console.log('\n' + '='.repeat(70))
  console.log('📊 DIAGNOSIS SUMMARY')
  console.log('='.repeat(70))
  
  if (!tokenUri || tokenUri === '') {
    console.log('❌ ROOT CAUSE: TokenURI is empty')
    console.log('   FIX: Update campaign metadata with updateCampaignMetadata()')
  } else if (!metadata.image) {
    console.log('❌ ROOT CAUSE: Metadata has no image field')
    console.log('   FIX: Re-upload metadata JSON with proper image field')
  } else {
    console.log('✅ Token has valid URI and metadata with image')
    console.log('')
    console.log('If MetaMask still shows no image, possible causes:')
    console.log('1. IPFS gateway latency - wait a few minutes and refresh')
    console.log('2. MetaMask caching - try removing and re-importing the NFT')
    console.log('3. BlockDAG RPC issues - verify RPC is responding in MetaMask')
    console.log('4. Image too large or slow to load from IPFS')
    console.log('')
    console.log('Direct image URL to test in browser:')
    console.log(ipfsToHttp(metadata.image))
  }
}

main().catch(console.error)
