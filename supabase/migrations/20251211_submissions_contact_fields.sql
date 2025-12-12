-- Add contact information fields to submissions table
-- These fields store creator personal info for verification and communication

-- Full name of the campaign creator
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS creator_name TEXT;

-- Phone number for contact
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS creator_phone TEXT;

-- Address stored as JSONB for flexibility (street, city, state, zip, country)
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS creator_address JSONB;

-- Add comments
COMMENT ON COLUMN submissions.creator_name IS 'Full legal name of the campaign creator';
COMMENT ON COLUMN submissions.creator_phone IS 'Phone number for verification and contact';
COMMENT ON COLUMN submissions.creator_address IS 'Mailing address as JSON: {street, city, state, zip, country}';
