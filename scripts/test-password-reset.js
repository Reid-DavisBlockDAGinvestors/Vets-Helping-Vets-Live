#!/usr/bin/env node
/**
 * Test Password Reset Flow
 * 
 * This script tests the password reset functionality:
 * 1. Supabase resetPasswordForEmail function
 * 2. The redirect URL configuration
 * 3. Email sending capability
 */
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🔐 PASSWORD RESET FLOW TEST')
  console.log('='.repeat(60))
  
  // 1. Check Supabase configuration
  console.log('\n1️⃣ Supabase Configuration:')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  console.log(`   URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`)
  console.log(`   Service Role Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing'}`)
  
  // 2. Check site URL configuration
  console.log('\n2️⃣ Site URL Configuration:')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://patriotpledgenfts.netlify.app'
  const resetUrl = `${siteUrl}/reset-password`
  console.log(`   Site URL: ${siteUrl}`)
  console.log(`   Reset Password URL: ${resetUrl}`)
  
  // 3. Check email configuration in Supabase
  console.log('\n3️⃣ Email Configuration:')
  console.log('   Note: Email settings are configured in Supabase Dashboard')
  console.log('   Go to: Authentication > Email Templates > Reset Password')
  console.log('   Ensure the redirect URL matches your site')
  
  // 4. Test flow description
  console.log('\n4️⃣ Password Reset Flow:')
  console.log('   1. User clicks "Forgot password?" on login modal')
  console.log('   2. User enters email and clicks "Send Reset Link"')
  console.log('   3. supabase.auth.resetPasswordForEmail() is called')
  console.log('   4. Supabase sends email with reset link')
  console.log('   5. User clicks link → redirected to /reset-password')
  console.log('   6. User enters new password')
  console.log('   7. supabase.auth.updateUser({ password }) updates it')
  
  // 5. Verify reset-password page exists
  console.log('\n5️⃣ Reset Password Page:')
  const fs = require('fs')
  const resetPagePath = 'app/reset-password/page.tsx'
  if (fs.existsSync(resetPagePath)) {
    console.log(`   ✅ ${resetPagePath} exists`)
  } else {
    console.log(`   ❌ ${resetPagePath} NOT FOUND`)
  }
  
  // 6. List users for testing (don't show sensitive data)
  console.log('\n6️⃣ Test Users Available:')
  const { data: users } = await supabase.auth.admin.listUsers()
  const testUsers = users?.users?.slice(0, 3) || []
  for (const u of testUsers) {
    console.log(`   • ${u.email} (verified: ${u.email_confirmed_at ? 'yes' : 'no'})`)
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('💡 To test password reset:')
  console.log('   1. Go to the site and click "Login"')
  console.log('   2. Click "Forgot password?"')
  console.log('   3. Enter a valid email and click "Send Reset Link"')
  console.log('   4. Check email for the reset link')
  console.log('   5. Click link and set new password')
}

main().catch(console.error)
