# Community Hub Enhancement Plan - FB/Discord Level

> Comprehensive roadmap to achieve state-of-the-art community features comparable to Facebook and Discord.

**Created:** January 1, 2026
**Target Completion:** Q1 2026

---

## Current State Assessment

### ✅ Already Implemented
- [x] Post creation with text, images, videos
- [x] Post reactions with emoji picker (❤️🙏💪🎉😢)
- [x] Comment system on posts
- [x] Comment reactions (NEW - Jan 1, 2026)
- [x] Reply to comments with @mention
- [x] Campaign-specific feeds
- [x] User profiles with avatars
- [x] Verified user badges
- [x] Share to social media (Twitter, Facebook, Reddit)
- [x] Post pinning and featuring
- [x] Admin moderation tools
- [x] @mention autocomplete for users and campaigns

### 🔄 Needs Enhancement
- [ ] Nested/threaded replies (only 1 level deep currently)
- [ ] Real-time updates (currently requires refresh)
- [ ] Rich text formatting in posts
- [ ] Poll creation
- [ ] Direct messaging

### ❌ Not Yet Implemented
- [ ] Notification center
- [ ] Live activity feed
- [ ] User tagging in images
- [ ] Hashtag system
- [ ] Search functionality
- [ ] Content moderation AI
- [ ] User blocking/muting
- [ ] Private groups/channels

---

## Phase 1: Core Enhancements (Week 1-2)

### 1.1 Real-Time Updates
**Priority: HIGH**

Implement Supabase Realtime subscriptions for:
- New posts appearing without refresh
- Comment count updates
- Reaction count updates
- Typing indicators

```typescript
// Example implementation
const channel = supabase
  .channel('community-posts')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_posts' }, handleNewPost)
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'community_posts' }, handlePostUpdate)
  .subscribe()
```

### 1.2 Notification Center
**Priority: HIGH**

Database schema already exists (`community_notifications`). Need UI:
- Bell icon in navbar with unread count
- Dropdown showing recent notifications
- Mark as read functionality
- Link to relevant content
- Push notification support (future)

**Notification Types:**
- Someone liked your post/comment
- Someone replied to your comment
- Someone mentioned you
- Campaign you follow has an update
- Your campaign reached a milestone

### 1.3 Threaded Replies
**Priority: MEDIUM**

Enhance comment system to support nested replies:
- Add `parent_comment_id` to comments table
- Collapse/expand reply threads
- "View X more replies" for long threads
- Max depth: 3 levels

---

## Phase 2: Rich Content (Week 3-4)

### 2.1 Rich Text Editor
**Priority: MEDIUM**

Replace plain textarea with rich text editor:
- Bold, italic, underline
- Links with preview
- Code blocks
- Lists (bullet, numbered)
- Blockquotes
- Emojis with picker

**Recommended:** TipTap or Lexical editor

### 2.2 Poll System
**Priority: MEDIUM**

Allow users to create polls:
- Single or multiple choice
- Optional poll duration
- Anonymous or public voting
- Results display (bar chart)

Database schema:
```sql
CREATE TABLE community_polls (
  id UUID PRIMARY KEY,
  post_id UUID REFERENCES community_posts,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  allow_multiple BOOLEAN DEFAULT false,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE community_poll_votes (
  id UUID PRIMARY KEY,
  poll_id UUID REFERENCES community_polls,
  user_id UUID REFERENCES auth.users,
  option_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poll_id, user_id, option_index)
);
```

### 2.3 Hashtag System
**Priority: MEDIUM**

- Auto-detect #hashtags in posts
- Clickable hashtag links
- Hashtag search/filter
- Trending hashtags sidebar

---

## Phase 3: Discovery & Search (Week 5-6)

### 3.1 Search Functionality
**Priority: HIGH**

Full-text search across:
- Post content
- Comments
- User display names
- Campaign names
- Hashtags

**Implementation:** Supabase full-text search with `tsvector`

### 3.2 Trending Content
**Priority: MEDIUM**

- Trending posts (most engagement in 24h)
- Trending hashtags
- Popular campaigns
- Active users leaderboard

### 3.3 Content Discovery
**Priority: LOW**

- "Suggested for you" based on:
  - Campaigns you've donated to
  - Users you interact with
  - Categories you browse
- "Similar posts" recommendations

---

## Phase 4: User Experience (Week 7-8)

### 4.1 User Profiles Enhancement
**Priority: MEDIUM**

- Profile banner images
- Bio/about section
- Social links
- Activity history
- Badges earned
- Donation stats (optional display)
- Posts/comments tabs

### 4.2 User Interactions
**Priority: MEDIUM**

- Follow users
- Block/mute users
- Report users/content
- User reputation system

### 4.3 Accessibility
**Priority: HIGH**

- Keyboard navigation
- Screen reader support
- High contrast mode
- Reduced motion option

---

## Phase 5: Advanced Features (Week 9-10)

### 5.1 Direct Messaging
**Priority: LOW**

Private messaging between users:
- 1:1 conversations
- Read receipts
- Online status
- Message history

### 5.2 Groups/Channels
**Priority: LOW**

Private or public groups:
- Campaign supporter groups
- Topic-based channels
- Group admin roles
- Channel permissions

### 5.3 Live Features
**Priority: LOW**

- Live streaming for campaign updates
- Watch parties for events
- Live polls during streams

---

## Phase 6: Moderation & Safety (Ongoing)

### 6.1 Content Moderation
**Priority: HIGH**

- Automated spam detection
- Profanity filter
- Image moderation (NSFW detection)
- Report queue for admins
- Moderation audit log

### 6.2 AI Assistance
**Priority: MEDIUM**

- Auto-suggest post tags
- Sentiment analysis
- Content quality scoring
- Duplicate detection

---

## Technical Requirements

### Database Tables Needed
```sql
-- Notifications (exists)
-- Polls
-- Poll votes
-- Hashtags
-- User follows
-- User blocks
-- Direct messages
-- Message threads
-- Groups
-- Group members
```

### API Endpoints Needed
- `/api/community/notifications` - GET, PATCH (mark read)
- `/api/community/polls` - CRUD
- `/api/community/polls/vote` - POST
- `/api/community/search` - GET
- `/api/community/trending` - GET
- `/api/community/follow` - POST, DELETE
- `/api/community/block` - POST, DELETE
- `/api/community/messages` - CRUD
- `/api/community/groups` - CRUD

### Frontend Components Needed
- `NotificationCenter.tsx`
- `RichTextEditor.tsx`
- `PollCreator.tsx`
- `PollDisplay.tsx`
- `SearchBar.tsx`
- `TrendingSidebar.tsx`
- `UserProfilePage.tsx`
- `DirectMessages.tsx`
- `GroupsManager.tsx`

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Posts per day | ~5 | 50+ |
| Comments per post | ~2 | 10+ |
| User engagement rate | 10% | 40%+ |
| Time on page | 2 min | 10+ min |
| Return visitors | 20% | 60%+ |

---

## Implementation Priority Order

1. **Week 1-2:** Notifications + Real-time updates
2. **Week 3-4:** Search + Threaded replies
3. **Week 5-6:** Rich text editor + Polls
4. **Week 7-8:** User profiles + Follow system
5. **Week 9-10:** DMs + Groups (if resources allow)

---

## Resources Required

- **Development:** 80-100 hours
- **Design:** 20-30 hours (UI/UX for new features)
- **Testing:** 20-30 hours (E2E tests for new features)
- **Infrastructure:** Supabase Realtime (included in plan)

---

*This plan is a living document and will be updated as features are implemented.*
