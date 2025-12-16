// Backfill first_name and last_name in community_profiles
// Sources: 1) Supabase auth user_metadata, 2) submissions table creator_name
require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function backfillProfileNames() {
  console.log('=== BACKFILL PROFILE NAMES ===\n')
  
  // Step 1: Get all auth users with their metadata
  console.log('Step 1: Fetching auth users...')
  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers()
  
  if (authErr) {
    console.error('Failed to fetch auth users:', authErr.message)
    return
  }
  
  const users = authData?.users || []
  console.log(`Found ${users.length} auth users\n`)
  
  // Step 2: Get all submissions with creator names
  console.log('Step 2: Fetching submissions...')
  const { data: submissions, error: subErr } = await supabase
    .from('submissions')
    .select('user_id, creator_name, creator_email, creator_first_name, creator_last_name')
    .not('user_id', 'is', null)
  
  if (subErr) {
    console.error('Failed to fetch submissions:', subErr.message)
  }
  console.log(`Found ${submissions?.length || 0} submissions with user_id\n`)
  
  // Create a map of user_id to submission data
  const submissionMap = new Map()
  for (const sub of submissions || []) {
    if (sub.user_id && !submissionMap.has(sub.user_id)) {
      submissionMap.set(sub.user_id, sub)
    }
  }
  
  // Step 3: Get existing community profiles
  console.log('Step 3: Fetching existing community profiles...')
  const { data: profiles, error: profErr } = await supabase
    .from('community_profiles')
    .select('user_id, display_name, first_name, last_name')
  
  if (profErr) {
    console.error('Failed to fetch profiles:', profErr.message)
  }
  console.log(`Found ${profiles?.length || 0} community profiles\n`)
  
  const profileMap = new Map()
  for (const p of profiles || []) {
    profileMap.set(p.user_id, p)
  }
  
  // Step 4: Process each user and determine what to update/create
  console.log('Step 4: Processing users...\n')
  
  let created = 0
  let updated = 0
  let skipped = 0
  let errors = 0
  
  for (const user of users) {
    const userId = user.id
    const email = user.email
    const metadata = user.user_metadata || {}
    
    // Get first/last name from various sources (priority order)
    let firstName = null
    let lastName = null
    let displayName = null
    
    // Source 1: Auth user_metadata (highest priority - from signup)
    if (metadata.first_name) firstName = metadata.first_name
    if (metadata.last_name) lastName = metadata.last_name
    
    // Source 2: Submissions table
    const submission = submissionMap.get(userId)
    if (submission) {
      if (!firstName && submission.creator_first_name) firstName = submission.creator_first_name
      if (!lastName && submission.creator_last_name) lastName = submission.creator_last_name
      
      // Parse creator_name if we still don't have first/last
      if ((!firstName || !lastName) && submission.creator_name) {
        const parts = submission.creator_name.trim().split(/\s+/)
        if (parts.length >= 2) {
          if (!firstName) firstName = parts[0]
          if (!lastName) lastName = parts.slice(1).join(' ')
        } else if (parts.length === 1 && !firstName) {
          firstName = parts[0]
        }
      }
    }
    
    // Generate display name if we have first/last
    if (firstName && lastName) {
      displayName = `${firstName} ${lastName}`
    } else if (firstName) {
      displayName = firstName
    }
    
    // Check if profile exists
    const existingProfile = profileMap.get(userId)
    
    if (existingProfile) {
      // Update if we have new data and existing is empty
      const needsUpdate = (
        (firstName && !existingProfile.first_name) ||
        (lastName && !existingProfile.last_name) ||
        (displayName && !existingProfile.display_name)
      )
      
      if (needsUpdate) {
        const updateData = {}
        if (firstName && !existingProfile.first_name) updateData.first_name = firstName
        if (lastName && !existingProfile.last_name) updateData.last_name = lastName
        if (displayName && !existingProfile.display_name) updateData.display_name = displayName
        updateData.updated_at = new Date().toISOString()
        
        const { error: updateErr } = await supabase
          .from('community_profiles')
          .update(updateData)
          .eq('user_id', userId)
        
        if (updateErr) {
          console.log(`❌ Error updating ${email}: ${updateErr.message}`)
          errors++
        } else {
          console.log(`✅ Updated ${email}: first=${firstName}, last=${lastName}`)
          updated++
        }
      } else {
        skipped++
      }
    } else {
      // Create new profile if we have any data
      if (firstName || lastName || email) {
        const insertData = {
          user_id: userId,
          display_name: displayName || email?.split('@')[0] || 'User',
          first_name: firstName || null,
          last_name: lastName || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        const { error: insertErr } = await supabase
          .from('community_profiles')
          .insert(insertData)
        
        if (insertErr) {
          // Might already exist due to race condition
          if (insertErr.code === '23505') {
            skipped++
          } else {
            console.log(`❌ Error creating profile for ${email}: ${insertErr.message}`)
            errors++
          }
        } else {
          console.log(`✅ Created profile for ${email}: first=${firstName}, last=${lastName}`)
          created++
        }
      } else {
        skipped++
      }
    }
  }
  
  console.log('\n=== BACKFILL COMPLETE ===')
  console.log(`Created: ${created}`)
  console.log(`Updated: ${updated}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Errors: ${errors}`)
}

backfillProfileNames().catch(console.error)
