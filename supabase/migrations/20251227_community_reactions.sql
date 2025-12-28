-- Add reaction_type column to community_likes table
-- Supports: love, pray, encourage, celebrate, care
-- Default to 'love' for backward compatibility with existing likes

ALTER TABLE community_likes 
ADD COLUMN IF NOT EXISTS reaction_type TEXT DEFAULT 'love';

-- Update existing records to have 'love' reaction type
UPDATE community_likes 
SET reaction_type = 'love' 
WHERE reaction_type IS NULL;

-- Add check constraint for valid reaction types
ALTER TABLE community_likes 
DROP CONSTRAINT IF EXISTS valid_reaction_type;

ALTER TABLE community_likes 
ADD CONSTRAINT valid_reaction_type 
CHECK (reaction_type IN ('love', 'pray', 'encourage', 'celebrate', 'care'));

-- Create index for efficient reaction type queries
CREATE INDEX IF NOT EXISTS idx_community_likes_reaction_type 
ON community_likes(reaction_type);

-- Add metadata column to community_notifications for reaction info
ALTER TABLE community_notifications 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN community_likes.reaction_type IS 'Reaction types: love (❤️), pray (🙏), encourage (💪), celebrate (🎉), care (😢)';
