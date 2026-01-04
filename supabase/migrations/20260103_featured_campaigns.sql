-- Add featured campaigns support
-- This allows admins to select campaigns for prominent homepage placement

-- Add featured columns to submissions table
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS featured_order INTEGER DEFAULT 0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS featured_at TIMESTAMPTZ;

-- Create index for faster featured query
CREATE INDEX IF NOT EXISTS idx_submissions_featured ON submissions(is_featured, featured_order) WHERE is_featured = TRUE;

-- Comment for documentation
COMMENT ON COLUMN submissions.is_featured IS 'Whether this campaign is featured on the homepage';
COMMENT ON COLUMN submissions.featured_order IS 'Order of featured campaigns (lower = higher priority)';
COMMENT ON COLUMN submissions.featured_at IS 'When this campaign was featured';
