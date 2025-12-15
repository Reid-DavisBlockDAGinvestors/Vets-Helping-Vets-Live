/**
 * Debug script to check submission data in Supabase
 * Run with: node scripts/debug-submission.js [campaign_id or search term]
 */
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function main() {
  const search = process.argv[2] || ''
  
  console.log('=== Supabase Submission Debug ===')
  console.log('Search:', search || '(all recent)')
  console.log('')

  // Get all submissions
  const { data: subs, error } = await supabase
    .from('submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Error:', error.message)
    return
  }

  console.log(`Found ${subs?.length || 0} recent submissions\n`)

  // Filter if search term provided
  let filtered = subs || []
  if (search) {
    filtered = filtered.filter(s => 
      s.title?.toLowerCase().includes(search.toLowerCase()) ||
      s.campaign_id?.toString() === search ||
      s.id?.includes(search)
    )
  }

  // Check marketplace visibility requirements
  const CONTRACT_ADDRESS = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').toLowerCase()
  
  for (const sub of filtered) {
    console.log('='.repeat(60))
    console.log('ID:', sub.id)
    console.log('Title:', sub.title?.slice(0, 50))
    console.log('Created:', sub.created_at)
    console.log('')
    
    console.log('--- Marketplace Visibility Checks ---')
    
    // Check 1: Status
    const statusOk = sub.status === 'minted'
    console.log(`[${statusOk ? '✅' : '❌'}] status = 'minted': "${sub.status}"`)
    
    // Check 2: visible_on_marketplace
    const visibleOk = sub.visible_on_marketplace === true || sub.visible_on_marketplace === 'true'
    console.log(`[${visibleOk ? '✅' : '❌'}] visible_on_marketplace: ${sub.visible_on_marketplace} (type: ${typeof sub.visible_on_marketplace})`)
    
    // Check 3: contract_address
    const contractOk = sub.contract_address && sub.contract_address.toLowerCase() === CONTRACT_ADDRESS
    console.log(`[${contractOk ? '✅' : '❌'}] contract_address matches: "${sub.contract_address?.slice(0,20)}..."`)
    console.log(`    Expected: ${CONTRACT_ADDRESS.slice(0,20)}...`)
    
    // Check 4: campaign_id
    const campaignOk = sub.campaign_id != null
    console.log(`[${campaignOk ? '✅' : '❌'}] campaign_id set: ${sub.campaign_id}`)
    
    // Overall
    const allOk = statusOk && visibleOk && contractOk && campaignOk
    console.log('')
    console.log(`MARKETPLACE VISIBLE: ${allOk ? '✅ YES' : '❌ NO'}`)
    
    if (!allOk) {
      console.log('\nMissing requirements:')
      if (!statusOk) console.log('  - Need status = "minted"')
      if (!visibleOk) console.log('  - Need visible_on_marketplace = true')
      if (!contractOk) console.log('  - Need valid contract_address')
      if (!campaignOk) console.log('  - Need campaign_id')
    }
    
    console.log('')
  }

  // Summary
  console.log('='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))
  
  const minted = (subs || []).filter(s => s.status === 'minted')
  const visible = minted.filter(s => s.visible_on_marketplace === true || s.visible_on_marketplace === 'true')
  const withContract = visible.filter(s => s.contract_address?.toLowerCase() === CONTRACT_ADDRESS)
  const withCampaign = withContract.filter(s => s.campaign_id != null)
  
  console.log(`Total submissions: ${subs?.length || 0}`)
  console.log(`Status = minted: ${minted.length}`)
  console.log(`+ visible_on_marketplace: ${visible.length}`)
  console.log(`+ valid contract_address: ${withContract.length}`)
  console.log(`+ has campaign_id: ${withCampaign.length} (should appear on marketplace)`)
}

main()
