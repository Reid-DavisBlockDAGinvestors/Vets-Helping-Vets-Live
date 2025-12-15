/**
 * Test my-campaigns API by simulating exactly what it does
 * Run with: node scripts/test-my-campaigns-api.js
 */
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function main() {
  console.log('=== Simulating my-campaigns API ===\n')

  // Get Reid's user
  const { data: authData } = await supabaseAdmin.auth.admin.listUsers()
  const user = authData?.users?.find(u => u.email?.includes('reid@blockdag'))
  
  if (!user) {
    console.log('No user found')
    return
  }

  const userId = user.id
  const userEmail = user.email

  console.log(`User: ${userEmail} (${userId})\n`)

  // 1. Created campaigns
  console.log('1. CREATED CAMPAIGNS (by creator_email):')
  const { data: createdCampaigns, error: err1 } = await supabaseAdmin
    .from('submissions')
    .select('id, title, image_uri, campaign_id, category, status')
    .ilike('creator_email', userEmail)
    .in('status', ['minted', 'approved', 'pending'])
    .order('created_at', { ascending: false })

  if (err1) console.log('   Error:', err1.message)
  console.log(`   Found ${createdCampaigns?.length || 0} campaigns`)
  for (const c of (createdCampaigns || [])) {
    console.log(`   - ${c.title?.slice(0, 40)}... (status: ${c.status}, campaign_id: ${c.campaign_id})`)
  }

  // 2. Purchases by email
  console.log('\n2. PURCHASES (by email):')
  const { data: purchasesByEmail, error: err2 } = await supabaseAdmin
    .from('purchases')
    .select('campaign_id')
    .ilike('email', userEmail)

  if (err2) console.log('   Error:', err2.message)
  console.log(`   Found ${purchasesByEmail?.length || 0} purchases`)
  
  const purchasedCampaignIds = [...new Set((purchasesByEmail || []).map(p => p.campaign_id).filter(Boolean))]
  console.log(`   Unique campaign IDs: ${purchasedCampaignIds.join(', ') || 'none'}`)

  // 3. Fetch purchased campaign details
  console.log('\n3. PURCHASED CAMPAIGN DETAILS:')
  let purchasedCampaigns = []
  if (purchasedCampaignIds.length > 0) {
    const { data, error: err3 } = await supabaseAdmin
      .from('submissions')
      .select('id, title, image_uri, campaign_id, category, status')
      .in('campaign_id', purchasedCampaignIds)
      .eq('status', 'minted')
    
    if (err3) console.log('   Error:', err3.message)
    purchasedCampaigns = data || []
    console.log(`   Found ${purchasedCampaigns.length} minted campaigns from purchases`)
    for (const c of purchasedCampaigns) {
      console.log(`   - ${c.title?.slice(0, 40)}... (campaign_id: ${c.campaign_id})`)
    }
  }

  // 4. Combine and tag
  console.log('\n4. COMBINED RESULTS:')
  const allCampaigns = [...(createdCampaigns || []), ...purchasedCampaigns]
  const seen = new Set()
  const uniqueCampaigns = allCampaigns.filter(c => {
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return true
  })

  const createdIds = new Set((createdCampaigns || []).map(c => c.id))
  const purchasedIds = new Set(purchasedCampaigns.map(c => c.id))

  const campaigns = uniqueCampaigns.map(c => ({
    ...c,
    interactionTypes: [
      createdIds.has(c.id) ? 'created' : null,
      purchasedIds.has(c.id) ? 'purchased' : null,
    ].filter(Boolean)
  }))

  console.log(`   Total unique campaigns: ${campaigns.length}`)
  for (const c of campaigns) {
    console.log(`   - ${c.title?.slice(0, 35)}... [${c.interactionTypes.join(', ')}]`)
  }

  console.log('\n5. API WOULD RETURN:')
  console.log(JSON.stringify({ campaigns: campaigns.slice(0, 3) }, null, 2).slice(0, 500) + '...')
  
  console.log('\n=== End Test ===')
}

main().catch(console.error)
