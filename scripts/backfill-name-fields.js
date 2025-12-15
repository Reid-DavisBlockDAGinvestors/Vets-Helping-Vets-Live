/**
 * Backfill script to parse existing creator_name into first_name, last_name
 * Also backfills Supabase Auth user_metadata with first_name, last_name
 * 
 * Run with: node scripts/backfill-name-fields.js
 */
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// Parse a full name into first and last name
function parseName(fullName) {
  if (!fullName || typeof fullName !== 'string') {
    return { firstName: '', lastName: '' }
  }
  
  const trimmed = fullName.trim()
  const parts = trimmed.split(/\s+/)
  
  if (parts.length === 0) {
    return { firstName: '', lastName: '' }
  } else if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' }
  } else {
    // First word is first name, rest is last name
    return { 
      firstName: parts[0], 
      lastName: parts.slice(1).join(' ') 
    }
  }
}

async function main() {
  console.log('=== Backfill Name Fields ===\n')

  // 1. Backfill submissions table
  console.log('1. SUBMISSIONS - Parsing creator_name into first_name, last_name...')
  
  const { data: submissions, error: subErr } = await supabaseAdmin
    .from('submissions')
    .select('id, creator_name, creator_first_name, creator_last_name')
    .is('creator_first_name', null)
  
  if (subErr) {
    console.error('   Error fetching submissions:', subErr.message)
  } else {
    console.log(`   Found ${submissions?.length || 0} submissions to backfill`)
    
    let updated = 0
    for (const sub of (submissions || [])) {
      if (!sub.creator_name) continue
      
      const { firstName, lastName } = parseName(sub.creator_name)
      
      const { error: updateErr } = await supabaseAdmin
        .from('submissions')
        .update({
          creator_first_name: firstName,
          creator_last_name: lastName
        })
        .eq('id', sub.id)
      
      if (updateErr) {
        console.error(`   Error updating ${sub.id}:`, updateErr.message)
      } else {
        updated++
        console.log(`   ✅ ${sub.creator_name} -> "${firstName}" "${lastName}"`)
      }
    }
    
    console.log(`   Updated ${updated} submissions`)
  }

  // 2. Backfill Supabase Auth user_metadata
  console.log('\n2. AUTH USERS - Backfilling user_metadata with first_name, last_name...')
  
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers()
  
  if (authErr) {
    console.error('   Error listing users:', authErr.message)
  } else {
    const users = authData?.users || []
    console.log(`   Found ${users.length} users`)
    
    let authUpdated = 0
    for (const user of users) {
      // Check if user already has first_name in metadata
      const metadata = user.user_metadata || {}
      
      if (metadata.first_name && metadata.last_name) {
        console.log(`   Skipping ${user.email?.slice(0, 20)}... - already has name fields`)
        continue
      }
      
      // Try to get name from existing metadata or email
      let fullName = metadata.name || metadata.full_name || ''
      
      // If no name, try to extract from email
      if (!fullName && user.email) {
        // Use email prefix, replace dots/underscores with spaces, capitalize
        const emailPrefix = user.email.split('@')[0]
        fullName = emailPrefix
          .replace(/[._]/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase())
      }
      
      const { firstName, lastName } = parseName(fullName)
      
      if (!firstName) {
        console.log(`   Skipping ${user.email?.slice(0, 20)}... - no name to parse`)
        continue
      }
      
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        {
          user_metadata: {
            ...metadata,
            first_name: firstName,
            last_name: lastName,
            full_name: fullName
          }
        }
      )
      
      if (updateErr) {
        console.error(`   Error updating user ${user.email}:`, updateErr.message)
      } else {
        authUpdated++
        console.log(`   ✅ ${user.email?.slice(0, 25)}... -> "${firstName}" "${lastName}"`)
      }
    }
    
    console.log(`   Updated ${authUpdated} auth users`)
  }

  console.log('\n=== Backfill Complete ===')
}

main().catch(console.error)
