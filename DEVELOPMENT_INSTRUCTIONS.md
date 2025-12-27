# 🎖️ PatriotPledge Development Instructions

## Core Principles

This document defines the development methodology for PatriotPledge NFT platform. All development MUST follow these principles.

---

## 1. Test-Driven Design (TDD)

### Methodology
```
1. WRITE TEST FIRST - Define expected behavior before implementation
2. RUN TEST - Verify it fails (red)
3. IMPLEMENT - Write minimal code to pass
4. REFACTOR - Improve while keeping tests green
5. REPEAT
```

### Test Locations
- **E2E Tests:** `tests/e2e/*.spec.ts` (Playwright)
- **Unit Tests:** `lib/*.test.ts` (future: Jest/Vitest)
- **Integration Tests:** `tests/integration/*.spec.ts` (future)

### Test Naming Convention
```typescript
// Pattern: should [expected behavior] when [condition]
test('should display CAPTCHA widget on submission form', ...)
test('should reject submissions without valid token', ...)
test('should return 404 for debug endpoints in production', ...)
```

### Coverage Requirements
- **Critical paths:** 100% (payments, auth, blockchain)
- **API routes:** 90%+
- **UI components:** 80%+
- **Utilities:** 95%+

---

## 2. Interface Segregation Principle (ISP)

### Methodology
```
1. DEFINE INTERFACE - Small, focused interfaces
2. IMPLEMENT - Classes/functions implement only what they need
3. COMPOSE - Combine interfaces for complex behavior
4. TEST - Each interface tested independently
```

### Example Pattern
```typescript
// ❌ Bad: Fat interface
interface IService {
  create(): void
  read(): void
  update(): void
  delete(): void
  audit(): void
  notify(): void
}

// ✅ Good: Segregated interfaces
interface IWriter { write(event: AuditEvent): Promise<void> }
interface IReader { query(filters: AuditFilters): Promise<AuditEvent[]> }
interface IRetention { applyRetention(days: number): Promise<number> }

// Combine as needed
interface IAuditService extends IWriter, IReader, IRetention {}
```

### Current ISP Implementations
- `lib/audit/types.ts` - IAuditWriter, IAuditReader, IRetention
- `lib/captcha/types.ts` - ICaptchaVerifier, ICaptchaWidgetProps

---

## 3. Playwright Testing

### Configuration
```typescript
// playwright.config.ts
{
  timeout: 60000,           // Extended for blockchain RPC
  retries: 2,               // Handle RPC flakiness
  workers: 1,               // Sequential for stability
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry'
  }
}
```

### Running Tests
```bash
# Run all tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run specific test file
npx playwright test captcha.spec.ts

# Run with debug
npx playwright test --debug
```

### Test Structure
```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup
  })

  test('should do something', async ({ page }) => {
    // Arrange
    await page.goto('/route')
    
    // Act
    await page.click('button')
    
    // Assert
    await expect(page.locator('.result')).toBeVisible()
  })
})
```

---

## 4. Development Workflow

### Feature Development
```
1. Create branch: git checkout -b feature/name
2. Write E2E test for the feature
3. Run test (should fail)
4. Implement feature following ISP
5. Run test (should pass)
6. Run full test suite: npm run test:e2e
7. Commit with descriptive message
8. Push to GitHub: git push origin feature/name
9. Create PR → Netlify preview deploy
10. Merge → Auto-deploy to production
```

### Bug Fixes
```
1. Write failing test that reproduces bug
2. Fix bug with minimal change
3. Verify test passes
4. Run full test suite
5. Commit: "fix: description of fix"
6. Push to GitHub
```

### Hotfixes
```
1. Create branch from main: git checkout -b hotfix/name
2. Apply minimal fix
3. Test locally
4. Push immediately
5. Merge to main
```

---

## 5. Git & Deployment

### Commit Messages
```
feat: Add CAPTCHA to submission form
fix: Correct progress bar calculation
refactor: Extract audit logging to service
test: Add E2E tests for crypto purchase
docs: Update development instructions
chore: Upgrade dependencies
```

### Push to GitHub (REQUIRED)
```bash
# Stage all changes
git add .

# Commit with descriptive message
git commit -m "feat: description"

# Push to trigger Netlify build
git push origin main
```

### Netlify Auto-Deploy
- Push to `main` → Production deploy
- Push to PR → Preview deploy
- All deploys logged in Netlify dashboard

---

## 6. Code Quality Standards

### Required for 10/10 Score
- [ ] No console.log in production (use `lib/logger.ts`)
- [ ] No dead code or unused imports
- [ ] All functions have TypeScript types
- [ ] All components have prop interfaces
- [ ] Error boundaries on all pages
- [ ] Loading states (skeletons) for async data
- [ ] Accessibility (ARIA labels, focus states)
- [ ] Responsive design (mobile-first)
- [ ] No duplicate code (DRY principle)
- [ ] Comments for complex logic only

### ESLint Rules
```json
{
  "no-console": "warn",
  "no-unused-vars": "error",
  "@typescript-eslint/explicit-function-return-type": "warn"
}
```

---

## 7. Security Standards

### Required for 10/10 Score
- [ ] All debug endpoints disabled in production
- [ ] CAPTCHA on all public forms
- [ ] Rate limiting on all API routes
- [ ] RLS policies on all Supabase tables
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitized output)
- [ ] CSRF protection (tokens)
- [ ] Content Security Policy headers
- [ ] Audit logging for admin actions
- [ ] Session timeout and refresh
- [ ] API key rotation schedule documented

---

## 8. Contract Support Architecture

### Infinite Contract Support
```typescript
// lib/contracts.ts - Registry pattern
const CONTRACT_REGISTRY = {
  v5: { address: '0x96bB...', abi: V5_ABI, features: {...} },
  v6: { address: '0xaE54...', abi: V6_ABI, features: {...} },
  // Future versions added here
  vesting: { address: '', abi: VESTING_ABI, features: {...} },
  staking: { address: '', abi: STAKING_ABI, features: {...} },
}

// Dynamic contract loading
function getContract(version: string): Contract {
  const config = CONTRACT_REGISTRY[version]
  return new ethers.Contract(config.address, config.abi, provider)
}
```

### Adding New Contracts
1. Deploy contract to BlockDAG
2. Add to `CONTRACT_REGISTRY` in `lib/contracts.ts`
3. Add ABI to `lib/contracts.ts`
4. Update `marketplace_contracts` table
5. Write E2E tests for new features
6. Document in this file

---

## 9. File Organization

```
windsurf-project-2/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   └── [pages]/           # UI pages
├── components/            # React components
├── contracts/             # Solidity contracts
├── hooks/                 # React hooks
├── lib/                   # Utilities & services
│   ├── audit/            # Audit logging (ISP)
│   ├── captcha/          # CAPTCHA (ISP)
│   └── ...               # Other utilities
├── scripts/              # Database & deployment scripts
│   └── sql/              # SQL migrations
├── supabase/migrations/  # Supabase migrations (tracked)
├── tests/e2e/            # Playwright E2E tests
├── public/               # Static assets
├── AUDIT_REPORTS/        # Historical audit reports
└── docs/                 # Documentation
```

---

## 10. Audit Reports

### Storage Location
All audit reports MUST be saved:
- `COMPREHENSIVE_AUDIT_REPORT.md` - Latest full audit
- `SECURITY_AUDIT_REPORT.md` - Security-specific findings
- `AUDIT_REPORTS/YYYY-MM-DD_audit.md` - Historical audits

### Migration Tracking
All database migrations tracked in:
- `supabase/migrations/` - SQL files with date prefix
- `MIGRATIONS.md` - Summary of all migrations

---

## 11. Checklist Before Every Push

```bash
# 1. Run linter
npm run lint

# 2. Run tests
npm run test:e2e

# 3. Check for console.logs (should use logger)
grep -r "console.log" app/ components/ lib/ --include="*.ts" --include="*.tsx"

# 4. Stage and commit
git add .
git commit -m "type: description"

# 5. Push to GitHub (triggers Netlify)
git push origin main
```

---

## Remember

> **"We are building the greatest fundraising platform ever created."**
> 
> Every line of code should reflect:
> - Elite quality (10/10)
> - Maximum security
> - Best user experience
> - Full transparency
> - Test coverage
> 
> This is not just software. This is a mission to help veterans and those in need.

---

*Last Updated: December 27, 2025*
