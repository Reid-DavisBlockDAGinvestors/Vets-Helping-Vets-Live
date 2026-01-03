import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const email = process.argv[2]
const password = process.argv[3]

if (!email || !password) {
  console.log('Usage: npx ts-node scripts/set-user-password.ts <email> <password>')
  process.exit(1)
}

async function main() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  console.log(`Looking for user: ${email}`)
  
  // Find user with pagination
  let user = null
  let page = 1
  const perPage = 1000
  
  while (!user) {
    const { data: authUsers, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage
    })
    
    if (error) {
      console.error('Error listing users:', error)
      process.exit(1)
    }
    
    console.log(`Page ${page}: Found ${authUsers.users.length} users`)
    
    user = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    
    if (authUsers.users.length < perPage) break
    page++
    if (page > 100) break
  }
  
  if (!user) {
    console.error('User not found!')
    process.exit(1)
  }
  
  console.log(`Found user: ${user.id}`)
  console.log(`Email confirmed: ${!!user.email_confirmed_at}`)
  
  // Set password
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: password
  })
  
  if (error) {
    console.error('Error setting password:', error)
    process.exit(1)
  }
  
  console.log(`✅ Password updated successfully for ${email}`)
  console.log(`User can now login with: ${email} / ${password}`)
}

main().catch(console.error)
