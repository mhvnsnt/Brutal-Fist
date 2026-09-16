-- ─────────────────────────────────────────────────────────────────────────────
-- Brutal Fist: Matchmaking Queue, ELO, Tier History, H2H, Cosmetic Unlocks
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. TYPES
DROP TYPE IF EXISTS public.queue_status CASCADE;
CREATE TYPE public.queue_status AS ENUM ('waiting', 'matched', 'cancelled', 'expired');

DROP TYPE IF EXISTS public.match_tier CASCADE;
CREATE TYPE public.match_tier AS ENUM ('bronze', 'silver', 'gold', 'platinum', 'diamond', 'legend');

-- 2. TABLES

-- Active match queue (real-time matchmaking pool)
CREATE TABLE IF NOT EXISTS public.active_match_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  fighter_id TEXT NOT NULL,
  fighter_name TEXT NOT NULL,
  elo_rating INTEGER NOT NULL DEFAULT 1000,
  tier public.match_tier NOT NULL DEFAULT 'bronze',
  status public.queue_status NOT NULL DEFAULT 'waiting',
  matched_with UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  matched_fighter_id TEXT,
  matched_fighter_name TEXT,
  match_id UUID,
  joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  matched_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes')
);

-- Player ELO and queue profile
CREATE TABLE IF NOT EXISTS public.player_elo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  fighter_id TEXT NOT NULL,
  fighter_name TEXT NOT NULL,
  elo_rating INTEGER NOT NULL DEFAULT 1000,
  tier public.match_tier NOT NULL DEFAULT 'bronze',
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  win_streak INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, fighter_id)
);

-- Tier climb history (tracks every tier change)
CREATE TABLE IF NOT EXISTS public.tier_climb_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  fighter_id TEXT NOT NULL,
  fighter_name TEXT NOT NULL,
  from_tier TEXT NOT NULL,
  to_tier TEXT NOT NULL,
  elo_at_change INTEGER NOT NULL,
  direction TEXT NOT NULL DEFAULT 'up',
  recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Head-to-head records between players
CREATE TABLE IF NOT EXISTS public.head_to_head_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  opponent_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  user_fighter_id TEXT NOT NULL,
  opponent_fighter_id TEXT NOT NULL,
  opponent_name TEXT NOT NULL DEFAULT '',
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  last_played_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, opponent_id, user_fighter_id, opponent_fighter_id)
);

-- Cosmetic unlock timeline
CREATE TABLE IF NOT EXISTS public.cosmetic_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  cosmetic_id TEXT NOT NULL,
  cosmetic_name TEXT NOT NULL,
  cosmetic_type TEXT NOT NULL DEFAULT 'OUTFIT',
  rarity TEXT NOT NULL DEFAULT 'COMMON',
  unlock_source TEXT NOT NULL DEFAULT 'milestone',
  unlock_context TEXT,
  unlocked_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, cosmetic_id)
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_active_match_queue_user_id ON public.active_match_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_active_match_queue_status ON public.active_match_queue(status);
CREATE INDEX IF NOT EXISTS idx_active_match_queue_tier ON public.active_match_queue(tier);
CREATE INDEX IF NOT EXISTS idx_active_match_queue_elo ON public.active_match_queue(elo_rating);
CREATE INDEX IF NOT EXISTS idx_active_match_queue_joined_at ON public.active_match_queue(joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_player_elo_user_id ON public.player_elo(user_id);
CREATE INDEX IF NOT EXISTS idx_player_elo_tier ON public.player_elo(tier);
CREATE INDEX IF NOT EXISTS idx_tier_climb_history_user_id ON public.tier_climb_history(user_id);
CREATE INDEX IF NOT EXISTS idx_tier_climb_history_recorded_at ON public.tier_climb_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_head_to_head_user_id ON public.head_to_head_records(user_id);
CREATE INDEX IF NOT EXISTS idx_cosmetic_unlocks_user_id ON public.cosmetic_unlocks(user_id);
CREATE INDEX IF NOT EXISTS idx_cosmetic_unlocks_unlocked_at ON public.cosmetic_unlocks(unlocked_at DESC);

-- 4. FUNCTIONS

-- Auto-expire stale queue entries
CREATE OR REPLACE FUNCTION public.expire_stale_queue_entries()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.active_match_queue
  SET status = 'expired'
  WHERE status = 'waiting'
    AND expires_at < CURRENT_TIMESTAMP;
END;
$$;

-- Get ELO tier from rating
CREATE OR REPLACE FUNCTION public.get_elo_tier(p_elo INTEGER)
RETURNS public.match_tier
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_elo >= 2000 THEN RETURN 'legend'::public.match_tier;
  ELSIF p_elo >= 1600 THEN RETURN 'diamond'::public.match_tier;
  ELSIF p_elo >= 1300 THEN RETURN 'platinum'::public.match_tier;
  ELSIF p_elo >= 1100 THEN RETURN 'gold'::public.match_tier;
  ELSIF p_elo >= 900 THEN RETURN 'silver'::public.match_tier;
  ELSE RETURN 'bronze'::public.match_tier;
  END IF;
END;
$$;

-- Update ELO after match
CREATE OR REPLACE FUNCTION public.update_elo_after_match(
  p_user_id UUID,
  p_fighter_id TEXT,
  p_fighter_name TEXT,
  p_opponent_elo INTEGER,
  p_outcome TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_elo INTEGER;
  v_current_tier public.match_tier;
  v_new_elo INTEGER;
  v_new_tier public.match_tier;
  v_k_factor INTEGER := 32;
  v_expected FLOAT;
  v_score FLOAT;
BEGIN
  SELECT elo_rating, tier INTO v_current_elo, v_current_tier
  FROM public.player_elo
  WHERE user_id = p_user_id AND fighter_id = p_fighter_id;

  IF v_current_elo IS NULL THEN
    v_current_elo := 1000;
    v_current_tier := 'bronze'::public.match_tier;
  END IF;

  v_expected := 1.0 / (1.0 + POWER(10.0, (p_opponent_elo - v_current_elo) / 400.0));
  v_score := CASE p_outcome WHEN 'win' THEN 1.0 WHEN 'loss' THEN 0.0 ELSE 0.5 END;
  v_new_elo := GREATEST(100, v_current_elo + ROUND(v_k_factor * (v_score - v_expected)));
  v_new_tier := public.get_elo_tier(v_new_elo);

  INSERT INTO public.player_elo (user_id, fighter_id, fighter_name, elo_rating, tier,
    wins, losses, draws, win_streak, updated_at)
  VALUES (p_user_id, p_fighter_id, p_fighter_name, v_new_elo, v_new_tier,
    CASE WHEN p_outcome = 'win' THEN 1 ELSE 0 END,
    CASE WHEN p_outcome = 'loss' THEN 1 ELSE 0 END,
    CASE WHEN p_outcome = 'draw' THEN 1 ELSE 0 END,
    CASE WHEN p_outcome = 'win' THEN 1 ELSE 0 END,
    CURRENT_TIMESTAMP)
  ON CONFLICT (user_id, fighter_id) DO UPDATE SET
    elo_rating = v_new_elo,
    tier = v_new_tier,
    wins = player_elo.wins + CASE WHEN p_outcome = 'win' THEN 1 ELSE 0 END,
    losses = player_elo.losses + CASE WHEN p_outcome = 'loss' THEN 1 ELSE 0 END,
    draws = player_elo.draws + CASE WHEN p_outcome = 'draw' THEN 1 ELSE 0 END,
    win_streak = CASE WHEN p_outcome = 'win' THEN player_elo.win_streak + 1 ELSE 0 END,
    updated_at = CURRENT_TIMESTAMP;

  IF v_new_tier <> v_current_tier THEN
    INSERT INTO public.tier_climb_history (user_id, fighter_id, fighter_name,
      from_tier, to_tier, elo_at_change, direction)
    VALUES (p_user_id, p_fighter_id, p_fighter_name,
      v_current_tier::TEXT, v_new_tier::TEXT, v_new_elo,
      CASE WHEN v_new_elo > v_current_elo THEN 'up' ELSE 'down' END);
  END IF;

  RETURN v_new_elo;
END;
$$;

-- 5. ENABLE RLS
ALTER TABLE public.active_match_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_elo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tier_climb_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.head_to_head_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cosmetic_unlocks ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES

-- active_match_queue: users manage own entries, all authenticated can read waiting entries
DROP POLICY IF EXISTS "users_manage_own_queue" ON public.active_match_queue;
CREATE POLICY "users_manage_own_queue"
ON public.active_match_queue FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "authenticated_read_waiting_queue" ON public.active_match_queue;
CREATE POLICY "authenticated_read_waiting_queue"
ON public.active_match_queue FOR SELECT TO authenticated
USING (status = 'waiting' OR user_id = auth.uid());

-- player_elo: own data + public read for leaderboard
DROP POLICY IF EXISTS "users_manage_own_elo" ON public.player_elo;
CREATE POLICY "users_manage_own_elo"
ON public.player_elo FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "public_read_player_elo" ON public.player_elo;
CREATE POLICY "public_read_player_elo"
ON public.player_elo FOR SELECT TO public USING (true);

-- tier_climb_history
DROP POLICY IF EXISTS "users_manage_own_tier_history" ON public.tier_climb_history;
CREATE POLICY "users_manage_own_tier_history"
ON public.tier_climb_history FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- head_to_head_records
DROP POLICY IF EXISTS "users_manage_own_h2h" ON public.head_to_head_records;
CREATE POLICY "users_manage_own_h2h"
ON public.head_to_head_records FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- cosmetic_unlocks
DROP POLICY IF EXISTS "users_manage_own_cosmetics" ON public.cosmetic_unlocks;
CREATE POLICY "users_manage_own_cosmetics"
ON public.cosmetic_unlocks FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 7. ENABLE REALTIME for active_match_queue
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_match_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_elo;
