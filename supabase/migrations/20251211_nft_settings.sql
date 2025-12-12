-- Add NFT settings columns to submissions table
-- These allow admin to configure the NFT pricing and editions for each campaign

-- NFT price in BDAG (default 20 BDAG = $1 USD)
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS nft_price DECIMAL(18, 4) DEFAULT 20;

-- Maximum number of editions (0 = unlimited)
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS nft_editions INTEGER DEFAULT 100;

-- Remaining editions available
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS nft_editions_remaining INTEGER DEFAULT 100;

-- Admin notes for internal tracking
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Who reviewed the submission
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id);

-- When the submission was reviewed
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Updated at timestamp
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS submissions_updated_at ON submissions;
CREATE TRIGGER submissions_updated_at
    BEFORE UPDATE ON submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_submissions_updated_at();

COMMENT ON COLUMN submissions.nft_price IS 'Price per NFT edition in BDAG tokens';
COMMENT ON COLUMN submissions.nft_editions IS 'Maximum number of NFT editions (0 = unlimited)';
COMMENT ON COLUMN submissions.nft_editions_remaining IS 'Remaining editions available for purchase';
