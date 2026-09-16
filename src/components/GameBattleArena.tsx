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
  COMMAND_THROW_MOVE,
} from '../engine/combat/FighterStateMachine';
import { FrameDataHitboxSystem } from '../engine/combat/FrameDataHitbox';
import {
  createComboState,
  registerHit,
  tickComboSystem,
  type ComboState,
} from '../engine/combat/ComboSystem';
import type { DebugOverlaySettings, FighterDebugData, ImpactMarker } from '../engine/debug/DebugOverlay';
import { DEFAULT_DEBUG_SETTINGS, computeFrameWindowData, computeRigState } from '../engine/debug/DebugOverlay';
import ComboCounterHUD from './ComboCounterHUD';
import DebugOverlayHUD from './DebugOverlayHUD';
import { MatchRecorderHUD, useMatchRecorder } from './MatchRecorder';
import { InputStringRecorder } from './InputStringRecorder';

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
  /** Stage to load in the combat arena */
  stageId?: import('./StageSelectScreen').StageId;
  /** Debug overlay settings — only passed from practice mode */
  debugSettings?: DebugOverlaySettings;
  /** When true, shows practice-mode label and enables debug settings panel */
  isPracticeMode?: boolean;
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
  stageId = 'urban_night',
  debugSettings = DEFAULT_DEBUG_SETTINGS,
  isPracticeMode = false,
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

  // ── Queued action display state (read from SM each frame) ─────────────────
  const [p1QueuedAction, setP1QueuedAction] = useState<{ type: string; label: string } | null>(null);
  const [p1RecoveryProgress, setP1RecoveryProgress] = useState(0);
  // ── Wakeup buffer display state ───────────────────────────────────────────
  const [p1WakeupBuffered, setP1WakeupBuffered] = useState<string | null>(null);

  // ── Fighter world positions (for hitbox collision) ────────────────────────
  const P1_X = -1.8;
  const P2_X = 1.8;

  // ── Combo system state ────────────────────────────────────────────────────
  const [p1Combo, setP1Combo] = useState<ComboState>(() => createComboState('p1'));
  const [p2Combo, setP2Combo] = useState<ComboState>(() => createComboState('p2'));
  const p1ComboRef = useRef<ComboState>(createComboState('p1'));
  const p2ComboRef = useRef<ComboState>(createComboState('p2'));

  // ── Debug overlay state ───────────────────────────────────────────────────
  const [p1DebugData, setP1DebugData] = useState<FighterDebugData | null>(null);
  const [p2DebugData, setP2DebugData] = useState<FighterDebugData | null>(null);
  const p1ImpactMarkersRef = useRef<ImpactMarker[]>([]);
  const p2ImpactMarkersRef = useRef<ImpactMarker[]>([]);
  const impactMarkerIdRef = useRef(0);

  // ── Animation trigger counters — increment on each new attack to force re-trigger ──
  const [p1AnimTrigger, setP1AnimTrigger] = useState(0);
  const [p2AnimTrigger, setP2AnimTrigger] = useState(0);
  const p1AnimTriggerRef = useRef(0);
  const p2AnimTriggerRef = useRef(0);
  const prevP1AnimRef = useRef<string>('idle');
  const prevP2AnimRef = useRef<string>('idle');

  // ── Match recorder ────────────────────────────────────────────────────────
  const { startRecording, stopRecording, recordFrame, getBuffer, isRecording } = useMatchRecorder();

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

    // Reset combo system
    const freshP1Combo = createComboState('p1');
    const freshP2Combo = createComboState('p2');
    p1ComboRef.current = freshP1Combo;
    p2ComboRef.current = freshP2Combo;
    setP1Combo(freshP1Combo);
    setP2Combo(freshP2Combo);

    // Reset impact markers
    p1ImpactMarkersRef.current = [];
    p2ImpactMarkersRef.current = [];

    // ── Cinematic sequence: sweep → intro → fight ──────────────────────────────
    setCinematicPhase('sweep');
    setArenaReady(false);

    // Start recording when fight begins
    const tRecord = window.setTimeout(() => {
      startRecording();
    }, SWEEP_DURATION_MS + INTRO_DURATION_MS);

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
      window.clearTimeout(tRecord);
      stopRecording();
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

  // ── Grab range visualization state ───────────────────────────────────────
  const [p1GrabRangeVisible, setP1GrabRangeVisible] = useState(false);
  const [p1GrabRangeRadius, setP1GrabRangeRadius] = useState(1.4);
  const [p1GrabRangeHit, setP1GrabRangeHit] = useState(false);

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
        // Tekken 4-limb inputs from bitmask extensions
        lp: (bitmask as any).lp ?? false,
        rp: (bitmask as any).rp ?? false,
        lk: (bitmask as any).lk ?? false,
        rk: (bitmask as any).rk ?? false,
        heatBurst: (bitmask as any).heatBurst ?? false,
        rageArt: (bitmask as any).rageArt ?? false,
        leftThrow: (bitmask as any).leftThrow ?? false,
        rightThrow: (bitmask as any).rightThrow ?? false,
      };

      // ── Update rage art availability based on P1 HP ────────────────────
      const p1HpPct = prevP1HealthRef.current / p1Fighter.hp;
      p1SMRef.current.setRageArtAvailable(p1HpPct);

      // ── Update P1 state machine ────────────────────────────────────────
      const p1SM = p1SMRef.current;
      const p1Hb = p1HitboxRef.current;
      const prevP1Action = p1SM.action;

      const p1NextMotion = p1SM.update(smInput, dt);
      const p1HbWindow = p1SM.getHitboxWindow();
      p1Hb.update(p1HbWindow);

      // ── Command throw grab range detection ────────────────────────────
      if (p1SM.action === 'CommandThrow' && prevP1Action !== 'CommandThrow') {
        // Just entered command throw — check grab range
        const grabResult = p1SM.checkGrabRange(P1_X, P2_X, p2SMRef.current.action);
        setP1GrabRangeVisible(true);
        setP1GrabRangeRadius(grabResult.grabRange);
        setP1GrabRangeHit(grabResult.throwSucceeded);
        p1SM.resolveCommandThrow(grabResult.throwSucceeded);
        if (grabResult.throwSucceeded) {
          // Apply throw to P2 — unblockable, full damage
          const throwDmg = COMMAND_THROW_MOVE.damage ?? 220;
          p2SMRef.current.applyKnockdown();
          p2HitboxRef.current.reset();
          console.log('[Arena] ✅ Command throw connected — damage:', throwDmg);
          if (settings.soundEnabled) sfx.playHeavyHit();
          setDamageEvent({
            count: ++damageEventCountRef.current,
            player: 'p2',
            damage: throwDmg,
            isCounter: false,
            factionColor: p2Color,
          });
          setFeedbackEvents(prev => [...prev.slice(-6), {
            id: ++feedbackIdRef.current,
            moveId: 'commandThrow',
            moveName: 'Command Throw',
            damage: throwDmg,
            isBlocked: false,
            isCounter: false,
            player: 'p1',
            x: 60 + Math.random() * 10,
            y: 20 + Math.random() * 20,
          }]);
        }
        // Hide grab range visualization after 400ms
        setTimeout(() => setP1GrabRangeVisible(false), 400);
      }

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
        // ── Guard system: check if P2 blocks, apply chip damage or full damage ──
        const p1HitMove = p1HbWindow.move;
        const guardResult = p1HitMove
          ? p2SMRef.current.processIncomingHit(p1HitMove)
          : { blocked: false, chipDamage: 0, guardBroken: false, finalDamage: p1Hit.damage };

        const effectiveDamage = guardResult.blocked ? guardResult.finalDamage : p1Hit.damage;

        // ── Combo system: register hit and apply damage scaling ──────────
        const { scaledDamage: p1ScaledDmg, newState: newP1Combo } = registerHit(
          p1ComboRef.current, effectiveDamage, now,
        );
        p1ComboRef.current = newP1Combo;
        setP1Combo({ ...newP1Combo });

        // Apply stun/knockdown to P2 state machine
        const isCrumple = !guardResult.blocked && p1Hit.launch > 0.3;
        if (isCrumple) {
          p2SMRef.current.applyKnockdown();
        } else if (!guardResult.blocked) {
          p2SMRef.current.applyStun(p1Hit.hitstun || 0.3, false);
        }
        // On guard break (throw/unblockable), apply stun even through guard
        if (guardResult.guardBroken) {
          p2SMRef.current.applyStun(p1Hit.hitstun || 0.3, false);
        }
        p2HitboxRef.current.reset();

        const isBlocked = guardResult.blocked;
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
          damage: p1ScaledDmg,
          isCounter,
          factionColor: p2Color,
        });
        setFeedbackEvents(prev => [...prev.slice(-6), {
          id: ++feedbackIdRef.current,
          moveId: p1HbWindow.move?.animation ?? 'hit',
          moveName: p1HbWindow.move?.specialName ?? (p1HbWindow.move?.animation === 'heavyAttack' ? 'Heavy' : 'Light'),
          damage: p1ScaledDmg,
          isBlocked,
          isCounter,
          player: 'p1',
          x: 65 + Math.random() * 10,
          y: 20 + Math.random() * 20,
        }]);

        // ── Debug: add impact marker for P1 hit ──────────────────────────
        if (debugSettings.enabled && debugSettings.showImpactMarkers) {
          const marker: ImpactMarker = {
            id: ++impactMarkerIdRef.current,
            x: 60 + Math.random() * 10,
            y: 25 + Math.random() * 30,
            frame: p1HbWindow.currentFrame,
            timestamp: now,
            damage: p1ScaledDmg,
            isBlocked,
          };
          p1ImpactMarkersRef.current = [...p1ImpactMarkersRef.current.slice(-4), marker];
        }
      }

      // ── Update P2 state machine (AI: simple reactive) ─────────────────
      const p2Hb = p2HitboxRef.current;

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
        // ── Guard system: check if P1 blocks, apply chip damage or full damage ──
        const p2HitMove = p2HbWindow.move;
        const p1GuardResult = p2HitMove
          ? p1SMRef.current.processIncomingHit(p2HitMove)
          : { blocked: false, chipDamage: 0, guardBroken: false, finalDamage: p2Hit.damage };

        const p1EffectiveDamage = p1GuardResult.blocked ? p1GuardResult.finalDamage : p2Hit.damage;

        // ── Combo system: register hit and apply damage scaling ──────────
        const { scaledDamage: p2ScaledDmg, newState: newP2Combo } = registerHit(
          p2ComboRef.current, p1EffectiveDamage, now,
        );
        p2ComboRef.current = newP2Combo;
        setP2Combo({ ...newP2Combo });

        const isCrumple = !p1GuardResult.blocked && p2Hit.launch > 0.3;
        if (isCrumple) {
          p1SMRef.current.applyKnockdown();
        } else if (!p1GuardResult.blocked) {
          p1SMRef.current.applyStun(p2Hit.hitstun || 0.3, false);
        }
        if (p1GuardResult.guardBroken) {
          p1SMRef.current.applyStun(p2Hit.hitstun || 0.3, false);
        }
        p1HitboxRef.current.reset();

        const isBlocked = p1GuardResult.blocked;
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
          damage: p2ScaledDmg,
          isCounter,
          factionColor: p1Color,
        });
        setFeedbackEvents(prev => [...prev.slice(-6), {
          id: ++feedbackIdRef.current,
          moveId: p2HbWindow.move?.animation ?? 'hit',
          moveName: p2HbWindow.move?.specialName ?? (p2HbWindow.move?.animation === 'heavyAttack' ? 'Heavy' : 'Light'),
          damage: p2ScaledDmg,
          isBlocked,
          isCounter,
          player: 'p2',
          x: 25 + Math.random() * 10,
          y: 20 + Math.random() * 20,
        }]);

        // ── Debug: add impact marker for P2 hit ──────────────────────────
        if (debugSettings.enabled && debugSettings.showImpactMarkers) {
          const marker: ImpactMarker = {
            id: ++impactMarkerIdRef.current,
            x: 28 + Math.random() * 10,
            y: 25 + Math.random() * 30,
            frame: p2HbWindow.currentFrame,
            timestamp: now,
            damage: p2ScaledDmg,
            isBlocked,
          };
          p2ImpactMarkersRef.current = [...p2ImpactMarkersRef.current.slice(-4), marker];
        }
      }

      // ── Tick combo expiry ──────────────────────────────────────────────
      const { p1Combo: tickedP1, p2Combo: tickedP2 } = tickComboSystem(
        p1ComboRef.current, p2ComboRef.current, now,
      );
      if (tickedP1 !== p1ComboRef.current) {
        p1ComboRef.current = tickedP1;
        setP1Combo({ ...tickedP1 });
      }
      if (tickedP2 !== p2ComboRef.current) {
        p2ComboRef.current = tickedP2;
        setP2Combo({ ...tickedP2 });
      }

      // ── Update debug overlay data ──────────────────────────────────────
      if (debugSettings.enabled) {
        const p1Action = mapActionToDisplayState(p1SM.action, p1NextMotion, engine.state);
        const p2Action = mapActionToDisplayState(p2SM.action, p2NextMotion, engine.p2State);

        const p1Fw = computeFrameWindowData(p1HbWindow, p1SM.action);
        const p2Fw = computeFrameWindowData(p2HbWindow, p2SM.action);

        const p1Geom = p1Hb.geometry;
        const p2Geom = p2Hb.geometry;

        // ── Compute rig state for debug overlay ──────────────────────────
        const p1CrossfadeState = p1SM.getCrossfadeState();
        const p2CrossfadeState = p2SM.getCrossfadeState();

        // Compute clip duration from current move or default locomotion clip
        const p1ClipDuration = p1HbWindow.move
          ? (p1HbWindow.move.startup + p1HbWindow.move.active + p1HbWindow.move.recovery)
          : 1.0; // default locomotion clip ~1s
        const p2ClipDuration = p2HbWindow.move
          ? (p2HbWindow.move.startup + p2HbWindow.move.active + p2HbWindow.move.recovery)
          : 1.0;

        const p1RigState = computeRigState(
          p1NextMotion,
          p1HbWindow.move ? (p1ClipDuration - (p1HbWindow.move.startup + p1HbWindow.move.active + p1HbWindow.move.recovery - (p1HbWindow.currentFrame / 60))) : 0,
          p1ClipDuration,
          1.0,
          p1CrossfadeState.isCrossfading,
          p1CrossfadeState.progress,
        );

        const p2RigState = computeRigState(
          p2NextMotion,
          p2HbWindow.move ? (p2ClipDuration - (p2HbWindow.move.startup + p2HbWindow.move.active + p2HbWindow.move.recovery - (p2HbWindow.currentFrame / 60))) : 0,
          p2ClipDuration,
          1.0,
          p2CrossfadeState.isCrossfading,
          p2CrossfadeState.progress,
        );

        setP1DebugData({
          player: 'p1',
          frameWindow: p1Fw,
          aabb: p1Geom ? {
            centerX: P1_X + p1Geom.offsetX,
            centerZ: p1ZRef.current + p1Geom.offsetZ,
            width: p1Geom.width,
            depth: p1Geom.depth,
            isActive: p1Hb.isActive,
          } : null,
          impactMarkers: p1ImpactMarkersRef.current,
          actionState: p1Action,
          rigState: p1RigState,
          hurtboxRegions: p1Hb.getHurtboxRegions(),
        });

        setP2DebugData({
          player: 'p2',
          frameWindow: p2Fw,
          aabb: p2Geom ? {
            centerX: P2_X - p2Geom.offsetX,
            centerZ: p2ZRef.current + p2Geom.offsetZ,
            width: p2Geom.width,
            depth: p2Geom.depth,
            isActive: p2Hb.isActive,
          } : null,
          impactMarkers: p2ImpactMarkersRef.current,
          actionState: p2Action,
          rigState: p2RigState,
          hurtboxRegions: p2Hb.getHurtboxRegions(),
        });
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

      // ── Record frame to match recorder ────────────────────────────────────
      recordFrame({
        timestamp: now,
        p1State: p1DisplayState,
        p2State: p2DisplayState,
        p1Animation: p1NextMotion,
        p2Animation: p2NextMotion,
        p1Health: engine.p1Health,
        p2Health: engine.p2Health,
        p1X: P1_X,
        p2X: P2_X,
        p1Z: p1ZRef.current,
        p2Z: p2ZRef.current,
        p1Input: {
          light: inputRef.current.light ?? false,
          heavy: inputRef.current.heavy ?? false,
          guard: inputRef.current.guard ?? false,
          left: inputRef.current.left ?? false,
          right: inputRef.current.right ?? false,
          up: inputRef.current.up ?? false,
          down: inputRef.current.down ?? false,
        },
        roundTimer,
      });

      // ── Increment animation trigger on attack start ──────────────────────
      const isP1Attack = p1NextMotion === 'lightAttack' || p1NextMotion === 'heavyAttack';
      const wasP1Attack = prevP1AnimRef.current === 'lightAttack' || prevP1AnimRef.current === 'heavyAttack';
      if (isP1Attack && (!wasP1Attack || p1NextMotion !== prevP1AnimRef.current)) {
        p1AnimTriggerRef.current += 1;
        setP1AnimTrigger(p1AnimTriggerRef.current);
      }
      const isP2Attack = p2NextMotion === 'lightAttack' || p2NextMotion === 'heavyAttack';
      const wasP2Attack = prevP2AnimRef.current === 'lightAttack' || prevP2AnimRef.current === 'heavyAttack';
      if (isP2Attack && (!wasP2Attack || p2NextMotion !== prevP2AnimRef.current)) {
        p2AnimTriggerRef.current += 1;
        setP2AnimTrigger(p2AnimTriggerRef.current);
      }
      prevP1AnimRef.current = p1NextMotion;
      prevP2AnimRef.current = p2NextMotion;

      // ── Update queued action HUD display ──────────────────────────────────
      setP1QueuedAction(p1SM.getQueuedAction());
      setP1RecoveryProgress(p1SM.getRecoveryProgress());
      setP1WakeupBuffered(p1SM.getBufferedWakeup());

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
  }, [ko, onMatchEnd, sfx, settings, cinematicPhase, p1Color, p2Color, p1Fighter, p2Fighter, debugSettings]);

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

  // Keyboard input — includes Q/E for Z-axis sidestep and Tekken 4-limb keys
  useEffect(() => {
    const Z_STEP = 0.08;
    const Z_MAX = 2.0;
    const onKeyDown = (e: KeyboardEvent) => {
      const i = inputRef.current as any;
      if (e.key === 'ArrowLeft') i.left = true;
      if (e.key === 'ArrowRight') i.right = true;
      if (e.key === 'ArrowUp') i.up = true;
      if (e.key === 'ArrowDown') i.down = true;
      // Legacy L/H/G/GR mapping (kept for compatibility)
      if (e.key === 'z' || e.key === 'Z') { i.light = true; i.lp = true; }
      if (e.key === 'x' || e.key === 'X') { i.heavy = true; i.rp = true; }
      if (e.key === 'c' || e.key === 'C') i.guard = true;
      if (e.key === 'v' || e.key === 'V') i.grapple = true;
      // Tekken 4-limb keys: U=1(LP), I=2(RP), J=3(LK), K=4(RK)
      if (e.key === 'u' || e.key === 'U') i.lp = true;
      if (e.key === 'i' || e.key === 'I') i.rp = true;
      if (e.key === 'j' || e.key === 'J') i.lk = true;
      if (e.key === 'k' || e.key === 'K') i.rk = true;
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
      const i = inputRef.current as any;
      if (e.key === 'ArrowLeft') i.left = false;
      if (e.key === 'ArrowRight') i.right = false;
      if (e.key === 'ArrowUp') i.up = false;
      if (e.key === 'ArrowDown') i.down = false;
      if (e.key === 'z' || e.key === 'Z') { i.light = false; i.lp = false; }
      if (e.key === 'x' || e.key === 'X') { i.heavy = false; i.rp = false; }
      if (e.key === 'c' || e.key === 'C') i.guard = false;
      if (e.key === 'v' || e.key === 'V') i.grapple = false;
      if (e.key === 'u' || e.key === 'U') i.lp = false;
      if (e.key === 'i' || e.key === 'I') i.rp = false;
      if (e.key === 'j' || e.key === 'J') i.lk = false;
      if (e.key === 'k' || e.key === 'K') i.rk = false;
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
    if (state === 'Crumple' || state === 'Knockdown') return 'DOWN';
    if (state === 'WakeupTechRoll') return 'ROLL';
    if (state === 'WakeupBackrise') return 'RISE';
    if (state === 'WakeupQuickStand') return 'STAND';
    if (state === 'Blockstun' || state === 'Guard') return 'BLOCK';
    if (state === 'Startup' || state === 'Attacking') return 'ATK';
    if (state === 'Active') return 'ACTIVE';
    if (state === 'Grappled') return 'GRAPPLE';
    if (state === 'Backdashing') return 'DASH';
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
          stageId={stageId === 'random' ? 'urban_night' : (stageId as 'urban_night' | 'training')}
          p1AnimTrigger={p1AnimTrigger}
          p2AnimTrigger={p2AnimTrigger}
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

          {/* ── Combo Counter HUD ── */}
          <ComboCounterHUD
            p1Combo={p1Combo}
            p2Combo={p2Combo}
            p1Color={p1Color}
            p2Color={p2Color}
          />

          {/* ── Debug Overlay HUD (practice mode only) ── */}
          <DebugOverlayHUD
            settings={debugSettings}
            p1Debug={p1DebugData}
            p2Debug={p2DebugData}
          />

          {/* ── Match Recorder HUD ── */}
          <MatchRecorderHUD
            p1Name={p1Fighter.name}
            p2Name={p2Fighter.name}
            stageName={stageId ?? 'urban_night'}
            getBuffer={getBuffer}
            isRecording={isRecording}
          />

          {/* ── Input String Recorder ── */}
          <InputStringRecorder inputRef={inputRef} />

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

          {/* ── Input Queue / Recovery HUD ── */}
          <div className="absolute bottom-32 left-4 z-40 pointer-events-none flex flex-col gap-1">
            {/* Recovery progress bar */}
            {p1RecoveryProgress > 0 && p1RecoveryProgress < 1 && (
              <div className="flex items-center gap-1.5">
                <div className="text-[7px] text-orange-400/80 tracking-widest font-black">REC</div>
                <div className="w-16 h-1.5 bg-zinc-800/80 border border-zinc-700/60 overflow-hidden">
                  <div
                    className="h-full transition-all duration-75"
                    style={{ width: `${p1RecoveryProgress * 100}%`, background: '#f97316' }}
                  />
                </div>
              </div>
            )}
            {/* Queued action badge */}
            {p1QueuedAction && (
              <div className="flex items-center gap-1.5 animate-pulse">
                <div className="text-[7px] text-yellow-400/80 tracking-widest">QUEUED</div>
                <div
                  className="px-2 py-0.5 text-[9px] font-black tracking-widest border"
                  style={{
                    color: p1QueuedAction.type === 'light' ? '#60a5fa'
                         : p1QueuedAction.type === 'heavy' ? '#f87171'
                         : p1QueuedAction.type === 'guard'? '#a1a1aa' :'#c084fc',
                    borderColor: p1QueuedAction.type === 'light' ? '#3b82f680'
                               : p1QueuedAction.type === 'heavy' ? '#ef444480'
                               : p1QueuedAction.type === 'guard'? '#52525b80' :'#a855f780',
                    background: 'rgba(0,0,0,0.75)',
                  }}
                >
                  {p1QueuedAction.label}
                </div>
              </div>
            )}
            {/* Wakeup buffer badge — shown during knockdown */}
            {p1WakeupBuffered && (
              <div className="flex items-center gap-1.5 animate-pulse">
                <div className="text-[7px] text-cyan-400/80 tracking-widest">WAKEUP</div>
                <div
                  className="px-2 py-0.5 text-[9px] font-black tracking-widest border border-cyan-500/50"
                  style={{ color: '#22d3ee', background: 'rgba(0,0,0,0.75)' }}
                >
                  {p1WakeupBuffered === 'techRoll' ? 'ROLL'
                   : p1WakeupBuffered === 'backrise'? 'RISE' :'STAND'}
                </div>
              </div>
            )}
          </div>

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
            <div>ARROWS: MOVE · Z/U: 1(LP) · X/I: 2(RP) · J: 3(LK) · K: 4(RK) · C: GUARD · V: GRAPPLE · Q/E: SIDESTEP</div>
            <div className="text-zinc-600">COMBOS: U+J=THROW · I+K=THROW · I+J=HEAT BURST · →+C=CMD THROW · SPECIAL: L+L+H or H+H+L</div>
          </div>

          {/* ── Grab Range Visualization ── */}
          {p1GrabRangeVisible && (
            <div
              className="absolute z-40 pointer-events-none"
              style={{
                bottom: '28%',
                left: '20%',
                transform: 'translateX(-50%)',
              }}
            >
              <div
                className="rounded-full border-2 flex items-center justify-center transition-all duration-200"
                style={{
                  width: `${p1GrabRangeRadius * 60}px`,
                  height: `${p1GrabRangeRadius * 60}px`,
                  borderColor: p1GrabRangeHit ? '#22c55e' : '#ef4444',
                  background: p1GrabRangeHit ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.08)',
                  boxShadow: p1GrabRangeHit
                    ? '0 0 20px rgba(34,197,94,0.5)'
                    : '0 0 16px rgba(239,68,68,0.4)',
                }}
              >
                <div
                  className="text-[7px] font-black tracking-widest"
                  style={{ color: p1GrabRangeHit ? '#22c55e' : '#ef4444' }}
                >
                  {p1GrabRangeHit ? 'GRAB!' : 'WHIFF'}
                </div>
              </div>
              <div
                className="text-center text-[6px] mt-1 font-black tracking-widest"
                style={{ color: p1GrabRangeHit ? '#22c55e' : '#ef4444' }}
              >
                CMD THROW · {p1GrabRangeRadius.toFixed(1)}u
              </div>
            </div>
          )}
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
    case 'Attacking':          return 'Startup';
    case 'Stunned':            return 'Hitstun';
    case 'Crumple':            return 'Hitstun';
    case 'Guard':              return 'Blockstun';
    case 'Walking':            return 'Walking';
    case 'Backdashing':        return 'Backdashing';
    case 'Knockdown':          return 'Knockdown';
    case 'WakeupTechRoll':     return 'WakeupTechRoll';
    case 'WakeupBackrise':     return 'WakeupBackrise';
    case 'WakeupQuickStand':   return 'WakeupQuickStand';
    case 'Idle':               return legacyState === 'KO' ? 'KO' : 'Neutral';
    default:                   return legacyState;
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
