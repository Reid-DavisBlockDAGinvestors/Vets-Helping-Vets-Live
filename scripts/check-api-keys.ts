#!/usr/bin/env ts-node
/**
 * API Key Security Check Script
 * 
 * Verifies that all required API keys are present and properly configured.
 * Run with: npx ts-node scripts/check-api-keys.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

interface KeyConfig {
  name: string
  envVar: string
  required: boolean
  minLength?: number
  pattern?: RegExp
  description: string
}

const API_KEYS: KeyConfig[] = [
  {
    name: 'Supabase URL',
    envVar: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    pattern: /^https:\/\/.*\.supabase\.co$/,
    description: 'Supabase project URL',
  },
  {
    name: 'Supabase Anon Key',
    envVar: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    minLength: 100,
    description: 'Supabase anonymous/public key',
  },
  {
    name: 'Supabase Service Role Key',
    envVar: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    minLength: 100,
    description: 'Supabase service role key (server-side only)',
  },
  {
    name: 'NowNodes API Key',
    envVar: 'NOWNODES_API_KEY',
    required: true,
    minLength: 30,
    description: 'NowNodes RPC API key for BlockDAG',
  },
  {
    name: 'BlockDAG RPC URL',
    envVar: 'BLOCKDAG_RPC',
    required: true,
    pattern: /^https:\/\//,
    description: 'Primary BlockDAG RPC endpoint',
  },
  {
    name: 'Platform Wallet Private Key',
    envVar: 'PLATFORM_WALLET_PRIVATE_KEY',
    required: true,
    minLength: 64,
    pattern: /^(0x)?[a-fA-F0-9]{64}$/,
    description: 'Platform wallet for minting operations',
  },
  {
    name: 'Stripe Secret Key',
    envVar: 'STRIPE_SECRET_KEY',
    required: false,
    pattern: /^sk_(test|live)_/,
    description: 'Stripe secret API key',
  },
  {
    name: 'Stripe Publishable Key',
    envVar: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    required: false,
    pattern: /^pk_(test|live)_/,
    description: 'Stripe publishable key',
  },
  {
    name: 'Pinata JWT',
    envVar: 'PINATA_JWT',
    required: false,
    minLength: 100,
    description: 'Pinata IPFS JWT token',
  },
]

interface CheckResult {
  name: string
  status: 'pass' | 'fail' | 'warn'
  message: string
}

function checkKey(config: KeyConfig): CheckResult {
  const value = process.env[config.envVar]

  // Check if key exists
  if (!value) {
    if (config.required) {
      return {
        name: config.name,
        status: 'fail',
        message: `Missing required key: ${config.envVar}`,
      }
    }
    return {
      name: config.name,
      status: 'warn',
      message: `Optional key not set: ${config.envVar}`,
    }
  }

  // Check minimum length
  if (config.minLength && value.length < config.minLength) {
    return {
      name: config.name,
      status: 'fail',
      message: `Key too short (${value.length} < ${config.minLength}): ${config.envVar}`,
    }
  }

  // Check pattern
  if (config.pattern && !config.pattern.test(value)) {
    return {
      name: config.name,
      status: 'fail',
      message: `Key format invalid: ${config.envVar}`,
    }
  }

  // Check for placeholder values
  const placeholders = ['your-key-here', 'xxx', 'placeholder', 'changeme', 'TODO']
  if (placeholders.some((p) => value.toLowerCase().includes(p))) {
    return {
      name: config.name,
      status: 'fail',
      message: `Key appears to be a placeholder: ${config.envVar}`,
    }
  }

  return {
    name: config.name,
    status: 'pass',
    message: `✓ Configured correctly`,
  }
}

function main() {
  console.log('\n🔐 PatriotPledge API Key Security Check\n')
  console.log('=' .repeat(60))

  const results: CheckResult[] = API_KEYS.map(checkKey)

  const passed = results.filter((r) => r.status === 'pass')
  const failed = results.filter((r) => r.status === 'fail')
  const warnings = results.filter((r) => r.status === 'warn')

  // Display results
  results.forEach((result) => {
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️'
    console.log(`\n${icon} ${result.name}`)
    console.log(`   ${result.message}`)
  })

  console.log('\n' + '=' .repeat(60))
  console.log(`\n📊 Summary:`)
  console.log(`   ✅ Passed: ${passed.length}`)
  console.log(`   ❌ Failed: ${failed.length}`)
  console.log(`   ⚠️  Warnings: ${warnings.length}`)

  if (failed.length > 0) {
    console.log('\n🚨 Action Required: Fix the failed checks before deploying!')
    process.exit(1)
  } else if (warnings.length > 0) {
    console.log('\n⚠️  Some optional keys are not configured.')
    process.exit(0)
  } else {
    console.log('\n✅ All API keys are properly configured!')
    process.exit(0)
  }
}

main()
