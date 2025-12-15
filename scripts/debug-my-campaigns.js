/**
 * Debug script to test my-campaigns API and data flow
 * Run with: node scripts/debug-my-campaigns.js
 */
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function main() {
  console.log('=== Debug My Campaigns Flow ===\n')

  // 1. Check for Reid's user account
  console.log('1. Finding Reid\'s user account...')
  const { data: authData } = await supabaseAdmin.auth.admin.listUsers()
  const reidUser = authData?.users?.find(u => u.email?.includes('reid@blockdag'))
  
  if (!reidUser) {
    console.log('   ❌ Could not find Reid\'s account')
    return
  }
  
  console.log(`   ✅ Found user: ${reidUser.email} (ID: ${reidUser.id})`)
  console.log(`   Email confirmed: ${reidUser.email_confirmed_at ? 'YES' : 'NO'}`)

  // 2. Check profile for wallet_address
  console.log('\n2. Checking profiles table for wallet_address...')
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', reidUser.id)
    .single()
  
  if (profileErr) {
    console.log('   ⚠️ Profile error:', profileErr.message)
  } else {
    console.log('   Profile data:', profile)
  }

  // 3. Check purchases table
  console.log('\n3. Checking purchases table...')
  const { data: purchases, error: purchaseErr } = await supabaseAdmin
    .from('purchases')
    .select('id, campaign_id, wallet_address, email, created_at')
    .or(`email.ilike.%reid@blockdag%,wallet_address.ilike.%07b3c4bb%`)
    .limit(10)
  
  if (purchaseErr) {
    console.log('   ⚠️ Purchases error:', purchaseErr.message)
  } else {
    console.log(`   Found ${purchases?.length || 0} purchases:`)
    for (const p of (purchases || [])) {
      console.log(`   - Campaign ${p.campaign_id}: email=${p.email?.slice(0,15) || 'none'}, wallet=${p.wallet_address?.slice(0,10) || 'none'}`)
    }
  }

  // 4. Check submissions table (for created campaigns)
  console.log('\n4. Checking submissions table (created campaigns)...')
  const { data: submissions, error: subErr } = await supabaseAdmin
    .from('submissions')
    .select('id, campaign_id, title, creator_email, status')
    .ilike('creator_email', '%reid@blockdag%')
    .limit(10)
  
  if (subErr) {
    console.log('   ⚠️ Submissions error:', subErr.message)
  } else {
    console.log(`   Found ${submissions?.length || 0} submissions:`)
    for (const s of (submissions || [])) {
      console.log(`   - ${s.title?.slice(0, 30)} (campaign_id: ${s.campaign_id}, status: ${s.status})`)
    }
  }

  // 5. Check what /api/community/my-campaigns would return
  console.log('\n5. Simulating my-campaigns API logic...')
  
  // Get unique campaign_ids from purchases
  const purchaseCampaignIds = [...new Set((purchases || []).map(p => p.campaign_id).filter(Boolean))]
  console.log(`   Purchase campaign IDs: ${purchaseCampaignIds.join(', ') || 'none'}`)
  
  // Get campaign_ids from submissions where status is minted
  const createdCampaignIds = [...new Set((submissions || []).filter(s => s.campaign_id && s.status === 'minted').map(s => s.campaign_id))]
  console.log(`   Created campaign IDs (minted only): ${createdCampaignIds.join(', ') || 'none'}`)
  
  // Combine unique campaign IDs
  const allCampaignIds = [...new Set([...purchaseCampaignIds, ...createdCampaignIds])]
  console.log(`   All unique campaign IDs: ${allCampaignIds.join(', ') || 'none'}`)

  // 6. Check if these campaigns exist in submissions with 'minted' status
  if (allCampaignIds.length > 0) {
    console.log('\n6. Fetching campaign details...')
    const { data: campaigns, error: campErr } = await supabaseAdmin
      .from('submissions')
      .select('id, campaign_id, title, image_uri, status')
      .in('campaign_id', allCampaignIds)
      .eq('status', 'minted')
    
    if (campErr) {
      console.log('   ⚠️ Campaigns error:', campErr.message)
    } else {
      console.log(`   Found ${campaigns?.length || 0} minted campaigns:`)
      for (const c of (campaigns || [])) {
        console.log(`   - ${c.title} (campaign_id: ${c.campaign_id})`)
      }
    }
  }

  // 7. Check the actual my-campaigns API response structure
  console.log('\n7. Checking what fields the API expects...')
  const { data: firstCampaign } = await supabaseAdmin
    .from('submissions')
    .select('*')
    .eq('status', 'minted')
    .limit(1)
    .single()
  
  if (firstCampaign) {
    console.log('   Sample campaign fields:', Object.keys(firstCampaign).join(', '))
  }

  console.log('\n=== Debug Complete ===')
}

main().catch(console.error)
