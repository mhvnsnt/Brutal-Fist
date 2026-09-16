'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  statsService,
  type TournamentSession,
  type MatchResult,
  type FighterStat,
  type PlayerRank,
  TIER_COLOR,
  TIER_LABEL,
} from '../lib/statsService';
import { useAuth } from '../contexts/AuthContext';
import MatchDetailModal from './MatchDetailModal';

const FACTION_COLOR: Record<string, string> = {
  alliance: '#1d4ed8',
  corporate: '#dc2626',
  chaos: '#7c3aed',
  independent: '#d97706',
};

type StatsTab = 'overview' | 'fighters' | 'history' | 'rank';

interface TournamentStatsScreenProps {
  onBack: () => void;
}

function WinRateBar({ wins, total }: { wins: number; total: number }) {
  const pct = total > 0 ? Math.round((wins / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-zinc-800 relative overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: pct >= 60 ? '#4ade80' : pct >= 40 ? '#facc15' : '#f87171',
          }}
        />
      </div>
      <span
        className="text-[9px] font-black w-8 text-right"
        style={{ color: pct >= 60 ? '#4ade80' : pct >= 40 ? '#facc15' : '#f87171' }}
      >
        {pct}%
      </span>
    </div>
  );
}

function RankBadge({ tier, points }: { tier: string; points: number }) {
  const color = TIER_COLOR[tier] ?? '#94a3b8';
  return (
    <div
      className="inline-flex items-center gap-2 border px-3 py-1.5"
      style={{ borderColor: color, background: `${color}15` }}
    >
      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="text-[10px] font-black tracking-widest" style={{ color }}>
        {TIER_LABEL[tier] ?? tier.toUpperCase()}
      </span>
      <span className="text-[9px] text-zinc-500">{points} PTS</span>
    </div>
  );
}

export default function TournamentStatsScreen({ onBack }: TournamentStatsScreenProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<StatsTab>('overview');
  const [sessions, setSessions] = useState<TournamentSession[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [fighterStats, setFighterStats] = useState<FighterStat[]>([]);
  const [rankHistory, setRankHistory] = useState<PlayerRank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [s, m, f, r] = await Promise.all([
        statsService.getUserSessions(user.id),
        statsService.getUserMatchHistory(user.id, 100),
        statsService.getFighterStats(user.id),
        statsService.getRankHistory(user.id),
      ]);
      setSessions(s);
      setMatches(m);
      setFighterStats(f);
      setRankHistory(r);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived cumulative stats ──────────────────────────────────────────────────
  const totalWins = sessions.reduce((a, s) => a + s.wins, 0);
  const totalLosses = sessions.reduce((a, s) => a + s.losses, 0);
  const totalDraws = sessions.reduce((a, s) => a + s.draws, 0);
  const totalMatches = totalWins + totalLosses + totalDraws;
  const totalTournaments = sessions.length;
  const championships = sessions.filter(s => s.isChampion).length;
  const currentRank = rankHistory.length > 0 ? rankHistory[rankHistory.length - 1] : null;

  const TABS: { id: StatsTab; label: string }[] = [
    { id: 'overview', label: 'OVERVIEW' },
    { id: 'fighters', label: 'FIGHTERS' },
    { id: 'history', label: 'HISTORY' },
    { id: 'rank', label: 'RANK' },
  ];

  return (
    <div className="fixed inset-0 bg-black text-white font-mono overflow-hidden flex flex-col">
      {/* Atmospheric bg */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, #1c1c2e 0%, #000 70%)' }}
      />
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(90deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 80px),
            repeating-linear-gradient(0deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 80px)`,
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-800/60 shrink-0">
        <div>
          <div className="text-[8px] tracking-[0.5em] text-zinc-600">BRUTAL FIST</div>
          <div className="text-xl font-black tracking-widest text-white mt-0.5">TOURNAMENT STATS</div>
        </div>
        <div className="flex items-center gap-3">
          {currentRank && (
            <RankBadge tier={currentRank.rankTier} points={currentRank.rankPoints} />
          )}
          <button
            onClick={onBack}
            className="text-[9px] tracking-widest text-zinc-600 hover:text-zinc-300 transition-colors border border-zinc-800 px-3 py-1.5"
          >
            ← BACK
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative z-10 flex border-b border-zinc-800/60 shrink-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 py-2.5 text-[9px] tracking-widest font-black transition-all"
            style={{
              color: tab === t.id ? '#facc15' : '#52525b',
              borderBottom: tab === t.id ? '2px solid #facc15' : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="text-[9px] tracking-widest text-zinc-600 animate-pulse">LOADING STATS...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-40">
            <div className="text-[9px] tracking-widest text-red-500">{error}</div>
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <div className="text-[9px] tracking-widest text-zinc-500">SIGN IN TO TRACK YOUR STATS</div>
          </div>
        ) : (
          <>
            {/* ── OVERVIEW TAB ── */}
            {tab === 'overview' && (
              <div className="space-y-4">
                {/* Cumulative record */}
                <div className="border border-zinc-800 p-4" style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #111 100%)' }}>
                  <div className="text-[8px] tracking-[0.4em] text-zinc-600 mb-4">CUMULATIVE RECORD</div>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    {[
                      { val: totalWins, label: 'WINS', color: '#4ade80' },
                      { val: totalLosses, label: 'LOSSES', color: '#f87171' },
                      { val: totalDraws, label: 'DRAWS', color: '#94a3b8' },
                      { val: totalMatches, label: 'MATCHES', color: '#facc15' },
                    ].map(({ val, label, color }) => (
                      <div key={label}>
                        <div className="text-3xl font-black" style={{ color }}>{val}</div>
                        <div className="text-[7px] text-zinc-600 mt-1">{label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <div className="text-[8px] text-zinc-600 mb-1.5">WIN RATE</div>
                    <WinRateBar wins={totalWins} total={totalMatches} />
                  </div>
                </div>

                {/* Tournament record */}
                <div className="border border-zinc-800 p-4">
                  <div className="text-[8px] tracking-[0.4em] text-zinc-600 mb-4">TOURNAMENT RECORD</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border border-zinc-800 p-3 text-center">
                      <div className="text-2xl font-black text-white">{totalTournaments}</div>
                      <div className="text-[7px] text-zinc-600 mt-1">ENTERED</div>
                    </div>
                    <div className="border border-yellow-400/30 p-3 text-center" style={{ background: '#facc1508' }}>
                      <div className="text-2xl font-black text-yellow-400">{championships}</div>
                      <div className="text-[7px] text-zinc-600 mt-1">CHAMPIONSHIPS</div>
                    </div>
                  </div>
                </div>

                {/* Recent sessions */}
                {sessions.length > 0 && (
                  <div className="border border-zinc-800 p-4">
                    <div className="text-[8px] tracking-[0.4em] text-zinc-600 mb-3">RECENT TOURNAMENTS</div>
                    <div className="space-y-2">
                      {sessions.slice(0, 5).map(s => (
                        <div key={s.id} className="flex items-center gap-3 py-1.5 border-b border-zinc-900">
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] font-black text-white truncate">{s.tournamentName ?? 'Tournament'}</div>
                            <div className="text-[7px] text-zinc-600 mt-0.5">{s.fighterName} · {s.roundsPlayed} rounds</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[8px] font-black text-green-400">{s.wins}W</span>
                            <span className="text-[8px] font-black text-red-400">{s.losses}L</span>
                            {s.isChampion && <span className="text-[8px]">👑</span>}
                          </div>
                          {s.tournamentTier && (
                            <div
                              className="text-[7px] font-black tracking-widest px-1.5 py-0.5 border shrink-0"
                              style={{
                                color: TIER_COLOR[s.tournamentTier] ?? '#94a3b8',
                                borderColor: TIER_COLOR[s.tournamentTier] ?? '#94a3b8',
                              }}
                            >
                              {(s.tournamentTier ?? '').toUpperCase()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {sessions.length === 0 && (
                  <div className="border border-zinc-800 p-8 text-center">
                    <div className="text-[9px] tracking-widest text-zinc-600">NO TOURNAMENT DATA YET</div>
                    <div className="text-[8px] text-zinc-700 mt-2">ENTER A TOURNAMENT TO START TRACKING</div>
                  </div>
                )}
              </div>
            )}

            {/* ── FIGHTERS TAB ── */}
            {tab === 'fighters' && (
              <div className="space-y-3">
                {fighterStats.length === 0 ? (
                  <div className="border border-zinc-800 p-8 text-center">
                    <div className="text-[9px] tracking-widest text-zinc-600">NO FIGHTER DATA YET</div>
                  </div>
                ) : (
                  fighterStats.map(f => {
                    const wr = f.totalMatches > 0 ? Math.round((f.totalWins / f.totalMatches) * 100) : 0;
                    return (
                      <div key={f.id} className="border border-zinc-800 p-4" style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #111 100%)' }}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="text-sm font-black text-white">{f.fighterName.toUpperCase()}</div>
                            <div className="text-[7px] text-zinc-600 mt-0.5">{f.totalMatches} MATCHES · {f.tournamentsEntered} TOURNAMENTS</div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-black" style={{ color: wr >= 60 ? '#4ade80' : wr >= 40 ? '#facc15' : '#f87171' }}>{wr}%</div>
                            <div className="text-[7px] text-zinc-600">WIN RATE</div>
                          </div>
                        </div>
                        <WinRateBar wins={f.totalWins} total={f.totalMatches} />
                        <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                          <div>
                            <div className="text-base font-black text-green-400">{f.totalWins}</div>
                            <div className="text-[7px] text-zinc-600">W</div>
                          </div>
                          <div>
                            <div className="text-base font-black text-red-400">{f.totalLosses}</div>
                            <div className="text-[7px] text-zinc-600">L</div>
                          </div>
                          <div>
                            <div className="text-base font-black text-yellow-400">{f.bestStreak}</div>
                            <div className="text-[7px] text-zinc-600">STREAK</div>
                          </div>
                          <div>
                            <div className="text-base font-black text-yellow-400">{f.tournamentsWon}</div>
                            <div className="text-[7px] text-zinc-600">TITLES</div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── HISTORY TAB ── */}
            {tab === 'history' && (
              <div className="space-y-1">
                {matches.length === 0 ? (
                  <div className="border border-zinc-800 p-8 text-center">
                    <div className="text-[9px] tracking-widest text-zinc-600">NO MATCH HISTORY YET</div>
                  </div>
                ) : (
                  matches.map((m, i) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMatch(m)}
                      className="w-full flex items-center gap-3 py-2 border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors text-left px-1"
                    >
                      <div className="text-[7px] text-zinc-700 w-5 text-right shrink-0">{i + 1}</div>
                      <div
                        className="text-[8px] font-black w-10 shrink-0"
                        style={{ color: m.outcome === 'win' ? '#4ade80' : m.outcome === 'draw' ? '#94a3b8' : '#f87171' }}
                      >
                        {m.outcome.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[8px] text-zinc-400">vs </span>
                        <span className="text-[8px] font-black text-white">{m.opponentFighterName}</span>
                      </div>
                      <div className="text-[7px] text-zinc-700 shrink-0">
                        {new Date(m.playedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="text-[7px] text-zinc-700 shrink-0">›</div>
                    </button>
                  ))
                )}
                <div className="pt-2 text-center">
                  <div className="text-[7px] tracking-widest text-zinc-700">TAP A MATCH TO VIEW DETAILS</div>
                </div>
              </div>
            )}

            {/* ── RANK TAB ── */}
            {tab === 'rank' && (
              <div className="space-y-4">
                {/* Current rank */}
                <div className="border border-zinc-800 p-5 text-center" style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #111 100%)' }}>
                  <div className="text-[8px] tracking-[0.4em] text-zinc-600 mb-3">CURRENT RANK</div>
                  {currentRank ? (
                    <>
                      <div
                        className="text-4xl font-black tracking-widest"
                        style={{ color: TIER_COLOR[currentRank.rankTier] ?? '#94a3b8' }}
                      >
                        {TIER_LABEL[currentRank.rankTier] ?? currentRank.rankTier.toUpperCase()}
                      </div>
                      <div className="text-xl font-black text-white mt-2">{currentRank.rankPoints} PTS</div>
                    </>
                  ) : (
                    <div className="text-[9px] text-zinc-600">NO RANK YET — COMPLETE A TOURNAMENT</div>
                  )}
                </div>

                {/* Rank tiers reference */}
                <div className="border border-zinc-800 p-4">
                  <div className="text-[8px] tracking-[0.4em] text-zinc-600 mb-3">RANK TIERS</div>
                  <div className="space-y-2">
                    {[
                      { tier: 'legend', label: 'LEGEND', min: '5000+', color: '#facc15' },
                      { tier: 'elite', label: 'ELITE', min: '2000–4999', color: '#ef4444' },
                      { tier: 'challenger', label: 'CHALLENGER', min: '500–1999', color: '#f59e0b' },
                      { tier: 'rookie', label: 'ROOKIE', min: '0–499', color: '#94a3b8' },
                    ].map(({ tier, label, min, color }) => (
                      <div
                        key={tier}
                        className="flex items-center justify-between py-2 border-b border-zinc-900"
                        style={{ opacity: currentRank?.rankTier === tier ? 1 : 0.5 }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                          <span className="text-[9px] font-black" style={{ color }}>{label}</span>
                        </div>
                        <span className="text-[8px] text-zinc-600">{min} PTS</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rank progression history */}
                {rankHistory.length > 1 && (
                  <div className="border border-zinc-800 p-4">
                    <div className="text-[8px] tracking-[0.4em] text-zinc-600 mb-3">PROGRESSION</div>
                    <div className="space-y-1">
                      {rankHistory.slice(-10).reverse().map((r, i) => (
                        <div key={r.id} className="flex items-center gap-3 py-1.5 border-b border-zinc-900">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: TIER_COLOR[r.rankTier] ?? '#94a3b8' }} />
                          <div className="flex-1">
                            <span className="text-[8px] font-black" style={{ color: TIER_COLOR[r.rankTier] ?? '#94a3b8' }}>
                              {r.rankPoints} PTS
                            </span>
                            <span className="text-[7px] text-zinc-700 ml-2">{(r.rankTier ?? '').toUpperCase()}</span>
                          </div>
                          <div className="text-[7px] text-zinc-700">
                            {new Date(r.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Match Detail Modal */}
      {selectedMatch && (
        <MatchDetailModal
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </div>
  );
}
