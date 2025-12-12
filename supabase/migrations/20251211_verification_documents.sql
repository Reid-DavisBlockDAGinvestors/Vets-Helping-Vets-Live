-- Add verification document fields to submissions table
-- These store URLs to uploaded verification documents in Supabase Storage

-- Selfie photo for facial matching
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS verification_selfie TEXT;

-- Government ID front image
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS verification_id_front TEXT;

-- Government ID back image
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS verification_id_back TEXT;

-- Array of supporting document URLs (DD-214, insurance, medical records, etc.)
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS verification_documents JSONB DEFAULT '[]'::jsonb;

-- Verification status: pending, verified, rejected, needs_review
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';

-- Notes from admin review of verification documents
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- Timestamp when verification was completed
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Comments
COMMENT ON COLUMN submissions.verification_selfie IS 'URL to selfie photo for facial matching';
COMMENT ON COLUMN submissions.verification_id_front IS 'URL to front of government-issued ID';
COMMENT ON COLUMN submissions.verification_id_back IS 'URL to back of government-issued ID';
COMMENT ON COLUMN submissions.verification_documents IS 'Array of {url, type, name} objects for supporting docs';
COMMENT ON COLUMN submissions.verification_status IS 'Status: pending, verified, rejected, needs_review';
COMMENT ON COLUMN submissions.verification_notes IS 'Admin notes about verification review';
COMMENT ON COLUMN submissions.verified_at IS 'Timestamp when identity was verified';

-- Create index on verification status for admin queries
CREATE INDEX IF NOT EXISTS idx_submissions_verification_status ON submissions(verification_status);
