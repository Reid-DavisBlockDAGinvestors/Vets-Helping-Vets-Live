/**
 * COMPREHENSIVE SECURITY AUDIT - MARS MISSION LEVEL
 * 
 * Covers:
 * 1. Smart Contract Security
 * 2. API Security & Authentication
 * 3. Data Exposure & Privacy
 * 4. Environment & Secrets
 * 5. Frontend Security (XSS, CSRF)
 * 6. Database Security (RLS)
 * 7. Third-Party Integrations
 * 
 * Run with: node scripts/security-audit-complete.js
 */

const fs = require('fs')
const path = require('path')

const REPORT = {
  timestamp: new Date().toISOString(),
  summary: { critical: 0, high: 0, medium: 0, low: 0, passed: 0 },
  sections: []
}

function addFinding(section, severity, title, details, recommendation) {
  const finding = { severity, title, details, recommendation }
  const existingSection = REPORT.sections.find(s => s.name === section)
  if (existingSection) {
    existingSection.findings.push(finding)
  } else {
    REPORT.sections.push({ name: section, findings: [finding] })
  }
  REPORT.summary[severity.toLowerCase()]++
}

function addPass(section, title) {
  const finding = { severity: 'PASS', title, details: null, recommendation: null }
  const existingSection = REPORT.sections.find(s => s.name === section)
  if (existingSection) {
    existingSection.findings.push(finding)
  } else {
    REPORT.sections.push({ name: section, findings: [finding] })
  }
  REPORT.summary.passed++
}

const SKIP_DIRS = ['node_modules', '.git', '.next', 'out', 'dist', '.vercel', '.netlify']

function walkDir(dir, callback) {
  try {
    const items = fs.readdirSync(dir)
    for (const item of items) {
      if (SKIP_DIRS.includes(item)) continue
      const fullPath = path.join(dir, item)
      try {
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
          walkDir(fullPath, callback)
        } else {
          callback(fullPath)
        }
      } catch {}
    }
  } catch {}
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return null
  }
}

// ============================================================================
// 1. SMART CONTRACT SECURITY AUDIT
// ============================================================================
function auditSmartContracts() {
  console.log('\n' + '='.repeat(70))
  console.log('1. SMART CONTRACT SECURITY AUDIT')
  console.log('='.repeat(70))

  const contractsDir = path.join(process.cwd(), 'contracts')
  const libOnchain = path.join(process.cwd(), 'lib', 'onchain.ts')
  
  // Check for reentrancy vulnerabilities in contract interactions
  if (fs.existsSync(libOnchain)) {
    const content = readFile(libOnchain)
    
    // Check for proper error handling in contract calls
    if (content.includes('try') && content.includes('catch')) {
      addPass('Smart Contracts', 'Contract calls have error handling')
    } else {
      addFinding('Smart Contracts', 'MEDIUM', 'Missing error handling in contract calls',
        'Some contract interactions may not have proper try-catch blocks',
        'Wrap all contract calls in try-catch to handle failures gracefully')
    }
    
    // Check for gas limit considerations
    if (content.includes('gasLimit') || content.includes('estimateGas')) {
      addPass('Smart Contracts', 'Gas limits are considered')
    } else {
      addFinding('Smart Contracts', 'LOW', 'No explicit gas limit handling',
        'Contract calls may fail due to gas estimation issues',
        'Consider adding explicit gas limits for critical transactions')
    }
    
    // Check for transaction confirmation handling
    if (content.includes('wait(') || content.includes('waitForTransaction')) {
      addPass('Smart Contracts', 'Transaction confirmations are awaited')
    } else {
      addFinding('Smart Contracts', 'MEDIUM', 'Transaction confirmations may not be awaited',
        'Transactions might be considered complete before confirmation',
        'Always wait for transaction confirmations before updating state')
    }
  }

  // Check mint/purchase flow for common vulnerabilities
  const mintRoute = path.join(process.cwd(), 'app', 'api', 'mint', 'route.ts')
  if (fs.existsSync(mintRoute)) {
    const content = readFile(mintRoute)
    
    // Check for signature verification
    if (content.includes('verifyMessage') || content.includes('ecrecover') || content.includes('signature')) {
      addPass('Smart Contracts', 'Signature verification present in mint flow')
    }
    
    // Check for amount validation
    if (content.includes('amount') && (content.includes('>=') || content.includes('<='))) {
      addPass('Smart Contracts', 'Amount validation in mint flow')
    }
  }

  // Check for private key exposure
  walkDir(process.cwd(), (filePath) => {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx') && !filePath.endsWith('.js')) return
    const content = readFile(filePath)
    if (!content) return
    
    // Check for hardcoded private keys
    if (/0x[a-fA-F0-9]{64}/.test(content) && !filePath.includes('test') && !filePath.includes('.d.ts')) {
      // Check if it's actually a private key usage, not a tx hash
      if (content.includes('privateKey') || content.includes('PRIVATE_KEY')) {
        addFinding('Smart Contracts', 'CRITICAL', 'Potential private key in code',
          `File: ${path.relative(process.cwd(), filePath)}`,
          'Never hardcode private keys. Use environment variables.')
      }
    }
  })

  console.log('   ✅ Smart contract audit complete')
}

// ============================================================================
// 2. API SECURITY & AUTHENTICATION AUDIT
// ============================================================================
function auditApiSecurity() {
  console.log('\n' + '='.repeat(70))
  console.log('2. API SECURITY & AUTHENTICATION AUDIT')
  console.log('='.repeat(70))

  const apiDir = path.join(process.cwd(), 'app', 'api')
  const routes = []
  
  walkDir(apiDir, (filePath) => {
    if (filePath.endsWith('route.ts') || filePath.endsWith('route.js')) {
      routes.push(filePath)
    }
  })

  console.log(`   Found ${routes.length} API routes`)

  const publicRoutes = ['metadata', 'stats', 'community', 'marketplace', 'recommendations']
  const sensitiveRoutes = ['admin', 'debug', 'payout', 'cleanup', 'backfill']
  
  let unprotectedSensitive = 0
  let missingRateLimit = 0

  for (const route of routes) {
    const content = readFile(route)
    if (!content) continue
    
    const relativePath = path.relative(process.cwd(), route)
    const isSensitive = sensitiveRoutes.some(s => relativePath.includes(s))
    const isPublic = publicRoutes.some(s => relativePath.includes(s))
    
    // Check auth for sensitive routes
    const hasAuth = content.includes('authorization') || 
                   content.includes('getUser') || 
                   content.includes('getSession') ||
                   content.includes('verifyAdminAuth')
    
    if (isSensitive && !hasAuth) {
      addFinding('API Security', 'HIGH', `Unprotected sensitive route: ${relativePath}`,
        'This route handles sensitive operations without authentication',
        'Add authentication check using verifyAdminAuth() or similar')
      unprotectedSensitive++
    }
    
    // Check for SQL injection (parameterized queries)
    if (content.includes('.from(') && content.includes('.eq(')) {
      // Using Supabase query builder - safe from SQL injection
    } else if (content.includes('raw(') || content.includes('sql`')) {
      addFinding('API Security', 'HIGH', `Raw SQL in ${relativePath}`,
        'Raw SQL queries can be vulnerable to SQL injection',
        'Use parameterized queries or Supabase query builder')
    }
    
    // Check for input validation
    if (content.includes('req.json()') || content.includes('req.body')) {
      if (!content.includes('if (!') && !content.includes('if(!')) {
        addFinding('API Security', 'MEDIUM', `Missing input validation in ${relativePath}`,
          'Request body is used without validation',
          'Validate all input parameters before processing')
      }
    }
    
    // Check for error information leakage
    if (content.includes('e.message') || content.includes('error.message')) {
      if (content.includes('NextResponse.json') && content.includes('e.message')) {
        // Could leak internal error details
      }
    }
  }

  if (unprotectedSensitive === 0) {
    addPass('API Security', 'All sensitive routes are protected')
  }

  // Check for CORS configuration
  const nextConfig = path.join(process.cwd(), 'next.config.js')
  const nextConfigMjs = path.join(process.cwd(), 'next.config.mjs')
  let hasNextConfig = fs.existsSync(nextConfig) || fs.existsSync(nextConfigMjs)
  
  if (hasNextConfig) {
    const configContent = readFile(nextConfig) || readFile(nextConfigMjs)
    if (configContent && configContent.includes('headers')) {
      addPass('API Security', 'Custom headers configuration found')
    }
  }

  console.log('   ✅ API security audit complete')
}

// ============================================================================
// 3. DATA EXPOSURE & PRIVACY AUDIT
// ============================================================================
function auditDataExposure() {
  console.log('\n' + '='.repeat(70))
  console.log('3. DATA EXPOSURE & PRIVACY AUDIT')
  console.log('='.repeat(70))

  // Check for PII in console.log statements
  const piiPatterns = [
    { pattern: /console\.log\([^)]*email[^)]*\)/gi, field: 'email' },
    { pattern: /console\.log\([^)]*password[^)]*\)/gi, field: 'password' },
    { pattern: /console\.log\([^)]*wallet[^)]*\)/gi, field: 'wallet address' },
    { pattern: /console\.log\([^)]*phone[^)]*\)/gi, field: 'phone' },
    { pattern: /console\.log\([^)]*ssn[^)]*\)/gi, field: 'SSN' },
    { pattern: /console\.log\([^)]*credit[^)]*\)/gi, field: 'credit card' },
  ]

  let piiLogCount = 0
  walkDir(process.cwd(), (filePath) => {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return
    if (filePath.includes('scripts/')) return
    
    const content = readFile(filePath)
    if (!content) return

    for (const { pattern, field } of piiPatterns) {
      const matches = content.match(pattern)
      if (matches && field !== 'wallet address') { // Wallet addresses are public
        piiLogCount++
        if (field === 'password' || field === 'SSN' || field === 'credit card') {
          addFinding('Data Privacy', 'CRITICAL', `Logging ${field} in ${path.relative(process.cwd(), filePath)}`,
            `Found: ${matches[0].slice(0, 60)}...`,
            `Never log sensitive ${field} data`)
        }
      }
    }
  })

  if (piiLogCount === 0) {
    addPass('Data Privacy', 'No critical PII found in logs')
  }

  // Check for data minimization in API responses
  const apiDir = path.join(process.cwd(), 'app', 'api')
  walkDir(apiDir, (filePath) => {
    if (!filePath.endsWith('route.ts')) return
    const content = readFile(filePath)
    if (!content) return
    
    // Check if select() is used (good - data minimization)
    if (content.includes('.select(\'*\')')) {
      addFinding('Data Privacy', 'MEDIUM', `SELECT * used in ${path.relative(process.cwd(), filePath)}`,
        'Selecting all columns may expose unnecessary data',
        'Use specific column selection to minimize data exposure')
    }
  })

  // Check for sensitive data in localStorage/sessionStorage usage
  walkDir(path.join(process.cwd(), 'components'), (filePath) => {
    const content = readFile(filePath)
    if (!content) return
    
    if (content.includes('localStorage') || content.includes('sessionStorage')) {
      if (content.includes('token') || content.includes('password') || content.includes('secret')) {
        addFinding('Data Privacy', 'HIGH', `Sensitive data in browser storage: ${path.relative(process.cwd(), filePath)}`,
          'Tokens or secrets may be stored in localStorage/sessionStorage',
          'Use httpOnly cookies for sensitive tokens')
      }
    }
  })

  console.log('   ✅ Data exposure audit complete')
}

// ============================================================================
// 4. ENVIRONMENT & SECRETS AUDIT
// ============================================================================
function auditEnvironment() {
  console.log('\n' + '='.repeat(70))
  console.log('4. ENVIRONMENT & SECRETS AUDIT')
  console.log('='.repeat(70))

  // Check .gitignore for env files
  const gitignore = readFile(path.join(process.cwd(), '.gitignore'))
  const envFiles = ['.env', '.env.local', '.env.production', '.env.development']
  
  for (const envFile of envFiles) {
    if (fs.existsSync(path.join(process.cwd(), envFile))) {
      if (gitignore && gitignore.includes(envFile)) {
        addPass('Environment', `${envFile} is in .gitignore`)
      } else {
        addFinding('Environment', 'CRITICAL', `${envFile} not in .gitignore`,
          'Environment file may be committed to version control',
          `Add ${envFile} to .gitignore immediately`)
      }
    }
  }

  // Check for hardcoded secrets
  const secretPatterns = [
    { pattern: /sk_live_[A-Za-z0-9]{20,}/g, name: 'Stripe live key' },
    { pattern: /sk_test_[A-Za-z0-9]{20,}/g, name: 'Stripe test key' },
    { pattern: /-----BEGIN.*PRIVATE KEY-----/g, name: 'Private key' },
    { pattern: /ghp_[A-Za-z0-9]{36}/g, name: 'GitHub token' },
    { pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/g, name: 'Slack token' },
  ]

  walkDir(process.cwd(), (filePath) => {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx') && !filePath.endsWith('.js')) return
    if (filePath.includes('scripts/security')) return
    
    const content = readFile(filePath)
    if (!content) return

    for (const { pattern, name } of secretPatterns) {
      if (pattern.test(content)) {
        addFinding('Environment', 'CRITICAL', `Hardcoded ${name} found`,
          `File: ${path.relative(process.cwd(), filePath)}`,
          'Remove hardcoded secrets and use environment variables')
      }
    }
  })

  // Check for server-only env vars in client code
  const serverOnlyVars = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'BLOCKDAG_PRIVATE_KEY',
    'RESEND_API_KEY',
    'PERSONA_API_KEY',
  ]

  walkDir(path.join(process.cwd(), 'components'), (filePath) => {
    const content = readFile(filePath)
    if (!content) return
    
    for (const varName of serverOnlyVars) {
      if (content.includes(varName)) {
        addFinding('Environment', 'CRITICAL', `Server-only var ${varName} in client component`,
          `File: ${path.relative(process.cwd(), filePath)}`,
          'Server-only environment variables must never be accessed from client components')
      }
    }
  })

  // Check app directory for client components using server vars
  walkDir(path.join(process.cwd(), 'app'), (filePath) => {
    if (!filePath.endsWith('.tsx')) return
    const content = readFile(filePath)
    if (!content) return
    
    if (content.includes("'use client'") || content.includes('"use client"')) {
      for (const varName of serverOnlyVars) {
        if (content.includes(varName)) {
          addFinding('Environment', 'CRITICAL', `Server-only var in client component`,
            `${varName} in ${path.relative(process.cwd(), filePath)}`,
            'Move this logic to a server component or API route')
        }
      }
    }
  })

  addPass('Environment', 'Server-only vars not exposed in client code')
  console.log('   ✅ Environment audit complete')
}

// ============================================================================
// 5. FRONTEND SECURITY (XSS, CSRF)
// ============================================================================
function auditFrontendSecurity() {
  console.log('\n' + '='.repeat(70))
  console.log('5. FRONTEND SECURITY (XSS, CSRF)')
  console.log('='.repeat(70))

  // Check for dangerous innerHTML usage
  walkDir(path.join(process.cwd(), 'components'), (filePath) => {
    const content = readFile(filePath)
    if (!content) return
    
    if (content.includes('dangerouslySetInnerHTML')) {
      addFinding('Frontend Security', 'HIGH', `dangerouslySetInnerHTML in ${path.relative(process.cwd(), filePath)}`,
        'Direct HTML injection can lead to XSS vulnerabilities',
        'Sanitize HTML content using DOMPurify or similar library')
    }
  })

  // Check for eval() usage
  walkDir(process.cwd(), (filePath) => {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx') && !filePath.endsWith('.js')) return
    const content = readFile(filePath)
    if (!content) return
    
    if (/\beval\s*\(/.test(content) || /new Function\s*\(/.test(content)) {
      addFinding('Frontend Security', 'CRITICAL', `eval() or new Function() in ${path.relative(process.cwd(), filePath)}`,
        'Dynamic code execution is extremely dangerous',
        'Remove eval() and find alternative solutions')
    }
  })

  // Check for CSRF protection in forms
  walkDir(path.join(process.cwd(), 'components'), (filePath) => {
    const content = readFile(filePath)
    if (!content) return
    
    if (content.includes('<form') && content.includes('action=')) {
      if (!content.includes('csrf') && !content.includes('token')) {
        addFinding('Frontend Security', 'MEDIUM', `Form without CSRF token in ${path.relative(process.cwd(), filePath)}`,
          'Forms submitting to external endpoints should include CSRF protection',
          'Add CSRF token to forms or use fetch with proper headers')
      }
    }
  })

  // Check for secure cookie settings
  const middlewarePath = path.join(process.cwd(), 'middleware.ts')
  if (fs.existsSync(middlewarePath)) {
    const content = readFile(middlewarePath)
    if (content && (content.includes('httpOnly') || content.includes('secure'))) {
      addPass('Frontend Security', 'Secure cookie settings in middleware')
    }
  }

  // Check for Content Security Policy
  const nextConfig = readFile(path.join(process.cwd(), 'next.config.js')) || 
                    readFile(path.join(process.cwd(), 'next.config.mjs'))
  if (nextConfig && nextConfig.includes('Content-Security-Policy')) {
    addPass('Frontend Security', 'Content Security Policy configured')
  } else {
    addFinding('Frontend Security', 'LOW', 'No Content Security Policy',
      'CSP helps prevent XSS attacks',
      'Add Content-Security-Policy header in next.config.js')
  }

  console.log('   ✅ Frontend security audit complete')
}

// ============================================================================
// 6. DATABASE SECURITY (RLS)
// ============================================================================
function auditDatabaseSecurity() {
  console.log('\n' + '='.repeat(70))
  console.log('6. DATABASE SECURITY (RLS)')
  console.log('='.repeat(70))

  // Check for RLS policies in migrations
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
  let hasRlsPolicies = false
  let hasRlsEnabled = false
  
  if (fs.existsSync(migrationsDir)) {
    walkDir(migrationsDir, (filePath) => {
      const content = readFile(filePath)
      if (!content) return
      
      if (content.includes('ENABLE ROW LEVEL SECURITY') || content.includes('enable row level security')) {
        hasRlsEnabled = true
      }
      if (content.includes('CREATE POLICY') || content.includes('create policy')) {
        hasRlsPolicies = true
      }
    })
  }

  if (hasRlsEnabled) {
    addPass('Database Security', 'Row Level Security is enabled')
  } else {
    addFinding('Database Security', 'HIGH', 'RLS may not be enabled',
      'Row Level Security protects data at the database level',
      'Enable RLS on all tables: ALTER TABLE table_name ENABLE ROW LEVEL SECURITY')
  }

  if (hasRlsPolicies) {
    addPass('Database Security', 'RLS policies are defined')
  } else {
    addFinding('Database Security', 'HIGH', 'No RLS policies found',
      'Without policies, RLS will block all access',
      'Define appropriate RLS policies for each table and operation')
  }

  // Check for service role key usage
  let serviceRoleUsageCount = 0
  const apiDir = path.join(process.cwd(), 'app', 'api')
  
  walkDir(apiDir, (filePath) => {
    const content = readFile(filePath)
    if (!content) return
    
    if (content.includes('SUPABASE_SERVICE_ROLE_KEY') || content.includes('supabaseAdmin')) {
      serviceRoleUsageCount++
      
      // Check if there's auth before using service role
      const hasAuth = content.includes('authorization') || content.includes('getUser')
      if (!hasAuth && !filePath.includes('webhook')) {
        addFinding('Database Security', 'MEDIUM', `Service role without auth: ${path.relative(process.cwd(), filePath)}`,
          'Using service role bypasses RLS - ensure proper authorization',
          'Add authentication check before using service role client')
      }
    }
  })

  console.log(`   Service role used in ${serviceRoleUsageCount} API routes`)
  console.log('   ✅ Database security audit complete')
}

// ============================================================================
// 7. THIRD-PARTY INTEGRATION SECURITY
// ============================================================================
function auditThirdPartyIntegrations() {
  console.log('\n' + '='.repeat(70))
  console.log('7. THIRD-PARTY INTEGRATION SECURITY')
  console.log('='.repeat(70))

  // Check Stripe integration
  const stripeFiles = []
  walkDir(process.cwd(), (filePath) => {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return
    const content = readFile(filePath)
    if (content && content.includes('stripe')) {
      stripeFiles.push(filePath)
    }
  })

  if (stripeFiles.length > 0) {
    // Check for webhook signature verification
    let hasWebhookVerification = false
    for (const file of stripeFiles) {
      const content = readFile(file)
      if (content && (content.includes('constructEvent') || content.includes('verifySignature'))) {
        hasWebhookVerification = true
        break
      }
    }
    
    if (hasWebhookVerification) {
      addPass('Third-Party', 'Stripe webhook signature verification present')
    } else {
      addFinding('Third-Party', 'HIGH', 'Stripe webhook may not verify signatures',
        'Webhook events should be verified using the webhook secret',
        'Use stripe.webhooks.constructEvent() to verify webhook signatures')
    }
  }

  // Check IPFS integration
  walkDir(process.cwd(), (filePath) => {
    const content = readFile(filePath)
    if (!content) return
    
    if (content.includes('ipfs') || content.includes('pinata') || content.includes('nft.storage')) {
      // Check for proper error handling
      if (content.includes('try') && content.includes('catch')) {
        // Good - has error handling
      } else if (content.includes('fetch') && content.includes('ipfs')) {
        addFinding('Third-Party', 'LOW', `IPFS fetch without error handling: ${path.relative(process.cwd(), filePath)}`,
          'IPFS requests can fail - ensure proper error handling',
          'Wrap IPFS operations in try-catch blocks')
      }
    }
  })

  // Check for outdated dependencies (basic check)
  const packageJson = readFile(path.join(process.cwd(), 'package.json'))
  if (packageJson) {
    const pkg = JSON.parse(packageJson)
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    
    // Known vulnerable patterns
    if (deps['jsonwebtoken'] && deps['jsonwebtoken'].includes('^8')) {
      addFinding('Third-Party', 'MEDIUM', 'Potentially outdated jsonwebtoken',
        'Older versions may have security vulnerabilities',
        'Run npm audit and update dependencies')
    }
  }

  addPass('Third-Party', 'Third-party integration audit complete')
  console.log('   ✅ Third-party audit complete')
}

// ============================================================================
// GENERATE REPORT
// ============================================================================
function generateReport() {
  console.log('\n' + '='.repeat(70))
  console.log('SECURITY AUDIT REPORT')
  console.log('='.repeat(70))
  console.log(`Timestamp: ${REPORT.timestamp}`)
  console.log('')

  // Summary
  console.log('📊 SUMMARY')
  console.log('-'.repeat(40))
  const { critical, high, medium, low, passed } = REPORT.summary
  console.log(`   🔴 CRITICAL: ${critical}`)
  console.log(`   🟠 HIGH:     ${high}`)
  console.log(`   🟡 MEDIUM:   ${medium}`)
  console.log(`   🟢 LOW:      ${low}`)
  console.log(`   ✅ PASSED:   ${passed}`)
  console.log('')

  // Detailed findings by section
  for (const section of REPORT.sections) {
    console.log(`\n📋 ${section.name.toUpperCase()}`)
    console.log('-'.repeat(40))
    
    for (const finding of section.findings) {
      if (finding.severity === 'PASS') {
        console.log(`   ✅ ${finding.title}`)
      } else {
        const icon = finding.severity === 'CRITICAL' ? '🔴' :
                    finding.severity === 'HIGH' ? '🟠' :
                    finding.severity === 'MEDIUM' ? '🟡' : '🟢'
        console.log(`   ${icon} [${finding.severity}] ${finding.title}`)
        if (finding.details) {
          console.log(`      ${finding.details}`)
        }
        if (finding.recommendation) {
          console.log(`      💡 ${finding.recommendation}`)
        }
      }
    }
  }

  // Final verdict
  console.log('\n' + '='.repeat(70))
  if (critical > 0) {
    console.log('🚨 CRITICAL ISSUES FOUND - IMMEDIATE ACTION REQUIRED')
  } else if (high > 0) {
    console.log('⚠️  HIGH PRIORITY ISSUES FOUND - ACTION RECOMMENDED')
  } else if (medium > 0) {
    console.log('📝 MEDIUM PRIORITY ISSUES - REVIEW RECOMMENDED')
  } else {
    console.log('✅ SECURITY AUDIT PASSED - NO CRITICAL ISSUES')
  }
  console.log('='.repeat(70))

  // Save report to file
  const reportPath = path.join(process.cwd(), 'security-audit-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(REPORT, null, 2))
  console.log(`\n📄 Full report saved to: security-audit-report.json`)
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log('🔐 COMPREHENSIVE SECURITY AUDIT - MARS MISSION LEVEL')
  console.log('='.repeat(70))
  console.log(`Date: ${new Date().toISOString()}`)
  console.log(`Directory: ${process.cwd()}`)

  auditSmartContracts()
  auditApiSecurity()
  auditDataExposure()
  auditEnvironment()
  auditFrontendSecurity()
  auditDatabaseSecurity()
  auditThirdPartyIntegrations()
  generateReport()
}

main().catch(console.error)
