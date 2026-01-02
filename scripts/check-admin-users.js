/**
 * Check and setup admin users
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAdmins() {
  console.log('='.repeat(60))
  console.log('CHECKING ADMIN USERS')
  console.log('='.repeat(60))

  // Check profiles table structure
  const { data: profiles, error: profError } = await supabase
    .from('profiles')
    .select('*')
    .limit(10)

  if (profError) {
    console.error('Error querying profiles:', profError.message)
    return
  }

  console.log(`\n📋 Found ${profiles?.length || 0} profiles:`)
  profiles?.forEach(p => {
    console.log(`  - ${p.email || p.id}: role="${p.role || 'none'}"`)
  })

  // Check auth.users
  const { data: authData } = await supabase.auth.admin.listUsers()
  const users = authData?.users || []
  
  console.log(`\n👥 Found ${users.length} auth users:`)
  users.slice(0, 5).forEach(u => {
    console.log(`  - ${u.email} (${u.id})`)
  })

  // Check if profiles have role column
  if (profiles && profiles.length > 0) {
    const hasRole = 'role' in profiles[0]
    console.log(`\n🔑 Profiles table has 'role' column: ${hasRole ? 'YES' : 'NO'}`)
    
    if (!hasRole) {
      console.log('\n⚠️  Need to add role column to profiles table!')
    }
  }

  // Find users that should be admins
  const adminEmails = ['reid@example.com', 'admin@example.com'] // Add your email here
  
  console.log('\n' + '='.repeat(60))
  console.log('TO MAKE YOURSELF AN ADMIN:')
  console.log('='.repeat(60))
  console.log(`
Run this SQL in Supabase SQL Editor:

-- First, check what users exist
SELECT id, email FROM auth.users LIMIT 10;

-- Then update your profile to be admin (replace YOUR_USER_ID)
UPDATE profiles 
SET role = 'super_admin' 
WHERE id = 'YOUR_USER_ID';

-- Or if you know your email, find and update:
UPDATE profiles 
SET role = 'super_admin' 
WHERE email = 'your-email@example.com';

-- If profile doesn't exist, create it:
INSERT INTO profiles (id, email, role)
SELECT id, email, 'super_admin'
FROM auth.users
WHERE email = 'your-email@example.com'
ON CONFLICT (id) DO UPDATE SET role = 'super_admin';
  `)
}

checkAdmins().catch(console.error)
