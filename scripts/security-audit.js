// Comprehensive Security Audit Script
// Checks for exposed secrets, API keys, and sensitive data patterns
// Run with: node scripts/security-audit.js

const fs = require('fs')
const path = require('path')

const SENSITIVE_PATTERNS = [
  // API Keys and Secrets
  { pattern: /SUPABASE_SERVICE_ROLE_KEY/gi, severity: 'CRITICAL', desc: 'Supabase service role key reference' },
  { pattern: /service_role/gi, severity: 'HIGH', desc: 'Service role reference' },
  { pattern: /eyJ[A-Za-z0-9_-]{100,}/g, severity: 'CRITICAL', desc: 'JWT token (potential secret)' },
  { pattern: /sk_live_[A-Za-z0-9]{20,}/g, severity: 'CRITICAL', desc: 'Stripe live secret key' },
  { pattern: /sk_test_[A-Za-z0-9]{20,}/g, severity: 'HIGH', desc: 'Stripe test secret key' },
  { pattern: /[a-f0-9]{64}/gi, severity: 'MEDIUM', desc: 'Potential private key (64 hex chars)' },
  
  // Database credentials
  { pattern: /postgres:\/\/[^@]+@/gi, severity: 'CRITICAL', desc: 'PostgreSQL connection string with credentials' },
  { pattern: /password\s*[:=]\s*['"][^'"]+['"]/gi, severity: 'HIGH', desc: 'Hardcoded password' },
  
  // Private keys
  { pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g, severity: 'CRITICAL', desc: 'Private key' },
  { pattern: /0x[a-fA-F0-9]{64}/g, severity: 'HIGH', desc: 'Potential wallet private key' },
  
  // API endpoints that shouldn't be public
  { pattern: /admin.*secret/gi, severity: 'HIGH', desc: 'Admin secret reference' },
  
  // Console logs that might expose data
  { pattern: /console\.(log|warn|error)\([^)]*(?:password|secret|key|token|auth)[^)]*\)/gi, severity: 'MEDIUM', desc: 'Console log with sensitive variable names' },
]

const SKIP_DIRS = ['node_modules', '.git', '.next', 'out', 'dist', '.vercel', '.netlify']
const SKIP_FILES = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']
const CHECK_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.env', '.md', '.sql', '.html']

const findings = []

function scanFile(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (!CHECK_EXTENSIONS.includes(ext)) return
  if (SKIP_FILES.includes(path.basename(filePath))) return
  
  // Skip .env files in gitignore (they should have secrets)
  if (filePath.includes('.env') && !filePath.includes('.env.example')) return
  
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')
    
    for (const { pattern, severity, desc } of SENSITIVE_PATTERNS) {
      let match
      const regex = new RegExp(pattern.source, pattern.flags)
      
      while ((match = regex.exec(content)) !== null) {
        // Find line number
        let lineNum = 1
        let pos = 0
        for (const line of lines) {
          if (pos + line.length >= match.index) {
            break
          }
          pos += line.length + 1
          lineNum++
        }
        
        // Get context (surrounding text)
        const start = Math.max(0, match.index - 30)
        const end = Math.min(content.length, match.index + match[0].length + 30)
        const context = content.slice(start, end).replace(/\n/g, ' ').trim()
        
        findings.push({
          file: filePath,
          line: lineNum,
          severity,
          desc,
          match: match[0].slice(0, 50) + (match[0].length > 50 ? '...' : ''),
          context: context.slice(0, 100)
        })
      }
    }
  } catch (e) {
    // Skip unreadable files
  }
}

function scanDirectory(dir) {
  try {
    const items = fs.readdirSync(dir)
    
    for (const item of items) {
      if (SKIP_DIRS.includes(item)) continue
      
      const fullPath = path.join(dir, item)
      const stat = fs.statSync(fullPath)
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath)
      } else if (stat.isFile()) {
        scanFile(fullPath)
      }
    }
  } catch (e) {
    // Skip unreadable directories
  }
}

function checkEnvUsage() {
  console.log('\n' + '='.repeat(70))
  console.log('ENVIRONMENT VARIABLE USAGE AUDIT')
  console.log('='.repeat(70))
  
  const envVars = {
    // Should ONLY be server-side
    serverOnly: [
      'SUPABASE_SERVICE_ROLE_KEY',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'BLOCKDAG_PRIVATE_KEY',
      'DIDIT_CLIENT_SECRET',
      'PERSONA_API_KEY',
      'RESEND_API_KEY',
    ],
    // Can be client-side (NEXT_PUBLIC_)
    publicOk: [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      'NEXT_PUBLIC_CONTRACT_ADDRESS',
      'NEXT_PUBLIC_SITE_URL',
    ]
  }
  
  console.log('\n🔴 SERVER-ONLY variables (should NEVER appear in client code):')
  for (const v of envVars.serverOnly) {
    console.log(`   ${v}`)
  }
  
  console.log('\n🟢 PUBLIC variables (OK to use in client code):')
  for (const v of envVars.publicOk) {
    console.log(`   ${v}`)
  }
  
  // Check if server-only vars are used in client components
  console.log('\n📋 Checking for server-only vars in client components...')
  
  const clientFiles = []
  function findClientFiles(dir) {
    try {
      const items = fs.readdirSync(dir)
      for (const item of items) {
        if (SKIP_DIRS.includes(item)) continue
        const fullPath = path.join(dir, item)
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
          findClientFiles(fullPath)
        } else if (stat.isFile() && (item.endsWith('.tsx') || item.endsWith('.ts'))) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8')
            if (content.includes("'use client'") || content.includes('"use client"')) {
              clientFiles.push(fullPath)
            }
          } catch {}
        }
      }
    } catch {}
  }
  
  findClientFiles(process.cwd())
  
  let serverVarInClientCount = 0
  for (const file of clientFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8')
      for (const v of envVars.serverOnly) {
        if (content.includes(v)) {
          console.log(`   ⚠️  ${v} found in client file: ${file}`)
          serverVarInClientCount++
        }
      }
    } catch {}
  }
  
  if (serverVarInClientCount === 0) {
    console.log('   ✅ No server-only variables found in client components')
  }
}

function checkApiRoutes() {
  console.log('\n' + '='.repeat(70))
  console.log('API ROUTE SECURITY AUDIT')
  console.log('='.repeat(70))
  
  const apiDir = path.join(process.cwd(), 'app', 'api')
  const issues = []
  
  function checkRoute(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      const relativePath = path.relative(process.cwd(), filePath)
      
      // Check for auth
      const hasAuthCheck = content.includes('authorization') || 
                          content.includes('getUser') || 
                          content.includes('getSession')
      
      // Check if it returns sensitive data
      const returnsSensitiveData = content.includes('service_role') ||
                                   content.includes('password') ||
                                   content.includes('secret')
      
      // Check for proper error handling
      const hasTryCatch = content.includes('try') && content.includes('catch')
      
      // Check for data sanitization
      const sanitizesOutput = content.includes('select(') // Using Supabase select is good
      
      if (!hasAuthCheck && !relativePath.includes('webhook')) {
        issues.push({ file: relativePath, issue: 'No authentication check', severity: 'HIGH' })
      }
      
      if (returnsSensitiveData) {
        issues.push({ file: relativePath, issue: 'May return sensitive data', severity: 'MEDIUM' })
      }
      
      if (!hasTryCatch) {
        issues.push({ file: relativePath, issue: 'No try-catch error handling', severity: 'LOW' })
      }
    } catch {}
  }
  
  function scanApiDir(dir) {
    try {
      const items = fs.readdirSync(dir)
      for (const item of items) {
        const fullPath = path.join(dir, item)
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
          scanApiDir(fullPath)
        } else if (item === 'route.ts' || item === 'route.js') {
          checkRoute(fullPath)
        }
      }
    } catch {}
  }
  
  if (fs.existsSync(apiDir)) {
    scanApiDir(apiDir)
  }
  
  if (issues.length === 0) {
    console.log('   ✅ No critical issues found in API routes')
  } else {
    for (const issue of issues) {
      const icon = issue.severity === 'HIGH' ? '🔴' : issue.severity === 'MEDIUM' ? '🟡' : '🟢'
      console.log(`   ${icon} [${issue.severity}] ${issue.file}: ${issue.issue}`)
    }
  }
  
  return issues
}

function main() {
  console.log('🔐 COMPREHENSIVE SECURITY AUDIT')
  console.log('=' .repeat(70))
  console.log('Date:', new Date().toISOString())
  console.log('Directory:', process.cwd())
  
  // 1. Scan for sensitive patterns
  console.log('\n' + '='.repeat(70))
  console.log('SENSITIVE PATTERN SCAN')
  console.log('='.repeat(70))
  
  scanDirectory(process.cwd())
  
  // Filter out false positives
  const realFindings = findings.filter(f => {
    // Ignore references in comments/docs
    if (f.context.includes('//') || f.context.includes('*')) return false
    // Ignore type definitions
    if (f.file.includes('.d.ts')) return false
    // Ignore this audit script
    if (f.file.includes('security-audit')) return false
    return true
  })
  
  if (realFindings.length === 0) {
    console.log('   ✅ No sensitive patterns detected')
  } else {
    const critical = realFindings.filter(f => f.severity === 'CRITICAL')
    const high = realFindings.filter(f => f.severity === 'HIGH')
    const medium = realFindings.filter(f => f.severity === 'MEDIUM')
    
    console.log(`\n   Found: ${critical.length} CRITICAL, ${high.length} HIGH, ${medium.length} MEDIUM`)
    
    for (const f of realFindings.slice(0, 20)) {
      const icon = f.severity === 'CRITICAL' ? '🔴' : f.severity === 'HIGH' ? '🟡' : '🟢'
      console.log(`\n   ${icon} [${f.severity}] ${f.desc}`)
      console.log(`      File: ${f.file}:${f.line}`)
      console.log(`      Match: ${f.match}`)
    }
    
    if (realFindings.length > 20) {
      console.log(`\n   ... and ${realFindings.length - 20} more findings`)
    }
  }
  
  // 2. Check environment variable usage
  checkEnvUsage()
  
  // 3. Check API routes
  const apiIssues = checkApiRoutes()
  
  // 4. Summary
  console.log('\n' + '='.repeat(70))
  console.log('SECURITY AUDIT SUMMARY')
  console.log('='.repeat(70))
  
  const criticalCount = realFindings.filter(f => f.severity === 'CRITICAL').length
  const highApiIssues = apiIssues.filter(i => i.severity === 'HIGH').length
  
  if (criticalCount > 0 || highApiIssues > 0) {
    console.log('\n🔴 CRITICAL ISSUES FOUND - IMMEDIATE ACTION REQUIRED')
  } else {
    console.log('\n✅ No critical security issues detected')
  }
  
  console.log(`\n   Pattern findings: ${realFindings.length}`)
  console.log(`   API route issues: ${apiIssues.length}`)
  
  console.log('\n📋 RECOMMENDATIONS:')
  console.log('   1. Never expose SUPABASE_SERVICE_ROLE_KEY to client')
  console.log('   2. Use NEXT_PUBLIC_ prefix only for truly public data')
  console.log('   3. All API routes should check authentication')
  console.log('   4. Never log sensitive data (passwords, tokens, keys)')
  console.log('   5. Use environment variables, never hardcode secrets')
  
  console.log('\n✅ Audit complete!')
}

main()
