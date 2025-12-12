-- Events table for analytics tracking (purchases, views, etc.)
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  submission_id UUID REFERENCES public.submissions(id) ON DELETE SET NULL,
  campaign_id INTEGER,
  wallet_address TEXT,
  tx_hash TEXT,
  amount_bdag NUMERIC,
  amount_usd NUMERIC,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by event type
CREATE INDEX IF NOT EXISTS idx_events_event_type ON public.events(event_type);

-- Index for querying by submission
CREATE INDEX IF NOT EXISTS idx_events_submission_id ON public.events(submission_id);

-- Index for querying by campaign
CREATE INDEX IF NOT EXISTS idx_events_campaign_id ON public.events(campaign_id);

-- Index for querying by wallet
CREATE INDEX IF NOT EXISTS idx_events_wallet_address ON public.events(wallet_address);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_events_created_at ON public.events(created_at DESC);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access" ON public.events
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to view their own events
CREATE POLICY "Users can view own events" ON public.events
  FOR SELECT
  USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

COMMENT ON TABLE public.events IS 'Analytics events for tracking purchases, views, and other user actions';
COMMENT ON COLUMN public.events.event_type IS 'Type of event: purchase, view, mint, etc.';
COMMENT ON COLUMN public.events.metadata IS 'Additional event-specific data as JSON';
