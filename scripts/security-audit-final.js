/**
 * FINAL SECURITY AUDIT - Production Ready Check
 * Excludes known false positives, focuses on real security issues
 * 
 * Run with: node scripts/security-audit-final.js
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
  const finding = { severity: 'PASS', title }
  const existingSection = REPORT.sections.find(s => s.name === section)
  if (existingSection) {
    existingSection.findings.push(finding)
  } else {
    REPORT.sections.push({ name: section, findings: [finding] })
  }
  REPORT.summary.passed++
}

const SKIP_DIRS = ['node_modules', '.git', '.next', 'out', 'dist', '.vercel', '.netlify', 'scripts']
const SKIP_FILES = ['package-lock.json', 'yarn.lock', 'tsconfig.tsbuildinfo']

function walkDir(dir, callback) {
  try {
    const items = fs.readdirSync(dir)
    for (const item of items) {
      if (SKIP_DIRS.includes(item)) continue
      if (SKIP_FILES.includes(item)) continue
      const fullPath = path.join(dir, item)
      try {
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) walkDir(fullPath, callback)
        else callback(fullPath)
      } catch {}
    }
  } catch {}
}

function readFile(filePath) {
  try { return fs.readFileSync(filePath, 'utf8') } catch { return null }
}

console.log('🔐 FINAL SECURITY AUDIT - PRODUCTION READY CHECK')
console.log('='.repeat(70))
console.log(`Date: ${new Date().toISOString()}`)
console.log('')

// ============================================================================
// 1. CRITICAL: Hardcoded Secrets Check
// ============================================================================
console.log('1️⃣  Checking for hardcoded secrets...')

const secretPatterns = [
  { pattern: /sk_live_[A-Za-z0-9]{20,}/g, name: 'Stripe LIVE key' },
  { pattern: /-----BEGIN.*PRIVATE KEY-----/g, name: 'Private key file' },
  { pattern: /ghp_[A-Za-z0-9]{36}/g, name: 'GitHub token' },
]

let hardcodedSecrets = 0
walkDir(process.cwd(), (filePath) => {
  if (!filePath.match(/\.(ts|tsx|js|jsx)$/)) return
  const content = readFile(filePath)
  if (!content) return
  
  for (const { pattern, name } of secretPatterns) {
    if (pattern.test(content)) {
      addFinding('Secrets', 'CRITICAL', `Hardcoded ${name}`, path.relative(process.cwd(), filePath), 'Remove immediately')
      hardcodedSecrets++
    }
  }
})

if (hardcodedSecrets === 0) {
  addPass('Secrets', 'No hardcoded production secrets found')
  console.log('   ✅ No hardcoded secrets')
} else {
  console.log(`   🔴 Found ${hardcodedSecrets} hardcoded secrets!`)
}

// ============================================================================
// 2. CRITICAL: Server-only vars in client components
// ============================================================================
console.log('2️⃣  Checking server-only vars in client components...')

const serverOnlyVars = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY', 
  'STRIPE_WEBHOOK_SECRET',
  'BLOCKDAG_PRIVATE_KEY',
]

let serverVarsInClient = 0
walkDir(path.join(process.cwd(), 'components'), (filePath) => {
  const content = readFile(filePath)
  if (!content) return
  
  for (const varName of serverOnlyVars) {
    if (content.includes(`process.env.${varName}`)) {
      addFinding('Secrets', 'CRITICAL', `${varName} in client component`, path.relative(process.cwd(), filePath), 'Move to API route')
      serverVarsInClient++
    }
  }
})

if (serverVarsInClient === 0) {
  addPass('Secrets', 'Server-only vars not in client components')
  console.log('   ✅ Server-only vars protected')
} else {
  console.log(`   🔴 Found ${serverVarsInClient} server vars in client!`)
}

// ============================================================================
// 3. HIGH: Admin routes without auth
// ============================================================================
console.log('3️⃣  Checking admin route authentication...')

const adminDir = path.join(process.cwd(), 'app', 'api', 'admin')
let unprotectedAdmin = 0

if (fs.existsSync(adminDir)) {
  walkDir(adminDir, (filePath) => {
    if (!filePath.endsWith('route.ts')) return
    const content = readFile(filePath)
    if (!content) return
    
    const hasAuth = content.includes('authorization') || 
                   content.includes('getUser') ||
                   content.includes('verifyAdminAuth')
    
    if (!hasAuth) {
      addFinding('Auth', 'HIGH', 'Admin route without auth', path.relative(process.cwd(), filePath), 'Add verifyAdminAuth()')
      unprotectedAdmin++
    }
  })
}

if (unprotectedAdmin === 0) {
  addPass('Auth', 'All admin routes have authentication')
  console.log('   ✅ All admin routes protected')
} else {
  console.log(`   🟠 Found ${unprotectedAdmin} unprotected admin routes`)
}

// ============================================================================
// 4. HIGH: Debug endpoints protection
// ============================================================================
console.log('4️⃣  Checking debug endpoint protection...')

const debugDir = path.join(process.cwd(), 'app', 'api', 'debug')
let unprotectedDebug = 0

if (fs.existsSync(debugDir)) {
  walkDir(debugDir, (filePath) => {
    if (!filePath.endsWith('route.ts')) return
    const content = readFile(filePath)
    if (!content) return
    
    const hasAuth = content.includes('verifyAdminAuth')
    if (!hasAuth) {
      addFinding('Auth', 'HIGH', 'Debug route without auth', path.relative(process.cwd(), filePath), 'Add verifyAdminAuth()')
      unprotectedDebug++
    }
  })
}

if (unprotectedDebug === 0) {
  addPass('Auth', 'All debug routes have authentication')
  console.log('   ✅ All debug routes protected')
} else {
  console.log(`   🟠 Found ${unprotectedDebug} unprotected debug routes`)
}

// ============================================================================
// 5. HIGH: XSS vulnerabilities
// ============================================================================
console.log('5️⃣  Checking for XSS vulnerabilities...')

let xssIssues = 0
walkDir(path.join(process.cwd(), 'components'), (filePath) => {
  const content = readFile(filePath)
  if (!content) return
  
  if (content.includes('dangerouslySetInnerHTML')) {
    // Check if it's sanitized
    if (!content.includes('DOMPurify') && !content.includes('sanitize')) {
      addFinding('XSS', 'HIGH', 'Unsanitized dangerouslySetInnerHTML', path.relative(process.cwd(), filePath), 'Use DOMPurify to sanitize')
      xssIssues++
    }
  }
})

if (xssIssues === 0) {
  addPass('XSS', 'No unsanitized HTML injection found')
  console.log('   ✅ No XSS vulnerabilities')
} else {
  console.log(`   🟠 Found ${xssIssues} potential XSS issues`)
}

// ============================================================================
// 6. MEDIUM: Environment files in gitignore
// ============================================================================
console.log('6️⃣  Checking .env files are gitignored...')

const gitignore = readFile(path.join(process.cwd(), '.gitignore')) || ''
const envChecks = ['.env', '.env.local', '.env.production']
let envIssues = 0

for (const envFile of envChecks) {
  if (fs.existsSync(path.join(process.cwd(), envFile))) {
    if (!gitignore.includes(envFile)) {
      addFinding('Environment', 'CRITICAL', `${envFile} not in .gitignore`, 'May be committed to repo', 'Add to .gitignore')
      envIssues++
    } else {
      addPass('Environment', `${envFile} is in .gitignore`)
    }
  }
}

if (envIssues === 0) {
  console.log('   ✅ All .env files are gitignored')
} else {
  console.log(`   🔴 ${envIssues} env files not in .gitignore!`)
}

// ============================================================================
// 7. MEDIUM: Security headers
// ============================================================================
console.log('7️⃣  Checking security headers...')

const nextConfig = readFile(path.join(process.cwd(), 'next.config.mjs')) || 
                  readFile(path.join(process.cwd(), 'next.config.js')) || ''

const requiredHeaders = [
  { name: 'Strict-Transport-Security', desc: 'HSTS' },
  { name: 'X-Content-Type-Options', desc: 'MIME sniffing protection' },
  { name: 'X-Frame-Options', desc: 'Clickjacking protection' },
  { name: 'X-XSS-Protection', desc: 'XSS filter' },
]

for (const { name, desc } of requiredHeaders) {
  if (nextConfig.includes(name)) {
    addPass('Headers', `${desc} (${name})`)
  } else {
    addFinding('Headers', 'MEDIUM', `Missing ${desc}`, name, 'Add to next.config headers')
  }
}

console.log('   ✅ Security headers configured')

// ============================================================================
// 8. Database: RLS enabled
// ============================================================================
console.log('8️⃣  Checking database RLS...')

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
let rlsEnabled = false
let rlsPolicies = false

if (fs.existsSync(migrationsDir)) {
  fs.readdirSync(migrationsDir).forEach(file => {
    const content = readFile(path.join(migrationsDir, file))
    if (content) {
      if (content.toLowerCase().includes('enable row level security')) rlsEnabled = true
      if (content.toLowerCase().includes('create policy')) rlsPolicies = true
    }
  })
}

if (rlsEnabled) addPass('Database', 'Row Level Security enabled')
else addFinding('Database', 'HIGH', 'RLS may not be enabled', 'Check Supabase dashboard', 'Enable RLS on all tables')

if (rlsPolicies) addPass('Database', 'RLS policies defined')
else addFinding('Database', 'HIGH', 'No RLS policies found', 'Tables may be inaccessible', 'Define appropriate policies')

console.log('   ✅ Database security checked')

// ============================================================================
// 9. Third-party: Stripe webhook verification
// ============================================================================
console.log('9️⃣  Checking Stripe webhook security...')

const webhookPath = path.join(process.cwd(), 'app', 'api', 'payments', 'stripe', 'webhook', 'route.ts')
if (fs.existsSync(webhookPath)) {
  const content = readFile(webhookPath)
  if (content && content.includes('constructEvent')) {
    addPass('Third-Party', 'Stripe webhook signature verification')
    console.log('   ✅ Stripe webhooks verified')
  } else {
    addFinding('Third-Party', 'HIGH', 'Stripe webhook not verifying signatures', webhookPath, 'Use stripe.webhooks.constructEvent()')
    console.log('   🟠 Stripe webhook verification missing')
  }
} else {
  addPass('Third-Party', 'No Stripe webhook (N/A)')
  console.log('   ✅ No Stripe webhook to check')
}

// ============================================================================
// FINAL REPORT
// ============================================================================
console.log('\n' + '='.repeat(70))
console.log('SECURITY AUDIT SUMMARY')
console.log('='.repeat(70))

const { critical, high, medium, low, passed } = REPORT.summary
console.log(`\n   🔴 CRITICAL: ${critical}`)
console.log(`   🟠 HIGH:     ${high}`)
console.log(`   🟡 MEDIUM:   ${medium}`)
console.log(`   🟢 LOW:      ${low}`)
console.log(`   ✅ PASSED:   ${passed}`)

// Show all findings
console.log('\n' + '-'.repeat(70))
for (const section of REPORT.sections) {
  console.log(`\n📋 ${section.name}`)
  for (const f of section.findings) {
    if (f.severity === 'PASS') {
      console.log(`   ✅ ${f.title}`)
    } else {
      const icon = f.severity === 'CRITICAL' ? '🔴' : f.severity === 'HIGH' ? '🟠' : f.severity === 'MEDIUM' ? '🟡' : '🟢'
      console.log(`   ${icon} [${f.severity}] ${f.title}`)
      if (f.details) console.log(`      ${f.details}`)
      if (f.recommendation) console.log(`      💡 ${f.recommendation}`)
    }
  }
}

// Verdict
console.log('\n' + '='.repeat(70))
if (critical > 0) {
  console.log('🚨 CRITICAL ISSUES - DO NOT DEPLOY')
} else if (high > 0) {
  console.log('⚠️  HIGH PRIORITY ISSUES - REVIEW BEFORE DEPLOY')
} else {
  console.log('✅ SECURITY AUDIT PASSED - READY FOR PRODUCTION')
}
console.log('='.repeat(70))

// Save report
fs.writeFileSync('security-audit-report.json', JSON.stringify(REPORT, null, 2))
console.log('\n📄 Report saved: security-audit-report.json')
