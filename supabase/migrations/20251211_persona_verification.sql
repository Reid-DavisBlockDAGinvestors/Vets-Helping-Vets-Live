-- Persona KYC integration fields for submissions table
-- Tracks automated identity verification status and results

-- Persona inquiry ID (their unique identifier for the verification session)
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS persona_inquiry_id TEXT;

-- Persona verification status: created, pending, completed, failed, expired, needs_review
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS persona_status TEXT DEFAULT 'not_started';

-- Persona reference ID (our reference we send to Persona)
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS persona_reference_id TEXT;

-- Full Persona verification result (JSON from webhook)
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS persona_result JSONB;

-- Whether face match passed
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS persona_face_match BOOLEAN;

-- Whether document verification passed
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS persona_doc_verified BOOLEAN;

-- Extracted data from ID (name, DOB, address, etc.)
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS persona_extracted_data JSONB;

-- Timestamp when Persona verification was completed
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS persona_verified_at TIMESTAMPTZ;

-- Comments
COMMENT ON COLUMN submissions.persona_inquiry_id IS 'Persona inquiry ID for the verification session';
COMMENT ON COLUMN submissions.persona_status IS 'Persona status: not_started, created, pending, completed, failed, expired, needs_review';
COMMENT ON COLUMN submissions.persona_reference_id IS 'Our reference ID sent to Persona (usually submission ID)';
COMMENT ON COLUMN submissions.persona_result IS 'Full Persona webhook result JSON';
COMMENT ON COLUMN submissions.persona_face_match IS 'Whether selfie matched the ID photo';
COMMENT ON COLUMN submissions.persona_doc_verified IS 'Whether the ID document was verified as authentic';
COMMENT ON COLUMN submissions.persona_extracted_data IS 'Data extracted from ID: name, DOB, address, etc.';
COMMENT ON COLUMN submissions.persona_verified_at IS 'When Persona verification completed';

-- Create index for Persona inquiry lookups (webhook processing)
CREATE INDEX IF NOT EXISTS idx_submissions_persona_inquiry ON submissions(persona_inquiry_id);
CREATE INDEX IF NOT EXISTS idx_submissions_persona_status ON submissions(persona_status);
