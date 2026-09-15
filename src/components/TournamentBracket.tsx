'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { type BannonFighterProfile, BANNON_ROSTER } from '../data/bannonRoster';
import dynamic from 'next/dynamic';
import { useAuth } from '../contexts/AuthContext';
import { statsService, calcRankPoints, getRankTier } from '../lib/statsService';

const GameBattleArena = dynamic(() => import('./GameBattleArena'), { ssr: false });

const FACTION_COLOR: Record<string, string> = {
  alliance:    '#1d4ed8',
  corporate:   '#dc2626',
  chaos:       '#7c3aed',
  independent: '#d97706',
};

export interface RoundResult {
  round: number;
  opponent: BannonFighterProfile;
  winner: 'p1' | 'p2' | 'draw';
  playerWon: boolean;
}

export interface CumulativeStats {
  wins: number;
  losses: number;
  draws: number;
  totalRounds: number;
  currentStreak: number;
}

interface TournamentBracketProps {
  playerFighter: BannonFighterProfile;
  onExit: () => void;
}

type TournamentPhase = 'bracket_view' | 'fighting' | 'round_result' | 'champion' | 'eliminated';

function buildOpponentQueue(playerFighter: BannonFighterProfile): BannonFighterProfile[] {
  // Pick 7 opponents from roster (excluding player), shuffled
  const pool = [...BANNON_ROSTER].filter(f => f.id !== playerFighter.id);
  // Shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 7);
}

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-zinc-500 w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-zinc-800 relative">
        <div className="absolute left-0 top-0 h-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[9px] font-black w-6 text-right" style={{ color }}>{value}</span>
    </div>
  );
}

export default function TournamentBracket({ playerFighter, onExit }: TournamentBracketProps) {
  const { user } = useAuth();
  const [opponents] = useState<BannonFighterProfile[]>(() => buildOpponentQueue(playerFighter));
  const [phase, setPhase] = useState<TournamentPhase>('bracket_view');
  const [currentRound, setCurrentRound] = useState(0); // 0-indexed
  const [results, setResults] = useState<RoundResult[]>([]);
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  const [stats, setStats] = useState<CumulativeStats>({
    wins: 0, losses: 0, draws: 0, totalRounds: 0, currentStreak: 0,
  });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tournamentId] = useState<string>('');

  // Create a session when the bracket starts
  useEffect(() => {
    if (!user?.id) return;
    statsService.getTournaments().then(ts => {
      const t = ts[0];
      if (!t) return;
      statsService.createSession({
        userId: user.id,
        tournamentId: t.id,
        fighterId: playerFighter.id,
        fighterName: playerFighter.name,
      }).then(id => { if (id) setSessionId(id); });
    });
  }, [user?.id, playerFighter.id, playerFighter.name]);

  const currentOpponent = opponents[currentRound] ?? null;
  const totalRounds = opponents.length;

  const handleMatchEnd = useCallback((winner: 'p1' | 'p2' | 'draw') => {
    const playerWon = winner === 'p1';
    const isDraw = winner === 'draw';

    const result: RoundResult = {
      round: currentRound + 1,
      opponent: opponents[currentRound],
      winner,
      playerWon,
    };

    setLastResult(result);
    setResults(prev => [...prev, result]);
    setStats(prev => ({
      wins: prev.wins + (playerWon ? 1 : 0),
      losses: prev.losses + (!playerWon && !isDraw ? 1 : 0),
      draws: prev.draws + (isDraw ? 1 : 0),
      totalRounds: prev.totalRounds + 1,
      currentStreak: playerWon ? prev.currentStreak + 1 : 0,
    }));

    // Persist match result
    if (user?.id && sessionId) {
      statsService.saveMatchResult({
        sessionId,
        userId: user.id,
        roundNumber: currentRound + 1,
        opponentFighterId: opponents[currentRound].id,
        opponentFighterName: opponents[currentRound].name,
        outcome: playerWon ? 'win' : isDraw ? 'draw' : 'loss',
      });
    }

    setPhase('round_result');
  }, [currentRound, opponents, user?.id, sessionId]);

  const persistSessionEnd = useCallback((finalStats: CumulativeStats, isChampion: boolean, isEliminated: boolean) => {
    if (!user?.id || !sessionId) return;
    const pts = calcRankPoints(finalStats.wins, finalStats.losses, isChampion);
    const tier = getRankTier(pts);
    statsService.completeSession({
      sessionId,
      wins: finalStats.wins,
      losses: finalStats.losses,
      draws: finalStats.draws,
      roundsPlayed: finalStats.totalRounds,
      isChampion,
      isEliminated,
      rankPointsEarned: pts,
    });
    statsService.upsertFighterStats({
      userId: user.id,
      fighterId: playerFighter.id,
      fighterName: playerFighter.name,
      wins: finalStats.wins,
      losses: finalStats.losses,
      draws: finalStats.draws,
      tournamentEntered: true,
      tournamentWon: isChampion,
      streak: finalStats.currentStreak,
    });
    statsService.recordRank(user.id, pts, tier);
  }, [user?.id, sessionId, playerFighter.id, playerFighter.name]);

  const handleNextRound = useCallback(() => {
    if (!lastResult) return;
    if (!lastResult.playerWon && lastResult.winner !== 'draw') {
      persistSessionEnd(stats, false, true);
      setPhase('eliminated');
      return;
    }
    const nextRound = currentRound + 1;
    if (nextRound >= totalRounds) {
      persistSessionEnd(stats, true, false);
      setPhase('champion');
    } else {
      setCurrentRound(nextRound);
      setPhase('bracket_view');
    }
  }, [lastResult, currentRound, totalRounds, stats, persistSessionEnd]);

  const playerColor = FACTION_COLOR[playerFighter.factionAlignment];

  // ── FIGHTING PHASE ──
  if (phase === 'fighting' && currentOpponent) {
    return (
      <GameBattleArena
        p1Fighter={playerFighter}
        p2Fighter={currentOpponent}
        onMatchEnd={handleMatchEnd}
        onBack={() => setPhase('bracket_view')}
        roundLabel={`ROUND ${currentRound + 1} / ${totalRounds}`}
      />
    );
  }

  // ── ROUND RESULT ──
  if (phase === 'round_result' && lastResult) {
    const opp = lastResult.opponent;
    const oppColor = FACTION_COLOR[opp.factionAlignment];
    const won = lastResult.playerWon;
    const draw = lastResult.winner === 'draw';

    return (
      <div className="fixed inset-0 bg-black text-white flex flex-col items-center justify-center font-mono overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: won ? 'radial-gradient(ellipse at 50% 50%, #1d4ed822 0%, transparent 70%)' : 'radial-gradient(ellipse at 50% 50%, #dc262622 0%, transparent 70%)' }}
        />

        <div className="relative z-10 flex flex-col items-center gap-6 w-[min(90vw,480px)]">
          {/* Result banner */}
          <div
            className="text-5xl font-black tracking-widest animate-pulse"
            style={{ color: won ? '#facc15' : draw ? '#94a3b8' : '#ef4444', textShadow: `0 0 30px currentColor` }}
          >
            {won ? 'VICTORY' : draw ? 'DRAW' : 'DEFEAT'}
          </div>

          {/* Matchup recap */}
          <div className="flex items-center gap-4 w-full">
            <div className="flex-1 text-center">
              <div className="text-[9px] tracking-widest text-zinc-500">YOU</div>
              <div className="text-lg font-black mt-1" style={{ color: playerColor }}>{playerFighter.name.toUpperCase()}</div>
            </div>
            <div className="text-2xl font-black text-zinc-600">VS</div>
            <div className="flex-1 text-center">
              <div className="text-[9px] tracking-widest text-zinc-500">OPPONENT</div>
              <div className="text-lg font-black mt-1" style={{ color: oppColor }}>{opp.name.toUpperCase()}</div>
            </div>
          </div>

          {/* Cumulative stats */}
          <div className="w-full border border-zinc-800 p-4 space-y-2">
            <div className="text-[9px] tracking-[0.3em] text-zinc-500 mb-3">TOURNAMENT STATS</div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-2xl font-black text-green-400">{stats.wins}</div>
                <div className="text-[8px] text-zinc-600">WINS</div>
              </div>
              <div>
                <div className="text-2xl font-black text-red-400">{stats.losses}</div>
                <div className="text-[8px] text-zinc-600">LOSSES</div>
              </div>
              <div>
                <div className="text-2xl font-black text-yellow-400">{stats.currentStreak}</div>
                <div className="text-[8px] text-zinc-600">STREAK</div>
              </div>
            </div>
            <div className="mt-2 text-[8px] text-zinc-600 text-center">
              ROUND {lastResult.round} / {totalRounds} · {totalRounds - lastResult.round} REMAINING
            </div>
          </div>

          {/* Action */}
          <button
            onClick={handleNextRound}
            className="w-full border-2 px-6 py-4 text-sm font-black tracking-widest transition-all"
            style={{
              borderColor: won ? playerColor : '#ef4444',
              color: won ? playerColor : '#ef4444',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = won ? playerColor : '#ef4444'; (e.currentTarget as HTMLButtonElement).style.color = '#000'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = won ? playerColor : '#ef4444'; }}
          >
            {won || draw
              ? currentRound + 1 >= totalRounds ? '→ FINAL RESULTS' : `→ ROUND ${currentRound + 2}`
              : '→ CONTINUE'}
          </button>
        </div>
      </div>
    );
  }

  // ── CHAMPION SCREEN ──
  if (phase === 'champion') {
    return (
      <div className="fixed inset-0 bg-black text-white flex flex-col items-center justify-center font-mono overflow-hidden">
        {/* Gold atmosphere */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 40%, #facc1530 0%, transparent 65%)' }}
        />
        {/* Scanlines */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 4px)'
        }} />

        <div className="relative z-10 flex flex-col items-center gap-6 w-[min(90vw,520px)]">
          {/* Crown */}
          <div className="text-5xl">👑</div>

          <div className="text-[10px] tracking-[0.5em] text-zinc-500">BRUTAL FIST TOURNAMENT</div>

          <div
            className="text-5xl font-black tracking-widest"
            style={{ color: '#facc15', textShadow: '0 0 40px #facc15, 0 0 80px #facc1544' }}
          >
            CHAMPION
          </div>

          <div
            className="text-3xl font-black tracking-widest mt-2"
            style={{ color: playerColor, textShadow: `0 0 20px ${playerColor}` }}
          >
            {playerFighter.name.toUpperCase()}
          </div>

          <div className="text-[9px] text-zinc-500">{playerFighter.role}</div>

          {/* Final stats */}
          <div className="w-full border border-yellow-400/30 p-5 space-y-3 mt-2"
            style={{ background: 'linear-gradient(135deg, #facc1508 0%, transparent 100%)' }}
          >
            <div className="text-[9px] tracking-[0.3em] text-yellow-400/70 mb-4">FINAL RECORD</div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <div className="text-3xl font-black text-green-400">{stats.wins}</div>
                <div className="text-[8px] text-zinc-600">WINS</div>
              </div>
              <div>
                <div className="text-3xl font-black text-red-400">{stats.losses}</div>
                <div className="text-[8px] text-zinc-600">LOSSES</div>
              </div>
              <div>
                <div className="text-3xl font-black text-zinc-400">{stats.draws}</div>
                <div className="text-[8px] text-zinc-600">DRAWS</div>
              </div>
              <div>
                <div className="text-3xl font-black text-yellow-400">{totalRounds}</div>
                <div className="text-[8px] text-zinc-600">ROUNDS</div>
              </div>
            </div>

            {/* Round-by-round results */}
            <div className="mt-4 space-y-1">
              <div className="text-[8px] tracking-widest text-zinc-600 mb-2">ROUND HISTORY</div>
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-[8px]">
                  <span className="text-zinc-600 w-14">RND {r.round}</span>
                  <span
                    className="font-black w-12"
                    style={{ color: r.playerWon ? '#4ade80' : r.winner === 'draw' ? '#94a3b8' : '#f87171' }}
                  >
                    {r.playerWon ? 'WIN' : r.winner === 'draw' ? 'DRAW' : 'LOSS'}
                  </span>
                  <span className="text-zinc-500">vs {r.opponent.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 w-full mt-2">
            <button
              onClick={onExit}
              className="flex-1 border border-zinc-700 px-4 py-3 text-xs font-black tracking-widest hover:bg-white hover:text-black transition-all"
            >
              MAIN MENU
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── ELIMINATED SCREEN ──
  if (phase === 'eliminated') {
    return (
      <div className="fixed inset-0 bg-black text-white flex flex-col items-center justify-center font-mono overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 50%, #dc262618 0%, transparent 65%)' }}
        />

        <div className="relative z-10 flex flex-col items-center gap-6 w-[min(90vw,480px)]">
          <div className="text-[10px] tracking-[0.5em] text-zinc-500">TOURNAMENT OVER</div>

          <div
            className="text-5xl font-black tracking-widest"
            style={{ color: '#ef4444', textShadow: '0 0 30px #ef4444' }}
          >
            ELIMINATED
          </div>

          <div className="text-lg font-black text-zinc-400">{playerFighter.name.toUpperCase()}</div>

          {/* Stats */}
          <div className="w-full border border-zinc-800 p-5 space-y-3">
            <div className="text-[9px] tracking-[0.3em] text-zinc-500 mb-3">FINAL RECORD</div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-3xl font-black text-green-400">{stats.wins}</div>
                <div className="text-[8px] text-zinc-600">WINS</div>
              </div>
              <div>
                <div className="text-3xl font-black text-red-400">{stats.losses}</div>
                <div className="text-[8px] text-zinc-600">LOSSES</div>
              </div>
              <div>
                <div className="text-3xl font-black text-zinc-400">{stats.totalRounds}</div>
                <div className="text-[8px] text-zinc-600">ROUNDS</div>
              </div>
            </div>

            <div className="mt-3 space-y-1">
              <div className="text-[8px] tracking-widest text-zinc-600 mb-2">ROUND HISTORY</div>
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-[8px]">
                  <span className="text-zinc-600 w-14">RND {r.round}</span>
                  <span
                    className="font-black w-12"
                    style={{ color: r.playerWon ? '#4ade80' : r.winner === 'draw' ? '#94a3b8' : '#f87171' }}
                  >
                    {r.playerWon ? 'WIN' : r.winner === 'draw' ? 'DRAW' : 'LOSS'}
                  </span>
                  <span className="text-zinc-500">vs {r.opponent.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 w-full">
            <button
              onClick={onExit}
              className="flex-1 border border-zinc-700 px-4 py-3 text-xs font-black tracking-widest hover:bg-white hover:text-black transition-all"
            >
              MAIN MENU
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── BRACKET VIEW (pre-fight) ──
  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col items-center justify-center font-mono overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, #1c1c2e 0%, #000 70%)' }}
      />
      {/* Grid lines */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `repeating-linear-gradient(90deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 80px),
          repeating-linear-gradient(0deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 80px)`
      }} />

      <div className="relative z-10 flex flex-col items-center gap-5 w-[min(92vw,520px)]">
        <div className="text-[9px] tracking-[0.5em] text-zinc-500">BRUTAL FIST TOURNAMENT</div>
        <div className="text-2xl font-black tracking-widest text-white">
          ROUND {currentRound + 1} <span className="text-zinc-600">/ {totalRounds}</span>
        </div>

        {/* VS matchup */}
        {currentOpponent && (
          <div className="w-full flex items-center gap-4 border border-zinc-800 p-4"
            style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #111 100%)' }}
          >
            <div className="flex-1 text-center">
              <div className="text-[8px] tracking-widest text-zinc-600 mb-1">YOU</div>
              <div
                className="text-xl font-black"
                style={{ color: playerColor }}
              >
                {playerFighter.name.toUpperCase()}
              </div>
              <div className="text-[8px] text-zinc-600 mt-1">{playerFighter.fightingStyle.split('.')[0]}</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-3xl font-black text-red-500">VS</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-[8px] tracking-widest text-zinc-600 mb-1">OPPONENT</div>
              <div
                className="text-xl font-black"
                style={{ color: FACTION_COLOR[currentOpponent.factionAlignment] }}
              >
                {currentOpponent.name.toUpperCase()}
              </div>
              <div className="text-[8px] text-zinc-600 mt-1">{currentOpponent.fightingStyle.split('.')[0]}</div>
            </div>
          </div>
        )}

        {/* Bracket progress */}
        <div className="w-full">
          <div className="text-[8px] tracking-widest text-zinc-600 mb-2">BRACKET PROGRESS</div>
          <div className="flex gap-1">
            {opponents.map((opp, i) => {
              const result = results.find(r => r.round === i + 1);
              const isCurrent = i === currentRound;
              const isFuture = i > currentRound;
              return (
                <div
                  key={opp.id}
                  className="flex-1 h-8 border flex items-center justify-center text-[7px] font-black transition-all"
                  style={{
                    borderColor: isCurrent
                      ? '#facc15'
                      : result?.playerWon
                        ? '#4ade80'
                        : result && !result.playerWon
                          ? '#f87171' :'#27272a',
                    background: isCurrent
                      ? '#facc1515'
                      : result?.playerWon
                        ? '#4ade8010'
                        : result
                          ? '#f8717110' :'transparent',
                    color: isCurrent
                      ? '#facc15'
                      : result?.playerWon
                        ? '#4ade80'
                        : result
                          ? '#f87171' :'#3f3f46',
                  }}
                  title={opp.name}
                >
                  {isFuture && !result ? '?' : result?.playerWon ? 'W' : result ? 'L' : isCurrent ? '▶' : '?'}
                </div>
              );
            })}
          </div>
          <div className="flex gap-1 mt-0.5">
            {opponents.map((opp, i) => (
              <div key={opp.id} className="flex-1 text-[6px] text-zinc-700 text-center truncate">
                {i <= currentRound ? opp.name.split(' ')[0] : '???'}
              </div>
            ))}
          </div>
        </div>

        {/* Current record */}
        {stats.totalRounds > 0 && (
          <div className="flex gap-6 text-center">
            <div>
              <div className="text-xl font-black text-green-400">{stats.wins}</div>
              <div className="text-[8px] text-zinc-600">WINS</div>
            </div>
            <div>
              <div className="text-xl font-black text-red-400">{stats.losses}</div>
              <div className="text-[8px] text-zinc-600">LOSSES</div>
            </div>
            {stats.currentStreak > 1 && (
              <div>
                <div className="text-xl font-black text-yellow-400">{stats.currentStreak}×</div>
                <div className="text-[8px] text-zinc-600">STREAK</div>
              </div>
            )}
          </div>
        )}

        {/* Fight button */}
        <button
          onClick={() => setPhase('fighting')}
          className="w-full border-2 border-yellow-400 px-6 py-4 text-lg font-black tracking-widest text-yellow-400 hover:bg-yellow-400 hover:text-black transition-all"
        >
          FIGHT →
        </button>

        <button
          onClick={onExit}
          className="text-[9px] text-zinc-700 hover:text-zinc-400 tracking-widest transition-colors"
        >
          ← EXIT TOURNAMENT
        </button>
      </div>
    </div>
  );
}
