# Docker Configuration Plan for PatriotPledge NFT

## Current State
- No Docker configuration exists
- App runs via `npm run dev` on Next.js
- Deploys to Netlify (serverless)

## Proposed Docker Setup

### 1. Development Dockerfile

```dockerfile
# Dockerfile.dev
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Expose port
EXPOSE 3000

# Development command
CMD ["npm", "run", "dev"]
```

### 2. Production Dockerfile

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
```

### 3. Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  web:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next
    environment:
      - NODE_ENV=development
    env_file:
      - .env.local

  # Optional: Local Supabase for testing
  # supabase:
  #   image: supabase/postgres
  #   ports:
  #     - "5432:5432"
```

### 4. Required next.config.mjs Changes

```javascript
// Add to next.config.mjs
output: 'standalone',
```

## Implementation Steps

1. **Create Dockerfile.dev** - For local development
2. **Create Dockerfile** - For production builds
3. **Create docker-compose.yml** - For easy orchestration
4. **Update next.config.mjs** - Add `output: 'standalone'`
5. **Create .dockerignore** - Exclude node_modules, .next, etc.
6. **Test locally** - `docker-compose up`
7. **Optional: Deploy to container service** (Railway, Fly.io, etc.)

## .dockerignore

```
node_modules
.next
.git
*.md
test-results
playwright-report
artifacts
cache
typechain-types
```

## Benefits

1. **Consistent environment** - Same Node version everywhere
2. **Easy onboarding** - `docker-compose up` to start
3. **Production parity** - Test production builds locally
4. **CI/CD ready** - Can integrate with GitHub Actions

## Timeline

- **Phase 1 (1 day):** Create dev Docker setup
- **Phase 2 (1 day):** Create production Docker setup
- **Phase 3 (optional):** Deploy to container service

## Notes

- Current Netlify deployment still works without Docker
- Docker is optional enhancement for dev consistency
- Consider Railway or Fly.io for containerized production if needed
