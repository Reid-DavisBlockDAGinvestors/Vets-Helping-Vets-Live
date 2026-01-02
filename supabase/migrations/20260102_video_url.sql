-- Add video_url column to submissions for YouTube links
-- Admin adds YouTube URL during campaign approval

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS video_url VARCHAR(500);

COMMENT ON COLUMN submissions.video_url IS 'YouTube video URL for campaign story, added by admin during approval';

-- Also add to campaign_updates for video updates
ALTER TABLE campaign_updates ADD COLUMN IF NOT EXISTS video_url VARCHAR(500);

COMMENT ON COLUMN campaign_updates.video_url IS 'YouTube video URL for campaign update';
