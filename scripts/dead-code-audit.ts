#!/usr/bin/env ts-node
/**
 * Dead Code Audit Script
 * 
 * Identifies potentially unused components, hooks, and utilities
 * Run with: npx ts-node scripts/dead-code-audit.ts
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(process.cwd())

// Directories to scan for exports
const SCAN_DIRS = ['components', 'hooks', 'lib']

// Directories to search for imports
const SEARCH_DIRS = ['app', 'components', 'hooks', 'lib', 'tests']

// Files to ignore (known entry points or config)
const IGNORE_FILES = [
  'layout.tsx',
  'page.tsx',
  'route.ts',
  'middleware.ts',
  'jest.config.js',
  'tailwind.config.ts',
  'next.config.mjs',
]

interface AuditResult {
  file: string
  exportName: string
  importCount: number
  status: 'unused' | 'low-usage' | 'ok'
}

function getAllFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = []
  
  if (!fs.existsSync(dir)) return files
  
  const items = fs.readdirSync(dir, { withFileTypes: true })
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name)
    
    if (item.isDirectory()) {
      // Skip node_modules, .next, etc.
      if (!item.name.startsWith('.') && item.name !== 'node_modules') {
        files.push(...getAllFiles(fullPath, extensions))
      }
    } else if (extensions.some(ext => item.name.endsWith(ext))) {
      files.push(fullPath)
    }
  }
  
  return files
}

function getExportedNames(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const exports: string[] = []
  
  // Match default export component names
  const defaultExport = content.match(/export\s+default\s+(?:function\s+)?(\w+)/g)
  if (defaultExport) {
    defaultExport.forEach(match => {
      const name = match.replace(/export\s+default\s+(?:function\s+)?/, '')
      if (name && name !== 'function') exports.push(name)
    })
  }
  
  // Match named exports
  const namedExports = content.match(/export\s+(?:const|function|class|interface|type)\s+(\w+)/g)
  if (namedExports) {
    namedExports.forEach(match => {
      const name = match.replace(/export\s+(?:const|function|class|interface|type)\s+/, '')
      exports.push(name)
    })
  }
  
  return exports
}

function countImports(searchName: string, searchFiles: string[], sourceFile: string): number {
  let count = 0
  
  for (const file of searchFiles) {
    if (file === sourceFile) continue
    
    try {
      const content = fs.readFileSync(file, 'utf-8')
      
      // Check for imports
      const importRegex = new RegExp(`import.*[{,\\s]${searchName}[},\\s]|import\\s+${searchName}\\s+from|from\\s+['"].*${path.basename(sourceFile, path.extname(sourceFile))}['"]`, 'g')
      const matches = content.match(importRegex)
      if (matches) count += matches.length
      
      // Check for direct usage of component name in JSX
      const jsxRegex = new RegExp(`<${searchName}[\\s/>]`, 'g')
      const jsxMatches = content.match(jsxRegex)
      if (jsxMatches) count += jsxMatches.length
      
    } catch (e) {
      // Skip unreadable files
    }
  }
  
  return count
}

function runAudit(): void {
  console.log('\n🔍 Dead Code Audit for PatriotPledge\n')
  console.log('=' .repeat(60))
  
  const results: AuditResult[] = []
  const searchFiles = SEARCH_DIRS.flatMap(dir => 
    getAllFiles(path.join(ROOT, dir), ['.ts', '.tsx'])
  )
  
  console.log(`\nScanning ${searchFiles.length} files...\n`)
  
  for (const scanDir of SCAN_DIRS) {
    const dirPath = path.join(ROOT, scanDir)
    const files = getAllFiles(dirPath, ['.ts', '.tsx'])
    
    for (const file of files) {
      const relativePath = path.relative(ROOT, file)
      const fileName = path.basename(file)
      
      // Skip ignored files
      if (IGNORE_FILES.includes(fileName)) continue
      
      // Skip test files
      if (file.includes('.test.') || file.includes('.spec.')) continue
      
      // Get the component/module name from filename
      const baseName = path.basename(file, path.extname(file))
      
      // Count imports of this file
      const importCount = countImports(baseName, searchFiles, file)
      
      let status: 'unused' | 'low-usage' | 'ok' = 'ok'
      if (importCount === 0) status = 'unused'
      else if (importCount === 1) status = 'low-usage'
      
      results.push({
        file: relativePath,
        exportName: baseName,
        importCount,
        status
      })
    }
  }
  
  // Sort by status and import count
  results.sort((a, b) => {
    if (a.status === 'unused' && b.status !== 'unused') return -1
    if (a.status !== 'unused' && b.status === 'unused') return 1
    return a.importCount - b.importCount
  })
  
  // Display results
  const unused = results.filter(r => r.status === 'unused')
  const lowUsage = results.filter(r => r.status === 'low-usage')
  
  if (unused.length > 0) {
    console.log('\n❌ POTENTIALLY UNUSED (0 imports found):')
    console.log('-'.repeat(60))
    unused.forEach(r => {
      console.log(`  ${r.file}`)
    })
  }
  
  if (lowUsage.length > 0) {
    console.log('\n⚠️  LOW USAGE (only 1 import):')
    console.log('-'.repeat(60))
    lowUsage.forEach(r => {
      console.log(`  ${r.file}`)
    })
  }
  
  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('\n📊 Summary:')
  console.log(`   Total files scanned: ${results.length}`)
  console.log(`   ❌ Potentially unused: ${unused.length}`)
  console.log(`   ⚠️  Low usage: ${lowUsage.length}`)
  console.log(`   ✅ Normal usage: ${results.filter(r => r.status === 'ok').length}`)
  
  if (unused.length > 0) {
    console.log('\n🚨 Review the unused files above and consider removing them.')
    console.log('   Note: Some may be entry points or dynamically imported.')
  }
  
  console.log('\n')
}

runAudit()
