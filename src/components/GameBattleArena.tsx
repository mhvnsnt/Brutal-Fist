'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { type BannonFighterProfile } from '../data/bannonRoster';
import { GameEngine } from '../engine/GameEngine';
import { getCharacterMoveSet } from '../engine/CharacterMoveSetSystem';
import { getMoveById } from '../engine/BrutalFistMoveCatalog';
import { FighterState, type InputBitmask } from '../types';
import MoveExecutionFeedback from './MoveExecutionFeedback';
import { MobileControls } from './MobileControls';
import { useSoundEffects } from '../hooks/useSoundEffects';
import dynamic from 'next/dynamic';

// ── 3D combat arena — loaded client-side only ─────────────────────────────────
const CombatArena3D = dynamic(() => import('./CombatArena3D'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <div className="text-yellow-400 text-xs tracking-widest animate-pulse font-mono">LOADING ARENA...</div>
    </div>
  ),
});

interface GameBattleArenaProps {
  p1Fighter: BannonFighterProfile;
  p2Fighter: BannonFighterProfile;
  onMatchEnd?: (winner: 'p1' | 'p2' | 'draw') => void;
  onBack?: () => void;
  /** Optional label shown in the round indicator (e.g. "ROUND 2 / 7") */
  roundLabel?: string;
  /** Optional cosmetic skin tint for P1 (hex color) */
  p1SkinTint?: string;
  /** Optional cosmetic skin tint for P2 (hex color) */
  p2SkinTint?: string;
}

const EMPTY_INPUT: InputBitmask = {
  up: false, down: false, left: false, right: false,
  light: false, heavy: false, guard: false,
  grapple: false, escape: false, pin: false,
};

const FACTION_COLOR: Record<string, string> = {
  alliance:    '#1d4ed8',
  corporate:   '#dc2626',
  chaos:       '#7c3aed',
  independent: '#d97706',
};

export default function GameBattleArena({
  p1Fighter,
  p2Fighter,
  onMatchEnd,
  onBack,
  roundLabel,
  p1SkinTint,
  p2SkinTint,
}: GameBattleArenaProps) {
  const engineRef = useRef<GameEngine | null>(null);
  const inputRef = useRef<InputBitmask>({ ...EMPTY_INPUT });
  const rafRef = useRef<number>(0);
  const [frame, setFrame] = useState(0);
  const [p1Health, setP1Health] = useState(p1Fighter.hp);
  const [p2Health, setP2Health] = useState(p2Fighter.hp);
  const [p1State, setP1State] = useState<string>('Neutral');
  const [p2State, setP2State] = useState<string>('Neutral');
  const [p1Animation, setP1Animation] = useState<string>('idle');
  const [p2Animation, setP2Animation] = useState<string>('idle');
  const [ko, setKo] = useState(false);
  const [winner, setWinner] = useState<'p1' | 'p2' | 'draw' | null>(null);
  const [roundTimer, setRoundTimer] = useState(99);
  const [hitStopActive, setHitStopActive] = useState(false);
  // ── State: arena is fully loaded (portrait boxes destroyed) ──────────────────
  const [arenaReady, setArenaReady] = useState(false);
  const koHandledRef = useRef(false);
  const roundStartedRef = useRef(false);

  // Sound effects
  const sfx = useSoundEffects();

  // Move execution feedback events
  const [feedbackEvents, setFeedbackEvents] = useState<Array<{
    id: number;
    moveId: string;
    moveName: string;
    damage: number;
    isBlocked: boolean;
    isCounter: boolean;
    player: 'p1' | 'p2';
    x: number;
    y: number;
  }>>([]);
  const feedbackIdRef = useRef(0);

  // Build engine with customized move sets
  useEffect(() => {
    const p1MoveSet = getCharacterMoveSet(p1Fighter.id);
    const p2MoveSet = getCharacterMoveSet(p2Fighter.id);

    const engine = new GameEngine(p1Fighter, p2Fighter);

    if (p1MoveSet?.isCustomized) {
      const lightMove = getMoveById(p1MoveSet.lightAttack);
      const heavyMove = getMoveById(p1MoveSet.heavyAttack);
      if (lightMove) (engine as any)._p1LightOverride = lightMove;
      if (heavyMove) (engine as any)._p1HeavyOverride = heavyMove;
    }

    engineRef.current = engine;
    setP1Health(p1Fighter.hp);
    setP2Health(p2Fighter.hp);
    setFrame(0);
    setKo(false);
    setWinner(null);
    setRoundTimer(99);
    koHandledRef.current = false;
    roundStartedRef.current = false;
    // Mark arena ready after a brief delay to ensure 3D canvas has mounted
    // and character select assets are fully purged from the render tree
    const readyTimer = window.setTimeout(() => setArenaReady(true), 400);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.clearTimeout(readyTimer);
    };
  }, [p1Fighter, p2Fighter]);

  // Round start bell (once per mount)
  useEffect(() => {
    if (roundStartedRef.current) return;
    roundStartedRef.current = true;
    const t = window.setTimeout(() => sfx.playRoundStart(), 300);
    return () => window.clearTimeout(t);
  }, [sfx]);

  // Track previous states for sound triggering
  const prevP1StateRef = useRef<string>('Neutral');
  const prevP2StateRef = useRef<string>('Neutral');
  const prevP1HealthRef = useRef<number>(p1Fighter.hp);
  const prevP2HealthRef = useRef<number>(p2Fighter.hp);

  // Game loop
  useEffect(() => {
    let lastTime = 0;
    const FRAME_MS = 1000 / 60;

    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const engine = engineRef.current;
      if (!engine) return;
      if (now - lastTime < FRAME_MS - 1) return;
      lastTime = now;

      const prevP1Health = prevP1HealthRef.current;
      const prevP2Health = prevP2HealthRef.current;
      const prevP1State = prevP1StateRef.current;
      const prevP2State = prevP2StateRef.current;

      engine.tick(inputRef.current);

      const p1Dmg = prevP1Health - engine.p1Health;
      const p2Dmg = prevP2Health - engine.p2Health;

      // ── Sound: move execution (when entering Startup) ──
      if (engine.state === FighterState.Startup && prevP1State !== FighterState.Startup) {
        sfx.playMoveExec();
      }
      if (engine.p2State === FighterState.Startup && prevP2State !== FighterState.Startup) {
        sfx.playMoveExec();
      }

      // ── Sound: grapple ──
      if (engine.state === 'Grappled' && prevP1State !== 'Grappled') {
        sfx.playGrapple();
      }

      // ── Sound + feedback: P2 takes damage ──
      if (p2Dmg > 0 && engine.currentMove) {
        const move = engine.currentMove;
        const isBlocked = engine.p2State === FighterState.Blockstun;
        const isCounter = prevP2State === FighterState.Startup || prevP2State === FighterState.Active;

        if (isBlocked) {
          sfx.playBlock();
        } else if (isCounter) {
          sfx.playCounter();
        } else if (p2Dmg > 300) {
          sfx.playHeavyHit();
        } else {
          sfx.playLightHit();
        }

        setFeedbackEvents(prev => [...prev.slice(-6), {
          id: ++feedbackIdRef.current,
          moveId: (move as any).id ?? 'hit',
          moveName: (move as any).displayName ?? 'Hit',
          damage: p2Dmg,
          isBlocked,
          isCounter,
          player: 'p1',
          x: 65 + Math.random() * 10,
          y: 20 + Math.random() * 20,
        }]);
      }

      // ── Sound + feedback: P1 takes damage ──
      if (p1Dmg > 0 && engine.p2Move) {
        const move = engine.p2Move;
        const isBlocked = engine.state === FighterState.Blockstun;
        const isCounter = prevP1State === FighterState.Startup || prevP1State === FighterState.Active;

        if (isBlocked) {
          sfx.playBlock();
        } else if (isCounter) {
          sfx.playCounter();
        } else if (p1Dmg > 300) {
          sfx.playHeavyHit();
        } else {
          sfx.playLightHit();
        }

        setFeedbackEvents(prev => [...prev.slice(-6), {
          id: ++feedbackIdRef.current,
          moveId: (move as any).id ?? 'hit',
          moveName: (move as any).displayName ?? 'Hit',
          damage: p1Dmg,
          isBlocked,
          isCounter,
          player: 'p2',
          x: 25 + Math.random() * 10,
          y: 20 + Math.random() * 20,
        }]);
      }

      // Update refs for next frame
      prevP1HealthRef.current = engine.p1Health;
      prevP2HealthRef.current = engine.p2Health;
      prevP1StateRef.current = engine.state;
      prevP2StateRef.current = engine.p2State;

      setFrame(engine.currentFrame);
      setP1Health(engine.p1Health);
      setP2Health(engine.p2Health);
      setP1State(engine.state);
      setP2State(engine.p2State);
      setP1Animation(engine.p1Animation);
      setP2Animation(engine.p2Animation);
      setHitStopActive(engine.hitStopFrames > 0);

      if (engine.isMatchOver() && !koHandledRef.current) {
        koHandledRef.current = true;
        setKo(true);
        const w = engine.p1Health <= 0 && engine.p2Health <= 0 ? 'draw'
          : engine.p1Health <= 0 ? 'p2' : 'p1';
        setWinner(w);
        cancelAnimationFrame(rafRef.current);
        sfx.playKO();
        setTimeout(() => {
          if (w !== 'draw') sfx.playVictory();
          onMatchEnd?.(w);
        }, 2500);
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ko, onMatchEnd, sfx]);

  // Round timer
  useEffect(() => {
    if (ko) return;
    const t = window.setInterval(() => {
      setRoundTimer(prev => {
        if (prev <= 1) {
          const engine = engineRef.current;
          if (engine && !koHandledRef.current) {
            koHandledRef.current = true;
            const w = engine.p1Health > engine.p2Health ? 'p1'
              : engine.p2Health > engine.p1Health ? 'p2' : 'draw';
            setKo(true);
            setWinner(w);
            cancelAnimationFrame(rafRef.current);
            sfx.playKO();
            setTimeout(() => {
              if (w !== 'draw') sfx.playVictory();
              onMatchEnd?.(w);
            }, 2500);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [ko, onMatchEnd, sfx]);

  // Keyboard input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const i = inputRef.current;
      if (e.key === 'ArrowLeft') i.left = true;
      if (e.key === 'ArrowRight') i.right = true;
      if (e.key === 'ArrowUp') i.up = true;
      if (e.key === 'ArrowDown') i.down = true;
      if (e.key === 'z' || e.key === 'Z') i.light = true;
      if (e.key === 'x' || e.key === 'X') i.heavy = true;
      if (e.key === 'c' || e.key === 'C') i.guard = true;
      if (e.key === 'v' || e.key === 'V') i.grapple = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const i = inputRef.current;
      if (e.key === 'ArrowLeft') i.left = false;
      if (e.key === 'ArrowRight') i.right = false;
      if (e.key === 'ArrowUp') i.up = false;
      if (e.key === 'ArrowDown') i.down = false;
      if (e.key === 'z' || e.key === 'Z') i.light = false;
      if (e.key === 'x' || e.key === 'X') i.heavy = false;
      if (e.key === 'c' || e.key === 'C') i.guard = false;
      if (e.key === 'v' || e.key === 'V') i.grapple = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const p1MaxHealth = p1Fighter.hp;
  const p2MaxHealth = p2Fighter.hp;
  const p1Pct = Math.max(0, Math.min(100, (p1Health / p1MaxHealth) * 100));
  const p2Pct = Math.max(0, Math.min(100, (p2Health / p2MaxHealth) * 100));
  const p1Color = FACTION_COLOR[p1Fighter.factionAlignment];
  const p2Color = FACTION_COLOR[p2Fighter.factionAlignment];

  const getHealthBarColor = (pct: number) => {
    if (pct > 50) return '#facc15';
    if (pct > 25) return '#f97316';
    return '#ef4444';
  };

  const getStateLabel = (state: string, anim: string) => {
    if (state === 'KO') return 'KO';
    if (state === 'Hitstun') return 'HIT';
    if (state === 'Blockstun') return 'BLOCK';
    if (state === 'Startup') return 'ATK';
    if (state === 'Active') return 'ACTIVE';
    if (state === 'Grappled') return 'GRAPPLE';
    return anim.toUpperCase();
  };

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden touch-none select-none font-mono">

      {/* ── FULL 3D COMBAT VIEWPORT ──────────────────────────────────────────── */}
      {/* This fills the entire screen. The HUD layers on top via z-index.        */}
      {/* Portrait boxes from CharacterSelect are NOT rendered here — they are   */}
      {/* destroyed the moment this component mounts (state transition complete). */}
      <div className="absolute inset-0 z-0">
        <CombatArena3D
          p1Fighter={p1Fighter}
          p2Fighter={p2Fighter}
          p1State={p1State}
          p2State={p2State}
          p1Animation={p1Animation}
          p2Animation={p2Animation}
          p1Color={p1Color}
          p2Color={p2Color}
          hitStopActive={hitStopActive}
          p1SkinTint={p1SkinTint}
          p2SkinTint={p2SkinTint}
        />
      </div>

      {/* ── Loading veil — hides the 3D canvas until fighters are spawned ─────── */}
      {!arenaReady && (
        <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center gap-3">
          <div className="text-yellow-400 text-sm font-black tracking-[0.4em] animate-pulse">
            LOADING ARENA
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <div className="text-zinc-600 text-[9px] tracking-widest mt-2">
            {p1Fighter.name.toUpperCase()} VS {p2Fighter.name.toUpperCase()}
          </div>
        </div>
      )}

      {/* ── HUD: Health bars & timer ── */}
      <div className="absolute top-0 left-0 right-0 z-30 px-3 pt-2 pb-1">
        <div className="flex items-center gap-2">
          {/* P1 health bar */}
          <div className="flex-1 flex flex-col gap-0.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[9px] font-black tracking-[0.3em]" style={{ color: p1Color }}>
                {p1Fighter.name.toUpperCase()}
              </span>
              <span className="text-[8px] text-zinc-500">{Math.ceil(p1Health).toLocaleString()}</span>
            </div>
            <div className="h-4 border border-zinc-700 bg-zinc-900/80 relative overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full transition-all duration-75"
                style={{
                  width: `${p1Pct}%`,
                  background: getHealthBarColor(p1Pct),
                  boxShadow: `0 0 8px ${getHealthBarColor(p1Pct)}88`,
                }}
              />
              {p1Pct <= 25 && (
                <div className="absolute inset-0 animate-pulse bg-red-500/10" />
              )}
            </div>
            <div className="text-[7px] text-zinc-400 tracking-widest h-3">
              {getStateLabel(p1State, p1Animation)}
            </div>
          </div>

          {/* Center: Timer + Round */}
          <div className="flex flex-col items-center shrink-0 w-20">
            <div className="text-[7px] text-zinc-400 tracking-widest text-center leading-tight">
              {roundLabel ?? 'ROUND 1'}
            </div>
            <div
              className="text-2xl font-black tabular-nums leading-none"
              style={{
                color: roundTimer <= 10 ? '#ef4444' : '#facc15',
                textShadow: roundTimer <= 10
                  ? '0 0 12px #ef4444' : '0 0 12px #facc15',
              }}
            >
              {String(roundTimer).padStart(2, '0')}
            </div>
            <div className="text-[7px] text-zinc-500 tracking-widest">F{frame}</div>
          </div>

          {/* P2 health bar */}
          <div className="flex-1 flex flex-col gap-0.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[8px] text-zinc-500 text-right w-full">{Math.ceil(p2Health).toLocaleString()}</span>
              <span className="text-[9px] font-black tracking-[0.3em] ml-2 whitespace-nowrap" style={{ color: p2Color }}>
                {p2Fighter.name.toUpperCase()}
              </span>
            </div>
            <div className="h-4 border border-zinc-700 bg-zinc-900/80 relative overflow-hidden">
              <div
                className="absolute right-0 top-0 h-full transition-all duration-75"
                style={{
                  width: `${p2Pct}%`,
                  background: getHealthBarColor(p2Pct),
                  boxShadow: `0 0 8px ${getHealthBarColor(p2Pct)}88`,
                }}
              />
              {p2Pct <= 25 && (
                <div className="absolute inset-0 animate-pulse bg-red-500/10" />
              )}
            </div>
            <div className="text-[7px] text-zinc-400 tracking-widest h-3 text-right">
              {getStateLabel(p2State, p2Animation)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Move Execution Feedback ── */}
      <MoveExecutionFeedback
        events={feedbackEvents}
        onExpire={(id) => setFeedbackEvents(prev => prev.filter(e => e.id !== id))}
      />

      {/* ── KO / Time Out overlay ── */}
      {ko && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none">
          <div
            className="font-black tracking-widest animate-pulse"
            style={{
              fontSize: 'clamp(4rem, 15vw, 10rem)',
              color: '#facc15',
              textShadow: '0 0 40px #facc15, 0 0 80px #facc1544',
              fontFamily: 'monospace',
            }}
          >
            {roundTimer <= 0 ? 'TIME' : 'K.O.'}
          </div>
          {winner && (
            <div className="mt-4 text-lg font-black tracking-[0.4em] text-white">
              {winner === 'draw' ? 'DRAW' : `${winner === 'p1' ? p1Fighter.name : p2Fighter.name} WINS`}
            </div>
          )}
        </div>
      )}

      {/* ── Hit stop flash ── */}
      {hitStopActive && (
        <div className="absolute inset-0 z-40 pointer-events-none bg-white/5 animate-pulse" />
      )}

      {/* ── Mobile controls ── */}
      {!ko && <MobileControls inputRef={inputRef} />}

      {/* ── Back button ── */}
      {onBack && (
        <button
          onClick={onBack}
          className="absolute top-16 left-3 z-40 text-[8px] text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-600 px-2 py-1 transition-colors bg-black/60"
        >
          ← BACK
        </button>
      )}

      {/* ── Controls legend ── */}
      <div className="absolute bottom-2 left-3 z-30 text-[7px] text-zinc-600 space-y-0.5 pointer-events-none">
        <div>ARROWS: MOVE · Z: LIGHT · X: HEAVY · C: GUARD · V: GRAPPLE</div>
      </div>
    </div>
  );
}
