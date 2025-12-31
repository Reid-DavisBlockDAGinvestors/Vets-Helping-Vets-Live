# PatriotPledge Architecture Guide

> Designed for elite maintainability, easy troubleshooting, and rapid feature implementation.

## Overview

PatriotPledge is a Next.js 14 application for NFT-powered charitable fundraising on the BlockDAG blockchain.

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
├──────────────┬──────────────┬──────────────┬────────────────┤
│   Pages      │  Components  │    Hooks     │     Lib        │
│   (app/)     │              │              │                │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────┘
       │              │              │                │
       ▼              ▼              ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Routes (app/api/)                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Supabase   │    │  BlockDAG   │    │   Pinata    │
│  (Database) │    │ (Blockchain)│    │   (IPFS)    │
└─────────────┘    └─────────────┘    └─────────────┘
```

---

## Directory Structure

```
patriotpledge/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes (serverless functions)
│   │   ├── submissions/   # Campaign submission endpoints
│   │   ├── purchase/      # NFT purchase flow
│   │   ├── marketplace/   # Public listing APIs
│   │   ├── community/     # Social features
│   │   └── admin/         # Protected admin endpoints
│   ├── admin/             # Admin dashboard pages
│   ├── story/[id]/        # Campaign detail pages
│   ├── dashboard/         # User dashboard
│   └── layout.tsx         # Root layout with providers
│
├── components/            # React Components
│   ├── account/          # User account components
│   ├── admin/            # Admin-specific components
│   │   ├── submissions/  # Submission management
│   │   ├── campaigns/    # Campaign management
│   │   └── users/        # User management
│   ├── community/        # Social/community features
│   ├── purchase/         # Purchase flow components
│   ├── story-form/       # Campaign submission form
│   └── psychology/       # Engagement components
│
├── hooks/                 # Custom React Hooks
│   ├── useOptimisticForm.ts   # Optimistic UI updates
│   ├── useSessionManager.ts   # Session & auth management
│   └── index.ts               # Barrel exports
│
├── lib/                   # Utilities & Services
│   ├── contracts.ts      # Smart contract registry
│   ├── onchain.ts        # Blockchain interactions
│   ├── supabase.ts       # Database client
│   ├── ipfs.ts           # IPFS utilities
│   ├── validation.ts     # Input validation
│   ├── rateLimit.ts      # Rate limiting
│   └── logger.ts         # Structured logging
│
├── tests/                 # Test Suites
│   ├── e2e/              # Playwright E2E tests
│   ├── unit/             # Jest unit tests
│   └── integration/      # API integration tests
│
├── contracts/             # Solidity Smart Contracts
│   └── PatriotPledgeNFTV5.sol
│
├── scripts/               # Utility Scripts
│   ├── dead-code-audit.ts
│   ├── check-api-keys.ts
│   └── deploy-*.ts
│
└── docs/                  # Documentation
    ├── ARCHITECTURE.md    # This file
    ├── API_KEY_ROTATION.md
    └── MIGRATIONS.md
```

---

## Component Architecture

### Principle: Interface Segregation (ISP)

Every component/hook has a **single responsibility**:

```typescript
// ❌ BAD: Fat component
<CampaignPage>
  // Handles fetching, display, purchase, sharing, comments...
</CampaignPage>

// ✅ GOOD: Segregated components
<CampaignPage>
  <CampaignHeader />      // Display only
  <CampaignStory />       // Content rendering
  <PurchasePanel />       // Purchase logic
  <ShareButtons />        // Social sharing
  <CommentSection />      // Comments
</CampaignPage>
```

### Component Size Limits

| Type | Max Lines | Action |
|------|-----------|--------|
| Page Component | 200 | Extract to sub-components |
| UI Component | 300 | Split into smaller pieces |
| Hook | 150 | Extract helper functions |
| Utility | 200 | Create sub-modules |

### Naming Conventions

```
Components:  PascalCase.tsx    (e.g., PurchasePanel.tsx)
Hooks:       useCamelCase.ts   (e.g., useOptimisticForm.ts)
Utilities:   camelCase.ts      (e.g., validation.ts)
API Routes:  route.ts          (in descriptive folders)
Tests:       *.test.ts         (e.g., validation.test.ts)
```

---

## State Management

### Client State
- **React hooks** for local UI state
- **Custom hooks** for shared logic (e.g., `useSessionManager`)

### Server State
- **Supabase** for persistent data
- **React Server Components** for initial data fetch
- **SWR/fetch** for client-side data fetching

### Blockchain State
- **Contract Registry** (`lib/contracts.ts`) for multi-version support
- **On-chain queries** via ethers.js

---

## API Design

### Route Organization
```
app/api/
├── submissions/
│   ├── route.ts           # GET (list), POST (create)
│   └── [id]/
│       ├── route.ts       # GET, PATCH, DELETE
│       └── approve/route.ts
├── marketplace/
│   └── fundraisers/route.ts
└── admin/
    └── [resource]/route.ts
```

### Response Format
```typescript
// Success
{ success: true, data: {...} }

// Error
{ error: "Human-readable message", code: "ERROR_CODE" }
```

### Authentication
- Supabase Auth with JWT tokens
- Admin routes check `user.role === 'admin'`
- Rate limiting via `lib/rateLimit.ts`

---

## Contract Registry

Supports **infinite contract versions** dynamically:

```typescript
// Register a new contract
registerContract({
  version: 'v7',
  address: '0x...',
  name: 'PatriotPledgeNFTV7',
  chainId: 1043,
  isActive: true,
  isMintable: true,
  features: { batchMint: true, ... },
  abi: V7_ABI
})

// Get active contract
const version = getActiveContractVersion() // 'v6'

// Query across all contracts
const nfts = await getWalletNFTsAllContracts(walletAddress)
```

---

## Testing Strategy

### Test Pyramid
```
        /\
       /  \  E2E (119 tests) - Critical user flows
      /----\
     /      \  Integration (2+) - API + DB
    /--------\
   /          \  Unit (184 tests) - Functions
  /____________\
```

### Running Tests
```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Specific test
npm test -- --testPathPattern="validation"
```

### Test Location
- Unit tests: `tests/unit/**/*.test.ts`
- E2E tests: `tests/e2e/**/*.spec.ts`
- Integration: `tests/integration/**/*.test.ts`

---

## Adding New Features

### 1. Create the Component/Hook
```bash
# Component in appropriate subfolder
components/feature-name/
├── FeatureName.tsx      # Main component
├── hooks/
│   └── useFeature.ts    # Feature-specific hook
└── index.ts             # Barrel export
```

### 2. Add Tests First (TDD)
```bash
# Write test
tests/unit/hooks/useFeature.test.ts

# Run to verify it fails
npm test -- --testPathPattern="useFeature"
```

### 3. Implement & Verify
```bash
# Implement feature
# Run test to verify pass
npm test
```

### 4. Add E2E Test
```bash
tests/e2e/feature.spec.ts
npm run test:e2e
```

---

## Troubleshooting Guide

### Common Issues

| Issue | Location | Solution |
|-------|----------|----------|
| Build fails | Check Netlify logs | Fix TypeScript errors |
| API 500 | `app/api/*/route.ts` | Check server logs, add try/catch |
| Blockchain error | `lib/onchain.ts` | Check RPC, wallet balance |
| Auth issues | `lib/supabase.ts` | Check session, refresh token |

### Debug Endpoints (Admin Only)
- `/api/debug/audit` - System health check
- `/api/health` - Basic health status

### Logging
```typescript
import { logger } from '@/lib/logger'

logger.debug('Operation details', { data })
logger.error('Error occurred:', error)
logger.api('API request', { method, path })
```

---

## Performance Checklist

- [ ] Images use `OptimizedImage` component
- [ ] Large lists use virtualization
- [ ] API routes have caching headers
- [ ] Database queries are indexed
- [ ] Client bundles are code-split

---

## Security Checklist

- [ ] All inputs validated (`lib/validation.ts`)
- [ ] Rate limiting on sensitive routes
- [ ] Admin routes require authentication
- [ ] Environment variables not exposed
- [ ] CSP headers configured

---

## Deployment

### Netlify (Production)
- Auto-deploys from `main` branch
- Environment variables in Netlify dashboard
- Build command: `npm run build`

### Local Development
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # Run linter
```

---

*Last Updated: December 31, 2025*
