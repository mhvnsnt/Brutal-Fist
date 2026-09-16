-- ─────────────────────────────────────────────────────────────────────────────
-- Brutal Fist: Tournament Stats, Fighter Performance & Player Rank History
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. TYPES
DROP TYPE IF EXISTS public.tournament_tier CASCADE;
CREATE TYPE public.tournament_tier AS ENUM ('rookie', 'challenger', 'elite', 'legend');

DROP TYPE IF EXISTS public.match_outcome CASCADE;
CREATE TYPE public.match_outcome AS ENUM ('win', 'loss', 'draw');

-- 2. CORE TABLES

-- User profiles (intermediary for auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Player rank history
CREATE TABLE IF NOT EXISTS public.player_ranks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  rank_points INTEGER NOT NULL DEFAULT 0,
  rank_tier TEXT NOT NULL DEFAULT 'rookie',
  recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tournament definitions
CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  tier public.tournament_tier NOT NULL DEFAULT 'rookie',
  max_rounds INTEGER NOT NULL DEFAULT 7,
  entry_rank_min INTEGER NOT NULL DEFAULT 0,
  entry_rank_max INTEGER NOT NULL DEFAULT 9999,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tournament sessions (a player's run through a tournament)
CREATE TABLE IF NOT EXISTS public.tournament_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  fighter_id TEXT NOT NULL,
  fighter_name TEXT NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  rounds_played INTEGER NOT NULL DEFAULT 0,
  is_champion BOOLEAN NOT NULL DEFAULT false,
  is_eliminated BOOLEAN NOT NULL DEFAULT false,
  rank_points_earned INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);

-- Individual match results within a tournament session
CREATE TABLE IF NOT EXISTS public.match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.tournament_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  opponent_fighter_id TEXT NOT NULL,
  opponent_fighter_name TEXT NOT NULL,
  outcome public.match_outcome NOT NULL,
  played_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Fighter performance metrics (aggregated per fighter per user)
CREATE TABLE IF NOT EXISTS public.fighter_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  fighter_id TEXT NOT NULL,
  fighter_name TEXT NOT NULL,
  total_wins INTEGER NOT NULL DEFAULT 0,
  total_losses INTEGER NOT NULL DEFAULT 0,
  total_draws INTEGER NOT NULL DEFAULT 0,
  total_matches INTEGER NOT NULL DEFAULT 0,
  tournaments_entered INTEGER NOT NULL DEFAULT 0,
  tournaments_won INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, fighter_id)
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_player_ranks_user_id ON public.player_ranks(user_id);
CREATE INDEX IF NOT EXISTS idx_player_ranks_recorded_at ON public.player_ranks(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_tournament_sessions_user_id ON public.tournament_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_sessions_tournament_id ON public.tournament_sessions(tournament_id);
CREATE INDEX IF NOT EXISTS idx_match_results_session_id ON public.match_results(session_id);
CREATE INDEX IF NOT EXISTS idx_match_results_user_id ON public.match_results(user_id);
CREATE INDEX IF NOT EXISTS idx_fighter_stats_user_id ON public.fighter_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_fighter_stats_fighter_id ON public.fighter_stats(fighter_id);

-- 4. FUNCTIONS

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Upsert fighter stats helper
CREATE OR REPLACE FUNCTION public.upsert_fighter_stats(
  p_user_id UUID,
  p_fighter_id TEXT,
  p_fighter_name TEXT,
  p_wins INTEGER,
  p_losses INTEGER,
  p_draws INTEGER,
  p_tournament_entered BOOLEAN,
  p_tournament_won BOOLEAN,
  p_streak INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.fighter_stats (
    user_id, fighter_id, fighter_name,
    total_wins, total_losses, total_draws, total_matches,
    tournaments_entered, tournaments_won, best_streak, updated_at
  )
  VALUES (
    p_user_id, p_fighter_id, p_fighter_name,
    p_wins, p_losses, p_draws, p_wins + p_losses + p_draws,
    CASE WHEN p_tournament_entered THEN 1 ELSE 0 END,
    CASE WHEN p_tournament_won THEN 1 ELSE 0 END,
    p_streak,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (user_id, fighter_id) DO UPDATE SET
    total_wins = fighter_stats.total_wins + p_wins,
    total_losses = fighter_stats.total_losses + p_losses,
    total_draws = fighter_stats.total_draws + p_draws,
    total_matches = fighter_stats.total_matches + p_wins + p_losses + p_draws,
    tournaments_entered = fighter_stats.tournaments_entered + CASE WHEN p_tournament_entered THEN 1 ELSE 0 END,
    tournaments_won = fighter_stats.tournaments_won + CASE WHEN p_tournament_won THEN 1 ELSE 0 END,
    best_streak = GREATEST(fighter_stats.best_streak, p_streak),
    updated_at = CURRENT_TIMESTAMP;
END;
$$;

-- 5. ENABLE RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fighter_stats ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES

-- user_profiles
DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;
CREATE POLICY "users_manage_own_user_profiles"
ON public.user_profiles FOR ALL TO authenticated
USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- player_ranks
DROP POLICY IF EXISTS "users_manage_own_player_ranks" ON public.player_ranks;
CREATE POLICY "users_manage_own_player_ranks"
ON public.player_ranks FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- tournaments (public read)
DROP POLICY IF EXISTS "public_read_tournaments" ON public.tournaments;
CREATE POLICY "public_read_tournaments"
ON public.tournaments FOR SELECT TO public USING (true);

-- tournament_sessions
DROP POLICY IF EXISTS "users_manage_own_tournament_sessions" ON public.tournament_sessions;
CREATE POLICY "users_manage_own_tournament_sessions"
ON public.tournament_sessions FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- match_results
DROP POLICY IF EXISTS "users_manage_own_match_results" ON public.match_results;
CREATE POLICY "users_manage_own_match_results"
ON public.match_results FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- fighter_stats
DROP POLICY IF EXISTS "users_manage_own_fighter_stats" ON public.fighter_stats;
CREATE POLICY "users_manage_own_fighter_stats"
ON public.fighter_stats FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 7. TRIGGERS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. SEED TOURNAMENT DATA
DO $$
BEGIN
  INSERT INTO public.tournaments (id, name, description, tier, max_rounds, entry_rank_min, entry_rank_max, is_active)
  VALUES
    (gen_random_uuid(), 'Street Circuit', 'Entry-level bracket for new fighters. Prove yourself on the streets.', 'rookie', 5, 0, 999, true),
    (gen_random_uuid(), 'Underground Brawl', 'No rules, no mercy. Mid-tier chaos bracket.', 'challenger', 7, 500, 2999, true),
    (gen_random_uuid(), 'Iron Gauntlet', 'Elite fighters only. Seven rounds of pure punishment.', 'elite', 7, 2000, 5999, true),
    (gen_random_uuid(), 'Brutal Fist Championship', 'The pinnacle. Only legends compete here.', 'legend', 7, 5000, 99999, true)
  ON CONFLICT (id) DO NOTHING;
END $$;
