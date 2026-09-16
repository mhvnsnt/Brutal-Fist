-- ── Match Replays Table ───────────────────────────────────────────────────────
-- Stores serialized MatchClip JSON from MatchRecorder for replay playback
-- and tournament review on the player profile screen.

CREATE TABLE IF NOT EXISTS public.match_replays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  clip_id TEXT NOT NULL,
  label TEXT NOT NULL,
  p1_name TEXT NOT NULL DEFAULT '',
  p2_name TEXT NOT NULL DEFAULT '',
  stage_name TEXT NOT NULL DEFAULT '',
  total_frames INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  in_point INTEGER NOT NULL DEFAULT 0,
  out_point INTEGER NOT NULL DEFAULT 0,
  speed_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  frames_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  exported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_replays_user_id ON public.match_replays(user_id);
CREATE INDEX IF NOT EXISTS idx_match_replays_created_at ON public.match_replays(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_match_replays_clip_id ON public.match_replays(clip_id);

ALTER TABLE public.match_replays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_match_replays" ON public.match_replays;
CREATE POLICY "users_manage_own_match_replays"
ON public.match_replays
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
