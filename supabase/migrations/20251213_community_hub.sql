-- Community Hub Tables

-- Posts table (main content)
CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  campaign_id TEXT, -- Optional: link to campaign
  content TEXT NOT NULL,
  media_urls TEXT[] DEFAULT '{}', -- Array of media URLs (images, videos, GIFs)
  media_types TEXT[] DEFAULT '{}', -- Array of media types ('image', 'video', 'gif', 'youtube', 'twitter')
  post_type TEXT DEFAULT 'discussion' CHECK (post_type IN ('discussion', 'update', 'milestone', 'thank_you', 'media', 'poll')),
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  shares_count INT DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments on posts
CREATE TABLE IF NOT EXISTS community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES community_comments(id) ON DELETE CASCADE, -- For nested replies
  content TEXT NOT NULL,
  likes_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Likes (for posts and comments)
CREATE TABLE IF NOT EXISTS community_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id),
  UNIQUE(user_id, comment_id),
  CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  )
);

-- User follows (follow creators, donors, campaigns)
CREATE TABLE IF NOT EXISTS community_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL,
  following_id UUID, -- User being followed
  campaign_id TEXT, -- Campaign being followed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  UNIQUE(follower_id, campaign_id)
);

-- Media uploads tracking
CREATE TABLE IF NOT EXISTS community_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'gif')),
  file_size INT,
  width INT,
  height INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User community profiles (extended profile for community features)
CREATE TABLE IF NOT EXISTS community_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  website_url TEXT,
  twitter_handle TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_creator BOOLEAN DEFAULT false,
  is_donor BOOLEAN DEFAULT false,
  total_donated NUMERIC DEFAULT 0,
  campaigns_supported INT DEFAULT 0,
  followers_count INT DEFAULT 0,
  following_count INT DEFAULT 0,
  posts_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications for community activity
CREATE TABLE IF NOT EXISTS community_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'mention', 'milestone', 'campaign_update')),
  actor_id UUID, -- User who triggered the notification
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_user ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_campaign ON community_posts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post ON community_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_post ON community_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON community_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON community_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON community_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON community_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON community_notifications(user_id, is_read);

-- Enable RLS
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies (use DROP IF EXISTS to allow re-running)
-- Posts: Anyone can read, authenticated users can create
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON community_posts;
CREATE POLICY "Posts are viewable by everyone" ON community_posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can create posts" ON community_posts;
CREATE POLICY "Users can create posts" ON community_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own posts" ON community_posts;
CREATE POLICY "Users can update own posts" ON community_posts FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own posts" ON community_posts;
CREATE POLICY "Users can delete own posts" ON community_posts FOR DELETE USING (auth.uid() = user_id);

-- Comments: Same pattern
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON community_comments;
CREATE POLICY "Comments are viewable by everyone" ON community_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can create comments" ON community_comments;
CREATE POLICY "Users can create comments" ON community_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own comments" ON community_comments;
CREATE POLICY "Users can update own comments" ON community_comments FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own comments" ON community_comments;
CREATE POLICY "Users can delete own comments" ON community_comments FOR DELETE USING (auth.uid() = user_id);

-- Likes
DROP POLICY IF EXISTS "Likes are viewable by everyone" ON community_likes;
CREATE POLICY "Likes are viewable by everyone" ON community_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can create likes" ON community_likes;
CREATE POLICY "Users can create likes" ON community_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own likes" ON community_likes;
CREATE POLICY "Users can delete own likes" ON community_likes FOR DELETE USING (auth.uid() = user_id);

-- Follows
DROP POLICY IF EXISTS "Follows are viewable by everyone" ON community_follows;
CREATE POLICY "Follows are viewable by everyone" ON community_follows FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can create follows" ON community_follows;
CREATE POLICY "Users can create follows" ON community_follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
DROP POLICY IF EXISTS "Users can delete own follows" ON community_follows;
CREATE POLICY "Users can delete own follows" ON community_follows FOR DELETE USING (auth.uid() = follower_id);

-- Profiles: Public read, own write
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON community_profiles;
CREATE POLICY "Profiles are viewable by everyone" ON community_profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON community_profiles;
CREATE POLICY "Users can update own profile" ON community_profiles FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own profile" ON community_profiles;
CREATE POLICY "Users can create own profile" ON community_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Notifications: Only own
DROP POLICY IF EXISTS "Users can view own notifications" ON community_notifications;
CREATE POLICY "Users can view own notifications" ON community_notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own notifications" ON community_notifications;
CREATE POLICY "Users can update own notifications" ON community_notifications FOR UPDATE USING (auth.uid() = user_id);

-- Service role has full access
DROP POLICY IF EXISTS "Service role full access posts" ON community_posts;
CREATE POLICY "Service role full access posts" ON community_posts FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access comments" ON community_comments;
CREATE POLICY "Service role full access comments" ON community_comments FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access likes" ON community_likes;
CREATE POLICY "Service role full access likes" ON community_likes FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access follows" ON community_follows;
CREATE POLICY "Service role full access follows" ON community_follows FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access media" ON community_media;
CREATE POLICY "Service role full access media" ON community_media FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access profiles" ON community_profiles;
CREATE POLICY "Service role full access profiles" ON community_profiles FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access notifications" ON community_notifications;
CREATE POLICY "Service role full access notifications" ON community_notifications FOR ALL USING (auth.role() = 'service_role');
