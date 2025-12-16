#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('=== LATEST BUG REPORTS ===\n')
  
  const { data, error } = await supabase
    .from('bug_reports')
    .select('id, title, description, category, status, created_at, page_url')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Error:', error.message)
    return
  }

  data.forEach((b, i) => {
    console.log(`${i + 1}. [${b.status.toUpperCase()}] ${b.title}`)
    console.log(`   Description: ${b.description?.substring(0, 150)}...`)
    console.log(`   Category: ${b.category}`)
    console.log(`   Page: ${b.page_url || 'N/A'}`)
    console.log(`   Created: ${b.created_at}`)
    console.log('')
  })
}

main().catch(console.error)
