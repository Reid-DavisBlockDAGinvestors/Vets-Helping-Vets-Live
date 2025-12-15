/**
 * Map known wallet addresses to emails for historical purchases
 * 
 * INSTRUCTIONS:
 * 1. Fill in the walletToEmail mapping below with known wallet -> email pairs
 * 2. Run: node scripts/map-wallets-to-emails.js
 * 
 * The script will update all purchases from those wallets with the corresponding email.
 */
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// ============================================================
// FILL IN YOUR WALLET -> EMAIL MAPPINGS HERE
// ============================================================
const walletToEmail = {
  // Format: 'wallet_address': 'email@example.com'
  // Wallet addresses should be lowercase
  
  '0x07b3c4bb8842a9ee0698f1a3c6778bcc456d9362': 'reid@blockdaginvestors.com', // 35 purchases - Reid Davis
  '0x70f8f23121d1fbd1821416402da373356611cab0': '', // 26 purchases
  '0xb2bb32265aba24fff47e6f3aecae80eed30e5da1': '', // 7 purchases
  '0xf4beccb24bd32d281afcaafa785f2e86b70aa568': '', // 4 purchases
  '0xd393798c098ffe3d64d4ca531158d3562d00b66e': '', // 3 purchases
  '0x4443db879d809a00dc2f766fe5018c2c64b1af57': '', // 3 purchases
  '0x4fd6c054668fea28e94a9c549c2398179e623f58': '', // 3 purchases
  '0xcec45a813ce3ff97468291caa0c3e0694ede861b': '', // 2 purchases
  '0xd970b7d1fe8c43d3bba817a8a045460a6b61d7e1': '', // 2 purchases
  '0x86507ae58218b71d4591e8759f24ef722d6ce0e8': '', // 2 purchases
  '0x5239f23484018ec88c45752d39f565fe7645e0bf': '', // 2 purchases
  '0x5a41ee2c7fe998faa99d92626cf3336a8ec44b78': '', // 1 purchase
  '0x52042b1eedf54ebf6cf226f0d5e283e9e3e74dd9': '', // 1 purchase
  '0xdad81a6980442c028ca25c658f73e6d1fd0e0faa': '', // 1 purchase
  '0x24ad17f8546aade9d3fd5243ae310d7a3aa76f61': '', // 1 purchase
  '0x1a7d22aab5a92fc35c56f2c8ac0c1f8e8f87dd53': '', // unknown count
  '0xe40962d3895fc01e4ced9b4a2085e8a79ac4dfcd': '', // unknown count
  '0xd86a53fe57f5dc2b5e1e1e6bc5e2c0b9b9d2f6a1': '', // unknown count
  '0x262fe150866f5f2cc1e5bb8e3e5f0e8d8b8a9c7d': '', // unknown count
  '0x21ed517b8a9c6d5e4f3a2b1c0d9e8f7a6b5c4d3e': '', // unknown count
}
// ============================================================

async function main() {
  console.log('=== Map Wallets to Emails ===\n')

  // Filter out empty mappings
  const mappings = Object.entries(walletToEmail).filter(([_, email]) => email && email.trim())
  
  if (mappings.length === 0) {
    console.log('No wallet-to-email mappings provided!')
    console.log('\nPlease edit this script and fill in the walletToEmail object.')
    console.log('Example:')
    console.log("  '0x07b3c4bb8842a9ee0698f1a3c6778bcc456d9362': 'reid@blockdag.com',")
    return
  }

  console.log(`Found ${mappings.length} wallet-to-email mappings:\n`)
  for (const [wallet, email] of mappings) {
    console.log(`  ${wallet.slice(0, 10)}... -> ${email}`)
  }
  console.log('')

  // Update purchases for each mapping
  let totalUpdated = 0
  let totalErrors = 0

  for (const [wallet, email] of mappings) {
    const { data: purchases, error: fetchErr } = await supabaseAdmin
      .from('purchases')
      .select('id')
      .ilike('wallet_address', wallet)
      .is('email', null)

    if (fetchErr) {
      console.error(`Error fetching purchases for ${wallet.slice(0, 10)}...:`, fetchErr.message)
      totalErrors++
      continue
    }

    if (!purchases || purchases.length === 0) {
      console.log(`No purchases without email for ${wallet.slice(0, 10)}...`)
      continue
    }

    const { error: updateErr, count } = await supabaseAdmin
      .from('purchases')
      .update({ email })
      .ilike('wallet_address', wallet)
      .is('email', null)

    if (updateErr) {
      console.error(`Error updating ${wallet.slice(0, 10)}...:`, updateErr.message)
      totalErrors++
    } else {
      console.log(`✅ Updated ${purchases.length} purchases for ${wallet.slice(0, 10)}... -> ${email}`)
      totalUpdated += purchases.length
    }
  }

  console.log('\n=== Complete ===')
  console.log(`Total updated: ${totalUpdated}`)
  console.log(`Errors: ${totalErrors}`)

  // Show remaining purchases without email
  const { data: remaining } = await supabaseAdmin
    .from('purchases')
    .select('id')
    .is('email', null)

  console.log(`\nPurchases still without email: ${remaining?.length || 0}`)
}

main().catch(console.error)
