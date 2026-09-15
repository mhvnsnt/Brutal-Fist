'use client';

import React, { useState, useEffect, useRef } from 'react';
import { type BannonFighterProfile } from '../data/bannonRoster';
import { type RoundResult, type CumulativeStats } from './TournamentBracket';


interface PostTournamentScreenProps {
  playerFighter: BannonFighterProfile;
  results: RoundResult[];
  stats: CumulativeStats;
  isChampion: boolean;
  rankPointsEarned: number;
  rankTier: string;
  onMainMenu: () => void;
  onPlayAgain: () => void;
}

const FACTION_COLOR: Record<string, string> = {
  alliance:    '#1d4ed8',
  corporate:   '#dc2626',
  chaos:       '#7c3aed',
  independent: '#d97706',
};

const RANK_TIERS = [
  { tier: 'BRONZE',   min: 0,   color: '#cd7f32' },
  { tier: 'SILVER',   min: 100, color: '#94a3b8' },
  { tier: 'GOLD',     min: 250, color: '#facc15' },
  { tier: 'PLATINUM', min: 500, color: '#67e8f9' },
  { tier: 'DIAMOND',  min: 800, color: '#a78bfa' },
  { tier: 'LEGEND',   min: 1200, color: '#f97316' },
];

function getRankColor(tier: string): string {
  return RANK_TIERS.find(r => r.tier === tier.toUpperCase())?.color ?? '#94a3b8';
}

/** Compute earned rewards based on performance */
function computeRewards(stats: CumulativeStats, isChampion: boolean, rankPointsEarned: number): Array<{ label: string; value: string; color: string }> {
  const rewards: Array<{ label: string; value: string; color: string }> = [];

  rewards.push({ label: 'RANK POINTS', value: `+${rankPointsEarned} RP`, color: '#facc15' });

  if (isChampion) {
    rewards.push({ label: 'CHAMPION TITLE', value: 'BRUTAL FIST CHAMPION', color: '#facc15' });
    rewards.push({ label: 'COSMETIC UNLOCK', value: 'GOLD AURA EFFECT', color: '#fbbf24' });
  }

  if (stats.wins >= 5) {
    rewards.push({ label: 'MASTERY BONUS', value: `${stats.wins}× WIN BADGE`, color: '#4ade80' });
  }

  if (stats.currentStreak >= 3) {
    rewards.push({ label: 'STREAK BONUS', value: `${stats.currentStreak}× STREAK TITLE`, color: '#f97316' });
  }

  const aiRounds = 0; // placeholder — could count aiResolved rounds
  if (stats.totalRounds >= 7) {
    rewards.push({ label: 'ENDURANCE BADGE', value: 'FULL BRACKET CLEARED', color: '#67e8f9' });
  }

  return rewards;
}

// ── Round Replay Viewer ───────────────────────────────────────────────────────
// Simulates a round-by-round playback with fighter positioning overlay
// and damage stats. Uses deterministic pseudo-animation from stored round data.

interface ReplayFrame {
  tick: number;
  p1X: number;   // 0–100 (percentage across arena)
  p2X: number;
  p1Health: number;
  p2Health: number;
  p1State: string;
  p2State: string;
  event?: string; // 'hit' | 'block' | 'ko'
  eventSide?: 'p1' | 'p2';
  eventDmg?: number;
}

/** Generate deterministic replay frames from a RoundResult */
function generateReplayFrames(
  result: RoundResult,
  p1MaxHp: number,
  p2MaxHp: number,
): ReplayFrame[] {
  const frames: ReplayFrame[] = [];
  const totalTicks = 120; // 2 seconds at 60fps equivalent
  const playerDmg = result.playerDamage ?? 80;
  const opponentDmg = result.opponentDamage ?? 80;

  // Derive final health from damage
  const p1FinalHp = Math.max(0, p1MaxHp - opponentDmg);
  const p2FinalHp = Math.max(0, p2MaxHp - playerDmg);

  // Simulate approach, exchange, and result
  for (let t = 0; t <= totalTicks; t++) {
    const progress = t / totalTicks;

    // Fighters start at opposite ends and approach center
    const approachEnd = 0.35;
    const fightStart = 0.4;
    const fightEnd = 0.75;

    let p1X = 15;
    let p2X = 85;
    let p1State = 'idle';
    let p2State = 'idle';
    let event: string | undefined;
    let eventSide: 'p1' | 'p2' | undefined;
    let eventDmg: number | undefined;

    if (progress < approachEnd) {
      // Approach phase
      const t2 = progress / approachEnd;
      p1X = 15 + t2 * 25;
      p2X = 85 - t2 * 25;
      p1State = 'walk';
      p2State = 'walk';
    } else if (progress < fightStart) {
      // Brief pause before exchange
      p1X = 40;
      p2X = 60;
      p1State = 'idle';
      p2State = 'idle';
    } else if (progress < fightEnd) {
      // Combat exchange phase
      const t2 = (progress - fightStart) / (fightEnd - fightStart);
      // Fighters oscillate slightly
      p1X = 38 + Math.sin(t2 * Math.PI * 4) * 4;
      p2X = 62 - Math.sin(t2 * Math.PI * 4) * 4;

      // Trigger events at specific moments
      if (t2 > 0.2 && t2 < 0.25) {
        p1State = 'attack';
        p2State = 'hit';
        event = 'hit';
        eventSide = 'p2';
        eventDmg = Math.round(playerDmg * 0.4);
      } else if (t2 > 0.5 && t2 < 0.55) {
        p2State = 'attack';
        p1State = 'hit';
        event = 'hit';
        eventSide = 'p1';
        eventDmg = Math.round(opponentDmg * 0.4);
      } else if (t2 > 0.75 && t2 < 0.8) {
        if (result.playerWon) {
          p1State = 'attack';
          p2State = 'ko';
          event = 'ko';
          eventSide = 'p2';
          eventDmg = Math.round(playerDmg * 0.6);
        } else {
          p2State = 'attack';
          p1State = 'ko';
          event = 'ko';
          eventSide = 'p1';
          eventDmg = Math.round(opponentDmg * 0.6);
        }
      } else {
        p1State = 'idle';
        p2State = 'idle';
      }
    } else {
      // Post-fight
      p1X = result.playerWon ? 45 : 38;
      p2X = result.playerWon ? 62 : 55;
      p1State = result.playerWon ? 'victory' : 'ko';
      p2State = result.playerWon ? 'ko' : 'victory';
    }

    // Interpolate health
    const healthProgress = Math.min(1, Math.max(0, (progress - fightStart) / (fightEnd - fightStart)));
    const p1Health = Math.round(p1MaxHp - opponentDmg * healthProgress);
    const p2Health = Math.round(p2MaxHp - playerDmg * healthProgress);

    frames.push({ tick: t, p1X, p2X, p1Health, p2Health, p1State, p2State, event, eventSide, eventDmg });
  }

  return frames;
}

interface RoundReplayViewerProps {
  result: RoundResult;
  playerFighter: BannonFighterProfile;
  roundIndex: number;
  totalRounds: number;
  onPrev: () => void;
  onNext: () => void;
}

function RoundReplayViewer({ result, playerFighter, roundIndex, totalRounds, onPrev, onNext }: RoundReplayViewerProps) {
  const [playing, setPlaying] = useState(false);
  const [currentTick, setCurrentTick] = useState(0);
  const [frames, setFrames] = useState<ReplayFrame[]>([]);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const tickRef = useRef<number>(0);

  const p1Color = FACTION_COLOR[playerFighter.factionAlignment];
  const p2Color = FACTION_COLOR[result.opponent.factionAlignment];
  const p1MaxHp = playerFighter.hp;
  const p2MaxHp = result.opponent.hp;

  useEffect(() => {
    const f = generateReplayFrames(result, p1MaxHp, p2MaxHp);
    setFrames(f);
    setCurrentTick(0);
    tickRef.current = 0;
    setPlaying(false);
    cancelAnimationFrame(rafRef.current);
  }, [result, p1MaxHp, p2MaxHp]);

  useEffect(() => {
    if (!playing || frames.length === 0) return;

    const loop = (now: number) => {
      if (now - lastTimeRef.current >= 33) { // ~30fps playback
        lastTimeRef.current = now;
        tickRef.current = Math.min(tickRef.current + 1, frames.length - 1);
        setCurrentTick(tickRef.current);
        if (tickRef.current >= frames.length - 1) {
          setPlaying(false);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, frames]);

  const handlePlay = () => {
    if (currentTick >= frames.length - 1) {
      tickRef.current = 0;
      setCurrentTick(0);
    }
    setPlaying(true);
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    let t = parseInt(e.target.value, 10);
    tickRef.current = t;
    setCurrentTick(t);
    setPlaying(false);
    cancelAnimationFrame(rafRef.current);
  };

  const frame = frames[currentTick] ?? frames[0];
  if (!frame) return null;

  const p1HealthPct = Math.max(0, Math.min(100, (frame.p1Health / p1MaxHp) * 100));
  const p2HealthPct = Math.max(0, Math.min(100, (frame.p2Health / p2MaxHp) * 100));

  const getHpColor = (pct: number) => pct > 50 ? '#facc15' : pct > 25 ? '#f97316' : '#ef4444';

  return (
    <div className="space-y-3">
      {/* Round navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onPrev}
          disabled={roundIndex === 0}
          className="text-[8px] font-black tracking-widest px-3 py-1.5 border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          ◀ PREV
        </button>
        <div className="text-center">
          <div className="text-[7px] text-zinc-600 tracking-widest">ROUND REPLAY</div>
          <div className="text-sm font-black text-white">
            RND {result.round} / {totalRounds}
          </div>
          <div className="text-[8px] font-black mt-0.5"
            style={{ color: result.playerWon ? '#4ade80' : result.winner === 'draw' ? '#94a3b8' : '#f87171' }}
          >
            {result.playerWon ? '▶ WIN' : result.winner === 'draw' ? '— DRAW' : '✕ LOSS'}
            {result.aiResolved && <span className="ml-1 text-zinc-700">⚡</span>}
          </div>
        </div>
        <button
          onClick={onNext}
          disabled={roundIndex === totalRounds - 1}
          className="text-[8px] font-black tracking-widest px-3 py-1.5 border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          NEXT ▶
        </button>
      </div>

      {/* ── Arena viewport with fighter positioning overlay ── */}
      <div
        className="relative w-full overflow-hidden border border-zinc-800"
        style={{ height: 160, background: 'linear-gradient(180deg, #0a0a12 0%, #111118 60%, #0d0d0d 100%)' }}
      >
        {/* Floor line */}
        <div className="absolute bottom-8 left-0 right-0 h-px bg-zinc-800" />
        {/* Grid lines */}
        {[20, 40, 60, 80].map(x => (
          <div key={x} className="absolute top-0 bottom-0 w-px bg-zinc-900/50" style={{ left: `${x}%` }} />
        ))}
        {/* Center marker */}
        <div className="absolute top-0 bottom-0 w-px" style={{ left: '50%', background: '#facc1530' }} />

        {/* P1 Fighter silhouette */}
        <div
          className="absolute transition-all duration-100"
          style={{
            left: `${frame.p1X}%`,
            bottom: 8,
            transform: 'translateX(-50%)',
          }}
        >
          {/* Fighter body */}
          <div className="relative flex flex-col items-center">
            {/* Hit event flash */}
            {frame.event && frame.eventSide === 'p1' && (
              <div
                className="absolute -inset-2 rounded-full animate-ping"
                style={{ background: `${p1Color}40` }}
              />
            )}
            {/* Fighter icon */}
            <div
              className="w-6 h-10 rounded-sm relative"
              style={{
                background: frame.p1State === 'ko' ?'#ef444460'
                  : frame.p1State === 'attack'
                  ? `${p1Color}cc`
                  : frame.p1State === 'hit' ?'#ffffff40'
                  : `${p1Color}80`,
                border: `1px solid ${p1Color}`,
                boxShadow: frame.p1State === 'attack' ? `0 0 8px ${p1Color}` : 'none',
                transform: frame.p1State === 'ko' ? 'rotate(90deg) translateY(8px)' : 'none',
                transition: 'transform 0.2s',
              }}
            />
            {/* Name tag */}
            <div className="text-[6px] font-black mt-0.5 whitespace-nowrap" style={{ color: p1Color }}>
              {playerFighter.name.slice(0, 6).toUpperCase()}
            </div>
          </div>
        </div>

        {/* P2 Fighter silhouette */}
        <div
          className="absolute transition-all duration-100"
          style={{
            left: `${frame.p2X}%`,
            bottom: 8,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="relative flex flex-col items-center">
            {frame.event && frame.eventSide === 'p2' && (
              <div
                className="absolute -inset-2 rounded-full animate-ping"
                style={{ background: `${p2Color}40` }}
              />
            )}
            <div
              className="w-6 h-10 rounded-sm"
              style={{
                background: frame.p2State === 'ko' ?'#ef444460'
                  : frame.p2State === 'attack'
                  ? `${p2Color}cc`
                  : frame.p2State === 'hit' ?'#ffffff40'
                  : `${p2Color}80`,
                border: `1px solid ${p2Color}`,
                boxShadow: frame.p2State === 'attack' ? `0 0 8px ${p2Color}` : 'none',
                transform: frame.p2State === 'ko' ? 'rotate(-90deg) translateY(8px)' : 'none',
                transition: 'transform 0.2s',
              }}
            />
            <div className="text-[6px] font-black mt-0.5 whitespace-nowrap" style={{ color: p2Color }}>
              {result.opponent.name.slice(0, 6).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Damage event popup */}
        {frame.event === 'hit' && frame.eventDmg && (
          <div
            className="absolute text-[10px] font-black animate-bounce"
            style={{
              left: `${frame.eventSide === 'p1' ? frame.p1X : frame.p2X}%`,
              top: '20%',
              transform: 'translateX(-50%)',
              color: '#facc15',
              textShadow: '0 0 8px #facc15',
            }}
          >
            -{frame.eventDmg}
          </div>
        )}
        {frame.event === 'ko' && (
          <div
            className="absolute text-[11px] font-black"
            style={{
              left: '50%',
              top: '15%',
              transform: 'translateX(-50%)',
              color: '#facc15',
              textShadow: '0 0 12px #facc15',
            }}
          >
            K.O.
          </div>
        )}

        {/* Distance indicator */}
        <div className="absolute top-2 left-0 right-0 flex justify-center">
          <div className="text-[6px] text-zinc-700 tracking-widest">
            DIST: {Math.round(Math.abs(frame.p2X - frame.p1X))}u
          </div>
        </div>
      </div>

      {/* ── Health bars overlay ── */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="flex justify-between text-[7px] mb-0.5">
            <span style={{ color: p1Color }}>{playerFighter.name.slice(0, 8).toUpperCase()}</span>
            <span className="text-zinc-600">{frame.p1Health}</span>
          </div>
          <div className="h-2 bg-zinc-900 border border-zinc-800">
            <div className="h-full transition-all duration-100" style={{ width: `${p1HealthPct}%`, background: getHpColor(p1HealthPct) }} />
          </div>
        </div>
        <div className="text-[7px] text-zinc-700 shrink-0">VS</div>
        <div className="flex-1">
          <div className="flex justify-between text-[7px] mb-0.5">
            <span className="text-zinc-600">{frame.p2Health}</span>
            <span style={{ color: p2Color }}>{result.opponent.name.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="h-2 bg-zinc-900 border border-zinc-800">
            <div className="h-full transition-all duration-100 ml-auto" style={{ width: `${p2HealthPct}%`, background: getHpColor(p2HealthPct) }} />
          </div>
        </div>
      </div>

      {/* ── Playback controls ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={playing ? () => { setPlaying(false); cancelAnimationFrame(rafRef.current); } : handlePlay}
          className="text-[8px] font-black tracking-widest px-4 py-2 border transition-all"
          style={{
            borderColor: playing ? '#ef4444' : '#facc15',
            color: playing ? '#ef4444' : '#facc15',
          }}
        >
          {playing ? '⏸ PAUSE' : currentTick >= frames.length - 1 ? '↺ REPLAY' : '▶ PLAY'}
        </button>
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={currentTick}
          onChange={handleScrub}
          className="flex-1 h-1 accent-yellow-400"
        />
        <div className="text-[7px] text-zinc-600 w-10 text-right">
          {currentTick}/{frames.length - 1}
        </div>
      </div>

      {/* ── Damage stats ── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="border border-zinc-900 p-2" style={{ background: `${p1Color}08` }}>
          <div className="text-[7px] text-zinc-600 mb-1">YOUR DAMAGE DEALT</div>
          <div className="text-lg font-black" style={{ color: p1Color }}>{result.playerDamage ?? '—'}</div>
          <div className="mt-1 h-1 bg-zinc-900">
            <div className="h-full" style={{ width: `${Math.min(100, ((result.playerDamage ?? 0) / 200) * 100)}%`, background: p1Color }} />
          </div>
        </div>
        <div className="border border-zinc-900 p-2" style={{ background: `${p2Color}08` }}>
          <div className="text-[7px] text-zinc-600 mb-1">OPP DAMAGE DEALT</div>
          <div className="text-lg font-black" style={{ color: p2Color }}>{result.opponentDamage ?? '—'}</div>
          <div className="mt-1 h-1 bg-zinc-900">
            <div className="h-full ml-auto" style={{ width: `${Math.min(100, ((result.opponentDamage ?? 0) / 200) * 100)}%`, background: p2Color }} />
          </div>
        </div>
      </div>

      {/* Fighter stats comparison */}
      <div className="border border-zinc-900 p-3 space-y-2">
        <div className="text-[7px] text-zinc-600 tracking-widest mb-2">FIGHTER COMPARISON</div>
        {[
          { label: 'STR', p1: playerFighter.strength, p2: result.opponent.strength },
          { label: 'SPD', p1: playerFighter.speed, p2: result.opponent.speed },
          { label: 'POI', p1: playerFighter.poise, p2: result.opponent.poise },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-zinc-900 flex justify-end">
              <div className="h-full" style={{ width: `${s.p1}%`, background: p1Color }} />
            </div>
            <span className="text-[7px] text-zinc-500 w-6 text-center">{s.label}</span>
            <div className="flex-1 h-1.5 bg-zinc-900">
              <div className="h-full" style={{ width: `${s.p2}%`, background: p2Color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main PostTournamentScreen ─────────────────────────────────────────────────

export default function PostTournamentScreen({
  playerFighter,
  results,
  stats,
  isChampion,
  rankPointsEarned,
  rankTier,
  onMainMenu,
  onPlayAgain,
}: PostTournamentScreenProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'bracket' | 'rewards' | 'replay'>('summary');
  const [replayRoundIndex, setReplayRoundIndex] = useState(0);
  const playerColor = FACTION_COLOR[playerFighter.factionAlignment];
  const rankColor = getRankColor(rankTier);
  const rewards = computeRewards(stats, isChampion, rankPointsEarned);

  const winRate = stats.totalRounds > 0
    ? Math.round((stats.wins / stats.totalRounds) * 100)
    : 0;

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col font-mono overflow-hidden">
      {/* Atmosphere */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: isChampion
          ? 'radial-gradient(ellipse at 50% 0%, #facc1518 0%, transparent 60%)'
          : 'radial-gradient(ellipse at 50% 0%, #dc262618 0%, transparent 60%)',
      }} />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.5) 3px, rgba(255,255,255,0.5) 4px)',
      }} />

      {/* Header */}
      <div className="relative z-10 flex-shrink-0 border-b border-zinc-900 px-5 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[8px] tracking-[0.5em] text-zinc-600">TOURNAMENT COMPLETE</div>
            <div className="mt-1 text-2xl font-black tracking-widest"
              style={{ color: isChampion ? '#facc15' : '#ef4444', textShadow: `0 0 20px currentColor` }}
            >
              {isChampion ? '👑 CHAMPION' : 'ELIMINATED'}
            </div>
            <div className="mt-1 text-sm font-black" style={{ color: playerColor }}>
              {playerFighter.name.toUpperCase()}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[7px] tracking-widest text-zinc-600">NEW RANK</div>
            <div className="text-xl font-black mt-0.5" style={{ color: rankColor }}>{rankTier}</div>
            <div className="text-[8px] mt-0.5" style={{ color: rankColor }}>+{rankPointsEarned} RP</div>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <div className="border border-zinc-900 py-2">
            <div className="text-xl font-black text-green-400">{stats.wins}</div>
            <div className="text-[7px] text-zinc-600">WINS</div>
          </div>
          <div className="border border-zinc-900 py-2">
            <div className="text-xl font-black text-red-400">{stats.losses}</div>
            <div className="text-[7px] text-zinc-600">LOSSES</div>
          </div>
          <div className="border border-zinc-900 py-2">
            <div className="text-xl font-black text-zinc-400">{stats.draws}</div>
            <div className="text-[7px] text-zinc-600">DRAWS</div>
          </div>
          <div className="border border-zinc-900 py-2">
            <div className="text-xl font-black text-yellow-400">{winRate}%</div>
            <div className="text-[7px] text-zinc-600">WIN RATE</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative z-10 flex-shrink-0 flex border-b border-zinc-900">
        {(['summary', 'bracket', 'rewards', 'replay'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-3 text-[8px] tracking-[0.2em] font-black transition-all"
            style={{
              color: activeTab === tab ? '#fff' : '#52525b',
              borderBottom: activeTab === tab ? `2px solid ${playerColor}` : '2px solid transparent',
            }}
          >
            {tab === 'replay' ? '⏵ REPLAY' : tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4">

        {/* SUMMARY TAB */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            {/* Match-by-match summary */}
            <div>
              <div className="text-[8px] tracking-[0.3em] text-zinc-600 mb-3">MATCH SUMMARY</div>
              <div className="space-y-2">
                {results.map((r, i) => {
                  const oppColor = FACTION_COLOR[r.opponent.factionAlignment];
                  return (
                    <div key={i} className="flex items-center gap-3 border border-zinc-900 px-3 py-2"
                      style={{ background: r.playerWon ? '#4ade8008' : r.winner === 'draw' ? '#94a3b808' : '#f8717108' }}
                    >
                      <div className="text-[8px] text-zinc-600 w-10">RND {r.round}</div>
                      <div className="flex-1">
                        <div className="text-[9px] font-black" style={{ color: oppColor }}>
                          vs {r.opponent.name.toUpperCase()}
                        </div>
                        <div className="text-[7px] text-zinc-600">{r.opponent.fightingStyle.split('.')[0]}</div>
                      </div>
                      {/* Damage bars */}
                      {r.playerDamage !== undefined && r.opponentDamage !== undefined && (
                        <div className="flex flex-col gap-0.5 w-24">
                          <div className="flex items-center gap-1">
                            <div className="text-[6px] text-zinc-600 w-6">YOU</div>
                            <div className="flex-1 h-1 bg-zinc-900">
                              <div className="h-full bg-green-500" style={{ width: `${Math.min(100, (r.playerDamage / 200) * 100)}%` }} />
                            </div>
                            <div className="text-[6px] text-zinc-500 w-6 text-right">{r.playerDamage}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="text-[6px] text-zinc-600 w-6">OPP</div>
                            <div className="flex-1 h-1 bg-zinc-900">
                              <div className="h-full bg-red-500" style={{ width: `${Math.min(100, (r.opponentDamage / 200) * 100)}%` }} />
                            </div>
                            <div className="text-[6px] text-zinc-500 w-6 text-right">{r.opponentDamage}</div>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-black"
                          style={{ color: r.playerWon ? '#4ade80' : r.winner === 'draw' ? '#94a3b8' : '#f87171' }}
                        >
                          {r.playerWon ? 'WIN' : r.winner === 'draw' ? 'DRAW' : 'LOSS'}
                        </span>
                        {r.aiResolved && <span className="text-[7px] text-zinc-700">⚡</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Fighter stats used */}
            <div>
              <div className="text-[8px] tracking-[0.3em] text-zinc-600 mb-3">YOUR FIGHTER STATS</div>
              <div className="border border-zinc-900 p-3 space-y-2">
                {[
                  { label: 'STRENGTH', value: playerFighter.strength, color: '#ef4444' },
                  { label: 'SPEED', value: playerFighter.speed, color: '#3b82f6' },
                  { label: 'POISE', value: playerFighter.poise, color: '#a78bfa' },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span className="text-[8px] text-zinc-500 w-20">{s.label}</span>
                    <div className="flex-1 h-1.5 bg-zinc-900">
                      <div className="h-full transition-all" style={{ width: `${s.value}%`, background: s.color }} />
                    </div>
                    <span className="text-[8px] font-black w-6 text-right" style={{ color: s.color }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* BRACKET TAB */}
        {activeTab === 'bracket' && (
          <div className="space-y-4">
            <div className="text-[8px] tracking-[0.3em] text-zinc-600 mb-3">FINAL BRACKET OUTCOME</div>

            {/* Visual bracket */}
            <div className="space-y-2">
              {results.map((r, i) => {
                const oppColor = FACTION_COLOR[r.opponent.factionAlignment];
                const isLast = i === results.length - 1;
                return (
                  <div key={i} className="relative">
                    <div className="flex items-stretch gap-0">
                      {/* Round label */}
                      <div className="w-14 flex items-center justify-center text-[7px] text-zinc-700 border-r border-zinc-900 pr-2">
                        RND {r.round}
                      </div>
                      {/* Match card */}
                      <div className="flex-1 border border-zinc-900 ml-2 p-2"
                        style={{
                          borderLeftColor: r.playerWon ? '#4ade80' : r.winner === 'draw' ? '#94a3b8' : '#f87171',
                          borderLeftWidth: 2,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[9px] font-black" style={{ color: playerColor }}>{playerFighter.name.toUpperCase()}</div>
                            <div className="text-[7px] text-zinc-600">{playerFighter.factionAlignment.toUpperCase()}</div>
                          </div>
                          <div className="text-[8px] font-black text-zinc-600">VS</div>
                          <div className="text-right">
                            <div className="text-[9px] font-black" style={{ color: oppColor }}>{r.opponent.name.toUpperCase()}</div>
                            <div className="text-[7px] text-zinc-600">{r.opponent.factionAlignment.toUpperCase()}</div>
                          </div>
                        </div>
                        <div className="mt-1 text-center">
                          <span className="text-[8px] font-black"
                            style={{ color: r.playerWon ? '#4ade80' : r.winner === 'draw' ? '#94a3b8' : '#f87171' }}
                          >
                            {r.playerWon ? '▶ PLAYER WINS' : r.winner === 'draw' ? '— DRAW' : '✕ OPPONENT WINS'}
                          </span>
                          {r.aiResolved && <span className="ml-2 text-[7px] text-zinc-700">⚡ SIMULATED</span>}
                        </div>
                      </div>
                    </div>
                    {/* Connector line */}
                    {!isLast && (
                      <div className="absolute left-14 top-full w-0.5 h-2 bg-zinc-900" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Final outcome */}
            <div className="border-2 p-4 text-center mt-4"
              style={{ borderColor: isChampion ? '#facc15' : '#ef4444', background: isChampion ? '#facc1508' : '#ef444408' }}
            >
              <div className="text-[8px] tracking-widest text-zinc-500 mb-1">FINAL OUTCOME</div>
              <div className="text-2xl font-black" style={{ color: isChampion ? '#facc15' : '#ef4444' }}>
                {isChampion ? '👑 TOURNAMENT CHAMPION' : '✕ ELIMINATED'}
              </div>
              <div className="text-[9px] text-zinc-500 mt-1">
                {stats.wins}W · {stats.losses}L · {stats.draws}D across {stats.totalRounds} rounds
              </div>
            </div>
          </div>
        )}

        {/* REWARDS TAB */}
        {activeTab === 'rewards' && (
          <div className="space-y-4">
            <div className="text-[8px] tracking-[0.3em] text-zinc-600 mb-3">EARNED REWARDS</div>

            {/* Rank change */}
            <div className="border border-zinc-900 p-4" style={{ background: `${rankColor}08` }}>
              <div className="text-[8px] tracking-widest text-zinc-600 mb-2">RANK PROGRESSION</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[8px] text-zinc-600">NEW TIER</div>
                  <div className="text-2xl font-black mt-0.5" style={{ color: rankColor }}>{rankTier}</div>
                </div>
                <div className="text-right">
                  <div className="text-[8px] text-zinc-600">POINTS EARNED</div>
                  <div className="text-2xl font-black text-yellow-400 mt-0.5">+{rankPointsEarned}</div>
                </div>
              </div>
              {/* Tier progress bar */}
              <div className="mt-3">
                <div className="flex justify-between text-[7px] text-zinc-700 mb-1">
                  {RANK_TIERS.map(r => (
                    <span key={r.tier} style={{ color: r.tier === rankTier.toUpperCase() ? rankColor : '#3f3f46' }}>
                      {r.tier.slice(0, 3)}
                    </span>
                  ))}
                </div>
                <div className="h-1.5 bg-zinc-900 relative">
                  <div className="absolute left-0 top-0 h-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, (rankPointsEarned / 1200) * 100)}%`,
                      background: `linear-gradient(90deg, #facc15, ${rankColor})`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Reward items */}
            <div className="space-y-2">
              {rewards.map((reward, i) => (
                <div key={i} className="flex items-center gap-3 border border-zinc-900 px-3 py-3"
                  style={{ background: `${reward.color}08` }}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: reward.color }} />
                  <div className="flex-1">
                    <div className="text-[8px] text-zinc-500">{reward.label}</div>
                    <div className="text-[10px] font-black mt-0.5" style={{ color: reward.color }}>{reward.value}</div>
                  </div>
                  <div className="text-[8px] text-zinc-700">UNLOCKED</div>
                </div>
              ))}
            </div>

            {/* Season progression note */}
            <div className="border border-zinc-900 p-3 text-center">
              <div className="text-[7px] tracking-widest text-zinc-700">SEASON PROGRESSION</div>
              <div className="text-[9px] text-zinc-500 mt-1">
                {stats.wins} tournament wins recorded · {isChampion ? 'Champion badge earned' : 'Keep fighting to earn champion status'}
              </div>
            </div>
          </div>
        )}

        {/* REPLAY TAB */}
        {activeTab === 'replay' && results.length > 0 && (
          <div className="space-y-4">
            <div className="text-[8px] tracking-[0.3em] text-zinc-600 mb-1">ROUND-BY-ROUND REPLAY</div>
            <div className="text-[7px] text-zinc-700 mb-3">
              Scrub through each round to review fighter positioning, damage events, and match outcome.
            </div>

            {/* Round selector pills */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => setReplayRoundIndex(i)}
                  className="px-2 py-1 text-[7px] font-black tracking-widest border transition-all"
                  style={{
                    borderColor: replayRoundIndex === i ? playerColor : '#27272a',
                    color: replayRoundIndex === i ? '#fff' : '#52525b',
                    background: replayRoundIndex === i ? `${playerColor}20` : 'transparent',
                  }}
                >
                  R{r.round} {r.playerWon ? '✓' : r.winner === 'draw' ? '—' : '✕'}
                </button>
              ))}
            </div>

            <RoundReplayViewer
              result={results[replayRoundIndex]}
              playerFighter={playerFighter}
              roundIndex={replayRoundIndex}
              totalRounds={results.length}
              onPrev={() => setReplayRoundIndex(i => Math.max(0, i - 1))}
              onNext={() => setReplayRoundIndex(i => Math.min(results.length - 1, i + 1))}
            />
          </div>
        )}

        {activeTab === 'replay' && results.length === 0 && (
          <div className="text-center py-12 text-zinc-700 text-[9px] tracking-widest">
            NO ROUND DATA AVAILABLE
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="relative z-10 flex-shrink-0 border-t border-zinc-900 p-4 flex gap-3">
        <button
          onClick={onPlayAgain}
          className="flex-1 border-2 border-yellow-400 py-3 text-xs font-black tracking-widest text-yellow-400 hover:bg-yellow-400 hover:text-black transition-all"
        >
          PLAY AGAIN
        </button>
        <button
          onClick={onMainMenu}
          className="flex-1 border border-zinc-700 py-3 text-xs font-black tracking-widest text-zinc-400 hover:bg-white hover:text-black transition-all"
        >
          MAIN MENU
        </button>
      </div>
    </div>
  );
}
