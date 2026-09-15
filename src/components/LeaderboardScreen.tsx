'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '../lib/supabase/client';
import { TIER_COLOR, TIER_LABEL } from '../lib/statsService';

interface PlayerWinRateRow {
  userId: string;
  displayName: string;
  wins: number;
  losses: number;
  draws: number;
  totalMatches: number;
  winRate: number;
}

interface FighterWinsRow {
  fighterId: string;
  fighterName: string;
  totalWins: number;
  totalMatches: number;
}

interface SeasonRankRow {
  userId: string;
  displayName: string;
  rankPoints: number;
  rankTier: string;
}

type LeaderboardTab = 'players' | 'fighters' | 'season';

const RANK_TIERS = [
  { tier: 'legend',     label: 'LEGEND',     min: 5000, color: '#facc15' },
  { tier: 'elite',      label: 'ELITE',      min: 2000, color: '#ef4444' },
  { tier: 'challenger', label: 'CHALLENGER', min: 500,  color: '#f59e0b' },
  { tier: 'rookie',     label: 'ROOKIE',     min: 0,    color: '#94a3b8' },
];

function getMedalColor(rank: number): string {
  if (rank === 1) return '#facc15';
  if (rank === 2) return '#94a3b8';
  if (rank === 3) return '#cd7f32';
  return '#3f3f46';
}

export default function LeaderboardScreen({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<LeaderboardTab>('players');
  const [playerRows, setPlayerRows] = useState<PlayerWinRateRow[]>([]);
  const [fighterRows, setFighterRows] = useState<FighterWinsRow[]>([]);
  const [seasonRows, setSeasonRows] = useState<SeasonRankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      try {
        // Top 10 players by win rate (from fighter_stats aggregated per user)
        const { data: fsData, error: fsErr } = await supabase
          .from('fighter_stats')
          .select('user_id, total_wins, total_losses, total_draws, total_matches')
          .order('total_wins', { ascending: false })
          .limit(50);

        if (fsErr) throw fsErr;

        // Aggregate per user
        const userMap: Record<string, { wins: number; losses: number; draws: number; matches: number }> = {};
        for (const row of fsData ?? []) {
          if (!userMap[row.user_id]) {
            userMap[row.user_id] = { wins: 0, losses: 0, draws: 0, matches: 0 };
          }
          userMap[row.user_id].wins += row.total_wins ?? 0;
          userMap[row.user_id].losses += row.total_losses ?? 0;
          userMap[row.user_id].draws += row.total_draws ?? 0;
          userMap[row.user_id].matches += row.total_matches ?? 0;
        }

        const playerList: PlayerWinRateRow[] = Object.entries(userMap)
          .map(([userId, s]) => ({
            userId,
            displayName: `PLAYER_${userId.slice(0, 6).toUpperCase()}`,
            wins: s.wins,
            losses: s.losses,
            draws: s.draws,
            totalMatches: s.matches,
            winRate: s.matches > 0 ? (s.wins / s.matches) * 100 : 0,
          }))
          .sort((a, b) => b.winRate - a.winRate)
          .slice(0, 10);

        setPlayerRows(playerList);

        // Top 10 fighters by total wins (aggregated across all users)
        const { data: fData, error: fErr } = await supabase
          .from('fighter_stats')
          .select('fighter_id, fighter_name, total_wins, total_matches')
          .order('total_wins', { ascending: false })
          .limit(100);

        if (fErr) throw fErr;

        const fighterMap: Record<string, { name: string; wins: number; matches: number }> = {};
        for (const row of fData ?? []) {
          if (!fighterMap[row.fighter_id]) {
            fighterMap[row.fighter_id] = { name: row.fighter_name, wins: 0, matches: 0 };
          }
          fighterMap[row.fighter_id].wins += row.total_wins ?? 0;
          fighterMap[row.fighter_id].matches += row.total_matches ?? 0;
        }

        const fighterList: FighterWinsRow[] = Object.entries(fighterMap)
          .map(([fighterId, s]) => ({
            fighterId,
            fighterName: s.name,
            totalWins: s.wins,
            totalMatches: s.matches,
          }))
          .sort((a, b) => b.totalWins - a.totalWins)
          .slice(0, 10);

        setFighterRows(fighterList);

        // Seasonal rank tier standings (latest rank per user)
        const { data: rankData, error: rankErr } = await supabase
          .from('player_ranks')
          .select('user_id, rank_points, rank_tier, recorded_at')
          .order('rank_points', { ascending: false })
          .limit(100);

        if (rankErr) throw rankErr;

        // Deduplicate — keep highest rank_points per user
        const rankMap: Record<string, { points: number; tier: string }> = {};
        for (const row of rankData ?? []) {
          if (!rankMap[row.user_id] || row.rank_points > rankMap[row.user_id].points) {
            rankMap[row.user_id] = { points: row.rank_points, tier: row.rank_tier };
          }
        }

        const seasonList: SeasonRankRow[] = Object.entries(rankMap)
          .map(([userId, r]) => ({
            userId,
            displayName: `PLAYER_${userId.slice(0, 6).toUpperCase()}`,
            rankPoints: r.points,
            rankTier: r.tier,
          }))
          .sort((a, b) => b.rankPoints - a.rankPoints)
          .slice(0, 10);

        setSeasonRows(seasonList);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="fixed inset-0 bg-[#0a0c12] text-white font-mono overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <div className="text-[9px] tracking-[0.5em] text-zinc-500 mb-1">GLOBAL</div>
          <div className="text-3xl font-black tracking-widest">LEADERBOARD</div>
          <div className="mt-1 h-px bg-zinc-800" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6">
          {([
            { key: 'players',  label: 'TOP PLAYERS' },
            { key: 'fighters', label: 'TOP FIGHTERS' },
            { key: 'season',   label: 'SEASON RANK' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 text-[9px] tracking-widest border transition-all ${
                tab === t.key
                  ? 'border-yellow-400 text-yellow-400 bg-yellow-400/10' :'border-zinc-700 text-zinc-500 hover:border-zinc-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="text-yellow-400 text-xs tracking-widest animate-pulse">LOADING STATS...</div>
          </div>
        )}

        {error && (
          <div className="border border-red-800 bg-red-900/20 px-4 py-3 text-[9px] text-red-400 mb-4">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ── TOP 10 PLAYERS BY WIN RATE ── */}
            {tab === 'players' && (
              <div>
                <div className="text-[8px] tracking-[0.4em] text-zinc-500 mb-3">TOP 10 — WIN RATE</div>
                {playerRows.length === 0 ? (
                  <div className="text-center py-12 text-zinc-600 text-xs">NO PLAYER DATA YET</div>
                ) : (
                  <div className="space-y-1">
                    {playerRows.map((row, i) => (
                      <div
                        key={row.userId}
                        className="flex items-center gap-3 border border-zinc-800 px-3 py-2 hover:border-zinc-600 transition-all"
                      >
                        <div
                          className="w-6 h-6 flex items-center justify-center text-[10px] font-black border"
                          style={{ borderColor: getMedalColor(i + 1), color: getMedalColor(i + 1) }}
                        >
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-black tracking-widest truncate">{row.displayName}</div>
                          <div className="text-[7px] text-zinc-500">
                            {row.wins}W / {row.losses}L / {row.draws}D · {row.totalMatches} MATCHES
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black" style={{ color: row.winRate >= 60 ? '#22c55e' : row.winRate >= 40 ? '#facc15' : '#ef4444' }}>
                            {row.winRate.toFixed(1)}%
                          </div>
                          <div className="text-[7px] text-zinc-600">WIN RATE</div>
                        </div>
                        <div className="w-16 h-1.5 bg-zinc-800 rounded overflow-hidden">
                          <div
                            className="h-full rounded"
                            style={{
                              width: `${row.winRate}%`,
                              background: row.winRate >= 60 ? '#22c55e' : row.winRate >= 40 ? '#facc15' : '#ef4444',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TOP 10 FIGHTERS BY TOTAL WINS ── */}
            {tab === 'fighters' && (
              <div>
                <div className="text-[8px] tracking-[0.4em] text-zinc-500 mb-3">TOP 10 — TOTAL WINS</div>
                {fighterRows.length === 0 ? (
                  <div className="text-center py-12 text-zinc-600 text-xs">NO FIGHTER DATA YET</div>
                ) : (
                  <div className="space-y-1">
                    {fighterRows.map((row, i) => (
                      <div
                        key={row.fighterId}
                        className="flex items-center gap-3 border border-zinc-800 px-3 py-2 hover:border-zinc-600 transition-all"
                      >
                        <div
                          className="w-6 h-6 flex items-center justify-center text-[10px] font-black border"
                          style={{ borderColor: getMedalColor(i + 1), color: getMedalColor(i + 1) }}
                        >
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-black tracking-widest truncate">{row.fighterName.toUpperCase()}</div>
                          <div className="text-[7px] text-zinc-500">{row.totalMatches} TOTAL MATCHES</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-yellow-400">{row.totalWins}</div>
                          <div className="text-[7px] text-zinc-600">WINS</div>
                        </div>
                        <div className="w-16 h-1.5 bg-zinc-800 rounded overflow-hidden">
                          <div
                            className="h-full bg-yellow-400 rounded"
                            style={{
                              width: `${Math.min(100, (row.totalWins / Math.max(1, fighterRows[0].totalWins)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── SEASONAL RANK TIER STANDINGS ── */}
            {tab === 'season' && (
              <div>
                <div className="text-[8px] tracking-[0.4em] text-zinc-500 mb-3">SEASON RANK STANDINGS</div>

                {/* Tier breakdown */}
                <div className="grid grid-cols-4 gap-1 mb-4">
                  {RANK_TIERS.map(tier => {
                    const count = seasonRows.filter(r => r.rankTier === tier.tier).length;
                    return (
                      <div key={tier.tier} className="border border-zinc-800 px-2 py-2 text-center">
                        <div className="text-[8px] font-black tracking-widest" style={{ color: tier.color }}>
                          {tier.label}
                        </div>
                        <div className="text-lg font-black mt-1" style={{ color: tier.color }}>{count}</div>
                        <div className="text-[7px] text-zinc-600">{tier.min}+ PTS</div>
                      </div>
                    );
                  })}
                </div>

                {seasonRows.length === 0 ? (
                  <div className="text-center py-12 text-zinc-600 text-xs">NO RANK DATA YET</div>
                ) : (
                  <div className="space-y-1">
                    {seasonRows.map((row, i) => {
                      const tierColor = TIER_COLOR[row.rankTier] ?? '#94a3b8';
                      const tierLabel = TIER_LABEL[row.rankTier] ?? row.rankTier.toUpperCase();
                      return (
                        <div
                          key={row.userId}
                          className="flex items-center gap-3 border border-zinc-800 px-3 py-2 hover:border-zinc-600 transition-all"
                        >
                          <div
                            className="w-6 h-6 flex items-center justify-center text-[10px] font-black border"
                            style={{ borderColor: getMedalColor(i + 1), color: getMedalColor(i + 1) }}
                          >
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-black tracking-widest truncate">{row.displayName}</div>
                            <div className="text-[7px]" style={{ color: tierColor }}>{tierLabel}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-black" style={{ color: tierColor }}>
                              {row.rankPoints.toLocaleString()}
                            </div>
                            <div className="text-[7px] text-zinc-600">RANK PTS</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Back */}
        <div className="mt-8">
          <button
            onClick={onBack}
            className="w-full border border-zinc-700 py-4 text-sm font-black tracking-widest hover:border-zinc-500 transition-all"
          >
            ← BACK
          </button>
        </div>

      </div>
    </div>
  );
}
