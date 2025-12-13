-- Campaign Identifiers and Community Integration
-- This creates a robust system for referencing campaigns in the community hub

-- Step 1: Add unique slug to submissions table for human-readable URLs
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS short_code TEXT UNIQUE;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS hashtag TEXT UNIQUE;

-- Create index for fast slug lookups
CREATE INDEX IF NOT EXISTS idx_submissions_slug ON submissions(slug);
CREATE INDEX IF NOT EXISTS idx_submissions_short_code ON submissions(short_code);
CREATE INDEX IF NOT EXISTS idx_submissions_hashtag ON submissions(hashtag);

-- Step 2: Campaign Tags/Topics for categorization
CREATE TABLE IF NOT EXISTS campaign_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#3B82F6', -- Hex color for UI
  icon TEXT, -- Emoji or icon name
  post_count INT DEFAULT 0,
  campaign_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default tags
INSERT INTO campaign_tags (name, slug, description, color, icon) VALUES
  ('Veterans', 'veterans', 'Support for military veterans', '#22C55E', '🎖️'),
  ('Medical', 'medical', 'Medical expenses and healthcare', '#EF4444', '🏥'),
  ('Housing', 'housing', 'Housing assistance and shelter', '#F59E0B', '🏠'),
  ('Education', 'education', 'Educational support and training', '#8B5CF6', '📚'),
  ('Emergency', 'emergency', 'Emergency and urgent needs', '#DC2626', '🚨'),
  ('Family', 'family', 'Family support and assistance', '#EC4899', '👨‍👩‍👧‍👦'),
  ('Business', 'business', 'Small business and entrepreneurship', '#06B6D4', '💼'),
  ('Community', 'community', 'Community projects and initiatives', '#10B981', '🤝')
ON CONFLICT (slug) DO NOTHING;

-- Step 3: Campaign-Tag associations (many-to-many)
CREATE TABLE IF NOT EXISTS campaign_tag_associations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL, -- References submissions.id or on-chain campaign ID
  tag_id UUID NOT NULL REFERENCES campaign_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_tags_campaign ON campaign_tag_associations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_tags_tag ON campaign_tag_associations(tag_id);

-- Step 4: Post mentions (campaigns, users, tags mentioned in posts)
CREATE TABLE IF NOT EXISTS post_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  mention_type TEXT NOT NULL CHECK (mention_type IN ('campaign', 'user', 'tag')),
  campaign_id TEXT, -- If mentioning a campaign
  user_id UUID, -- If mentioning a user
  tag_id UUID REFERENCES campaign_tags(id) ON DELETE CASCADE, -- If mentioning a tag
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_mentions_post ON post_mentions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_mentions_campaign ON post_mentions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_post_mentions_user ON post_mentions(user_id);
CREATE INDEX IF NOT EXISTS idx_post_mentions_tag ON post_mentions(tag_id);

-- Step 5: Campaign followers (users following specific campaigns)
CREATE TABLE IF NOT EXISTS campaign_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  notify_posts BOOLEAN DEFAULT true,
  notify_updates BOOLEAN DEFAULT true,
  notify_milestones BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_followers_campaign ON campaign_followers(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_followers_user ON campaign_followers(user_id);

-- Step 6: Campaign activity log (tracks all activity for feeds)
CREATE TABLE IF NOT EXISTS campaign_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'post', 'comment', 'like', 'share', 'donation', 'milestone', 
    'update', 'mention', 'follow', 'nft_purchase', 'tip'
  )),
  actor_id UUID, -- User who performed the action
  post_id UUID REFERENCES community_posts(id) ON DELETE SET NULL,
  comment_id UUID REFERENCES community_comments(id) ON DELETE SET NULL,
  amount NUMERIC, -- For donations/tips
  metadata JSONB, -- Additional data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_activity_campaign ON campaign_activity(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_activity_type ON campaign_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_campaign_activity_created ON campaign_activity(created_at DESC);

-- Step 7: Campaign stats (aggregated metrics)
CREATE TABLE IF NOT EXISTS campaign_community_stats (
  campaign_id TEXT PRIMARY KEY,
  followers_count INT DEFAULT 0,
  posts_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  likes_count INT DEFAULT 0,
  shares_count INT DEFAULT 0,
  mentions_count INT DEFAULT 0,
  engagement_score INT DEFAULT 0, -- Calculated engagement metric
  last_activity_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 8: Function to generate unique slug from title
CREATE OR REPLACE FUNCTION generate_campaign_slug(title TEXT, campaign_id TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  base_slug := lower(regexp_replace(title, '[^a-zA-Z0-9\s-]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  
  -- Limit length
  base_slug := left(base_slug, 50);
  
  final_slug := base_slug;
  
  -- Check for uniqueness and append number if needed
  WHILE EXISTS (SELECT 1 FROM submissions WHERE slug = final_slug AND id != campaign_id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Function to generate short code (like YouTube video IDs)
CREATE OR REPLACE FUNCTION generate_short_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Trigger to auto-generate slug and short_code on submission insert/update
CREATE OR REPLACE FUNCTION auto_generate_campaign_identifiers()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate slug if not set
  IF NEW.slug IS NULL AND NEW.title IS NOT NULL THEN
    NEW.slug := generate_campaign_slug(NEW.title, NEW.id);
  END IF;
  
  -- Generate short_code if not set
  IF NEW.short_code IS NULL THEN
    NEW.short_code := generate_short_code();
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM submissions WHERE short_code = NEW.short_code AND id != NEW.id) LOOP
      NEW.short_code := generate_short_code();
    END LOOP;
  END IF;
  
  -- Generate hashtag if not set (simplified version of title)
  IF NEW.hashtag IS NULL AND NEW.title IS NOT NULL THEN
    NEW.hashtag := lower(regexp_replace(NEW.title, '[^a-zA-Z0-9]', '', 'g'));
    NEW.hashtag := left(NEW.hashtag, 30);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_campaign_identifiers ON submissions;
CREATE TRIGGER trigger_auto_campaign_identifiers
  BEFORE INSERT OR UPDATE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_campaign_identifiers();

-- Step 11: Update existing submissions with slugs
UPDATE submissions 
SET slug = generate_campaign_slug(title, id)
WHERE slug IS NULL AND title IS NOT NULL;

UPDATE submissions 
SET short_code = generate_short_code()
WHERE short_code IS NULL;

-- Enable RLS
ALTER TABLE campaign_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_tag_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_community_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Public read, authenticated write
CREATE POLICY "Public read campaign_tags" ON campaign_tags FOR SELECT USING (true);
CREATE POLICY "Public read campaign_tag_associations" ON campaign_tag_associations FOR SELECT USING (true);
CREATE POLICY "Public read post_mentions" ON post_mentions FOR SELECT USING (true);
CREATE POLICY "Public read campaign_followers" ON campaign_followers FOR SELECT USING (true);
CREATE POLICY "Public read campaign_activity" ON campaign_activity FOR SELECT USING (true);
CREATE POLICY "Public read campaign_community_stats" ON campaign_community_stats FOR SELECT USING (true);

CREATE POLICY "Authenticated insert campaign_followers" ON campaign_followers 
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated delete campaign_followers" ON campaign_followers 
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service full campaign_tags" ON campaign_tags FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service full campaign_tag_associations" ON campaign_tag_associations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service full post_mentions" ON post_mentions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service full campaign_followers" ON campaign_followers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service full campaign_activity" ON campaign_activity FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service full campaign_community_stats" ON campaign_community_stats FOR ALL USING (auth.role() = 'service_role');
