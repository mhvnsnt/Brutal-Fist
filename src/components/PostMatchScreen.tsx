'use client';

import React, { useEffect, useRef, useState } from 'react';
import { type BannonFighterProfile } from '../data/bannonRoster';

// ── Per-character bloom/glow palette ─────────────────────────────────────────
// Each fighter has a unique victory bloom color matching their faction/style
export const CHARACTER_BLOOM: Record<string, { primary: string; secondary: string; glow: string }> = {
  bannon:     { primary: '#facc15', secondary: '#f97316', glow: '0 0 60px #facc1566, 0 0 120px #f9731633' },
  maime:      { primary: '#a855f7', secondary: '#ec4899', glow: '0 0 60px #a855f766, 0 0 120px #ec489933' },
  kaz:        { primary: '#3b82f6', secondary: '#06b6d4', glow: '0 0 60px #3b82f666, 0 0 120px #06b6d433' },
  rex:        { primary: '#ef4444', secondary: '#f97316', glow: '0 0 60px #ef444466, 0 0 120px #f9731633' },
  ghost:      { primary: '#22d3ee', secondary: '#818cf8', glow: '0 0 60px #22d3ee66, 0 0 120px #818cf833' },
  viper:      { primary: '#22c55e', secondary: '#84cc16', glow: '0 0 60px #22c55e66, 0 0 120px #84cc1633' },
  titan:      { primary: '#f59e0b', secondary: '#ef4444', glow: '0 0 60px #f59e0b66, 0 0 120px #ef444433' },
  shadow:     { primary: '#8b5cf6', secondary: '#6366f1', glow: '0 0 60px #8b5cf666, 0 0 120px #6366f133' },
  // Fallback for any unknown character
  default:    { primary: '#facc15', secondary: '#ffffff', glow: '0 0 60px #facc1566, 0 0 120px #ffffff22' },
};

function getBloom(fighter: BannonFighterProfile) {
  return CHARACTER_BLOOM[fighter.id] ?? CHARACTER_BLOOM.default;
}

// ── Round summary entry ───────────────────────────────────────────────────────
export interface RoundResult {
  round: number;
  winner: 'p1' | 'p2' | 'draw';
  condition: 'KO' | 'TIMEOUT' | 'PERFECT';
  p1HealthRemaining: number;
  p2HealthRemaining: number;
  durationSeconds: number;
}

export interface PostMatchScreenProps {
  p1Fighter: BannonFighterProfile;
  p2Fighter: BannonFighterProfile;
  winner: 'p1' | 'p2' | 'draw';
  condition: 'KO' | 'TIMEOUT' | 'PERFECT';
  roundResults: RoundResult[];
  p1Color: string;
  p2Color: string;
  /** Called when user picks Rematch */
  onRematch: () => void;
  /** Called when user picks Character Select */
  onCharacterSelect: () => void;
  /** Called when user picks Watch Replay */
  onWatchReplay?: () => void;
  /** Called when user picks Exit / Main Menu */
  onExit: () => void;
}

// ── Scanline overlay ──────────────────────────────────────────────────────────
function Scanlines() {
  return (
    <div
      className="absolute inset-0 pointer-events-none z-10 opacity-[0.07]"
      style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.8) 2px, rgba(0,0,0,0.8) 4px)',
      }}
    />
  );
}

// ── Bloom ring behind winner name ─────────────────────────────────────────────
function BloomRing({ color, glow }: { color: string; glow: string }) {
  return (
    <div
      className="absolute inset-0 rounded-full pointer-events-none"
      style={{
        background: `radial-gradient(ellipse at center, ${color}22 0%, ${color}08 50%, transparent 75%)`,
        boxShadow: glow,
        animation: 'pulse 2s ease-in-out infinite',
      }}
    />
  );
}

// ── Condition badge ───────────────────────────────────────────────────────────
function ConditionBadge({ condition }: { condition: 'KO' | 'TIMEOUT' | 'PERFECT' }) {
  const styles: Record<string, { color: string; bg: string; border: string; label: string }> = {
    KO:      { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: '#ef444466', label: 'K.O.' },
    TIMEOUT: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: '#f59e0b66', label: 'TIME OUT' },
    PERFECT: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: '#22c55e66', label: 'PERFECT!' },
  };
  const s = styles[condition];
  return (
    <div
      className="px-4 py-1 text-sm font-black tracking-[0.4em] border"
      style={{ color: s.color, background: s.bg, borderColor: s.border, textShadow: `0 0 16px ${s.color}` }}
    >
      {s.label}
    </div>
  );
}

// ── Round summary row ─────────────────────────────────────────────────────────
function RoundRow({
  result,
  p1Fighter,
  p2Fighter,
  p1Color,
  p2Color,
}: {
  result: RoundResult;
  p1Fighter: BannonFighterProfile;
  p2Fighter: BannonFighterProfile;
  p1Color: string;
  p2Color: string;
}) {
  const p1Pct = Math.max(0, Math.min(100, (result.p1HealthRemaining / p1Fighter.hp) * 100));
  const p2Pct = Math.max(0, Math.min(100, (result.p2HealthRemaining / p2Fighter.hp) * 100));

  const conditionColors: Record<string, string> = {
    KO: '#ef4444', TIMEOUT: '#f59e0b', PERFECT: '#22c55e',
  };

  return (
    <div className="flex items-center gap-3 py-2 border-b border-zinc-800/60">
      {/* Round label */}
      <div className="w-16 shrink-0 text-center">
        <div className="text-[8px] text-zinc-500 tracking-widest">RND</div>
        <div className="text-lg font-black text-zinc-300">{result.round}</div>
      </div>

      {/* P1 health bar */}
      <div className="flex-1 flex flex-col gap-0.5">
        <div className="flex justify-between text-[7px] text-zinc-500">
          <span style={{ color: p1Color }}>{p1Fighter.name.toUpperCase()}</span>
          <span>{Math.ceil(result.p1HealthRemaining)}</span>
        </div>
        <div className="h-2 bg-zinc-900 border border-zinc-700/40 overflow-hidden">
          <div
            className="h-full transition-all duration-700"
            style={{
              width: `${p1Pct}%`,
              background: result.winner === 'p1' ? p1Color : '#52525b',
              boxShadow: result.winner === 'p1' ? `0 0 6px ${p1Color}88` : 'none',
            }}
          />
        </div>
      </div>

      {/* Condition badge center */}
      <div className="shrink-0 w-20 text-center">
        <div
          className="text-[8px] font-black tracking-widest"
          style={{ color: conditionColors[result.condition] ?? '#facc15' }}
        >
          {result.condition}
        </div>
        <div className="text-[7px] text-zinc-600">{result.durationSeconds}s</div>
      </div>

      {/* P2 health bar */}
      <div className="flex-1 flex flex-col gap-0.5">
        <div className="flex justify-between text-[7px] text-zinc-500">
          <span>{Math.ceil(result.p2HealthRemaining)}</span>
          <span style={{ color: p2Color }}>{p2Fighter.name.toUpperCase()}</span>
        </div>
        <div className="h-2 bg-zinc-900 border border-zinc-700/40 overflow-hidden">
          <div
            className="h-full ml-auto transition-all duration-700"
            style={{
              width: `${p2Pct}%`,
              background: result.winner === 'p2' ? p2Color : '#52525b',
              boxShadow: result.winner === 'p2' ? `0 0 6px ${p2Color}88` : 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Action button ─────────────────────────────────────────────────────────────
function ActionButton({
  label,
  icon,
  color,
  onClick,
  primary,
}: {
  label: string;
  icon: string;
  color: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 px-4 py-3 border transition-all duration-150 active:scale-95 hover:scale-105 min-w-[80px]"
      style={{
        borderColor: primary ? color : `${color}55`,
        background: primary ? `${color}18` : 'rgba(0,0,0,0.6)',
        color: primary ? color : '#a1a1aa',
        boxShadow: primary ? `0 0 20px ${color}33` : 'none',
      }}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-[8px] font-black tracking-[0.3em]">{label}</span>
    </button>
  );
}

// ── Main PostMatchScreen ──────────────────────────────────────────────────────
export default function PostMatchScreen({
  p1Fighter,
  p2Fighter,
  winner,
  condition,
  roundResults,
  p1Color,
  p2Color,
  onRematch,
  onCharacterSelect,
  onWatchReplay,
  onExit,
}: PostMatchScreenProps) {
  const [visible, setVisible] = useState(false);
  const [showRounds, setShowRounds] = useState(false);
  const [showButtons, setShowButtons] = useState(false);

  // Staggered entrance animation
  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 100);
    const t2 = setTimeout(() => setShowRounds(true), 600);
    const t3 = setTimeout(() => setShowButtons(true), 1100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const winnerFighter = winner === 'p1' ? p1Fighter : winner === 'p2' ? p2Fighter : null;
  const loserFighter  = winner === 'p1' ? p2Fighter : winner === 'p2' ? p1Fighter : null;
  const bloom = winnerFighter ? getBloom(winnerFighter) : CHARACTER_BLOOM.default;
  const winnerColor = winner === 'p1' ? p1Color : winner === 'p2' ? p2Color : '#facc15';

  // Total match stats
  const totalRounds = roundResults.length;
  const p1Wins = roundResults.filter(r => r.winner === 'p1').length;
  const p2Wins = roundResults.filter(r => r.winner === 'p2').length;
  const totalDuration = roundResults.reduce((s, r) => s + r.durationSeconds, 0);

  return (
    <div className="fixed inset-0 bg-black text-white font-mono overflow-hidden flex flex-col">
      <Scanlines />

      {/* ── Cinematic letterbox bars ── */}
      <div className="absolute top-0 left-0 right-0 h-[8%] bg-black z-20" />
      <div className="absolute bottom-0 left-0 right-0 h-[8%] bg-black z-20" />

      {/* ── Background bloom radial ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${bloom.primary}0d 0%, transparent 70%)`,
          transition: 'opacity 1s ease',
          opacity: visible ? 1 : 0,
        }}
      />

      {/* ── Main content ── */}
      <div
        className="relative z-10 flex flex-col items-center justify-start h-full pt-[10%] pb-[10%] px-4 overflow-y-auto gap-4"
        style={{ transition: 'opacity 0.5s ease, transform 0.5s ease', opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)' }}
      >
        {/* ── Winner announcement ── */}
        <div className="relative flex flex-col items-center gap-2 py-4">
          <BloomRing color={bloom.primary} glow={bloom.glow} />

          {winner === 'draw' ? (
            <>
              <div className="text-[9px] tracking-[0.6em] text-zinc-400">MATCH RESULT</div>
              <div
                className="text-5xl font-black tracking-widest"
                style={{ color: '#f59e0b', textShadow: '0 0 40px #f59e0b, 0 0 80px #f59e0b44' }}
              >
                DRAW
              </div>
              <ConditionBadge condition={condition} />
            </>
          ) : (
            <>
              <div className="text-[9px] tracking-[0.6em] text-zinc-400">WINNER</div>
              <div
                className="text-4xl md:text-5xl font-black tracking-widest text-center leading-tight"
                style={{ color: winnerColor, textShadow: bloom.glow.replace(/,/g, ',') }}
              >
                {winnerFighter?.name.toUpperCase()}
              </div>
              <div className="text-[9px] tracking-[0.4em] text-zinc-400 mt-0.5">WINS</div>
              <ConditionBadge condition={condition} />

              {/* Loser name */}
              {loserFighter && (
                <div className="text-[8px] tracking-[0.3em] text-zinc-600 mt-1">
                  defeated {loserFighter.name.toUpperCase()}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Match stats strip ── */}
        <div className="flex gap-6 text-center">
          <div>
            <div className="text-[7px] text-zinc-500 tracking-widest">ROUNDS</div>
            <div className="text-lg font-black text-zinc-300">{totalRounds}</div>
          </div>
          <div>
            <div className="text-[7px] tracking-widest" style={{ color: p1Color }}>P1 WINS</div>
            <div className="text-lg font-black" style={{ color: p1Color }}>{p1Wins}</div>
          </div>
          <div>
            <div className="text-[7px] tracking-widest" style={{ color: p2Color }}>P2 WINS</div>
            <div className="text-lg font-black" style={{ color: p2Color }}>{p2Wins}</div>
          </div>
          <div>
            <div className="text-[7px] text-zinc-500 tracking-widest">TIME</div>
            <div className="text-lg font-black text-zinc-300">{totalDuration}s</div>
          </div>
        </div>

        {/* ── Round summary ── */}
        {showRounds && roundResults.length > 0 && (
          <div
            className="w-full max-w-lg border border-zinc-800/60 bg-zinc-950/80 p-3"
            style={{ transition: 'opacity 0.4s ease, transform 0.4s ease', opacity: showRounds ? 1 : 0, transform: showRounds ? 'translateY(0)' : 'translateY(10px)' }}
          >
            <div className="text-[8px] tracking-[0.4em] text-zinc-500 mb-2 text-center">ROUND SUMMARY</div>
            {roundResults.map(r => (
              <RoundRow
                key={r.round}
                result={r}
                p1Fighter={p1Fighter}
                p2Fighter={p2Fighter}
                p1Color={p1Color}
                p2Color={p2Color}
              />
            ))}
          </div>
        )}

        {/* ── Action buttons ── */}
        {showButtons && (
          <div
            className="flex flex-wrap gap-3 justify-center mt-2"
            style={{ transition: 'opacity 0.4s ease', opacity: showButtons ? 1 : 0 }}
          >
            <ActionButton
              label="REMATCH"
              icon="⚔️"
              color={winnerColor}
              onClick={onRematch}
              primary
            />
            <ActionButton
              label="FIGHTERS"
              icon="👤"
              color="#60a5fa"
              onClick={onCharacterSelect}
            />
            {onWatchReplay && (
              <ActionButton
                label="REPLAY"
                icon="▶"
                color="#a78bfa"
                onClick={onWatchReplay}
              />
            )}
            <ActionButton
              label="EXIT"
              icon="✕"
              color="#71717a"
              onClick={onExit}
            />
          </div>
        )}
      </div>

      {/* ── Horizontal divider lines (Tekken-style) ── */}
      <div
        className="absolute left-0 right-0 h-px z-20 pointer-events-none"
        style={{ top: '8%', background: `linear-gradient(90deg, transparent, ${winnerColor}66, transparent)` }}
      />
      <div
        className="absolute left-0 right-0 h-px z-20 pointer-events-none"
        style={{ bottom: '8%', background: `linear-gradient(90deg, transparent, ${winnerColor}66, transparent)` }}
      />
    </div>
  );
}
