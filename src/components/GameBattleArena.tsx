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
import PostMatchScreen, { type RoundResult } from './PostMatchScreen';

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
import { useMatchRecorder, PauseMenuRecorder, saveReplayToSupabase } from './MatchRecorder';
import { InputStringRecorder } from './InputStringRecorder';
import { useAuth } from '../contexts/AuthContext';
// ── Locomotion + bone hitbox systems ─────────────────────────────────────────
import { LocomotionSystem, ATTACK_ROOT_MOTION_PROFILES } from '../engine/locomotion/LocomotionSystem';
import { createTekkenStick } from '../engine/combat/TekkenInput';
import { BoneHitboxSystem, HIT_STOP_DURATIONS, HIT_STOP_DEFAULT_MS } from '../engine/locomotion/BoneHitboxSystem';
// ── Announcer system ──────────────────────────────────────────────────────────
import { getAnnouncerSystem } from '../engine/announcer/AnnouncerSystem';
// ── Ki Charge system ──────────────────────────────────────────────────────────
import { createKiChargeState, tickKiCharge, applyKiChargeCounterHit, type KiChargeState,  } from '../engine/combat/KiChargeSystem';
// ── Decoupled combat state tick ───────────────────────────────────────────────
import { createCombatMatchState, tickCombatState, checkSidestepWhiff, type CombatMatchState,  } from '../engine/combat/CombatStateTick';
// ── Wall system ───────────────────────────────────────────────────────────────
// ── Stage config & arena state ────────────────────────────────────────────────
import {
  resolveStageConfig,
  createArenaCombatState,
  tickArenaState,
  type ArenaCombatState,
} from '../engine/combat/StageConfig';
// ── Stage Manager — multi-tier transitions, train hazard, ledge throws, wall breaks ──
import { createStageManagerState, tickTrainHazard, tickFloorBreak, tickLedgeThrow, tickDestructibleWalls, tickHazardBounce, triggerFloorBreak, executeLedgeThrow, applyWallBreak, applyHazardBounce, checkLedgeThrowOverride, checkWallBreak, checkHazardVolume, TRAIN_HIT_DAMAGE, TRAIN_PLATFORM_Y, type StageManagerState,  } from '../engine/combat/StageManager';
// ── Heat Burst / Power Crush / Rage Art ──────────────────────────────────────
import { type HeatState, type PowerCrushState, type RageArtState,  } from '../engine/combat/HeatBurstSystem';
// ── Directional throw system ──────────────────────────────────────────────────
import { checkThrowRange, detectThrowInput, getThrowDamage, THROW_CATALOG,  } from '../engine/combat/DirectionalThrowSystem';
// ── Global Audio Manager ──────────────────────────────────────────────────────
import { getGlobalAudioManager } from '../engine/audio/GlobalAudioManager';
// ── Hit Effect System ─────────────────────────────────────────────────────────
import { type HitEffectPool } from '../engine/combat/HitEffectSystem';

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
// Post-match screen delay after KO/victory cinematic
const POST_MATCH_DELAY_MS = 3600;

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

  // ── Post-match screen state ───────────────────────────────────────────────
  const [showPostMatch, setShowPostMatch] = useState(false);
  const [matchCondition, setMatchCondition] = useState<'KO' | 'TIMEOUT' | 'PERFECT'>('KO');
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const roundStartTimeRef = useRef<number>(Date.now());

  // ── Knockdown event for dust VFX ─────────────────────────────────────────
  const [knockdownEvent, setKnockdownEvent] = useState<{ count: number; player: 'p1' | 'p2' } | undefined>(undefined);
  const knockdownEventCountRef = useRef(0);

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

  // ── Locomotion systems (one per fighter) ─────────────────────────────────
  const p1LocoRef = useRef<LocomotionSystem>(new LocomotionSystem(-1.8, 0, 1));
  const p2LocoRef = useRef<LocomotionSystem>(new LocomotionSystem(1.8, 0, -1));
  const p1StickRef = useRef(createTekkenStick());
  const p1JumpYRef = useRef(0);

  // ── Bone hitbox systems (populated by FighterMesh callbacks) ─────────────
  const p1BoneHitboxRef = useRef<BoneHitboxSystem | null>(null);
  const p2BoneHitboxRef = useRef<BoneHitboxSystem | null>(null);

  // ── Hit-stop state ────────────────────────────────────────────────────────
  const hitStopTimerRef = useRef<number>(0);
  const hitStopActiveRef = useRef<boolean>(false);

  // ── Ki Charge state (one per fighter) ────────────────────────────────────
  const [p1KiCharge, setP1KiCharge] = useState<KiChargeState>(createKiChargeState());
  const [p2KiCharge, setP2KiCharge] = useState<KiChargeState>(createKiChargeState());
  const p1KiChargeRef = useRef<KiChargeState>(createKiChargeState());
  const p2KiChargeRef = useRef<KiChargeState>(createKiChargeState());

  // ── Decoupled combat state (Night Sky Engine pattern) ────────────────────
  const combatStateRef = useRef<CombatMatchState>(
    createCombatMatchState(p1Fighter.hp, p2Fighter.hp)
  );

  // ── Arena combat state — wiped and rebuilt on every stage load ────────────
  const arenaCombatStateRef = useRef<ArenaCombatState>(createArenaCombatState(stageId));
  const [arenaState, setArenaState] = useState<ArenaCombatState>(() => createArenaCombatState(stageId));
  const [ringOutNotice, setRingOutNotice] = useState<{ player: 'p1' | 'p2'; count: number } | null>(null);
  const ringOutNoticeCountRef = useRef(0);
  const [floorBreakNotice, setFloorBreakNotice] = useState<{ player: 'p1' | 'p2'; level: string; count: number } | null>(null);
  const floorBreakNoticeCountRef = useRef(0);
  const [hazardNotice, setHazardNotice] = useState<string>('');

  // ── Stage Manager — multi-tier, train, ledge throws, wall breaks ──────────
  const stageManagerRef = useRef<StageManagerState>(
    createStageManagerState(stageId, p1Fighter.hp, p2Fighter.hp)
  );
  const [trainWarningActive, setTrainWarningActive] = useState(false);
  const [trainCrossing, setTrainCrossing] = useState(false);
  const [trainX, setTrainX] = useState(-20);
  const [p1OnTracks, setP1OnTracks] = useState(false);
  const [p2OnTracks, setP2OnTracks] = useState(false);
  const [p1VaultPrompt, setP1VaultPrompt] = useState(false);
  const [p2VaultPrompt, setP2VaultPrompt] = useState(false);
  const [floorBreakPhase, setFloorBreakPhase] = useState<string>('idle');
  const [debrisPositions, setDebrisPositions] = useState<Array<{ x: number; y: number; z: number }>>([]);
  const [ledgeThrowActive, setLedgeThrowActive] = useState(false);
  const [wallShatterLeft, setWallShatterLeft] = useState(false);
  const [wallShatterRight, setWallShatterRight] = useState(false);
  const [hazardBounceNotice, setHazardBounceNotice] = useState<string>('');
  const hazardBounceNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // P1 Y position for track detection (subway stage)
  const p1YRef = useRef(0);
  const p2YRef = useRef(0);

  // ── Announcer system ──────────────────────────────────────────────────────
  const announcerRef = useRef(getAnnouncerSystem({
    p1Name: p1Fighter.name,
    p2Name: p2Fighter.name,
    enabled: settings.soundEnabled,
  }));

  // Track announcer state to avoid double-firing
  const announcerFiredRef = useRef({
    getReady: false,
    round: false,
    fight: false,
    ko: false,
  });

  // ── Z-axis sidestep state ─────────────────────────────────────────────────
  const p1SidestepZRef = useRef(0);
  const p2SidestepZRef = useRef(0);

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

  // ── Locomotion velocity state — fed from FSM each frame for velocity-gated blending ──
  const [p1LocomotionVelocity, setP1LocomotionVelocity] = useState<{ forward: number; strafe: number }>({ forward: 0, strafe: 0 });
  const [p2LocomotionVelocity, setP2LocomotionVelocity] = useState<{ forward: number; strafe: number }>({ forward: 0, strafe: 0 });
  const p1VelRef = useRef<{ forward: number; strafe: number }>({ forward: 0, strafe: 0 });
  const p2VelRef = useRef<{ forward: number; strafe: number }>({ forward: 0, strafe: 0 });

  // ── Match recorder ────────────────────────────────────────────────────────
  const { startRecording, stopRecording, recordFrame, getBuffer, isRecording } = useMatchRecorder();
  const { user } = useAuth();

  // ── Cinematic phase state ─────────────────────────────────────────────────
  const [cinematicPhase, setCinematicPhase] = useState<CinematicPhase>('sweep');

  // ── Pause menu state ──────────────────────────────────────────────────────
  const [isPaused, setIsPaused] = useState(false);
  const [pauseTab, setPauseTab] = useState<'menu' | 'replay'>('menu');

  // ESC key toggles pause (only during fight phase, not during KO)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && cinematicPhase === 'fight' && !ko) {
        setIsPaused(p => !p);
        setPauseTab('menu');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cinematicPhase, ko]);

  // Pause/resume game loop via ref flag
  const isPausedRef = useRef(false);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // ── Position state (X and Z axes) ────────────────────────────────────────
  const [p1X, setP1X] = useState(-1.8);
  const [p1Y, setP1Y] = useState(0);
  const [p2X, setP2X] = useState(1.8);
  const [p1Z, setP1Z] = useState(0);
  const [p2Z, setP2Z] = useState(0);
  const p1XRef = useRef(-1.8);
  const p2XRef = useRef(1.8);
  const p1ZRef = useRef(0);
  const p2ZRef = useRef(0);

  useEffect(() => {
    const held = new Set<string>();
    const apply = () => {
      const i = inputRef.current as any;
      i.left = held.has("KeyA") || held.has("ArrowLeft");
      i.right = held.has("KeyD") || held.has("ArrowRight");
      i.up = held.has("KeyW") || held.has("ArrowUp");
      i.down = held.has("KeyS") || held.has("ArrowDown");
    };
    window.__controlsTest = {
      getYaw: () => -p1XRef.current,
      getSpeed: () =>
        Math.abs(p1VelRef.current.forward) +
        Math.abs(p1VelRef.current.strafe) +
        Math.abs(p1XRef.current + 1.8) +
        Math.abs(p1ZRef.current),
      setKeys: (codes: string[]) => {
        held.clear();
        for (const c of codes) held.add(c);
        apply();
      },
    };
    return () => {
      delete window.__controlsTest;
    };
  }, []);

  // ── Damage event state ────────────────────────────────────────────────────
  const [damageEvent, setDamageEvent] = useState<{
    count: number; player: 'p1' | 'p2'; damage: number; isCounter: boolean; factionColor: string;
  } | undefined>(undefined);
  const damageEventCountRef = useRef(0);

  // ── Wall-splat event state ────────────────────────────────────────────────
  const [wallSplatEvent, setWallSplatEvent] = useState<{
    count: number; player: 'p1' | 'p2'; wall: 'left' | 'right';
  } | undefined>(undefined);
  const wallSplatEventCountRef = useRef(0);

  // ── Heat Burst event state ────────────────────────────────────────────────
  const [heatBurstEvent, setHeatBurstEvent] = useState<{
    count: number; player: 'p1' | 'p2';
  } | undefined>(undefined);
  const heatBurstEventCountRef = useRef(0);

  // ── Rage Art event state ──────────────────────────────────────────────────
  const [rageArtEvent, setRageArtEvent] = useState<{
    count: number; player: 'p1' | 'p2';
  } | undefined>(undefined);
  const rageArtEventCountRef = useRef(0);

  // ── Camera shake offset from hit effect system ────────────────────────────
  const [cameraShakeOffset, setCameraShakeOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // ── Heat / Power Crush / Rage Art HUD state ───────────────────────────────
  const [p1HeatActive, setP1HeatActive] = useState(false);
  const [p2HeatActive, setP2HeatActive] = useState(false);
  const [p1RageArtAvailable, setP1RageArtAvailable] = useState(false);
  const [p2RageArtAvailable, setP2RageArtAvailable] = useState(false);
  const [p1PowerCrushActive, setP1PowerCrushActive] = useState(false);
  const [p2PowerCrushActive, setP2PowerCrushActive] = useState(false);

  // ── Global Audio Manager ──────────────────────────────────────────────────
  const audioManagerRef = useRef(getGlobalAudioManager());

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
    setShowPostMatch(false);
    roundStartTimeRef.current = Date.now();
    setRoundResults([]);
    setP1Z(0); setP2Z(0);
    p1ZRef.current = 0; p2ZRef.current = 0;
    // Reset fighter positions
    setP1X(-1.8); setP2X(1.8);
    p1XRef.current = -1.8; p2XRef.current = 1.8;
    p1LocoRef.current = new LocomotionSystem(-1.8, 0, 1);
    p2LocoRef.current = new LocomotionSystem(1.8, 0, -1);

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

    // ── Wipe and rebuild arena combat state for this stage ─────────────────
    const freshArenaState = createArenaCombatState(stageId);
    arenaCombatStateRef.current = freshArenaState;
    setArenaState(freshArenaState);
    setRingOutNotice(null);
    setFloorBreakNotice(null);
    setHazardNotice(freshArenaState.config.hazardLabel);

    // ── Wipe and rebuild Stage Manager state ──────────────────────────────
    const freshStageManager = createStageManagerState(stageId, p1Fighter.hp, p2Fighter.hp);
    stageManagerRef.current = freshStageManager;
    setTrainWarningActive(false);
    setTrainCrossing(false);
    setTrainX(-20);
    setP1OnTracks(false);
    setP2OnTracks(false);
    setP1VaultPrompt(false);
    setP2VaultPrompt(false);
    setFloorBreakPhase('idle');
    setDebrisPositions([]);
    setLedgeThrowActive(false);
    setWallShatterLeft(false);
    setWallShatterRight(false);
    setHazardBounceNotice('');

    // ── Init Global Audio Manager ──────────────────────────────────────────
    const audioManager = audioManagerRef.current;
    audioManager.init({ enabled: settings.soundEnabled }).then(() => {
      // Play character select BGM during sweep/intro
      audioManager.playBGM('character_select', 800);
    });

    // ── Cinematic sequence: sweep → intro → fight ──────────────────────────────
    setCinematicPhase('sweep');
    setArenaReady(false);

    // Start recording when fight begins
    const tRecord = window.setTimeout(() => {
      startRecording();
    }, SWEEP_DURATION_MS + INTRO_DURATION_MS);

    const t1 = window.setTimeout(() => {
      setCinematicPhase('intro');
      // Preload combat audio during VS/intro screen
      audioManager.preloadCombatAudio(stageId);
    }, SWEEP_DURATION_MS);

    const t2 = window.setTimeout(() => {
      setCinematicPhase('fight');
      setArenaReady(true);
      // Crossfade to stage BGM — use stage config track key
      const stageCfg = resolveStageConfig(stageId);
      audioManager.playBGM(`stage_${stageCfg.bgmTrack}`, 1200);
    }, SWEEP_DURATION_MS + INTRO_DURATION_MS);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(tRecord);
      stopRecording();
      audioManager.stopBGM(500);
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

  // ── Announcer: fire "Get Ready" on mount, "Round X" on intro, "Fight!" on fight ──
  useEffect(() => {
    const announcer = announcerRef.current;
    announcer.updateConfig({ enabled: settings.soundEnabled, p1Name: p1Fighter.name, p2Name: p2Fighter.name });

    // Reset fired flags on new match
    announcerFiredRef.current = { getReady: false, round: false, fight: false, ko: false };

    // "Get ready for the next battle." — fires immediately on VS/loading screen
    const tGetReady = window.setTimeout(() => {
      if (!announcerFiredRef.current.getReady) {
        announcerFiredRef.current.getReady = true;
        announcer.fire('getReady');
      }
    }, 200);

    // "Round 1!" — fires when intro cinematic starts
    const tRound = window.setTimeout(() => {
      if (!announcerFiredRef.current.round) {
        announcerFiredRef.current.round = true;
        announcer.fire('round1');
      }
    }, SWEEP_DURATION_MS + 300);

    // "Fight!" — fires when player control is unlocked
    const tFight = window.setTimeout(() => {
      if (!announcerFiredRef.current.fight) {
        announcerFiredRef.current.fight = true;
        announcer.fire('fight');
      }
    }, SWEEP_DURATION_MS + INTRO_DURATION_MS + 600);

    return () => {
      window.clearTimeout(tGetReady);
      window.clearTimeout(tRound);
      window.clearTimeout(tFight);
    };
  }, [p1Fighter, p2Fighter, settings.soundEnabled]);

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
      const cmd = p1StickRef.current.resolve(
        { left: !!bitmask.left, right: !!bitmask.right, up: !!bitmask.up, down: !!bitmask.down },
        now,
      );
      const smInput: SMInput = {
        forward: cmd.forward,
        strafe: cmd.strafe,
        light: bitmask.light ?? false,
        heavy: bitmask.heavy ?? false,
        guard: bitmask.guard ?? false,
        crouch: cmd.crouch,
        grapple: bitmask.grapple ?? false,
        escape: bitmask.escape ?? false,
        lp: (bitmask as any).lp ?? false,
        rp: (bitmask as any).rp ?? false,
        lk: (bitmask as any).lk ?? false,
        rk: (bitmask as any).rk ?? false,
        heatBurst: (bitmask as any).heatBurst ?? false,
        rageArt: (bitmask as any).rageArt ?? false,
        leftThrow: (bitmask as any).leftThrow ?? false,
        rightThrow: (bitmask as any).rightThrow ?? false,
        jump: cmd.jump,
        dashing: cmd.dashing,
        backdashing: cmd.backdashing,
        running: cmd.running,
      };
      if (!smInput.strafe) {
        if ((bitmask as any).sidestepBg) smInput.strafe = -1;
        else if ((bitmask as any).sidestepFg) smInput.strafe = 1;
      }

      // ── Ki Charge detection (1+2+3+4 = all four limbs) ────────────────
      const p1KiInput = {
        lp: smInput.lp, rp: smInput.rp, lk: smInput.lk, rk: smInput.rk,
      };
      const prevP1KiActive = p1KiChargeRef.current.active;
      const newP1KiCharge = tickKiCharge(
        p1KiChargeRef.current,
        p1KiInput,
        false, // attackLanded resolved below
        dt,
      );
      if (!prevP1KiActive && newP1KiCharge.active) {
        // Just activated Ki Charge — fire announcer
        announcerRef.current.fire('kiCharge');
        setSpecialMoveNotice({ name: 'Ki Charge!', player: 'p1', id: ++specialNoticeIdRef.current });
        setTimeout(() => setSpecialMoveNotice(null), 2000);
        console.log('[Arena] ⚡ P1 Ki Charge activated');
      }
      p1KiChargeRef.current = newP1KiCharge;
      setP1KiCharge({ ...newP1KiCharge });

      // ── Tick decoupled combat state (Night Sky Engine pattern) ─────────
      combatStateRef.current = tickCombatState(
        combatStateRef.current,
        p1KiInput,
        {},
        dt,
      );

      // ── Tick arena combat state (stage boundaries, ring-out, floor-break, hazard) ──
      const p1X = p1XRef.current;
      const p2X = p2XRef.current;
      const prevArena = arenaCombatStateRef.current;
      const newArena = tickArenaState(
        prevArena,
        p1X,
        p2X,
        0, // hit damage passed per-hit below
        0,
        false,
        false,
      );
      arenaCombatStateRef.current = newArena;

      // Ring-out KO detection
      if (newArena.p1RingOut && !prevArena.p1RingOut) {
        setRingOutNotice({ player: 'p1', count: ++ringOutNoticeCountRef.current });
        // Treat ring-out as instant KO for P1
        setP1Health(0);
      }
      if (newArena.p2RingOut && !prevArena.p2RingOut) {
        setRingOutNotice({ player: 'p2', count: ++ringOutNoticeCountRef.current });
        setP2Health(0);
      }

      // Floor-break notification
      if (newArena.p1FloorBreakPending && !prevArena.p1FloorBreakPending) {
        const lvl = newArena.config.levels[newArena.p1LevelIndex];
        setFloorBreakNotice({ player: 'p1', level: lvl?.label ?? 'LOWER LEVEL', count: ++floorBreakNoticeCountRef.current });
        arenaCombatStateRef.current = { ...newArena, p1FloorBreakPending: false };
      }
      if (newArena.p2FloorBreakPending && !prevArena.p2FloorBreakPending) {
        const lvl = newArena.config.levels[newArena.p2LevelIndex];
        setFloorBreakNotice({ player: 'p2', level: lvl?.label ?? 'LOWER LEVEL', count: ++floorBreakNoticeCountRef.current });
        arenaCombatStateRef.current = { ...newArena, p2FloorBreakPending: false };
      }

      // Hazard damage (applied per second)
      if (newArena.p1InHazard) {
        const hazardDmg = newArena.config.levels[newArena.p1LevelIndex]?.hazardDamagePerSec ?? 0;
        if (hazardDmg > 0) {
          setP1Health(h => Math.max(0, h - hazardDmg * dt));
        }
      }
      if (newArena.p2InHazard) {
        const hazardDmg = newArena.config.levels[newArena.p2LevelIndex]?.hazardDamagePerSec ?? 0;
        if (hazardDmg > 0) {
          setP2Health(h => Math.max(0, h - hazardDmg * dt));
        }
      }

      // ── Stage Manager tick — train hazard, floor break, ledge throw, wall breaks ──
      const sm = stageManagerRef.current;
      const stageCfg = sm.config;

      // ── Train hazard tick (Subway stage — MDickie-style independent RNG) ──
      if (sm.trainHazard.enabled) {
        const p1InputUp = (inputRef.current as any).up ?? false;
        const trainResult = tickTrainHazard(
          sm.trainHazard,
          dt,
          p1YRef.current,
          p2YRef.current,
          p1InputUp,
          false, // P2 AI vault handled below
        );
        stageManagerRef.current = { ...sm, trainHazard: trainResult.state };

        // Sync HUD state
        setTrainWarningActive(trainResult.state.warningActive);
        setTrainCrossing(trainResult.state.trainCrossing);
        setTrainX(trainResult.state.trainX);
        setP1OnTracks(trainResult.state.p1OnTracks);
        setP2OnTracks(trainResult.state.p2OnTracks);
        setP1VaultPrompt(trainResult.state.p1OnTracks && !trainResult.state.p1VaultActive);
        setP2VaultPrompt(trainResult.state.p2OnTracks && !trainResult.state.p2VaultActive);

        // Fire warning audio/visual
        if (trainResult.fireWarning) {
          audioManagerRef.current.playSFX('train_horn');
          console.log('[Train] 🚇 WARNING — train incoming in 2 seconds!');
        }

        // Train hit — apply massive unblockable damage
        if (trainResult.p1TrainHit) {
          const trainDmg = Math.round(p1Fighter.hp * TRAIN_HIT_DAMAGE);
          setP1Health(h => Math.max(0, h - trainDmg));
          audioManagerRef.current.playSFX('heavy_hit');
          audioManagerRef.current.playVOX('pain_grunt');
          setDamageEvent({
            count: ++damageEventCountRef.current,
            player: 'p1',
            damage: trainDmg,
            isCounter: false,
            factionColor: '#f59e0b',
          });
          // Force P1 back to platform
          p1YRef.current = TRAIN_PLATFORM_Y;
          p1SMRef.current.applyKnockdown();
          console.log('[Train] 🚇 P1 HIT BY TRAIN — damage:', trainDmg);
        }
        if (trainResult.p2TrainHit) {
          const trainDmg = Math.round(p2Fighter.hp * TRAIN_HIT_DAMAGE);
          setP2Health(h => Math.max(0, h - trainDmg));
          audioManagerRef.current.playSFX('heavy_hit');
          audioManagerRef.current.playVOX('pain_grunt');
          setDamageEvent({
            count: ++damageEventCountRef.current,
            player: 'p2',
            damage: trainDmg,
            isCounter: false,
            factionColor: '#f59e0b',
          });
          p2YRef.current = TRAIN_PLATFORM_Y;
          p2SMRef.current.applyKnockdown();
          console.log('[Train] 🚇 P2 HIT BY TRAIN — damage:', trainDmg);
        }

        if (trainResult.crossingEnded) {
          console.log('[Train] 🚇 Train passed. Next crossing in', Math.round(trainResult.state.nextCrossingInterval), 's');
        }
      }

      // ── Floor break tick ──────────────────────────────────────────────────
      if (sm.floorBreak.phase !== 'idle') {
        const fbResult = tickFloorBreak(sm.floorBreak, dt);
        stageManagerRef.current = { ...stageManagerRef.current, floorBreak: fbResult.state };
        setFloorBreakPhase(fbResult.state.phase);
        setDebrisPositions(fbResult.state.debrisPositions.map(d => ({ x: d.x, y: d.y, z: d.z })));

        if (fbResult.applyLandingDamage && sm.floorBreak.triggerFighter) {
          const victim = sm.floorBreak.triggerFighter;
          const landDmg = fbResult.state.landingDamage;
          if (victim === 'p1') {
            setP1Health(h => Math.max(0, h - landDmg));
            setDamageEvent({ count: ++damageEventCountRef.current, player: 'p1', damage: landDmg, isCounter: false, factionColor: '#f97316' });
          } else {
            setP2Health(h => Math.max(0, h - landDmg));
            setDamageEvent({ count: ++damageEventCountRef.current, player: 'p2', damage: landDmg, isCounter: false, factionColor: '#f97316' });
          }
          audioManagerRef.current.playSFX('floor_slam');
          console.log('[FloorBreak] 💥 Landing damage applied to', victim, ':', landDmg);
        }

        if (fbResult.transitionComplete) {
          console.log('[FloorBreak] ✅ Stage transition complete — input restored');
        }
      }

      // ── Ledge throw tick ──────────────────────────────────────────────────
      if (sm.ledgeThrow.active) {
        const ltResult = tickLedgeThrow(sm.ledgeThrow);
        stageManagerRef.current = { ...stageManagerRef.current, ledgeThrow: ltResult.state };
        setLedgeThrowActive(ltResult.state.active);

        if (ltResult.koVictim) {
          // Ledge throw KO — instant ring-out
          if (ltResult.koVictim === 'p1') {
            setP1Health(0);
            setRingOutNotice({ player: 'p1', count: ++ringOutNoticeCountRef.current });
          } else {
            setP2Health(0);
            setRingOutNotice({ player: 'p2', count: ++ringOutNoticeCountRef.current });
          }
          audioManagerRef.current.playSFX('floor_slam');
          announcerRef.current.fire('ko');
          console.log('[LedgeThrow] 🎯 Ring-out KO:', ltResult.koVictim);
        }
      }

      // ── Destructible wall tick ────────────────────────────────────────────
      {
        const newWalls = tickDestructibleWalls(sm.destructibleWalls);
        stageManagerRef.current = { ...stageManagerRef.current, destructibleWalls: newWalls };
        setWallShatterLeft(newWalls.leftShatterActive);
        setWallShatterRight(newWalls.rightShatterActive);
      }

      // ── Hazard bounce tick ────────────────────────────────────────────────
      {
        const newBounce = tickHazardBounce(sm.hazardBounce);
        stageManagerRef.current = { ...stageManagerRef.current, hazardBounce: newBounce };

        // Apply bounce position correction — shove fighters back to center
        if (newBounce.p1BounceActive && newBounce.p1BounceFrames > 0) {
          const lerpSpeed = 0.15;
          const newX = p1XRef.current + (newBounce.p1TargetX - p1XRef.current) * lerpSpeed;
          p1XRef.current = newX;
          p1LocoRef.current.clampX(newX);
          setP1X(newX);
        }
        if (newBounce.p2BounceActive && newBounce.p2BounceFrames > 0) {
          const lerpSpeed = 0.15;
          const newX = p2XRef.current + (newBounce.p2TargetX - p2XRef.current) * lerpSpeed;
          p2XRef.current = newX;
          p2LocoRef.current.clampX(newX);
          setP2X(newX);
        }
      }

      // ── Proximity ledge-throw override check ──────────────────────────────
      // Before executing a standard throw, check if attacker is near the ring-out edge
      if (!sm.ledgeThrow.active && stageCfg.ringOutEnabled && isFinite(stageCfg.boundaryX)) {
        const throwInputDetected = (inputRef.current as any).grapple ?? false;
        if (throwInputDetected && p1SMRef.current.action === 'Idle') {
          const isLedgeOverride = checkLedgeThrowOverride(
            p1XRef.current, p2XRef.current,
            stageCfg.boundaryX, stageCfg.ringOutEnabled,
          );
          if (isLedgeOverride) {
            const ledgeState = executeLedgeThrow('p2');
            stageManagerRef.current = { ...stageManagerRef.current, ledgeThrow: ledgeState };
            setLedgeThrowActive(true);
            setSpecialMoveNotice({ name: 'LEDGE THROW!', player: 'p1', id: ++specialNoticeIdRef.current });
            setTimeout(() => setSpecialMoveNotice(null), 2000);
            audioManagerRef.current.playSFX('throw_connect');
            console.log('[LedgeThrow] 🎯 Ledge throw override activated!');
          }
        }
      }

      // ── Destructible wall break check ─────────────────────────────────────
      if (stageCfg.hasDestructibleWalls) {
        const smSnap = stageManagerRef.current;
        // Check if P2 was just knocked into a wall with high force
        const p2WallState = combatStateRef.current.p2.wallSplat;
        if (p2WallState.isSplatted && p2WallState.wall) {
          const knockbackForce = Math.abs(combatStateRef.current.p2.velocityX ?? 0) * 1000;
          if (checkWallBreak(knockbackForce, p2WallState.wall, smSnap.destructibleWalls, true)) {
            const newWalls = applyWallBreak(smSnap.destructibleWalls, p2WallState.wall);
            stageManagerRef.current = { ...stageManagerRef.current, destructibleWalls: newWalls };
            setSpecialMoveNotice({ name: 'WALL BREAK!', player: 'p1', id: ++specialNoticeIdRef.current });
            setTimeout(() => setSpecialMoveNotice(null), 2000);
            audioManagerRef.current.playSFX('wall_splat');
            console.log('[WallBreak] 💥 Wall broken:', p2WallState.wall);
          }
        }
        // Same for P1
        const p1WallState = combatStateRef.current.p1.wallSplat;
        if (p1WallState.isSplatted && p1WallState.wall) {
          const knockbackForce = Math.abs(combatStateRef.current.p1.velocityX ?? 0) * 1000;
          if (checkWallBreak(knockbackForce, p1WallState.wall, smSnap.destructibleWalls, true)) {
            const newWalls = applyWallBreak(smSnap.destructibleWalls, p1WallState.wall);
            stageManagerRef.current = { ...stageManagerRef.current, destructibleWalls: newWalls };
            setSpecialMoveNotice({ name: 'WALL BREAK!', player: 'p2', id: ++specialNoticeIdRef.current });
            setTimeout(() => setSpecialMoveNotice(null), 2000);
            audioManagerRef.current.playSFX('wall_splat');
          }
        }
      }

      // ── Crowd / fence hazard bounce check ─────────────────────────────────
      if (stageCfg.hazardVolume) {
        const smSnap = stageManagerRef.current;
        const hv = stageCfg.hazardVolume;
        const p1InKnockback = combatStateRef.current.p1.stun.isHitStun;
        const p2InKnockback = combatStateRef.current.p2.stun.isHitStun;

        if (!smSnap.hazardBounce.p1BounceActive && checkHazardVolume(p1XRef.current, hv.triggerX, p1InKnockback)) {
          const newBounce = applyHazardBounce(smSnap.hazardBounce, 'p1', p1XRef.current);
          stageManagerRef.current = { ...stageManagerRef.current, hazardBounce: newBounce };
          const chipDmg = Math.round(p1Fighter.hp * hv.chipDamage);
          setP1Health(h => Math.max(0, h - chipDmg));
          setHazardBounceNotice(hv.label);
          if (hazardBounceNoticeTimerRef.current) clearTimeout(hazardBounceNoticeTimerRef.current);
          hazardBounceNoticeTimerRef.current = setTimeout(() => setHazardBounceNotice(''), 1500);
          audioManagerRef.current.playSFX('wall_splat');
          console.log('[HazardBounce] 🔥 P1 bounced by hazard volume:', hv.label);
        }
        if (!smSnap.hazardBounce.p2BounceActive && checkHazardVolume(p2XRef.current, hv.triggerX, p2InKnockback)) {
          const newBounce = applyHazardBounce(smSnap.hazardBounce, 'p2', p2XRef.current);
          stageManagerRef.current = { ...stageManagerRef.current, hazardBounce: newBounce };
          const chipDmg = Math.round(p2Fighter.hp * hv.chipDamage);
          setP2Health(h => Math.max(0, h - chipDmg));
          setHazardBounceNotice(hv.label);
          if (hazardBounceNoticeTimerRef.current) clearTimeout(hazardBounceNoticeTimerRef.current);
          hazardBounceNoticeTimerRef.current = setTimeout(() => setHazardBounceNotice(''), 1500);
          audioManagerRef.current.playSFX('wall_splat');
          console.log('[HazardBounce] 🔥 P2 bounced by hazard volume:', hv.label);
        }
      }

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
        const grabResult = p1SM.checkGrabRange(p1XRef.current, p2XRef.current, p2SMRef.current.action);
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

          // ── Heat Burst activation ─────────────────────────────────────
          if (move.specialName === 'Heat Burst') {
            const audioMgrHeat = audioManagerRef.current;
            audioMgrHeat.playSFX('heat_burst_activate');
            audioMgrHeat.playVOX('heat_burst_yell');
            setHeatBurstEvent({ count: ++heatBurstEventCountRef.current, player: 'p1' });
            setP1HeatActive(true);
            // Heat expires after ~5 seconds
            setTimeout(() => setP1HeatActive(false), 5000);
          }

          // ── Rage Art activation ───────────────────────────────────────
          if (move.specialName === 'Rage Art') {
            const audioMgrRage = audioManagerRef.current;
            audioMgrRage.playSFX('rage_art_activate');
            audioMgrRage.playVOX('rage_art_yell');
            audioMgrRage.playAnnouncer('ki_charge'); // announcer reacts to Rage Art
            setRageArtEvent({ count: ++rageArtEventCountRef.current, player: 'p1' });
            setP1RageArtAvailable(false);
          }
        }
      }

      // ── Directional throw input detection ─────────────────────────────
      const throwInput = {
        lp: smInput.lp ?? false,
        rp: smInput.rp ?? false,
        lk: smInput.lk ?? false,
        rk: smInput.rk ?? false,
        forward: smInput.forward > 0,
        backward: smInput.forward < 0,
      };
      const detectedThrowId = detectThrowInput(throwInput);
      if (detectedThrowId && p1SM.action === 'Idle') {
        const inRange = checkThrowRange(p1XRef.current, p1ZRef.current, p2XRef.current, p2ZRef.current);
        if (inRange) {
          // Throw connects — apply damage and knockdown
          const throwDef = THROW_CATALOG[detectedThrowId];
          if (throwDef) {
            const throwDmg = getThrowDamage(detectedThrowId, false);
            p2SMRef.current.applyKnockdown();
            p2LocoRef.current.halt();
            audioManagerRef.current.playSFX('throw_connect');
            audioManagerRef.current.playVOX('attack_grunt');
            setDamageEvent({
              count: ++damageEventCountRef.current,
              player: 'p2',
              damage: throwDmg,
              isCounter: false,
              factionColor: p2Color,
            });
            setSpecialMoveNotice({ name: throwDef.name, player: 'p1', id: ++specialNoticeIdRef.current });
            setTimeout(() => setSpecialMoveNotice(null), 1500);
            setKnockdownEvent({ count: ++knockdownEventCountRef.current, player: 'p2' });
          }
        } else {
          // Throw whiffed — play whiff sound
          audioManagerRef.current.playSFX('whiff');
        }
      }

      // ── Update Rage Art availability HUD ──────────────────────────────
      const p1HpPctForRage = prevP1HealthRef.current / p1Fighter.hp;
      const p2HpPctForRage = prevP2HealthRef.current / p2Fighter.hp;
      setP1RageArtAvailable(p1HpPctForRage <= 0.25);
      setP2RageArtAvailable(p2HpPctForRage <= 0.25);

      // ── Check P1 hitbox vs P2 ──────────────────────────────────────────
      const p2SM = p2SMRef.current;
      const p2IsBlocking = p2SM.action === 'Guard' && !p2KiChargeRef.current.blockingDisabled;

      // ── Z-axis sidestep whiff check ────────────────────────────────────
      const p1AttackIsLinear = !(p1HbWindow.move?.isSpecial); // specials track
      const p1HitWhiffs = checkSidestepWhiff(p1ZRef.current, p2ZRef.current, !p1AttackIsLinear);

      const p1Hit = p1HitWhiffs ? null : p1Hb.checkCollision(
        p1XRef.current, p1ZRef.current, 1,
        p2XRef.current, p2ZRef.current,
        p2IsBlocking,
        p1HbWindow.currentFrame,
      );

      if (p1Hit) {
        // ── Ki Charge: apply counter-hit bonus and consume charge ─────────
        const p1KiActive = p1KiChargeRef.current.active;
        const isKiCounter = p1KiActive;
        if (p1KiActive) {
          // Consume the Ki Charge
          p1KiChargeRef.current = { ...p1KiChargeRef.current, active: false, framesRemaining: 0, nextAttackIsCounter: false, blockingDisabled: false };
          setP1KiCharge({ ...p1KiChargeRef.current });
        }

        // ── Guard system: check if P2 blocks, apply chip damage or full damage ──
        const p1HitMove = p1HbWindow.move;
        const guardResult = p1HitMove
          ? p2SMRef.current.processIncomingHit(p1HitMove)
          : { blocked: false, chipDamage: 0, guardBroken: false, finalDamage: p1Hit.damage };

        // Ki Charge chip damage on block
        let effectiveDamage = guardResult.blocked
          ? (p1KiActive
              ? Math.round(p1Hit.damage * p1KiChargeRef.current.chipDamageMultiplier)
              : guardResult.finalDamage)
          : p1Hit.damage;

        // Ki Charge counter-hit bonus
        if (p1KiActive && !guardResult.blocked) {
          effectiveDamage = applyKiChargeCounterHit(effectiveDamage);
        }

        // ── Combo system: register hit and apply damage scaling ──────────
        const { scaledDamage: p1ScaledDmg, newState: newP1Combo } = registerHit(
          p1ComboRef.current, effectiveDamage, now,
        );
        p1ComboRef.current = newP1Combo;
        setP1Combo({ ...newP1Combo });
        if (!guardResult.blocked) {
          engine.applyIncomingHit('p2', p1ScaledDmg, false, p1Hit.hitstun || 0.3);
        }

        // Apply stun/knockdown to P2 state machine
        const isCrumple = !guardResult.blocked && p1Hit.launch > 0.3;
        if (isCrumple) {
          p2SMRef.current.applyKnockdown();
          p2LocoRef.current.halt();
          // Trigger dust VFX on knockdown
          setKnockdownEvent({ count: ++knockdownEventCountRef.current, player: 'p2' });

          // ── Floor-break: slam sends P2 crashing through to next level ──
          const slamDmg = p1Hit.damage ?? 0;
          const prevArenaSnap = arenaCombatStateRef.current;
          const afterSlam = tickArenaState(prevArenaSnap, p1XRef.current, p2XRef.current, 0, slamDmg, false, true);
          arenaCombatStateRef.current = afterSlam;
          if (afterSlam.p2FloorBreakPending && !prevArenaSnap.p2FloorBreakPending) {
            const lvl = afterSlam.config.levels[afterSlam.p2LevelIndex];
            setFloorBreakNotice({ player: 'p2', level: lvl?.label ?? 'LOWER LEVEL', count: ++floorBreakNoticeCountRef.current });
            arenaCombatStateRef.current = { ...afterSlam, p2FloorBreakPending: false };
            audioManagerRef.current.playSFX('floor_slam');
            // ── Trigger StageManager floor break transition ──────────────
            const fbState = triggerFloorBreak('p2', afterSlam.p2LevelIndex, slamDmg);
            stageManagerRef.current = { ...stageManagerRef.current, floorBreak: fbState };
            setFloorBreakPhase('floor_break_debris');
          }
        } else if (!guardResult.blocked) {
          p2SMRef.current.applyStun(p1Hit.hitstun || 0.3, false);
          // Apply pushback from hit
          p2LocoRef.current.applyPushback(p1Hit.pushback ?? 0.3);
        }
        if (guardResult.guardBroken) {
          p2SMRef.current.applyStun(p1Hit.hitstun || 0.3, false);
        }
        p2HitboxRef.current.reset();

        // ── Hit Stop: freeze both fighters' animations ────────────────────
        // Duration scales with attack weight (heavy = longer freeze)
        if (!guardResult.blocked) {
          const attackKey = p1HbWindow.move?.animation ?? 'lightAttack';
          const isHeavy = p1Hit.damage > 120 || p1HbWindow.move?.isSpecial;
          const stopMs = isHeavy
            ? (HIT_STOP_DURATIONS[attackKey] ?? HIT_STOP_DEFAULT_MS)
            : HIT_STOP_DURATIONS.lightAttack;
          hitStopTimerRef.current = stopMs / 1000;
          hitStopActiveRef.current = true;
          setHitStopActive(true);
          console.log(`[Arena] ❄️ Hit stop triggered: ${stopMs}ms for "${attackKey}"`);
        }

        const isBlocked = guardResult.blocked;
        const isCounter = prevP2State === FighterState.Startup || prevP2State === FighterState.Active;
        if (settings.soundEnabled) {
          if (isBlocked) sfx.playBlock();
          else if (isCounter) sfx.playCounter();
          else if (p1Hit.damage > 200) sfx.playHeavyHit();
          else sfx.playLightHit();
        }
        // ── Global Audio Manager SFX ──────────────────────────────────────
        const audioMgr = audioManagerRef.current;
        if (isBlocked) audioMgr.playSFX('block');
        else if (isCounter) { audioMgr.playSFX('counter_hit'); audioMgr.playVOX('pain_grunt'); }
        else if (p1Hit.damage > 200) { audioMgr.playSFX('heavy_hit'); audioMgr.playVOX('pain_grunt'); }
        else audioMgr.playSFX('light_hit');
        if (p1Hit.damage > 100 && !isBlocked) audioMgr.playVOX('attack_grunt');

        // ── Wall-splat detection: check if P2 is in hit-stun near a wall ─
        const p2CombatState = combatStateRef.current.p2;
        if (p2CombatState.wallSplat.isSplatted && !p2CombatState.wallSplat.chainedDuringWindow) {
          const wall = p2CombatState.wallSplat.wall;
          if (wall) {
            setWallSplatEvent({ count: ++wallSplatEventCountRef.current, player: 'p2', wall });
            audioMgr.playSFX('wall_splat');
            setSpecialMoveNotice({ name: 'WALL SPLAT!', player: 'p1', id: ++specialNoticeIdRef.current });
            setTimeout(() => setSpecialMoveNotice(null), 1500);
          }
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
        mapActionToDisplayState(p2SMRef.current.action, p2SMRef.current.current, engine.p2State),
        engine.p1Health,
        engine.p2Health,
        p2XRef.current,
        p1XRef.current,
      );
      const p2NextMotion = p2SM.update(p2AIInput, dt);
      const p2HbWindow = p2SM.getHitboxWindow();
      p2Hb.update(p2HbWindow);

      // ── Check P2 hitbox vs P1 ──────────────────────────────────────────
      const p1IsBlocking = p1SM.action === 'Guard';
      const p2Hit = p2Hb.checkCollision(
        p2XRef.current, p2ZRef.current, -1,
        p1XRef.current, p1ZRef.current,
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
        if (!p1GuardResult.blocked) {
          engine.applyIncomingHit('p1', p2ScaledDmg, false, p2Hit.hitstun || 0.3);
        }

        const isCrumple = !p1GuardResult.blocked && p2Hit.launch > 0.3;
        if (isCrumple) {
          p1SMRef.current.applyKnockdown();
          p1LocoRef.current.halt();
          // Trigger dust VFX on knockdown
          setKnockdownEvent({ count: ++knockdownEventCountRef.current, player: 'p1' });

          // ── Floor-break: slam sends P1 crashing through to next level ──
          const slamDmg = p2Hit.damage ?? 0;
          const prevArenaSnap = arenaCombatStateRef.current;
          const afterSlam = tickArenaState(prevArenaSnap, p1XRef.current, p2XRef.current, slamDmg, 0, true, false);
          arenaCombatStateRef.current = afterSlam;
          if (afterSlam.p1FloorBreakPending && !prevArenaSnap.p1FloorBreakPending) {
            const lvl = afterSlam.config.levels[afterSlam.p1LevelIndex];
            setFloorBreakNotice({ player: 'p1', level: lvl?.label ?? 'LOWER LEVEL', count: ++floorBreakNoticeCountRef.current });
            arenaCombatStateRef.current = { ...afterSlam, p1FloorBreakPending: false };
            audioManagerRef.current.playSFX('floor_slam');
            // ── Trigger StageManager floor break transition ──────────────
            const fbState = triggerFloorBreak('p1', afterSlam.p1LevelIndex, slamDmg);
            stageManagerRef.current = { ...stageManagerRef.current, floorBreak: fbState };
            setFloorBreakPhase('floor_break_debris');
          }
        } else if (!p1GuardResult.blocked) {
          p1SMRef.current.applyStun(p2Hit.hitstun || 0.3, false);
          p1LocoRef.current.applyPushback(p2Hit.pushback ?? 0.3);
        }
        if (p1GuardResult.guardBroken) {
          p1SMRef.current.applyStun(p2Hit.hitstun || 0.3, false);
        }
        p1HitboxRef.current.reset();

        // ── Hit Stop for P2 attacks ───────────────────────────────────────
        if (!p1GuardResult.blocked) {
          const attackKey = p2HbWindow.move?.animation ?? 'lightAttack';
          const isHeavy = p2Hit.damage > 120 || p2HbWindow.move?.isSpecial;
          const stopMs = isHeavy
            ? (HIT_STOP_DURATIONS[attackKey] ?? HIT_STOP_DEFAULT_MS)
            : HIT_STOP_DURATIONS.lightAttack;
          hitStopTimerRef.current = stopMs / 1000;
          hitStopActiveRef.current = true;
          setHitStopActive(true);
        }

        const isBlocked = p1GuardResult.blocked;
        const isCounter = prevP1State === FighterState.Startup || prevP1State === FighterState.Active;
        if (settings.soundEnabled) {
          if (isBlocked) sfx.playBlock();
          else if (isCounter) sfx.playCounter();
          else if (p2Hit.damage > 200) sfx.playHeavyHit();
          else sfx.playLightHit();
        }
        // ── Global Audio Manager SFX (P2 hits P1) ────────────────────────
        const audioMgr2 = audioManagerRef.current;
        if (isBlocked) audioMgr2.playSFX('block');
        else if (isCounter) { audioMgr2.playSFX('counter_hit'); audioMgr2.playVOX('pain_grunt'); }
        else if (p2Hit.damage > 200) { audioMgr2.playSFX('heavy_hit'); audioMgr2.playVOX('pain_grunt'); }
        else audioMgr2.playSFX('light_hit');
        if (p2Hit.damage > 100 && !isBlocked) audioMgr2.playVOX('attack_grunt');

        // ── Wall-splat detection for P1 ───────────────────────────────────
        const p1CombatState = combatStateRef.current.p1;
        if (p1CombatState.wallSplat.isSplatted && !p1CombatState.wallSplat.chainedDuringWindow) {
          const wall = p1CombatState.wallSplat.wall;
          if (wall) {
            setWallSplatEvent({ count: ++wallSplatEventCountRef.current, player: 'p1', wall });
            audioMgr2.playSFX('wall_splat');
          }
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
            centerX: p1XRef.current + p1Geom.offsetX,
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
            centerX: p2XRef.current - p2Geom.offsetX,
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
        p1X: p1XRef.current,
        p2X: p2XRef.current,
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

      // ── Increment animation trigger on ANY state change ──────────────────
      // Trigger on attacks, hit reactions, knockdowns — any meaningful state change
      const TRIGGER_STATES = new Set(['lightAttack', 'heavyAttack', 'lightKick', 'heavyKick', 'hit', 'Hitstun', 'HitStun', 'knockdown', 'Knockdown', 'ko', 'KO', 'Crumple', 'WakeupTechRoll', 'WakeupBackrise', 'WakeupQuickStand', 'jump', 'jumpForward', 'jumpBack']);
      const p1StateChanged = p1NextMotion !== prevP1AnimRef.current;
      const p2StateChanged = p2NextMotion !== prevP2AnimRef.current;

      if (p1StateChanged && (TRIGGER_STATES.has(p1NextMotion) || TRIGGER_STATES.has(prevP1AnimRef.current))) {
        p1AnimTriggerRef.current += 1;
        setP1AnimTrigger(p1AnimTriggerRef.current);
      }
      if (p2StateChanged && (TRIGGER_STATES.has(p2NextMotion) || TRIGGER_STATES.has(prevP2AnimRef.current))) {
        p2AnimTriggerRef.current += 1;
        setP2AnimTrigger(p2AnimTriggerRef.current);
      }
      prevP1AnimRef.current = p1NextMotion;
      prevP2AnimRef.current = p2NextMotion;

      // ── Hit-stop countdown ────────────────────────────────────────────
      if (hitStopActiveRef.current) {
        hitStopTimerRef.current -= dt;
        if (hitStopTimerRef.current <= 0) {
          hitStopActiveRef.current = false;
          hitStopTimerRef.current = 0;
          setHitStopActive(false);
        }
      }

      // ── Locomotion system update ──────────────────────────────────────
      // Only update locomotion when not in hit-stop
      if (!hitStopActiveRef.current) {
        const p1Vel = p1SMRef.current.getWalkVelocity();
        const p2Vel = p2SMRef.current.getWalkVelocity();
        const p1IsDashing = cmd.dashing || cmd.running;
        const p1IsBackdashing = cmd.backdashing || p1SMRef.current.action === 'Backdashing';
        const p2IsBackdashing = p2SMRef.current.action === 'Backdashing';

        // Begin root motion for lunging attacks
        if (p1SMRef.current.action === 'Attacking' || p1SMRef.current.action === 'CommandThrow') {
          const attackKey = p1NextMotion;
          const profile = ATTACK_ROOT_MOTION_PROFILES[attackKey];
          if (profile?.hasRootMotion && p1LocoRef.current.mode === 'programmatic') {
            const move = p1HbWindow.move;
            p1LocoRef.current.beginRootMotionAttack(attackKey, move?.active ?? 0.14);
          }
        } else if (p1LocoRef.current.mode === 'rootMotion') {
          p1LocoRef.current.endRootMotionAttack();
        }

        if (cmd.jump) p1LocoRef.current.beginJump();
        else p1LocoRef.current.armJump();
        p1LocoRef.current.update(p1Vel.forward, p1Vel.strafe, dt, p1IsDashing, p1IsBackdashing);
        p2LocoRef.current.update(p2Vel.forward, p2Vel.strafe, dt, false, p2IsBackdashing);

        // ── Feed locomotion positions back to visual state ────────────────
        // Enforce minimum separation so fighters can't overlap
        const MIN_SEPARATION = 1.2;
        let newP1X = p1LocoRef.current.position.x;
        let newP2X = p2LocoRef.current.position.x;

        // Clamp: P1 can't cross past P2, P2 can't cross past P1
        if (newP1X > newP2X - MIN_SEPARATION) {
          const mid = (newP1X + newP2X) / 2;
          newP1X = mid - MIN_SEPARATION / 2;
          newP2X = mid + MIN_SEPARATION / 2;
          p1LocoRef.current.clampX(newP1X);
          p2LocoRef.current.clampX(newP2X);
        }

        // Only trigger React re-render when position changes meaningfully (>0.01 units)
        if (Math.abs(newP1X - p1XRef.current) > 0.01) {
          p1XRef.current = newP1X;
          setP1X(newP1X);
        }
        const jy = p1LocoRef.current.airborneY;
        if (Math.abs(jy - p1YRef.current) > 0.005) {
          p1YRef.current = jy;
          p1JumpYRef.current = jy;
          setP1Y(jy);
        }
        if (Math.abs(newP2X - p2XRef.current) > 0.01) {
          p2XRef.current = newP2X;
          setP2X(newP2X);
        }

        const newP1Z = p1LocoRef.current.position.z;
        const newP2Z = p2LocoRef.current.position.z;
        if (Math.abs(newP1Z - p1ZRef.current) > 0.01) {
          p1ZRef.current = newP1Z;
          setP1Z(newP1Z);
        }
        if (Math.abs(newP2Z - p2ZRef.current) > 0.01) {
          p2ZRef.current = newP2Z;
          setP2Z(newP2Z);
        }

        // Update locomotion velocity for animation blending
        const p1VelMag = Math.abs(p1Vel.forward) + Math.abs(p1Vel.strafe);
        const p2VelMag = Math.abs(p2Vel.forward) + Math.abs(p2Vel.strafe);
        if (Math.abs(p1VelMag - p1VelRef.current.forward) > 0.03) {
          p1VelRef.current = p1Vel;
          setP1LocomotionVelocity({ ...p1Vel });
        }
        if (Math.abs(p2VelMag - p2VelRef.current.forward) > 0.03) {
          p2VelRef.current = p2Vel;
          setP2LocomotionVelocity({ ...p2Vel });
        }
      }

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

        // ── Auto-save replay ──────────────────────────────────────────────
        triggerAutoSaveReplay(w);

        // ── Announcer: K.O. / Double K.O. / Perfect / Great ──────────────
        const announcer = announcerRef.current;
        if (!announcerFiredRef.current.ko) {
          announcerFiredRef.current.ko = true;
          const isDoubleKo = engine.p1Health <= 0 && engine.p2Health <= 0;
          const winnerHealth = w === 'p1' ? engine.p1Health : engine.p2Health;
          const winnerMaxHp = w === 'p1' ? p1Fighter.hp : p2Fighter.hp;
          const winnerHpPct = winnerHealth / winnerMaxHp;

          if (isDoubleKo) {
            // Double K.O. fires first, then Draw
            announcer.fire('doubleKo');
            setTimeout(() => announcer.fire('draw'), 1200);
          } else if (winnerHpPct >= 0.99) {
            // Perfect — winner took no damage
            announcer.fire('ko');
            setTimeout(() => announcer.fire('perfect'), 800);
          } else if (winnerHpPct <= 0.05) {
            // Great — pixel health comeback
            announcer.fire('ko');
            setTimeout(() => announcer.fire('great'), 800);
          } else {
            announcer.fire('ko');
          }

          // "[Name] Wins!" fires during victory cinematic
          if (!isDoubleKo) {
            setTimeout(() => {
              const winnerName = w === 'p1' ? p1Fighter.name : p2Fighter.name;
              announcer.fire(w === 'p1' ? 'p1Wins' : 'p2Wins', winnerName);
            }, 2200);
          }
        }

        // Determine condition
        const isPerfect = (w === 'p1' && engine.p1Health >= p1Fighter.hp * 0.99) ||
                          (w === 'p2' && engine.p2Health >= p2Fighter.hp * 0.99);
        const cond: 'KO' | 'TIMEOUT' | 'PERFECT' = isPerfect ? 'PERFECT' : 'KO';
        setMatchCondition(cond);

        // Build round result
        const elapsed = Math.round((Date.now() - roundStartTimeRef.current) / 1000);
        const roundResult: RoundResult = {
          round: 1,
          winner: w,
          condition: cond,
          p1HealthRemaining: Math.max(0, engine.p1Health),
          p2HealthRemaining: Math.max(0, engine.p2Health),
          durationSeconds: elapsed,
        };
        setRoundResults([roundResult]);

        // Switch to victory cinematic
        setTimeout(() => {
          setCinematicPhase('victory');
          if (w !== 'draw' && settings.soundEnabled) sfx.playVictory();
        }, 800);
        setTimeout(() => {
          onMatchEnd?.(w);
          setShowPostMatch(true);
        }, POST_MATCH_DELAY_MS);
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

            // ── Auto-save replay on timeout ───────────────────────────────
            triggerAutoSaveReplay(w);

            // ── Announcer: Time Up! + Draw/Winner ─────────────────────────
            const announcer = announcerRef.current;
            announcer.fire('timeUp');
            setTimeout(() => {
              if (w === 'draw') {
                announcer.fire('draw');
              } else {
                const winnerName = w === 'p1' ? p1Fighter.name : p2Fighter.name;
                announcer.fire(w === 'p1' ? 'p1Wins' : 'p2Wins', winnerName);
              }
            }, 1200);

            setMatchCondition('TIMEOUT');
            const elapsed = Math.round((Date.now() - roundStartTimeRef.current) / 1000);
            setRoundResults([{
              round: 1,
              winner: w,
              condition: 'TIMEOUT',
              p1HealthRemaining: Math.max(0, engine.p1Health),
              p2HealthRemaining: Math.max(0, engine.p2Health),
              durationSeconds: elapsed,
            }]);
            setTimeout(() => {
              setCinematicPhase('victory');
              if (w !== 'draw' && settings.soundEnabled) sfx.playVictory();
            }, 800);
            setTimeout(() => {
              onMatchEnd?.(w);
              setShowPostMatch(true);
            }, POST_MATCH_DELAY_MS);
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
    const onKeyDown = (e: KeyboardEvent) => {
      const i = inputRef.current as any;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') i.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') i.right = true;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') i.up = true;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') i.down = true;
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
      // Q/E = held sidestep (away / toward camera). Double-tap up/down still uses the stick.
      if (e.key === 'q' || e.key === 'Q') i.sidestepBg = true;
      if (e.key === 'e' || e.key === 'E') i.sidestepFg = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const i = inputRef.current as any;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') i.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') i.right = false;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') i.up = false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') i.down = false;
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
      if (e.key === 'q' || e.key === 'Q') i.sidestepBg = false;
      if (e.key === 'e' || e.key === 'E') i.sidestepFg = false;
    };
    // Z return is handled by locomotion, not a lerp that fights sidestep.
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

  // ── Auto-save replay to Supabase on match end ─────────────────────────────
  const autoSaveReplayRef = useRef(false);

  const triggerAutoSaveReplay = useCallback(async (
    winnerPlayer: 'p1' | 'p2' | 'draw',
  ) => {
    if (autoSaveReplayRef.current) return; // Only save once per match
    autoSaveReplayRef.current = true;

    stopRecording();
    const frames = getBuffer();
    if (frames.length === 0) return;

    const clip = {
      id: `auto_${Date.now()}`,
      label: `${p1Fighter.name} vs ${p2Fighter.name} — ${stageId ?? 'urban_night'} [AUTO]`,
      p1Name: p1Fighter.name,
      p2Name: p2Fighter.name,
      stageName: stageId ?? 'urban_night',
      frames,
      inPoint: 0,
      outPoint: frames.length - 1,
      speedMultiplier: 1.0,
      exportedAt: new Date().toISOString(),
      totalFrames: frames.length,
      durationMs: frames.length > 1
        ? (frames[frames.length - 1]?.timestamp ?? 0) - (frames[0]?.timestamp ?? 0)
        : 0,
    };

    if (user?.id) {
      const result = await saveReplayToSupabase(clip, user.id);
      if (result.success) {
        console.log('[Arena] ☁ Auto-saved replay to Supabase:', clip.id, `(${frames.length} frames)`);
      } else {
        console.warn('[Arena] ⚠ Auto-save replay failed:', result.error);
      }
    } else {
      console.log('[Arena] ℹ Auto-save skipped — user not signed in');
    }
  }, [p1Fighter.name, p2Fighter.name, stageId, user?.id, stopRecording, getBuffer]);

  // Reset autoSaveReplayRef on new match
  useEffect(() => {
    autoSaveReplayRef.current = false;
  }, [p1Fighter, p2Fighter]);

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
          knockdownEvent={knockdownEvent}
          stageId={stageId ?? 'urban_night'}
          p1AnimTrigger={p1AnimTrigger}
          p2AnimTrigger={p2AnimTrigger}
          p1LocomotionVelocity={p1LocomotionVelocity}
          p2LocomotionVelocity={p2LocomotionVelocity}
          p1X={p1X}
          p2X={p2X}
          p1Y={p1Y}
          onP1BoneHitboxReady={(sys: BoneHitboxSystem) => { p1BoneHitboxRef.current = sys; }}
          onP2BoneHitboxReady={(sys: BoneHitboxSystem) => { p2BoneHitboxRef.current = sys; }}
          wallSplatEvent={wallSplatEvent}
          heatBurstEvent={heatBurstEvent}
          rageArtEvent={rageArtEvent}
          cameraShakeOffset={cameraShakeOffset}
        />
      </div>

      {/* ── HUD OVERLAY: transparent, only visible during fight phase ── */}
      {cinematicPhase === 'fight' && (
        <>
          {/* Health bars + timer — semi-transparent background only on bar rows */}
          <div className="absolute top-0 left-0 right-0 z-30 px-3 pt-2 pb-1 pointer-events-none">
            <div className="flex items-center gap-2">
              <img
                src={p1Fighter.pixelPortrait ?? `/portraits/pixel/${p1Fighter.id}.png`}
                alt=""
                className="h-12 w-12 shrink-0 border border-zinc-700 object-cover"
                style={{ imageRendering: "pixelated" }}
              />
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
              <img
                src={p2Fighter.pixelPortrait ?? `/portraits/pixel/${p2Fighter.id}.png`}
                alt=""
                className="h-12 w-12 shrink-0 border border-zinc-700 object-cover"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
          </div>

          {/* ── Combo Counter HUD ── */}
          <ComboCounterHUD
            p1Combo={p1Combo}
            p2Combo={p2Combo}
            p1Color={p1Color}
            p2Color={p2Color}
          />

          {/* ── Ki Charge HUD — glowing aura indicator ── */}
          {p1KiCharge.active && (
            <div className="absolute z-40 pointer-events-none" style={{ bottom: '28%', left: '12%' }}>
              <div
                className="px-3 py-1 text-[9px] font-black tracking-widest uppercase animate-pulse"
                style={{
                  color: '#a78bfa',
                  textShadow: '0 0 16px #a78bfa, 0 0 32px #a78bfa88',
                  border: '1px solid #a78bfa44',
                  background: 'rgba(0,0,0,0.75)',
                }}
              >
                ⚡ KI CHARGE · {Math.ceil(p1KiCharge.framesRemaining / 60 * 10) / 10}s
              </div>
              <div className="text-[6px] text-purple-300/70 tracking-widest mt-0.5 text-center">
                NEXT HIT = COUNTER · NO BLOCK
              </div>
            </div>
          )}

          {/* ── Heat Burst HUD — stance mode indicator ── */}
          {p1HeatActive && (
            <div className="absolute z-40 pointer-events-none" style={{ bottom: '22%', left: '8%' }}>
              <div
                className="px-3 py-1 text-[9px] font-black tracking-widest uppercase animate-pulse"
                style={{
                  color: '#f97316',
                  textShadow: '0 0 16px #f97316, 0 0 32px #f9731688',
                  border: '1px solid #f9731644',
                  background: 'rgba(0,0,0,0.75)',
                }}
              >
                🔥 HEAT STATE
              </div>
            </div>
          )}
          {p2HeatActive && (
            <div className="absolute z-40 pointer-events-none" style={{ bottom: '22%', right: '8%' }}>
              <div
                className="px-3 py-1 text-[9px] font-black tracking-widest uppercase animate-pulse"
                style={{
                  color: '#f97316',
                  textShadow: '0 0 16px #f97316, 0 0 32px #f9731688',
                  border: '1px solid #f9731644',
                  background: 'rgba(0,0,0,0.75)',
                }}
              >
                🔥 HEAT STATE
              </div>
            </div>
          )}

          {/* ── Rage Art available indicator ── */}
          {p1RageArtAvailable && (
            <div className="absolute z-40 pointer-events-none" style={{ bottom: '16%', left: '8%' }}>
              <div
                className="px-3 py-1 text-[9px] font-black tracking-widest uppercase animate-pulse"
                style={{
                  color: '#ef4444',
                  textShadow: '0 0 16px #ef4444, 0 0 32px #ef444488',
                  border: '1px solid #ef444444',
                  background: 'rgba(0,0,0,0.75)',
                }}
              >
                💢 RAGE ART READY
              </div>
            </div>
          )}
          {p2RageArtAvailable && (
            <div className="absolute z-40 pointer-events-none" style={{ bottom: '16%', right: '8%' }}>
              <div
                className="px-3 py-1 text-[9px] font-black tracking-widest uppercase animate-pulse"
                style={{
                  color: '#ef4444',
                  textShadow: '0 0 16px #ef4444, 0 0 32px #ef444488',
                  border: '1px solid #ef444444',
                  background: 'rgba(0,0,0,0.75)',
                }}
              >
                💢 RAGE ART READY
              </div>
            </div>
          )}

          {/* ── Ring-Out Notice ── */}
          {ringOutNotice && (
            <div
              key={ringOutNotice.count}
              className="absolute z-50 pointer-events-none inset-0 flex items-center justify-center"
            >
              <div
                className="px-6 py-3 text-2xl font-black tracking-[0.3em] uppercase animate-bounce"
                style={{
                  color: '#facc15',
                  textShadow: '0 0 30px #facc15, 0 0 60px #facc1588',
                  border: '2px solid #facc1566',
                  background: 'rgba(0,0,0,0.85)',
                }}
              >
                {ringOutNotice.player === 'p1' ? 'P1' : 'P2'} RING OUT!
              </div>
            </div>
          )}

          {/* ── Floor Break Notice ── */}
          {floorBreakNotice && (
            <div
              key={floorBreakNotice.count}
              className="absolute z-50 pointer-events-none inset-0 flex items-center justify-center"
            >
              <div
                className="px-6 py-3 text-xl font-black tracking-[0.25em] uppercase"
                style={{
                  color: '#f97316',
                  textShadow: '0 0 24px #f97316, 0 0 48px #f9731688',
                  border: '2px solid #f9731666',
                  background: 'rgba(0,0,0,0.85)',
                  animation: 'ping 0.4s ease-out',
                }}
              >
                💥 FLOOR BREAK → {floorBreakNotice.level}
              </div>
            </div>
          )}

          {/* ── Hazard Warning ── */}
          {hazardNotice && arenaState.config.hazardDamagePerSec > 0 && (
            <div className="absolute z-40 pointer-events-none top-[18%] left-1/2 -translate-x-1/2">
              <div
                className="px-3 py-1 text-[8px] font-black tracking-widest uppercase animate-pulse"
                style={{
                  color: '#ef4444',
                  textShadow: '0 0 12px #ef4444',
                  border: '1px solid #ef444466',
                  background: 'rgba(0,0,0,0.75)',
                }}
              >
                {hazardNotice}
              </div>
            </div>
          )}

          {/* ── Train Warning HUD (Subway stage) ── */}
          {trainWarningActive && (
            <div className="absolute z-50 pointer-events-none inset-0 flex items-center justify-center">
              <div
                className="px-8 py-4 text-2xl font-black tracking-[0.3em] uppercase animate-pulse"
                style={{
                  color: '#f59e0b',
                  textShadow: '0 0 30px #f59e0b, 0 0 60px #f59e0b88',
                  border: '2px solid #f59e0b66',
                  background: 'rgba(0,0,0,0.9)',
                }}
              >
                🚇 TRAIN INCOMING!
              </div>
            </div>
          )}

          {/* ── Train Crossing Flash ── */}
          {trainCrossing && (
            <div
              className="absolute z-50 pointer-events-none inset-0"
              style={{ background: 'rgba(245,158,11,0.08)', boxShadow: 'inset 0 0 80px rgba(245,158,11,0.3)' }}
            />
          )}

          {/* ── Vault Prompt (P1 on tracks) ── */}
          {p1OnTracks && !trainCrossing && (
            <div className="absolute z-40 pointer-events-none" style={{ bottom: '35%', left: '10%' }}>
              <div
                className="px-3 py-1.5 text-[9px] font-black tracking-widest uppercase animate-bounce"
                style={{
                  color: '#22d3ee',
                  textShadow: '0 0 16px #22d3ee',
                  border: '1px solid #22d3ee66',
                  background: 'rgba(0,0,0,0.85)',
                }}
              >
                ↑ VAULT UP!
              </div>
              <div className="text-[6px] text-cyan-400/60 tracking-widest text-center mt-0.5">PRESS UP TO ESCAPE TRACKS</div>
            </div>
          )}

          {/* ── Hazard Bounce Notice ── */}
          {hazardBounceNotice && (
            <div className="absolute z-50 pointer-events-none top-[30%] left-1/2 -translate-x-1/2">
              <div
                className="px-4 py-2 text-sm font-black tracking-widest uppercase animate-pulse"
                style={{
                  color: '#f97316',
                  textShadow: '0 0 20px #f97316',
                  border: '1px solid #f9731666',
                  background: 'rgba(0,0,0,0.85)',
                }}
              >
                {hazardBounceNotice}
              </div>
            </div>
          )}

          {/* ── Floor Break Phase Indicator ── */}
          {floorBreakPhase === 'floor_break_fall' && (
            <div
              className="absolute z-50 pointer-events-none inset-0"
              style={{ background: 'rgba(249,115,22,0.06)', boxShadow: 'inset 0 0 60px rgba(249,115,22,0.2)' }}
            />
          )}

          {/* ── Wall Shatter VFX (left/right) ── */}
          {wallShatterLeft && (
            <div
              className="absolute z-40 pointer-events-none left-0 top-0 bottom-0 w-16 animate-pulse"
              style={{ background: 'linear-gradient(to right, rgba(148,163,184,0.3), transparent)' }}
            />
          )}
          {wallShatterRight && (
            <div
              className="absolute z-40 pointer-events-none right-0 top-0 bottom-0 w-16 animate-pulse"
              style={{ background: 'linear-gradient(to left, rgba(148,163,184,0.3), transparent)' }}
            />
          )}

          {/* ── Ledge Throw Active Indicator ── */}
          {ledgeThrowActive && (
            <div className="absolute z-50 pointer-events-none inset-0 flex items-center justify-center">
              <div
                className="px-6 py-3 text-xl font-black tracking-[0.3em] uppercase"
                style={{
                  color: '#ef4444',
                  textShadow: '0 0 24px #ef4444, 0 0 48px #ef444488',
                  border: '2px solid #ef444466',
                  background: 'rgba(0,0,0,0.9)',
                  animation: 'pulse 0.5s ease-in-out infinite',
                }}
              >
                🎯 LEDGE THROW!
              </div>
            </div>
          )}

          {/* ── Stage Level Indicator ── */}
          {arenaState.config.levels.length > 1 && (
            <div className="absolute z-40 pointer-events-none top-[22%] left-1/2 -translate-x-1/2 flex gap-3">
              <span
                className="text-[7px] tracking-widest font-black"
                style={{ color: arenaState.config.accentColor, opacity: 0.7 }}
              >
                P1: {arenaState.config.levels[arenaState.p1LevelIndex]?.label ?? 'LEVEL 1'}
              </span>
              <span className="text-[7px] text-zinc-600">|</span>
              <span
                className="text-[7px] tracking-widest font-black"
                style={{ color: arenaState.config.accentColor, opacity: 0.7 }}
              >
                P2: {arenaState.config.levels[arenaState.p2LevelIndex]?.label ?? 'LEVEL 1'}
              </span>
            </div>
          )}

          {/* ── Debug Overlay HUD (practice mode only) ── */}
          <DebugOverlayHUD
            settings={debugSettings}
            p1Debug={p1DebugData}
            p2Debug={p2DebugData}
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

          {/* Move Execution Feedback — training mode only, never during real fights */}
          {isPracticeMode && (
            <MoveExecutionFeedback
              events={feedbackEvents}
              onExpire={(id) => setFeedbackEvents(prev => prev.filter(e => e.id !== id))}
            />
          )}

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
            <div className="text-purple-500/60">KI CHARGE: U+X+J+K (1+2+3+4) — NEXT HIT = COUNTER · NO BLOCK</div>
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

      {/* ── Pause button (ESC hint) ── */}
      {cinematicPhase === 'fight' && !ko && (
        <button
          onClick={() => { setIsPaused(p => !p); setPauseTab('menu'); }}
          className="absolute top-3 right-3 z-40 text-[8px] text-zinc-500 hover:text-zinc-200 border border-zinc-700/40 hover:border-zinc-500 px-2 py-1 transition-colors bg-black/50 font-mono tracking-widest"
        >
          ⏸ ESC
        </button>
      )}

      {/* ── Pause Menu Overlay ── */}
      {isPaused && cinematicPhase === 'fight' && !ko && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}
        >
          <div
            className="w-full max-w-sm border border-zinc-700 bg-zinc-950 font-mono"
            style={{ boxShadow: '0 0 40px rgba(250,204,21,0.08)' }}
          >
            {/* Pause header */}
            <div className="border-b border-zinc-800 px-4 py-2 flex items-center justify-between">
              <div className="text-[10px] text-yellow-400 tracking-widest font-black">⏸ PAUSED</div>
              <div className="text-[7px] text-zinc-600">{p1Fighter.name} vs {p2Fighter.name}</div>
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-zinc-800">
              <button
                onClick={() => setPauseTab('menu')}
                className={`flex-1 text-[8px] tracking-widest py-1.5 transition-colors ${pauseTab === 'menu' ? 'text-yellow-400 border-b border-yellow-600' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                MENU
              </button>
              <button
                onClick={() => setPauseTab('replay')}
                className={`flex-1 text-[8px] tracking-widest py-1.5 transition-colors ${pauseTab === 'replay' ? 'text-yellow-400 border-b border-yellow-600' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                ⏺ REPLAY
              </button>
            </div>

            <div className="p-4">
              {pauseTab === 'menu' && (
                <div className="space-y-2">
                  <button
                    onClick={() => setIsPaused(false)}
                    className="w-full text-[9px] font-black tracking-widest border border-yellow-700 text-yellow-400 hover:bg-yellow-900/30 py-2 transition-colors"
                  >
                    ▶ RESUME FIGHT
                  </button>
                  {onBack && (
                    <button
                      onClick={() => { setIsPaused(false); onBack(); }}
                      className="w-full text-[9px] font-black tracking-widest border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 py-2 transition-colors"
                    >
                      ← QUIT MATCH
                    </button>
                  )}
                  <div className="text-[6px] text-zinc-700 text-center pt-1">
                    Press ESC to resume
                  </div>
                </div>
              )}

              {pauseTab === 'replay' && (
                <PauseMenuRecorder
                  p1Name={p1Fighter.name}
                  p2Name={p2Fighter.name}
                  stageName={stageId ?? 'urban_night'}
                  getBuffer={getBuffer}
                  isRecording={isRecording}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Post-Match Screen ── */}
      {showPostMatch && winner && (
        <div className="absolute inset-0 z-50">
          <PostMatchScreen
            p1Fighter={p1Fighter}
            p2Fighter={p2Fighter}
            winner={winner}
            condition={matchCondition}
            roundResults={roundResults}
            p1Color={p1Color}
            p2Color={p2Color}
            onRematch={() => {
              setShowPostMatch(false);
              // Reset match state
              const engine = engineRef.current;
              if (engine) {
                setP1Health(p1Fighter.hp);
                setP2Health(p2Fighter.hp);
                setKo(false);
                setWinner(null);
                setRoundTimer(99);
                koHandledRef.current = false;
                roundStartedRef.current = false;
                setRoundResults([]);
                roundStartTimeRef.current = Date.now();
                setP1X(-1.8); setP2X(1.8);
                p1XRef.current = -1.8; p2XRef.current = 1.8;
                p1LocoRef.current = new LocomotionSystem(-1.8, 0, 1);
                p2LocoRef.current = new LocomotionSystem(1.8, 0, -1);
                p1SMRef.current = new FighterStateMachine();
                p2SMRef.current = new FighterStateMachine();
                p1SMRef.current.registerSpecialMoves(DEFAULT_SPECIAL_MOVES);
                p2SMRef.current.registerSpecialMoves(DEFAULT_SPECIAL_MOVES);
                p1HitboxRef.current.reset();
                p2HitboxRef.current.reset();
                const freshP1Combo = createComboState('p1');
                const freshP2Combo = createComboState('p2');
                p1ComboRef.current = freshP1Combo;
                p2ComboRef.current = freshP2Combo;
                setP1Combo(freshP1Combo);
                setP2Combo(freshP2Combo);
              }
              setCinematicPhase('sweep');
              setArenaReady(false);
              const t1 = window.setTimeout(() => setCinematicPhase('intro'), SWEEP_DURATION_MS);
              const t2 = window.setTimeout(() => { setCinematicPhase('fight'); setArenaReady(true); }, SWEEP_DURATION_MS + INTRO_DURATION_MS);
              // cleanup handled by component unmount
              void t1; void t2;
            }}
            onCharacterSelect={() => {
              setShowPostMatch(false);
              onBack?.();
            }}
            onExit={() => {
              setShowPostMatch(false);
              onBack?.();
            }}
          />
        </div>
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
    case 'Attacking':          return motion || 'lightAttack';
    case 'Stunned':            return 'Hitstun';
    case 'Crumple':            return 'Hitstun';
    case 'Guard':              return motion || 'guard';
    case 'Walking':            return motion || 'Walking';
    case 'Backdashing':        return 'Backdashing';
    case 'Jumping':            return motion || 'jump';
    case 'Knockdown':          return 'Knockdown';
    case 'WakeupTechRoll':     return 'WakeupTechRoll';
    case 'WakeupBackrise':     return 'WakeupBackrise';
    case 'WakeupQuickStand':   return 'WakeupQuickStand';
    case 'Idle':               return motion === 'crouch' ? 'crouch' : (legacyState === 'KO' ? 'KO' : 'Neutral');
    default:                   return motion || legacyState;
  }
}

/** Reactive AI input for P2 — moves toward P1, attacks when in range, guards when hit */
function buildP2AIInput(
  p2State: string,
  p1Health: number,
  p2Health: number,
  p2X: number,
  p1X: number,
): SMInput {
  const now = performance.now();
  const isAggressive = p2Health < p1Health;
  const dist = Math.abs(p2X - p1X);

  // Can't act while stunned/knocked down
  if (p2State === 'Hitstun' || p2State === 'Stunned' || p2State === 'Knockdown' ||
      p2State === 'WakeupTechRoll' || p2State === 'WakeupBackrise' || p2State === 'WakeupQuickStand') {
    return { forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false };
  }

  // Guard briefly after being hit
  if (p2State === 'Blockstun') {
    return { forward: 0, strafe: 0, light: false, heavy: false, guard: true, crouch: false };
  }

  // P2 faces -X (toward P1 at left), so "forward" = -1 moves toward P1
  // P2 is at +X, P1 is at -X, so P2 needs to move in -X direction (forward = -1 in P2's frame)
  const ATTACK_RANGE = 1.6;
  const CLOSE_RANGE = 1.3;

  // Use a time-based decision cycle for varied behavior
  const cycle = Math.floor(now / 800) % 6;

  if (dist > ATTACK_RANGE) {
    // Move toward P1 (forward = -1 for P2 since it faces -X)
    return { forward: -1, strafe: 0, light: false, heavy: false, guard: false, crouch: false };
  }

  if (dist <= CLOSE_RANGE) {
    // In attack range — vary attacks
    switch (cycle) {
      case 0:
      case 1: return { forward: 0, strafe: 0, light: true, heavy: false, guard: false, crouch: false };
      case 2: return { forward: 0, strafe: 0, light: false, heavy: isAggressive, guard: !isAggressive, crouch: false };
      case 3: return { forward: -1, strafe: 0, light: true, heavy: false, guard: false, crouch: false };
      case 4: return { forward: 0, strafe: 0, light: false, heavy: true, guard: false, crouch: false };
      case 5: return { forward: 1, strafe: 0, light: false, heavy: false, guard: true, crouch: false }; // backdash
      default: return { forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false };
    }
  }

  // Medium range — approach and occasionally attack
  if (cycle % 3 === 0) {
    return { forward: 0, strafe: 0, light: true, heavy: false, guard: false, crouch: false };
  }
  return { forward: -1, strafe: 0, light: false, heavy: false, guard: false, crouch: false };
}