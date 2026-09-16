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
import { type CinematicPhase } from './CombatArena3D';
import { type TournamentSettings, DEFAULT_TOURNAMENT_SETTINGS } from './TournamentSettingsScreen';
import dynamic from 'next/dynamic';

// ── New combat systems ────────────────────────────────────────────────────────
import {
  FighterStateMachine,
  type FighterInput as SMInput,
  DEFAULT_SPECIAL_MOVES,
} from '../engine/combat/FighterStateMachine';
import { FrameDataHitboxSystem } from '../engine/combat/FrameDataHitbox';

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
  roundLabel?: string;
  p1SkinTint?: string;
  p2SkinTint?: string;
  /** Tournament settings (difficulty, FOV, audio toggles) */
  settings?: TournamentSettings;
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

// ── Cinematic timing constants ────────────────────────────────────────────────
const SWEEP_DURATION_MS = 2000;
const INTRO_DURATION_MS = 2500;

export default function GameBattleArena({
  p1Fighter,
  p2Fighter,
  onMatchEnd,
  onBack,
  roundLabel,
  p1SkinTint,
  p2SkinTint,
  settings = DEFAULT_TOURNAMENT_SETTINGS,
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
  const [arenaReady, setArenaReady] = useState(false);

  // ── Z-axis sidestep state ────────────────────────────────────────────────────
  const [p1Z, setP1Z] = useState(0);
  const [p2Z, setP2Z] = useState(0);
  const p1ZRef = useRef(0);
  const p2ZRef = useRef(0);

  // ── Cinematic phase ──────────────────────────────────────────────────────────
  const [cinematicPhase, setCinematicPhase] = useState<CinematicPhase>('sweep');

  // ── Damage event for VFX ─────────────────────────────────────────────────────
  const [damageEvent, setDamageEvent] = useState<{
    count: number; player: 'p1' | 'p2'; damage: number; isCounter: boolean; factionColor: string;
  } | undefined>(undefined);
  const damageEventCountRef = useRef(0);

  const koHandledRef = useRef(false);
  const roundStartedRef = useRef(false);

  const sfx = useSoundEffects();

  const [feedbackEvents, setFeedbackEvents] = useState<Array<{
    id: number; moveId: string; moveName: string; damage: number;
    isBlocked: boolean; isCounter: boolean; player: 'p1' | 'p2'; x: number; y: number;
  }>>([]);
  const feedbackIdRef = useRef(0);

  // ── Action state machines (one per fighter) ──────────────────────────────
  const p1SMRef = useRef<FighterStateMachine>(new FighterStateMachine());
  const p2SMRef = useRef<FighterStateMachine>(new FighterStateMachine());
  const p1HitboxRef = useRef<FrameDataHitboxSystem>(new FrameDataHitboxSystem());
  const p2HitboxRef = useRef<FrameDataHitboxSystem>(new FrameDataHitboxSystem());

  // ── Special move notification state ──────────────────────────────────────
  const [specialMoveNotice, setSpecialMoveNotice] = useState<{
    name: string; player: 'p1' | 'p2'; id: number;
  } | null>(null);
  const specialNoticeIdRef = useRef(0);

  // ── Fighter world positions (for hitbox collision) ────────────────────────
  const P1_X = -1.8;
  const P2_X = 1.8;

  // Build engine
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
    setP1Z(0); setP2Z(0);
    p1ZRef.current = 0; p2ZRef.current = 0;

    // Reset state machines and hitbox systems for new match
    p1SMRef.current = new FighterStateMachine();
    p2SMRef.current = new FighterStateMachine();
    p1SMRef.current.registerSpecialMoves(DEFAULT_SPECIAL_MOVES);
    p2SMRef.current.registerSpecialMoves(DEFAULT_SPECIAL_MOVES);
    p1HitboxRef.current.reset();
    p2HitboxRef.current.reset();

    // ── Cinematic sequence: sweep → intro → fight ──────────────────────────────
    setCinematicPhase('sweep');
    setArenaReady(false);

    const t1 = window.setTimeout(() => {
      setCinematicPhase('intro');
    }, SWEEP_DURATION_MS);

    const t2 = window.setTimeout(() => {
      setCinematicPhase('fight');
      setArenaReady(true);
    }, SWEEP_DURATION_MS + INTRO_DURATION_MS);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [p1Fighter, p2Fighter]);

  // Round start bell
  useEffect(() => {
    if (roundStartedRef.current) return;
    roundStartedRef.current = true;
    const t = window.setTimeout(() => {
      if (settings.soundEnabled) sfx.playRoundStart();
    }, SWEEP_DURATION_MS + INTRO_DURATION_MS + 300);
    return () => window.clearTimeout(t);
  }, [sfx, settings.soundEnabled]);

  const prevP1StateRef = useRef<string>('Neutral');
  const prevP2StateRef = useRef<string>('Neutral');
  const prevP1HealthRef = useRef<number>(p1Fighter.hp);
  const prevP2HealthRef = useRef<number>(p2Fighter.hp);

  const p1Color = FACTION_COLOR[p1Fighter.factionAlignment] ?? '#facc15';
  const p2Color = FACTION_COLOR[p2Fighter.factionAlignment] ?? '#facc15';

  // Game loop — only runs during 'fight' phase
  useEffect(() => {
    if (cinematicPhase !== 'fight') return;
    let lastTime = 0;
    const FRAME_MS = 1000 / 60;

    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const engine = engineRef.current;
      if (!engine) return;
      if (now - lastTime < FRAME_MS - 1) return;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const prevP1Health = prevP1HealthRef.current;
      const prevP2Health = prevP2HealthRef.current;
      const prevP1State = prevP1StateRef.current;
      const prevP2State = prevP2StateRef.current;

      // ── Build SM input from bitmask ────────────────────────────────────
      const bitmask = inputRef.current;
      const smInput: SMInput = {
        forward: bitmask.right ? 1 : bitmask.left ? -1 : 0,
        strafe: 0,
        light: bitmask.light ?? false,
        heavy: bitmask.heavy ?? false,
        guard: bitmask.guard ?? false,
        crouch: bitmask.down ?? false,
        grapple: bitmask.grapple ?? false,
        escape: bitmask.escape ?? false,
      };

      // ── Update P1 state machine ────────────────────────────────────────
      const p1SM = p1SMRef.current;
      const p1Hb = p1HitboxRef.current;
      const prevP1Action = p1SM.action;

      // Block inputs during attack recovery (state machine handles this internally)
      const p1NextMotion = p1SM.update(smInput, dt);
      const p1HbWindow = p1SM.getHitboxWindow();
      p1Hb.update(p1HbWindow);

      // Detect special move activation for notification
      if (p1SM.action === 'Attacking' && prevP1Action !== 'Attacking') {
        const move = p1HbWindow.move;
        if (move?.isSpecial && move.specialName) {
          setSpecialMoveNotice({
            name: move.specialName,
            player: 'p1',
            id: ++specialNoticeIdRef.current,
          });
          setTimeout(() => setSpecialMoveNotice(null), 1800);
        }
      }

      // ── Check P1 hitbox vs P2 ──────────────────────────────────────────
      const p2SM = p2SMRef.current;
      const p2IsBlocking = p2SM.action === 'Guard';
      const p1Hit = p1Hb.checkCollision(
        P1_X, p1ZRef.current, 1,
        P2_X, p2ZRef.current,
        p2IsBlocking,
        p1HbWindow.currentFrame,
      );

      if (p1Hit) {
        // Apply stun to P2 state machine
        const isCrumple = p1Hit.launch > 0.3;
        p2SMRef.current.applyStun(p1Hit.hitstun || 0.3, isCrumple);
        p2HitboxRef.current.reset();

        const isBlocked = p2IsBlocking;
        const isCounter = prevP2State === FighterState.Startup || prevP2State === FighterState.Active;
        if (settings.soundEnabled) {
          if (isBlocked) sfx.playBlock();
          else if (isCounter) sfx.playCounter();
          else if (p1Hit.damage > 200) sfx.playHeavyHit();
          else sfx.playLightHit();
        }
        setDamageEvent({
          count: ++damageEventCountRef.current,
          player: 'p2',
          damage: p1Hit.damage,
          isCounter,
          factionColor: p2Color,
        });
        setFeedbackEvents(prev => [...prev.slice(-6), {
          id: ++feedbackIdRef.current,
          moveId: p1HbWindow.move?.animation ?? 'hit',
          moveName: p1HbWindow.move?.specialName ?? (p1HbWindow.move?.animation === 'heavyAttack' ? 'Heavy' : 'Light'),
          damage: p1Hit.damage,
          isBlocked,
          isCounter,
          player: 'p1',
          x: 65 + Math.random() * 10,
          y: 20 + Math.random() * 20,
        }]);
      }

      // ── Update P2 state machine (AI: simple reactive) ─────────────────
      const p2Hb = p2HitboxRef.current;

      // Simple AI input for P2
      const p2AIInput: SMInput = buildP2AIInput(
        engine.p2State, engine.p1Health, engine.p2Health,
      );
      const p2NextMotion = p2SM.update(p2AIInput, dt);
      const p2HbWindow = p2SM.getHitboxWindow();
      p2Hb.update(p2HbWindow);

      // ── Check P2 hitbox vs P1 ──────────────────────────────────────────
      const p1IsBlocking = p1SM.action === 'Guard';
      const p2Hit = p2Hb.checkCollision(
        P2_X, p2ZRef.current, -1,
        P1_X, p1ZRef.current,
        p1IsBlocking,
        p2HbWindow.currentFrame,
      );

      if (p2Hit) {
        const isCrumple = p2Hit.launch > 0.3;
        p1SMRef.current.applyStun(p2Hit.hitstun || 0.3, isCrumple);
        p1HitboxRef.current.reset();

        const isBlocked = p1IsBlocking;
        const isCounter = prevP1State === FighterState.Startup || prevP1State === FighterState.Active;
        if (settings.soundEnabled) {
          if (isBlocked) sfx.playBlock();
          else if (isCounter) sfx.playCounter();
          else if (p2Hit.damage > 200) sfx.playHeavyHit();
          else sfx.playLightHit();
        }
        setDamageEvent({
          count: ++damageEventCountRef.current,
          player: 'p1',
          damage: p2Hit.damage,
          isCounter,
          factionColor: p1Color,
        });
        setFeedbackEvents(prev => [...prev.slice(-6), {
          id: ++feedbackIdRef.current,
          moveId: p2HbWindow.move?.animation ?? 'hit',
          moveName: p2HbWindow.move?.specialName ?? (p2HbWindow.move?.animation === 'heavyAttack' ? 'Heavy' : 'Light'),
          damage: p2Hit.damage,
          isBlocked,
          isCounter,
          player: 'p2',
          x: 25 + Math.random() * 10,
          y: 20 + Math.random() * 20,
        }]);
      }

      // ── Tick legacy engine for health/state tracking ───────────────────
      engine.tick(inputRef.current);

      const p1Dmg = prevP1Health - engine.p1Health;
      const p2Dmg = prevP2Health - engine.p2Health;

      prevP1HealthRef.current = engine.p1Health;
      prevP2HealthRef.current = engine.p2Health;

      // ── Map SM action state → display state ───────────────────────────
      const p1DisplayState = mapActionToDisplayState(p1SM.action, p1NextMotion, engine.state);
      const p2DisplayState = mapActionToDisplayState(p2SM.action, p2NextMotion, engine.p2State);

      prevP1StateRef.current = p1DisplayState;
      prevP2StateRef.current = p2DisplayState;

      setFrame(engine.currentFrame);
      setP1Health(engine.p1Health);
      setP2Health(engine.p2Health);
      setP1State(p1DisplayState);
      setP2State(p2DisplayState);
      setP1Animation(p1NextMotion);
      setP2Animation(p2NextMotion);
      setHitStopActive(engine.hitStopFrames > 0);

      if (engine.isMatchOver() && !koHandledRef.current) {
        koHandledRef.current = true;
        setKo(true);
        const w = engine.p1Health <= 0 && engine.p2Health <= 0 ? 'draw'
          : engine.p1Health <= 0 ? 'p2' : 'p1';
        setWinner(w);
        cancelAnimationFrame(rafRef.current);
        if (settings.soundEnabled) sfx.playKO();
        // Switch to victory cinematic
        const winnerFighter = w === 'p1' ? p1Fighter : w === 'p2' ? p2Fighter : null;
        setTimeout(() => {
          setCinematicPhase('victory');
          if (w !== 'draw' && settings.soundEnabled) sfx.playVictory();
        }, 800);
        setTimeout(() => {
          onMatchEnd?.(w);
        }, 3500);
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ko, onMatchEnd, sfx, settings, cinematicPhase, p1Color, p2Color, p1Fighter, p2Fighter]);

  // Round timer
  useEffect(() => {
    if (ko || cinematicPhase !== 'fight') return;
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
            if (settings.soundEnabled) sfx.playKO();
            setTimeout(() => {
              setCinematicPhase('victory');
              if (w !== 'draw' && settings.soundEnabled) sfx.playVictory();
            }, 800);
            setTimeout(() => { onMatchEnd?.(w); }, 3500);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [ko, onMatchEnd, sfx, settings, cinematicPhase]);

  // Keyboard input — includes Q/E for Z-axis sidestep
  useEffect(() => {
    const Z_STEP = 0.08;
    const Z_MAX = 2.0;
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
      // Z-axis sidestep: Q = sidestep into background, E = sidestep into foreground
      if (e.key === 'q' || e.key === 'Q') {
        p1ZRef.current = Math.max(-Z_MAX, p1ZRef.current - Z_STEP * 5);
        setP1Z(p1ZRef.current);
      }
      if (e.key === 'e' || e.key === 'E') {
        p1ZRef.current = Math.min(Z_MAX, p1ZRef.current + Z_STEP * 5);
        setP1Z(p1ZRef.current);
      }
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
    // Return Z to center gradually
    const zReturnInterval = setInterval(() => {
      p1ZRef.current *= 0.9;
      if (Math.abs(p1ZRef.current) < 0.05) p1ZRef.current = 0;
      setP1Z(p1ZRef.current);
    }, 50);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      clearInterval(zReturnInterval);
    };
  }, []);

  const p1MaxHealth = p1Fighter.hp;
  const p2MaxHealth = p2Fighter.hp;
  const p1Pct = Math.max(0, Math.min(100, (p1Health / p1MaxHealth) * 100));
  const p2Pct = Math.max(0, Math.min(100, (p2Health / p2MaxHealth) * 100));

  const getHealthBarColor = (pct: number) => {
    if (pct > 50) return '#facc15';
    if (pct > 25) return '#f97316';
    return '#ef4444';
  };

  const getStateLabel = (state: string, anim: string) => {
    if (state === 'KO') return 'KO';
    if (state === 'Hitstun' || state === 'Stunned') return 'HIT';
    if (state === 'Crumple') return 'DOWN';
    if (state === 'Blockstun' || state === 'Guard') return 'BLOCK';
    if (state === 'Startup' || state === 'Attacking') return 'ATK';
    if (state === 'Active') return 'ACTIVE';
    if (state === 'Grappled') return 'GRAPPLE';
    if (state === 'Walking') return 'WALK';
    return anim.toUpperCase();
  };

  const winnerName = winner === 'p1' ? p1Fighter.name : winner === 'p2' ? p2Fighter.name : undefined;

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden touch-none select-none font-mono">

      {/* ── FULL-SCREEN 3D COMBAT VIEWPORT — background layer ── */}
      <div className="absolute inset-0 z-0" style={{ width: '100%', height: '100%' }}>
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
          p1Z={p1Z}
          p2Z={p2Z}
          cinematicPhase={cinematicPhase}
          winnerName={winnerName}
          cameraFov={settings.cameraFov}
          announcerEnabled={settings.soundEnabled}
          damageEvent={damageEvent}
        />
      </div>

      {/* ── HUD OVERLAY: transparent, only visible during fight phase ── */}
      {cinematicPhase === 'fight' && (
        <>
          {/* Health bars + timer — semi-transparent background only on bar rows */}
          <div className="absolute top-0 left-0 right-0 z-30 px-3 pt-2 pb-1 pointer-events-none">
            <div className="flex items-center gap-2">
              {/* P1 health bar */}
              <div className="flex-1 flex flex-col gap-0.5">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[9px] font-black tracking-[0.3em]" style={{ color: p1Color }}>
                    {p1Fighter.name.toUpperCase()}
                  </span>
                  <span className="text-[8px] text-zinc-400">{Math.ceil(p1Health).toLocaleString()}</span>
                </div>
                <div className="h-4 border border-zinc-700/60 bg-black/50 relative overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full transition-all duration-75"
                    style={{ width: `${p1Pct}%`, background: getHealthBarColor(p1Pct), boxShadow: `0 0 8px ${getHealthBarColor(p1Pct)}88` }}
                  />
                  {p1Pct <= 25 && <div className="absolute inset-0 animate-pulse bg-red-500/10" />}
                </div>
                <div className="text-[7px] text-zinc-300 tracking-widest h-3">{getStateLabel(p1State, p1Animation)}</div>
              </div>

              {/* Center: Timer + Round */}
              <div className="flex flex-col items-center shrink-0 w-20">
                <div className="text-[7px] text-zinc-300 tracking-widest text-center leading-tight">{roundLabel ?? 'ROUND 1'}</div>
                <div
                  className="text-2xl font-black tabular-nums leading-none"
                  style={{ color: roundTimer <= 10 ? '#ef4444' : '#facc15', textShadow: roundTimer <= 10 ? '0 0 12px #ef4444' : '0 0 12px #facc15' }}
                >
                  {String(roundTimer).padStart(2, '0')}
                </div>
                <div className="text-[7px] text-zinc-400 tracking-widest">F{frame}</div>
              </div>

              {/* P2 health bar */}
              <div className="flex-1 flex flex-col gap-0.5">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[8px] text-zinc-400 text-right w-full">{Math.ceil(p2Health).toLocaleString()}</span>
                  <span className="text-[9px] font-black tracking-[0.3em] ml-2 whitespace-nowrap" style={{ color: p2Color }}>
                    {p2Fighter.name.toUpperCase()}
                  </span>
                </div>
                <div className="h-4 border border-zinc-700/60 bg-black/50 relative overflow-hidden">
                  <div
                    className="absolute right-0 top-0 h-full transition-all duration-75"
                    style={{ width: `${p2Pct}%`, background: getHealthBarColor(p2Pct), boxShadow: `0 0 8px ${getHealthBarColor(p2Pct)}88` }}
                  />
                  {p2Pct <= 25 && <div className="absolute inset-0 animate-pulse bg-red-500/10" />}
                </div>
                <div className="text-[7px] text-zinc-300 tracking-widest h-3 text-right">{getStateLabel(p2State, p2Animation)}</div>
              </div>
            </div>
          </div>

          {/* ── Special Move Notification ── */}
          {specialMoveNotice && (
            <div
              key={specialMoveNotice.id}
              className="absolute z-40 pointer-events-none"
              style={{
                top: '18%',
                left: specialMoveNotice.player === 'p1' ? '8%' : 'auto',
                right: specialMoveNotice.player === 'p2' ? '8%' : 'auto',
              }}
            >
              <div
                className="px-3 py-1 text-xs font-black tracking-widest uppercase animate-pulse"
                style={{
                  color: '#facc15',
                  textShadow: '0 0 20px #facc15, 0 0 40px #facc1566',
                  border: '1px solid #facc1544',
                  background: 'rgba(0,0,0,0.7)',
                }}
              >
                ⚡ {specialMoveNotice.name}
              </div>
            </div>
          )}

          {/* ── Input Queue Indicator ── */}
          {p1SMRef.current.isRecovering && (
            <div className="absolute bottom-32 left-4 z-40 pointer-events-none">
              <div className="text-[7px] text-yellow-400/70 tracking-widest animate-pulse">QUEUED</div>
            </div>
          )}

          {/* Move Execution Feedback */}
          <MoveExecutionFeedback
            events={feedbackEvents}
            onExpire={(id) => setFeedbackEvents(prev => prev.filter(e => e.id !== id))}
          />

          {/* KO overlay */}
          {ko && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none">
              <div
                className="font-black tracking-widest animate-pulse"
                style={{ fontSize: 'clamp(4rem, 15vw, 10rem)', color: '#facc15', textShadow: '0 0 40px #facc15, 0 0 80px #facc1544', fontFamily: 'monospace' }}
              >
                {roundTimer <= 0 ? 'TIME' : 'K.O.'}
              </div>
            </div>
          )}

          {/* Hit stop flash */}
          {hitStopActive && <div className="absolute inset-0 z-40 pointer-events-none bg-white/5 animate-pulse" />}

          {/* Mobile touch controls — transparent overlay on top of 3D arena */}
          {!ko && <MobileControls inputRef={inputRef} />}

          {/* Controls legend */}
          <div className="absolute bottom-2 left-3 z-30 text-[7px] text-zinc-500 space-y-0.5 pointer-events-none">
            <div>ARROWS: MOVE · Z: LIGHT · X: HEAVY · C: GUARD · V: GRAPPLE · Q/E: SIDESTEP</div>
            <div className="text-zinc-600">SPECIAL: L+L+H or H+H+L</div>
          </div>
        </>
      )}

      {/* Back button */}
      {onBack && cinematicPhase === 'fight' && (
        <button
          onClick={onBack}
          className="absolute top-16 left-3 z-40 text-[8px] text-zinc-400 hover:text-zinc-200 border border-zinc-700/60 hover:border-zinc-500 px-2 py-1 transition-colors bg-black/50"
        >
          ← BACK
        </button>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Map SM ActionState + motion to a display state string */
function mapActionToDisplayState(
  action: import('../engine/combat/FighterStateMachine').ActionState,
  motion: string,
  legacyState: string,
): string {
  switch (action) {
    case 'Attacking': return 'Startup';
    case 'Stunned':   return 'Hitstun';
    case 'Crumple':   return 'Hitstun';
    case 'Guard':     return 'Blockstun';
    case 'Walking':   return 'Neutral';
    case 'Idle':      return legacyState === 'KO' ? 'KO' : 'Neutral';
    default:          return legacyState;
  }
}

/** Simple reactive AI input for P2 */
function buildP2AIInput(
  p2State: string,
  p1Health: number,
  p2Health: number,
): SMInput {
  const now = performance.now();
  const cycle = Math.floor(now / 1200) % 4;
  const isAggressive = p2Health < p1Health;

  if (p2State === 'Hitstun' || p2State === 'Blockstun') {
    return { forward: 0, strafe: 0, light: false, heavy: false, guard: true, crouch: false };
  }

  switch (cycle) {
    case 0: return { forward: -1, strafe: 0, light: false, heavy: false, guard: false, crouch: false };
    case 1: return { forward: 0, strafe: 0, light: true, heavy: false, guard: false, crouch: false };
    case 2: return { forward: 0, strafe: 0, light: false, heavy: isAggressive, guard: !isAggressive, crouch: false };
    case 3: return { forward: -1, strafe: 0, light: false, heavy: false, guard: false, crouch: false };
    default: return { forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false };
  }
}
