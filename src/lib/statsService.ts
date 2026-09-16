'use client';

import { createClient } from './supabase/client';

function isSchemaError(error: any): boolean {
  if (!error) return false;
  if (error.code && typeof error.code === 'string') {
    const cls = error.code.substring(0, 2);
    if (cls === '42' || cls === '08') return true;
    if (cls === '23') return false;
  }
  if (error.message) {
    return /relation.*does not exist|column.*does not exist|function.*does not exist|syntax error|type.*does not exist/i.test(error.message);
  }
  return false;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TournamentSession {
  id: string;
  userId: string;
  tournamentId: string;
  tournamentName?: string;
  tournamentTier?: string;
  fighterId: string;
  fighterName: string;
  wins: number;
  losses: number;
  draws: number;
  roundsPlayed: number;
  isChampion: boolean;
  isEliminated: boolean;
  rankPointsEarned: number;
  startedAt: string;
  completedAt?: string;
}

export interface MatchResult {
  id: string;
  sessionId: string;
  userId: string;
  roundNumber: number;
  opponentFighterId: string;
  opponentFighterName: string;
  outcome: 'win' | 'loss' | 'draw';
  playedAt: string;
}

export interface FighterStat {
  id: string;
  userId: string;
  fighterId: string;
  fighterName: string;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  totalMatches: number;
  tournamentsEntered: number;
  tournamentsWon: number;
  bestStreak: number;
  updatedAt: string;
}

export interface PlayerRank {
  id: string;
  userId: string;
  rankPoints: number;
  rankTier: string;
  recordedAt: string;
}

export interface Tournament {
  id: string;
  name: string;
  description: string;
  tier: 'rookie' | 'challenger' | 'elite' | 'legend';
  maxRounds: number;
  entryRankMin: number;
  entryRankMax: number;
  isActive: boolean;
  createdAt: string;
}

// ─── Stats Service ────────────────────────────────────────────────────────────

export const statsService = {

  // ── Tournaments ──────────────────────────────────────────────────────────────

  async getTournaments(): Promise<Tournament[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }
      return (data || []).map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        tier: r.tier,
        maxRounds: r.max_rounds,
        entryRankMin: r.entry_rank_min,
        entryRankMax: r.entry_rank_max,
        isActive: r.is_active,
        createdAt: r.created_at,
      }));
    } catch (e: any) {
      if (isSchemaError(e)) throw e;
      return [];
    }
  },

  // ── Tournament Sessions ───────────────────────────────────────────────────────

  async createSession(params: {
    userId: string;
    tournamentId: string;
    fighterId: string;
    fighterName: string;
  }): Promise<string | null> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('tournament_sessions')
        .insert({
          user_id: params.userId,
          tournament_id: params.tournamentId,
          fighter_id: params.fighterId,
          fighter_name: params.fighterName,
        })
        .select('id')
        .single();
      if (error) {
        if (isSchemaError(error)) throw error;
        return null;
      }
      return data?.id ?? null;
    } catch (e: any) {
      if (isSchemaError(e)) throw e;
      return null;
    }
  },

  async completeSession(params: {
    sessionId: string;
    wins: number;
    losses: number;
    draws: number;
    roundsPlayed: number;
    isChampion: boolean;
    isEliminated: boolean;
    rankPointsEarned: number;
  }): Promise<void> {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('tournament_sessions')
        .update({
          wins: params.wins,
          losses: params.losses,
          draws: params.draws,
          rounds_played: params.roundsPlayed,
          is_champion: params.isChampion,
          is_eliminated: params.isEliminated,
          rank_points_earned: params.rankPointsEarned,
          completed_at: new Date().toISOString(),
        })
        .eq('id', params.sessionId);
      if (error && isSchemaError(error)) throw error;
    } catch (e: any) {
      if (isSchemaError(e)) throw e;
    }
  },

  async getUserSessions(userId: string): Promise<TournamentSession[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('tournament_sessions')
        .select('*, tournaments(name, tier)')
        .eq('user_id', userId)
        .order('started_at', { ascending: false });
      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }
      return (data || []).map(r => ({
        id: r.id,
        userId: r.user_id,
        tournamentId: r.tournament_id,
        tournamentName: r.tournaments?.name,
        tournamentTier: r.tournaments?.tier,
        fighterId: r.fighter_id,
        fighterName: r.fighter_name,
        wins: r.wins,
        losses: r.losses,
        draws: r.draws,
        roundsPlayed: r.rounds_played,
        isChampion: r.is_champion,
        isEliminated: r.is_eliminated,
        rankPointsEarned: r.rank_points_earned,
        startedAt: r.started_at,
        completedAt: r.completed_at,
      }));
    } catch (e: any) {
      if (isSchemaError(e)) throw e;
      return [];
    }
  },

  // ── Match Results ─────────────────────────────────────────────────────────────

  async saveMatchResult(params: {
    sessionId: string;
    userId: string;
    roundNumber: number;
    opponentFighterId: string;
    opponentFighterName: string;
    outcome: 'win' | 'loss' | 'draw';
  }): Promise<void> {
    const supabase = createClient();
    try {
      const { error } = await supabase.from('match_results').insert({
        session_id: params.sessionId,
        user_id: params.userId,
        round_number: params.roundNumber,
        opponent_fighter_id: params.opponentFighterId,
        opponent_fighter_name: params.opponentFighterName,
        outcome: params.outcome,
      });
      if (error && isSchemaError(error)) throw error;
    } catch (e: any) {
      if (isSchemaError(e)) throw e;
    }
  },

  async getUserMatchHistory(userId: string, limit = 50): Promise<MatchResult[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('match_results')
        .select('*')
        .eq('user_id', userId)
        .order('played_at', { ascending: false })
        .limit(limit);
      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }
      return (data || []).map(r => ({
        id: r.id,
        sessionId: r.session_id,
        userId: r.user_id,
        roundNumber: r.round_number,
        opponentFighterId: r.opponent_fighter_id,
        opponentFighterName: r.opponent_fighter_name,
        outcome: r.outcome,
        playedAt: r.played_at,
      }));
    } catch (e: any) {
      if (isSchemaError(e)) throw e;
      return [];
    }
  },

  // ── Fighter Stats ─────────────────────────────────────────────────────────────

  async upsertFighterStats(params: {
    userId: string;
    fighterId: string;
    fighterName: string;
    wins: number;
    losses: number;
    draws: number;
    tournamentEntered: boolean;
    tournamentWon: boolean;
    streak: number;
  }): Promise<void> {
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc('upsert_fighter_stats', {
        p_user_id: params.userId,
        p_fighter_id: params.fighterId,
        p_fighter_name: params.fighterName,
        p_wins: params.wins,
        p_losses: params.losses,
        p_draws: params.draws,
        p_tournament_entered: params.tournamentEntered,
        p_tournament_won: params.tournamentWon,
        p_streak: params.streak,
      });
      if (error && isSchemaError(error)) throw error;
    } catch (e: any) {
      if (isSchemaError(e)) throw e;
    }
  },

  async getFighterStats(userId: string): Promise<FighterStat[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('fighter_stats')
        .select('*')
        .eq('user_id', userId)
        .order('total_matches', { ascending: false });
      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }
      return (data || []).map(r => ({
        id: r.id,
        userId: r.user_id,
        fighterId: r.fighter_id,
        fighterName: r.fighter_name,
        totalWins: r.total_wins,
        totalLosses: r.total_losses,
        totalDraws: r.total_draws,
        totalMatches: r.total_matches,
        tournamentsEntered: r.tournaments_entered,
        tournamentsWon: r.tournaments_won,
        bestStreak: r.best_streak,
        updatedAt: r.updated_at,
      }));
    } catch (e: any) {
      if (isSchemaError(e)) throw e;
      return [];
    }
  },

  // ── Player Rank ───────────────────────────────────────────────────────────────

  async getCurrentRank(userId: string): Promise<PlayerRank | null> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('player_ranks')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        if (isSchemaError(error)) throw error;
        return null;
      }
      if (!data) return null;
      return {
        id: data.id,
        userId: data.user_id,
        rankPoints: data.rank_points,
        rankTier: data.rank_tier,
        recordedAt: data.recorded_at,
      };
    } catch (e: any) {
      if (isSchemaError(e)) throw e;
      return null;
    }
  },

  async getRankHistory(userId: string): Promise<PlayerRank[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('player_ranks')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: true });
      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }
      return (data || []).map(r => ({
        id: r.id,
        userId: r.user_id,
        rankPoints: r.rank_points,
        rankTier: r.rank_tier,
        recordedAt: r.recorded_at,
      }));
    } catch (e: any) {
      if (isSchemaError(e)) throw e;
      return [];
    }
  },

  async recordRank(userId: string, rankPoints: number, rankTier: string): Promise<void> {
    const supabase = createClient();
    try {
      const { error } = await supabase.from('player_ranks').insert({
        user_id: userId,
        rank_points: rankPoints,
        rank_tier: rankTier,
      });
      if (error && isSchemaError(error)) throw error;
    } catch (e: any) {
      if (isSchemaError(e)) throw e;
    }
  },
};

// ─── Rank helpers ─────────────────────────────────────────────────────────────

export function calcRankPoints(wins: number, losses: number, isChampion: boolean): number {
  return wins * 100 - losses * 30 + (isChampion ? 500 : 0);
}

export function getRankTier(points: number): string {
  if (points >= 5000) return 'legend';
  if (points >= 2000) return 'elite';
  if (points >= 500) return 'challenger';
  return 'rookie';
}

export const TIER_COLOR: Record<string, string> = {
  rookie: '#94a3b8',
  challenger: '#f59e0b',
  elite: '#ef4444',
  legend: '#facc15',
};

export const TIER_LABEL: Record<string, string> = {
  rookie: 'ROOKIE',
  challenger: 'CHALLENGER',
  elite: 'ELITE',
  legend: 'LEGEND',
};
