#!/usr/bin/env node
/**
 * Automated Security Scanning Script
 * 
 * Runs various security checks on the codebase:
 * 1. npm audit for dependency vulnerabilities
 * 2. Environment variable checks
 * 3. Hardcoded secrets detection
 * 4. API endpoint security audit
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  category: string
  message: string
  file?: string
  line?: number
}

const issues: SecurityIssue[] = []

function log(color: string, message: string) {
  console.log(`${color}${message}${COLORS.reset}`)
}

function addIssue(issue: SecurityIssue) {
  issues.push(issue)
}

// Check 1: NPM Audit
function checkNpmAudit() {
  log(COLORS.cyan, '\n📦 Running npm audit...')
  try {
    const result = execSync('npm audit --json', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
    const audit = JSON.parse(result)
    
    if (audit.metadata?.vulnerabilities) {
      const vuln = audit.metadata.vulnerabilities
      if (vuln.critical > 0) {
        addIssue({ severity: 'critical', category: 'Dependencies', message: `${vuln.critical} critical vulnerabilities found` })
      }
      if (vuln.high > 0) {
        addIssue({ severity: 'high', category: 'Dependencies', message: `${vuln.high} high severity vulnerabilities found` })
      }
      if (vuln.moderate > 0) {
        addIssue({ severity: 'medium', category: 'Dependencies', message: `${vuln.moderate} moderate vulnerabilities found` })
      }
      log(COLORS.green, `  ✓ Audit complete: ${vuln.critical} critical, ${vuln.high} high, ${vuln.moderate} moderate`)
    }
  } catch (e: any) {
    // npm audit exits with non-zero if vulnerabilities found
    try {
      const output = e.stdout?.toString() || '{}'
      const audit = JSON.parse(output)
      if (audit.metadata?.vulnerabilities) {
        const vuln = audit.metadata.vulnerabilities
        if (vuln.critical > 0) {
          addIssue({ severity: 'critical', category: 'Dependencies', message: `${vuln.critical} critical vulnerabilities` })
        }
        if (vuln.high > 0) {
          addIssue({ severity: 'high', category: 'Dependencies', message: `${vuln.high} high vulnerabilities` })
        }
        log(COLORS.yellow, `  ⚠ Found vulnerabilities: ${vuln.critical || 0} critical, ${vuln.high || 0} high`)
      }
    } catch {
      log(COLORS.yellow, '  ⚠ Could not parse npm audit output')
    }
  }
}

// Check 2: Environment Variables
function checkEnvVariables() {
  log(COLORS.cyan, '\n🔐 Checking environment variables...')
  
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'BLOCKDAG_RPC',
  ]
  
  const sensitiveVars = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'PINATA_JWT',
    'NOWNODES_API_KEY',
    'DEPLOYER_PRIVATE_KEY',
  ]

  // Check .env.local exists
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) {
    addIssue({ severity: 'high', category: 'Environment', message: '.env.local file not found' })
    return
  }

  const envContent = fs.readFileSync(envPath, 'utf-8')
  const envVars = new Set(envContent.split('\n')
    .filter(line => line.includes('=') && !line.startsWith('#'))
    .map(line => line.split('=')[0].trim()))

  for (const v of requiredVars) {
    if (!envVars.has(v)) {
      addIssue({ severity: 'medium', category: 'Environment', message: `Missing required env var: ${v}` })
    }
  }

  log(COLORS.green, `  ✓ Checked ${requiredVars.length} required variables`)
}

// Check 3: Hardcoded Secrets Detection
function checkHardcodedSecrets() {
  log(COLORS.cyan, '\n🔍 Scanning for hardcoded secrets...')
  
  const patterns = [
    { name: 'Private Key', regex: /['"]0x[a-fA-F0-9]{64}['"]/ },
    { name: 'API Key', regex: /['"][a-zA-Z0-9_-]{32,}['"]/ },
    { name: 'JWT Token', regex: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/ },
    { name: 'Password', regex: /password\s*[=:]\s*['"][^'"]+['"]/ },
  ]

  const excludeDirs = ['node_modules', '.next', '.git', 'dist', 'build']
  const includeExts = ['.ts', '.tsx', '.js', '.jsx', '.json']

  function scanDir(dir: string) {
    const items = fs.readdirSync(dir, { withFileTypes: true })
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name)
      
      if (item.isDirectory()) {
        if (!excludeDirs.includes(item.name)) {
          scanDir(fullPath)
        }
      } else if (item.isFile() && includeExts.some(ext => item.name.endsWith(ext))) {
        // Skip env files and config
        if (item.name.includes('.env') || item.name === 'package-lock.json') continue
        
        const content = fs.readFileSync(fullPath, 'utf-8')
        const lines = content.split('\n')
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          
          // Skip comments and imports
          if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.includes('import')) continue
          
          for (const pattern of patterns) {
            if (pattern.regex.test(line)) {
              // Skip false positives
              if (line.includes('process.env') || line.includes('NEXT_PUBLIC_')) continue
              if (line.includes('example') || line.includes('test') || line.includes('mock')) continue
              if (item.name.includes('.test.') || item.name.includes('.spec.')) continue
              
              addIssue({
                severity: 'high',
                category: 'Hardcoded Secret',
                message: `Potential ${pattern.name} found`,
                file: fullPath.replace(process.cwd(), ''),
                line: i + 1
              })
            }
          }
        }
      }
    }
  }

  scanDir(process.cwd())
  log(COLORS.green, '  ✓ Scanned codebase for hardcoded secrets')
}

// Check 4: API Route Security
function checkApiSecurity() {
  log(COLORS.cyan, '\n🛡️ Checking API route security...')
  
  const apiDir = path.join(process.cwd(), 'app', 'api')
  if (!fs.existsSync(apiDir)) {
    log(COLORS.yellow, '  ⚠ API directory not found')
    return
  }

  const publicRoutes: string[] = []
  const protectedRoutes: string[] = []

  function scanApiDir(dir: string) {
    const items = fs.readdirSync(dir, { withFileTypes: true })
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name)
      
      if (item.isDirectory()) {
        scanApiDir(fullPath)
      } else if (item.name === 'route.ts' || item.name === 'route.js') {
        const content = fs.readFileSync(fullPath, 'utf-8')
        const routePath = fullPath.replace(apiDir, '/api').replace('/route.ts', '').replace('/route.js', '')
        
        // Check for auth
        const hasAuth = content.includes('authorization') || 
                       content.includes('getUser') ||
                       content.includes('auth.uid')
        
        if (hasAuth) {
          protectedRoutes.push(routePath)
        } else {
          publicRoutes.push(routePath)
        }
        
        // Check for rate limiting
        if (!content.includes('rateLimit') && !content.includes('rate-limit')) {
          addIssue({
            severity: 'low',
            category: 'API Security',
            message: `No rate limiting on ${routePath}`,
            file: fullPath.replace(process.cwd(), '')
          })
        }
      }
    }
  }

  scanApiDir(apiDir)
  
  log(COLORS.green, `  ✓ Found ${protectedRoutes.length} protected routes, ${publicRoutes.length} public routes`)
  
  // Flag sensitive public routes
  const sensitivePaths = ['admin', 'purchase', 'payment', 'user', 'profile']
  for (const route of publicRoutes) {
    if (sensitivePaths.some(p => route.includes(p))) {
      addIssue({
        severity: 'medium',
        category: 'API Security',
        message: `Potentially sensitive route without auth: ${route}`
      })
    }
  }
}

// Check 5: Security Headers in Middleware
function checkSecurityHeaders() {
  log(COLORS.cyan, '\n📋 Checking security headers...')
  
  const middlewarePath = path.join(process.cwd(), 'middleware.ts')
  if (!fs.existsSync(middlewarePath)) {
    addIssue({ severity: 'medium', category: 'Headers', message: 'No middleware.ts found' })
    return
  }

  const content = fs.readFileSync(middlewarePath, 'utf-8')
  
  const requiredHeaders = [
    { name: 'X-Frame-Options', pattern: /x-frame-options/i },
    { name: 'X-Content-Type-Options', pattern: /x-content-type-options/i },
    { name: 'Strict-Transport-Security', pattern: /strict-transport-security/i },
  ]

  for (const header of requiredHeaders) {
    if (!header.pattern.test(content)) {
      addIssue({
        severity: 'medium',
        category: 'Headers',
        message: `Missing ${header.name} in middleware`
      })
    }
  }

  log(COLORS.green, '  ✓ Checked security headers')
}

// Generate Report
function generateReport() {
  console.log('\n' + '='.repeat(60))
  log(COLORS.cyan, '📊 SECURITY SCAN REPORT')
  console.log('='.repeat(60))

  const critical = issues.filter(i => i.severity === 'critical')
  const high = issues.filter(i => i.severity === 'high')
  const medium = issues.filter(i => i.severity === 'medium')
  const low = issues.filter(i => i.severity === 'low')

  console.log(`\n📈 Summary:`)
  console.log(`   ${COLORS.red}Critical: ${critical.length}${COLORS.reset}`)
  console.log(`   ${COLORS.yellow}High: ${high.length}${COLORS.reset}`)
  console.log(`   ${COLORS.blue}Medium: ${medium.length}${COLORS.reset}`)
  console.log(`   Low: ${low.length}`)

  if (issues.length === 0) {
    log(COLORS.green, '\n✅ No security issues found!')
  } else {
    console.log('\n📝 Issues:\n')
    
    for (const issue of [...critical, ...high, ...medium, ...low]) {
      const color = issue.severity === 'critical' ? COLORS.red :
                    issue.severity === 'high' ? COLORS.yellow :
                    issue.severity === 'medium' ? COLORS.blue : COLORS.reset
      
      console.log(`${color}[${issue.severity.toUpperCase()}]${COLORS.reset} ${issue.category}: ${issue.message}`)
      if (issue.file) {
        console.log(`         File: ${issue.file}${issue.line ? `:${issue.line}` : ''}`)
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  
  // Exit with error if critical/high issues
  if (critical.length > 0 || high.length > 0) {
    log(COLORS.red, '❌ Security scan failed - fix critical/high issues')
    process.exit(1)
  } else {
    log(COLORS.green, '✅ Security scan passed')
    process.exit(0)
  }
}

// Main
async function main() {
  console.log('🔒 PatriotPledge Security Scanner')
  console.log('='.repeat(40))
  
  checkNpmAudit()
  checkEnvVariables()
  checkHardcodedSecrets()
  checkApiSecurity()
  checkSecurityHeaders()
  
  generateReport()
}

main().catch(console.error)
