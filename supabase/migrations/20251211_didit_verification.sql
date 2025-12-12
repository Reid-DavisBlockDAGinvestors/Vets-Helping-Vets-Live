-- Migration: Add Didit KYC verification columns to submissions
-- Replaces Persona verification with Didit

-- Add Didit verification columns
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS didit_session_id TEXT,
ADD COLUMN IF NOT EXISTS didit_status TEXT DEFAULT 'Not Started',
ADD COLUMN IF NOT EXISTS didit_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS didit_id_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS didit_liveness_passed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS didit_face_match BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS didit_features JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS didit_extracted_data JSONB DEFAULT '{}';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_submissions_didit_session_id 
ON submissions(didit_session_id) 
WHERE didit_session_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN submissions.didit_session_id IS 'Didit verification session ID';
COMMENT ON COLUMN submissions.didit_status IS 'Didit verification status: Not Started, In Progress, Pending Review, Approved, Declined, Expired';
COMMENT ON COLUMN submissions.didit_verified_at IS 'Timestamp when verification was completed';
COMMENT ON COLUMN submissions.didit_id_verified IS 'Whether ID document was verified';
COMMENT ON COLUMN submissions.didit_liveness_passed IS 'Whether liveness check passed';
COMMENT ON COLUMN submissions.didit_face_match IS 'Whether face match check passed';
COMMENT ON COLUMN submissions.didit_features IS 'Full features response from Didit';
COMMENT ON COLUMN submissions.didit_extracted_data IS 'Extracted data from verification';
