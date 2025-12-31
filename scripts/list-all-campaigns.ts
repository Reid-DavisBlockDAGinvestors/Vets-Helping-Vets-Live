#!/usr/bin/env node
/**
 * List all campaigns from database
 */
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  console.log('\n📋 ALL CAMPAIGNS IN DATABASE\n')
  
  const { data: campaigns, error } = await supabase
    .from('submissions')
    .select('id, title, campaign_id, status, sold_count, goal, created_at')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log(`Total: ${campaigns.length} campaigns\n`)
  
  // Group by status
  const byStatus: Record<string, any[]> = {}
  for (const c of campaigns) {
    const status = c.status || 'unknown'
    if (!byStatus[status]) byStatus[status] = []
    byStatus[status].push(c)
  }
  
  for (const [status, list] of Object.entries(byStatus)) {
    console.log(`\n=== ${status.toUpperCase()} (${list.length}) ===`)
    for (const c of list) {
      console.log(`  #${c.campaign_id || 'N/A'} | ${c.title?.slice(0, 50)}...`)
      console.log(`     Sold: ${c.sold_count || 0} | Goal: $${c.goal || 0} | Created: ${c.created_at?.slice(0, 10)}`)
    }
  }
  
  // Find similar titles
  console.log('\n\n=== CHECKING FOR SIMILAR TITLES ===')
  const titles = campaigns.map((c: any) => ({ title: c.title?.toLowerCase().trim(), original: c.title, id: c.id, campaign_id: c.campaign_id }))
  const seen = new Map<string, any[]>()
  
  for (const t of titles) {
    if (!t.title) continue
    // Use first 20 chars as key for fuzzy match
    const key = t.title.slice(0, 30)
    if (!seen.has(key)) seen.set(key, [])
    seen.get(key)!.push(t)
  }
  
  for (const [key, list] of seen) {
    if (list.length > 1) {
      console.log(`\n  Potential duplicates (${list.length}):`)
      for (const item of list) {
        console.log(`    - ${item.original} (ID: ${item.id}, Campaign: ${item.campaign_id})`)
      }
    }
  }
  
  // Check for "Turner" or "Gerhan" or "Kizilas"
  console.log('\n\n=== SEARCHING FOR SPECIFIC KEYWORDS ===')
  const keywords = ['turner', 'gerhan', 'kizilas', 'anthony']
  for (const kw of keywords) {
    const matches = campaigns.filter((c: any) => c.title?.toLowerCase().includes(kw))
    console.log(`\n  "${kw}": ${matches.length} matches`)
    for (const m of matches) {
      console.log(`    - ${m.title} (Campaign #${m.campaign_id})`)
    }
  }
}

run().catch(console.error)
