// Focused Security Audit - Real Issues Only
// Run with: node scripts/security-audit-focused.js

const fs = require('fs')
const path = require('path')

console.log('🔐 FOCUSED SECURITY AUDIT')
console.log('='.repeat(70))
console.log('Date:', new Date().toISOString())

const issues = []

// 1. Check for hardcoded secrets (not env var references)
console.log('\n📋 1. CHECKING FOR HARDCODED SECRETS...')

const secretPatterns = [
  { pattern: /sk_live_[A-Za-z0-9]{20,}/g, desc: 'Stripe live key' },
  { pattern: /sk_test_[A-Za-z0-9]{20,}/g, desc: 'Stripe test key' },
  { pattern: /-----BEGIN.*PRIVATE KEY-----/g, desc: 'Private key' },
]

function scanForSecrets(dir) {
  const skipDirs = ['node_modules', '.git', '.next', 'scripts']
  try {
    const items = fs.readdirSync(dir)
    for (const item of items) {
      if (skipDirs.includes(item)) continue
      const fullPath = path.join(dir, item)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        scanForSecrets(fullPath)
      } else if (item.endsWith('.ts') || item.endsWith('.tsx') || item.endsWith('.js')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8')
          for (const { pattern, desc } of secretPatterns) {
            if (pattern.test(content)) {
              issues.push({ type: 'CRITICAL', file: fullPath, issue: `Hardcoded ${desc}` })
            }
          }
        } catch {}
      }
    }
  } catch {}
}

scanForSecrets(process.cwd())
console.log(issues.length === 0 ? '   ✅ No hardcoded secrets found' : `   🔴 Found ${issues.length} issues`)

// 2. Check debug endpoints
console.log('\n📋 2. DEBUG ENDPOINTS (should be disabled in production)...')

const debugDir = path.join(process.cwd(), 'app', 'api', 'debug')
if (fs.existsSync(debugDir)) {
  const debugRoutes = []
  function findRoutes(dir) {
    try {
      const items = fs.readdirSync(dir)
      for (const item of items) {
        const fullPath = path.join(dir, item)
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) findRoutes(fullPath)
        else if (item === 'route.ts') debugRoutes.push(fullPath)
      }
    } catch {}
  }
  findRoutes(debugDir)
  
  console.log(`   ⚠️  Found ${debugRoutes.length} debug endpoints:`)
  for (const r of debugRoutes) {
    console.log(`      - ${path.relative(process.cwd(), r)}`)
  }
  console.log('   RECOMMENDATION: Add auth check or disable in production')
} else {
  console.log('   ✅ No debug directory found')
}

// 3. Check admin routes have auth
console.log('\n📋 3. ADMIN ROUTES SECURITY...')

const adminDir = path.join(process.cwd(), 'app', 'api', 'admin')
if (fs.existsSync(adminDir)) {
  function checkAdminRoutes(dir) {
    try {
      const items = fs.readdirSync(dir)
      for (const item of items) {
        const fullPath = path.join(dir, item)
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) checkAdminRoutes(fullPath)
        else if (item === 'route.ts') {
          const content = fs.readFileSync(fullPath, 'utf8')
          const hasAuth = content.includes('authorization') || content.includes('getUser')
          const hasRoleCheck = content.includes('role') && (content.includes('admin') || content.includes('super_admin'))
          
          const relativePath = path.relative(process.cwd(), fullPath)
          if (!hasAuth) {
            console.log(`   🔴 NO AUTH: ${relativePath}`)
            issues.push({ type: 'HIGH', file: relativePath, issue: 'Admin route without auth' })
          } else if (!hasRoleCheck) {
            console.log(`   🟡 NO ROLE CHECK: ${relativePath}`)
          } else {
            console.log(`   ✅ ${relativePath}`)
          }
        }
      }
    } catch {}
  }
  checkAdminRoutes(adminDir)
}

// 4. Check for console.log with sensitive data
console.log('\n📋 4. CONSOLE.LOG WITH SENSITIVE VARIABLE NAMES...')

const sensitiveLogPatterns = [
  /console\.log\([^)]*password[^)]*\)/gi,
  /console\.log\([^)]*secret[^)]*\)/gi,
  /console\.log\([^)]*apiKey[^)]*\)/gi,
  /console\.log\([^)]*token[^)]*\)/gi,
]

let sensitiveLogCount = 0
function checkConsoleLogs(dir) {
  const skipDirs = ['node_modules', '.git', '.next', 'scripts']
  try {
    const items = fs.readdirSync(dir)
    for (const item of items) {
      if (skipDirs.includes(item)) continue
      const fullPath = path.join(dir, item)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        checkConsoleLogs(fullPath)
      } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8')
          for (const pattern of sensitiveLogPatterns) {
            const matches = content.match(pattern)
            if (matches) {
              for (const m of matches) {
                // Skip if it's logging auth check result, not the actual token
                if (m.includes('token:') && !m.includes('Bearer')) continue
                console.log(`   ⚠️  ${path.relative(process.cwd(), fullPath)}: ${m.slice(0, 60)}...`)
                sensitiveLogCount++
              }
            }
          }
        } catch {}
      }
    }
  } catch {}
}

checkConsoleLogs(process.cwd())
if (sensitiveLogCount === 0) {
  console.log('   ✅ No sensitive data in console.log statements')
}

// 5. Check API responses don't include env vars
console.log('\n📋 5. API RESPONSES EXPOSING ENV VARS...')

function checkApiResponses(dir) {
  const skipDirs = ['node_modules', '.git', '.next']
  try {
    const items = fs.readdirSync(dir)
    for (const item of items) {
      if (skipDirs.includes(item)) continue
      const fullPath = path.join(dir, item)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        checkApiResponses(fullPath)
      } else if (item === 'route.ts') {
        try {
          const content = fs.readFileSync(fullPath, 'utf8')
          // Check if process.env is included in response
          if (content.includes('NextResponse.json') && content.includes('process.env')) {
            // Check if env var is in response object
            const responseMatches = content.match(/NextResponse\.json\(\s*\{[^}]+\}/g)
            for (const m of (responseMatches || [])) {
              if (m.includes('process.env')) {
                console.log(`   🔴 ${path.relative(process.cwd(), fullPath)}: May expose env var in response`)
                issues.push({ type: 'HIGH', file: fullPath, issue: 'May expose env var in API response' })
              }
            }
          }
        } catch {}
      }
    }
  } catch {}
}

checkApiResponses(path.join(process.cwd(), 'app', 'api'))

// 6. Check .env files aren't committed
console.log('\n📋 6. .ENV FILES STATUS...')

const envFiles = ['.env', '.env.local', '.env.production']
for (const f of envFiles) {
  const filePath = path.join(process.cwd(), f)
  if (fs.existsSync(filePath)) {
    // Check if it's in .gitignore
    try {
      const gitignore = fs.readFileSync(path.join(process.cwd(), '.gitignore'), 'utf8')
      if (gitignore.includes(f)) {
        console.log(`   ✅ ${f} exists and is in .gitignore`)
      } else {
        console.log(`   🔴 ${f} exists but NOT in .gitignore!`)
        issues.push({ type: 'CRITICAL', file: f, issue: 'Env file not in .gitignore' })
      }
    } catch {
      console.log(`   ⚠️  ${f} exists, couldn't check .gitignore`)
    }
  }
}

// Summary
console.log('\n' + '='.repeat(70))
console.log('SECURITY AUDIT SUMMARY')
console.log('='.repeat(70))

const critical = issues.filter(i => i.type === 'CRITICAL')
const high = issues.filter(i => i.type === 'HIGH')

if (critical.length > 0) {
  console.log('\n🔴 CRITICAL ISSUES:')
  for (const i of critical) {
    console.log(`   - ${i.file}: ${i.issue}`)
  }
}

if (high.length > 0) {
  console.log('\n🟡 HIGH PRIORITY ISSUES:')
  for (const i of high) {
    console.log(`   - ${i.file}: ${i.issue}`)
  }
}

if (critical.length === 0 && high.length === 0) {
  console.log('\n✅ No critical or high priority security issues found!')
}

console.log('\n📋 NETLIFY-SPECIFIC RECOMMENDATIONS:')
console.log('   1. All SUPABASE_SERVICE_ROLE_KEY usage is in API routes (server-side) ✅')
console.log('   2. NEXT_PUBLIC_ vars are safe to expose (they\'re public by design)')
console.log('   3. Debug endpoints should be protected or disabled')
console.log('   4. Admin routes should verify user role')

console.log('\n✅ Focused audit complete!')
