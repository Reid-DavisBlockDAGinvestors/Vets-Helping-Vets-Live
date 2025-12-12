-- Campaign updates table for Living NFT updates submitted by fundraiser creators
-- These are submitted for admin review before being pushed to the NFTs

CREATE TABLE IF NOT EXISTS public.campaign_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to the original submission/campaign
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  campaign_id INTEGER, -- On-chain campaign ID (V5)
  
  -- Creator who submitted this update
  creator_wallet TEXT NOT NULL,
  creator_email TEXT,
  
  -- Update content
  title TEXT, -- Optional title for the update
  story_update TEXT, -- Situation update / current status
  funds_utilization TEXT, -- How funds have been used
  benefits TEXT, -- Benefits received from the donations
  still_needed TEXT, -- What additional help is still needed
  new_image_uri TEXT, -- Optional new image (deprecated, use media_uris)
  media_uris TEXT[], -- Array of IPFS URIs for photos, videos, audio
  
  -- Admin review fields
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  reviewer_notes TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_campaign_updates_submission_id ON public.campaign_updates(submission_id);
CREATE INDEX IF NOT EXISTS idx_campaign_updates_creator_wallet ON public.campaign_updates(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_campaign_updates_status ON public.campaign_updates(status);
CREATE INDEX IF NOT EXISTS idx_campaign_updates_campaign_id ON public.campaign_updates(campaign_id);

-- Trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS set_campaign_updates_updated_at ON public.campaign_updates;
CREATE TRIGGER set_campaign_updates_updated_at
BEFORE UPDATE ON public.campaign_updates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Disable RLS for now (service role only via API routes)
ALTER TABLE IF EXISTS public.campaign_updates DISABLE ROW LEVEL SECURITY;
