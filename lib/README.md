# PatriotPledge Library Modules

This directory contains all shared utility functions, services, and integrations for the PatriotPledge platform.

## Architecture Overview

```
lib/
├── Core Services
│   ├── supabase.ts          # Supabase client (browser)
│   ├── supabaseAdmin.ts     # Supabase admin client (server)
│   ├── logger.ts            # Structured logging utility
│   └── utils.ts             # Common utility functions
│
├── Blockchain Integration
│   ├── contracts.ts         # Smart contract ABIs and addresses
│   ├── ethers.ts            # Ethers.js provider configuration
│   ├── onchain.ts           # On-chain data fetching utilities
│   └── stats.ts             # Campaign statistics from blockchain
│
├── Storage & Media
│   ├── storacha.ts          # IPFS uploads via Pinata
│   ├── ipfs.ts              # IPFS URI helpers (ipfsToHttp, etc.)
│   └── categories.ts        # Campaign category definitions
│
├── Authentication
│   ├── adminAuth.ts         # Admin authentication middleware
│   ├── didit.ts             # Didit KYC verification
│   └── captcha/             # CAPTCHA verification module
│
├── Communication
│   ├── email/               # Email templates and sending
│   └── mailer.ts            # Email sending service
│
├── Utilities
│   ├── retry.ts             # Retry logic with exponential backoff
│   ├── debugGuard.ts        # Debug endpoint protection
│   └── analytics.ts         # Analytics tracking
│
└── Community
    └── community/           # Community features (posts, reactions)
```

## Module Documentation

### Core Services

#### `logger.ts`
Structured logging with environment awareness.
```typescript
import { logger } from '@/lib/logger'

logger.debug('Debug message')      // Only in development
logger.info('Info message')        // General info
logger.warn('Warning message')     // Warnings
logger.error('Error message', err) // Errors with stack traces
```

#### `supabase.ts` / `supabaseAdmin.ts`
Supabase clients for database operations.
```typescript
import { supabase } from '@/lib/supabase'           // Browser client
import { supabaseAdmin } from '@/lib/supabaseAdmin' // Server client (bypasses RLS)
```

### Blockchain Integration

#### `contracts.ts`
Contains all smart contract ABIs and multi-contract support.
- `CONTRACTS` - Map of contract versions (v1-v5)
- `getContractConfig(version)` - Get ABI/address for a version
- `PatriotPledgeNFTV5_ABI` - Current contract ABI

#### `ethers.ts`
Provider configuration with NowNodes RPC support.
```typescript
import { createProvider, getRpcProvider } from '@/lib/ethers'

const provider = getRpcProvider() // Auto-configured provider
```

#### `onchain.ts`
Fetch on-chain campaign and token data.
```typescript
import { getProvider, getCampaign, getTokenMetadata } from '@/lib/onchain'
```

### Storage & Media

#### `storacha.ts`
IPFS uploads via Pinata with Supabase fallback.
```typescript
import { uploadToIPFS, uploadMetadataToIPFS } from '@/lib/storacha'

const uri = await uploadToIPFS(file) // Returns ipfs://...
```

#### `ipfs.ts`
IPFS URI conversion utilities.
```typescript
import { ipfsToHttp, httpToIpfs, isIpfsUri } from '@/lib/ipfs'

const httpUrl = ipfsToHttp('ipfs://baf...')
// https://gateway.pinata.cloud/ipfs/baf...
```

### Authentication

#### `adminAuth.ts`
Admin authentication for API routes.
```typescript
import { requireAdmin, requireSuperAdmin } from '@/lib/adminAuth'

// In API route:
const admin = await requireAdmin(request)
if (!admin) return new Response('Unauthorized', { status: 401 })
```

### Communication

#### `email/`
Modular email system with templates.
- `sender.ts` - Email sending via Resend
- `templates/` - HTML email templates
- `config.ts` - Email configuration

### Utilities

#### `retry.ts`
Retry logic with exponential backoff.
```typescript
import { withRetry, RetryConfig } from '@/lib/retry'

const result = await withRetry(
  () => fetchData(),
  { maxRetries: 3, delayMs: 1000 }
)
```

#### `categories.ts`
Campaign category definitions and helpers.
```typescript
import { CATEGORIES, getCategoryById, getCategoryBySlug } from '@/lib/categories'
```

## Environment Variables

Required environment variables for lib modules:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# BlockDAG RPC
BLOCKDAG_RPC=https://bdag.nownodes.io
NOWNODES_API_KEY=

# IPFS (Pinata)
PINATA_JWT=
PINATA_GATEWAY=gateway.pinata.cloud

# Email (Resend)
RESEND_API_KEY=

# Admin
ADMIN_SECRET=
```

## Testing

Tests are colocated with modules:
- `categories.test.ts`
- `ipfs.test.ts`
- `retry.test.ts`
- `utils.test.ts`

Run tests:
```bash
npm test
```

## Best Practices

1. **Always use logger** - Never use `console.log` directly
2. **Handle errors gracefully** - Use try/catch with logger.error
3. **Type everything** - All functions should have TypeScript types
4. **Document public functions** - Add JSDoc comments
5. **Write tests** - Add tests for new utility functions
