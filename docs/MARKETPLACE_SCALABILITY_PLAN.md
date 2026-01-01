# Marketplace Scalability Plan

> Comprehensive strategy for organizing and scaling the marketplace to handle thousands of campaigns while maximizing discoverability and engagement.

**Created:** January 1, 2026  
**Target Implementation:** Q1 2026

---

## Current State Analysis

### Problems with Current Layout
1. **Simple List View** - Not scalable for thousands of campaigns
2. **Limited Categories** - Only showing "veteran" and "general" (FIXED - now 8 categories)
3. **No Featured Section** - All campaigns treated equally
4. **No Category Browsing** - Users can't explore by category
5. **No Trending/Popular** - No social proof indicators
6. **Poor Discovery** - Hard to find specific causes

### What Works
- NFTCard component is solid
- Pagination/infinite scroll exists
- Search functionality works
- Filter component updated with all categories

---

## Research: Best Practices from Leading Platforms

### GoFundMe Approach
- **Featured Campaigns** - Hero section with highlighted causes
- **Category Sections** - Horizontal scrolling rows per category
- **Trending Now** - Recently popular campaigns
- **Near You** - Location-based discovery
- **Staff Picks** - Curated selections

### Kickstarter Approach
- **Projects We Love** - Featured curated section
- **Category Pages** - Deep dive into each category
- **Collections** - Themed groupings (seasonal, events)
- **Live/Ending Soon** - Urgency-based sections
- **Staff Picks** - Editorial curation

### Facebook/Instagram Feed Approach
- **Algorithm-Based Feed** - Personalized content
- **Story Format** - Visual-first browsing
- **Infinite Scroll** - Continuous engagement
- **Engagement Signals** - Social proof (likes, comments)

### Discord Community Approach
- **Channels/Categories** - Clear organization
- **Pinned Content** - Important items highlighted
- **Activity Indicators** - Show what's active
- **Role-Based Access** - Different views for different users

---

## Proposed New Architecture

### 1. Hero Section (Featured Campaigns)

```
┌─────────────────────────────────────────────────────────────┐
│                    🎖️ FEATURED CAMPAIGN                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │     [Large Hero Card - Auto-rotating or Manual]       │  │
│  │     - High-quality image/video                        │  │
│  │     - Campaign title + story excerpt                  │  │
│  │     - Progress bar + stats                            │  │
│  │     - CTA button                                      │  │
│  │                                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│           [•] [ ] [ ]  ← Carousel dots                      │
└─────────────────────────────────────────────────────────────┘
```

**Selection Criteria for Featured:**
- Admin-pinned campaigns
- High engagement rate
- Recently reached milestone
- Urgency (ending soon)

### 2. Category Showcase Sections

```
┌─────────────────────────────────────────────────────────────┐
│ 🎖️ Veteran & Military                        [View All →]   │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                    │
│ │Card │ │Card │ │Card │ │Card │ │Card │  ← Horizontal      │
│ │  1  │ │  2  │ │  3  │ │  4  │ │  5  │     scroll         │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 🏥 Medical Expenses                          [View All →]   │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                    │
│ │Card │ │Card │ │Card │ │Card │ │Card │                    │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                    │
└─────────────────────────────────────────────────────────────┘

... (repeat for each category with campaigns)
```

### 3. Trending/Popular Section

```
┌─────────────────────────────────────────────────────────────┐
│ 🔥 Trending This Week                                        │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ #1  [Card] Most donations in 7 days                     │ │
│ │ #2  [Card] Second most                                  │ │
│ │ #3  [Card] Third most                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 4. Category Pages (Deep Dive)

When clicking "View All →" for a category:

```
/marketplace/category/veteran

┌─────────────────────────────────────────────────────────────┐
│ 🎖️ Veteran & Military Campaigns                             │
│ "Supporting those who served our nation"                    │
│                                                             │
│ [Filters: Sort by | Goal Range | Location | Urgency]        │
│                                                             │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                            │
│ │Card │ │Card │ │Card │ │Card │                            │
│ └─────┘ └─────┘ └─────┘ └─────┘                            │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                            │
│ │Card │ │Card │ │Card │ │Card │                            │
│ └─────┘ └─────┘ └─────┘ └─────┘                            │
│                                                             │
│           [Load More] or Infinite Scroll                    │
└─────────────────────────────────────────────────────────────┘
```

### 5. Quick Category Navigation

```
┌─────────────────────────────────────────────────────────────┐
│ Browse by Category                                          │
│                                                             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│ │ 🎖️       │ │ 🏥       │ │ 👶       │ │ 🐾       │        │
│ │ Veteran  │ │ Medical  │ │ Children │ │ Pets     │        │
│ │   (24)   │ │   (18)   │ │   (12)   │ │   (8)    │        │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│ │ 🌪️       │ │ 📚       │ │ 🤝       │ │ 💙       │        │
│ │ Disaster │ │ Education│ │ Community│ │ Other    │        │
│ │   (5)    │ │   (15)   │ │   (9)    │ │   (7)    │        │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core Layout Refactor (Week 1-2)

**New Components Needed:**
```
components/marketplace/
├── FeaturedCarousel.tsx       # Hero featured campaigns
├── CategoryRow.tsx            # Horizontal scrolling row
├── CategoryCard.tsx           # Category navigation tile
├── TrendingSection.tsx        # Trending campaigns
├── QuickFilters.tsx           # Enhanced filters bar
├── MarketplaceLayout.tsx      # New layout orchestrator
└── hooks/
    ├── useFeatured.ts         # Featured campaigns data
    ├── useTrending.ts         # Trending calculation
    └── useCategoryStats.ts    # Category counts
```

**API Endpoints Needed:**
```
/api/marketplace/featured      # GET featured/pinned campaigns
/api/marketplace/trending      # GET trending by engagement
/api/marketplace/categories    # GET category stats (counts)
/api/marketplace/category/[id] # GET campaigns by category
```

**Database Changes:**
```sql
-- Add is_featured flag to submissions
ALTER TABLE submissions ADD COLUMN is_featured BOOLEAN DEFAULT false;
ALTER TABLE submissions ADD COLUMN featured_until TIMESTAMPTZ;
ALTER TABLE submissions ADD COLUMN featured_priority INTEGER DEFAULT 0;

-- Add engagement tracking
ALTER TABLE submissions ADD COLUMN view_count INTEGER DEFAULT 0;
ALTER TABLE submissions ADD COLUMN share_count INTEGER DEFAULT 0;
```

### Phase 2: Category Pages (Week 3)

- Create `/marketplace/category/[id]` dynamic route
- Implement category-specific filtering
- Add category hero banners
- SEO optimization for category pages

### Phase 3: Trending & Discovery (Week 4)

- Implement trending algorithm:
  ```typescript
  score = (donations_7d * 10) + (views_7d * 1) + (shares_7d * 5) + (comments_7d * 3)
  ```
- Add "Near You" section (requires location data)
- Implement "Recently Viewed" (localStorage)
- Add "Similar Campaigns" recommendations

### Phase 4: Personalization (Week 5-6)

- Track user interests (viewed categories)
- Personalized feed algorithm
- "For You" section based on history
- Email digest of recommended campaigns

---

## Component Specifications

### FeaturedCarousel.tsx
```typescript
interface FeaturedCarouselProps {
  campaigns: FeaturedCampaign[]
  autoRotate?: boolean
  rotateInterval?: number // ms
}

// Features:
// - Large hero card display
// - Auto-rotation with pause on hover
// - Manual navigation dots
// - Mobile swipe support
// - Lazy load images
```

### CategoryRow.tsx
```typescript
interface CategoryRowProps {
  category: Category
  campaigns: NFTItem[]
  onViewAll: () => void
}

// Features:
// - Horizontal scroll with arrows
// - "View All" link
// - Category icon + name header
// - Responsive (fewer cards on mobile)
// - Lazy loading for off-screen
```

### TrendingSection.tsx
```typescript
interface TrendingSectionProps {
  campaigns: TrendingCampaign[]
  period: '24h' | '7d' | '30d'
}

// Features:
// - Ranked list (1st, 2nd, 3rd)
// - Trending indicators (up/down arrows)
// - Time period selector
// - Engagement stats displayed
```

---

## Performance Considerations

### Data Loading Strategy
1. **SSR for initial load** - First 5 featured + first row of each category
2. **Lazy load category rows** - Load as user scrolls
3. **Cache trending data** - Refresh every 15 minutes
4. **CDN for images** - Use Cloudflare or similar

### Pagination Strategy
- **Virtual scrolling** for long lists
- **Cursor-based pagination** (already implemented)
- **Prefetch next page** on scroll near end

### Image Optimization
- Use Next.js Image component
- Implement blur-up loading
- WebP format with fallback
- Multiple sizes for responsive

---

## V7 Contract Considerations

### Bug Bounty On-Chain Payments

**Current State:** V5 contract doesn't have bug bounty payment function.

**V7 Proposed Addition:**
```solidity
// Separate bug bounty pool
uint256 public bugBountyPool;

// Add funds to bug bounty pool (admin/nonprofit)
function fundBugBounty() external payable onlyOwner {
    bugBountyPool += msg.value;
}

// Pay bug bounty reward (admin only)
function payBugBounty(
    address recipient,
    uint256 amount,
    string calldata bugReportId
) external onlyOwner {
    require(bugBountyPool >= amount, "Insufficient pool");
    bugBountyPool -= amount;
    payable(recipient).transfer(amount);
    emit BugBountyPaid(recipient, amount, bugReportId);
}
```

**Roadmap Item for V7:**
- [ ] Add bug bounty pool management
- [ ] Add bug bounty payment function
- [ ] Add event for payment tracking
- [ ] Frontend integration for admin panel

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Avg. time on marketplace | ~30s | 3+ min |
| Campaigns viewed per session | 2-3 | 10+ |
| Category click-through rate | N/A | 15%+ |
| Featured campaign conversion | N/A | 5%+ |
| Return visitor rate | 20% | 50%+ |

---

## Mobile-First Design

All components must be:
- Touch-friendly (large tap targets)
- Swipe-enabled for carousels
- Responsive grid layouts
- Fast loading (< 3s on 3G)

---

## Timeline Summary

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1 | 2 weeks | Core layout, components, API |
| Phase 2 | 1 week | Category pages |
| Phase 3 | 1 week | Trending, discovery |
| Phase 4 | 2 weeks | Personalization |

**Total: 6 weeks**

---

*This plan is a living document and will be updated as implementation progresses.*
