import type { FighterMotionState } from '../retarget/AnimationController';
import { computeAttackLockDuration, isSpinClip } from './ClipPlaybackGate';
import { directionalAttackClip } from '../retarget/FighterMotionBank';
import {
  HEAT_DASH_HIT,
  RUN_ATTACK,
  RUN_KICK,
  genericLink,
  hitToWindow,
  matchString,
  type BuiltAttack,
  type Limb,
} from './StringRoutes';

// ── Action States ─────────────────────────────────────────────────────────────
export type ActionState =
  | 'Idle' | 'Walking' | 'Backdashing' | 'Attacking' | 'Stunned' | 'Crumple' |'Guard' | 'Knockdown' | 'WakeupTechRoll' | 'WakeupBackrise' | 'WakeupQuickStand'
  | 'HitStun' | 'CommandThrow' | 'ThrowWhiff' | 'Jumping';

// ── Wakeup option buffered during knockdown recovery ─────────────────────────
export type WakeupOption = 'techRoll' | 'backrise' | 'quickStand' | null;

export interface FighterInput {
  forward: number;
  strafe: number;
  light: boolean;
  heavy: boolean;
  guard: boolean;
  crouch: boolean;
  grapple?: boolean;
  escape?: boolean;
  // ── Tekken 4-limb inputs ─────────────────────────────────────────────────
  /** 1 = Left Punch (LP) */
  lp?: boolean;
  /** 2 = Right Punch (RP) */
  rp?: boolean;
  /** 3 = Left Kick (LK) */
  lk?: boolean;
  /** 4 = Right Kick (RK) */
  rk?: boolean;
  // ── Tekken combination inputs ─────────────────────────────────────────────
  /** Heat Burst: 2+3 (RP+LK) */
  heatBurst?: boolean;
  /** Rage Art: d/f + 1+2 */
  rageArt?: boolean;
  /** Left Throw: 1+3 (LP+LK) */
  leftThrow?: boolean;
  /** Right Throw: 2+4 (RP+RK) */
  rightThrow?: boolean;
  jump?: boolean;
  dashing?: boolean;
  backdashing?: boolean;
  running?: boolean;
}

// ── Crossfade state for debug overlay ────────────────────────────────────────
export interface CrossfadeState {
  isCrossfading: boolean;
  fromClip: string;
  toClip: string;
  progress: number;
  duration: number;
}

export interface MoveWindow {
  startup: number;
  active: number;
  recovery: number;
  animation: FighterMotionState;
  hitboxStartFrame?: number;
  hitboxEndFrame?: number;
  totalFrames?: number;
  damage?: number;
  isSpecial?: boolean;
  specialName?: string;
  /** If true, this move is a throw — cannot be blocked by guard */
  isThrow?: boolean;
  /** If true, this move is unblockable — guard does not reduce damage */
  isUnblockable?: boolean;
  /** If true, this is a command throw (Forward+Guard) */
  isCommandThrow?: boolean;
  /** Grab range in world units for command throw */
  grabRange?: number;
  /** Combo route to execute after successful throw */
  throwComboRoute?: Array<'light' | 'heavy'>;
  /** High misses crouch. Low hits standing guard. Mid hits a crouching guard. */
  attackLevel?: 'high' | 'mid' | 'low';
  launchPower?: number;
  hitstun?: number;
  blockstun?: number;
  /** Seconds from swing start when a dialed follow-up may cancel in. */
  cancelAt?: number;
  stepIn?: number;
  reach?: number;
  width?: number;
  depth?: number;
  pushback?: number;
  /**
   * Bank clip to play while `animation` stays the combat state.
   * Claude's attackClip split: lock/hitbox stay on the state, the
   * visible swing is this clip. Absent → directionalAttackClip.
   */
  clip?: string;
}

// ── Special Move Definitions ──────────────────────────────────────────────────
export interface SpecialMoveDefinition {
  id: string;
  name: string;
  sequence: Array<keyof FighterInput>;
  move: MoveWindow;
}

// ── Built-in move windows ─────────────────────────────────────────────────────
export const DEFAULT_MOVE_WINDOWS: Record<'lightAttack' | 'heavyAttack' | 'lightKick' | 'heavyKick', MoveWindow> = {
  lightAttack: {
    startup: 0.12,
    active: 0.10,
    recovery: 0.22,
    animation: 'lightAttack',
    hitboxStartFrame: 8,
    hitboxEndFrame: 14,
    totalFrames: 26,
    damage: 80,
  },
  heavyAttack: {
    startup: 0.20,
    active: 0.14,
    recovery: 0.38,
    animation: 'heavyAttack',
    hitboxStartFrame: 12,
    hitboxEndFrame: 20,
    totalFrames: 43,
    damage: 150,
  },
  lightKick: {
    startup: 0.14,
    active: 0.12,
    recovery: 0.28,
    animation: 'lightKick',
    hitboxStartFrame: 9,
    hitboxEndFrame: 16,
    totalFrames: 32,
    damage: 90,
    specialName: 'Left Kick',
  },
  heavyKick: {
    startup: 0.22,
    active: 0.16,
    recovery: 0.42,
    animation: 'heavyKick',
    hitboxStartFrame: 13,
    hitboxEndFrame: 22,
    totalFrames: 48,
    damage: 170,
    specialName: 'Right Kick',
  },
};

// ── Tekken-style move windows ─────────────────────────────────────────────────
/** Left Throw (1+3): LP+LK */
export const LEFT_THROW_MOVE: MoveWindow = {
  startup: 0.08,
  active: 0.06,
  recovery: 0.50,
  animation: 'heavyAttack',
  hitboxStartFrame: 5,
  hitboxEndFrame: 9,
  totalFrames: 38,
  damage: 180,
  isThrow: true,
  isUnblockable: true,
  specialName: 'Left Throw',
  throwComboRoute: [],
};

/** Right Throw (2+4): RP+RK */
export const RIGHT_THROW_MOVE: MoveWindow = {
  startup: 0.08,
  active: 0.06,
  recovery: 0.50,
  animation: 'heavyAttack',
  hitboxStartFrame: 5,
  hitboxEndFrame: 9,
  totalFrames: 38,
  damage: 180,
  isThrow: true,
  isUnblockable: true,
  specialName: 'Right Throw',
  throwComboRoute: [],
};

/** Heat Burst (2+3): RP+LK — activates Heat State */
export const HEAT_BURST_MOVE: MoveWindow = {
  startup: 0.15,
  active: 0.20,
  recovery: 0.40,
  animation: 'heavyAttack',
  hitboxStartFrame: 9,
  hitboxEndFrame: 21,
  totalFrames: 45,
  damage: 120,
  isSpecial: true,
  specialName: 'Heat Burst',
};

/** Rage Art (d/f + 1+2): available below 25% HP */
export const RAGE_ART_MOVE: MoveWindow = {
  startup: 0.25,
  active: 0.30,
  recovery: 0.60,
  animation: 'heavyAttack',
  hitboxStartFrame: 15,
  hitboxEndFrame: 33,
  totalFrames: 69,
  damage: 350,
  isSpecial: true,
  isUnblockable: true,
  specialName: 'Rage Art',
};

// ── Command Throw move definition ─────────────────────────────────────────────
export const COMMAND_THROW_MOVE: MoveWindow = {
  startup: 0.10,
  active: 0.08,
  recovery: 0.55,
  animation: 'heavyAttack',
  hitboxStartFrame: 6,
  hitboxEndFrame: 11,
  totalFrames: 43,
  damage: 220,
  isThrow: true,
  isCommandThrow: true,
  isUnblockable: true,
  grabRange: 1.4,
  specialName: 'Command Throw',
  throwComboRoute: ['light', 'heavy'],
};

// ── Default special moves catalog ────────────────────────────────────────────
export const DEFAULT_SPECIAL_MOVES: SpecialMoveDefinition[] = [
  {
    id: 'power_surge',
    name: 'Power Surge',
    sequence: ['heavy', 'heavy', 'light'],
    move: {
      startup: 0.18,
      active: 0.22,
      recovery: 0.45,
      animation: 'heavyAttack',
      hitboxStartFrame: 11,
      hitboxEndFrame: 24,
      totalFrames: 50,
      damage: 280,
      isSpecial: true,
      specialName: 'Power Surge',
    },
  },
  {
    id: 'quick_combo',
    name: 'Quick Combo',
    sequence: ['light', 'light', 'heavy'],
    move: {
      startup: 0.10,
      active: 0.18,
      recovery: 0.30,
      animation: 'lightAttack',
      hitboxStartFrame: 6,
      hitboxEndFrame: 18,
      totalFrames: 35,
      damage: 200,
      isSpecial: true,
      specialName: 'Quick Combo',
    },
  },
];

// ── Input buffer entry ────────────────────────────────────────────────────────
interface BufferEntry {
  key: keyof FighterInput;
  timestamp: number;
}

// ── Queued input during recovery ──────────────────────────────────────────────
interface QueuedAction {
  type: 'light' | 'heavy' | 'guard' | 'grapple' | 'commandThrow';
}

// ── Hitbox active window result ───────────────────────────────────────────────
export interface HitboxWindow {
  active: boolean;
  progress: number;
  move: MoveWindow | null;
  currentFrame: number;
}

// ── Guard result when receiving a hit ────────────────────────────────────────
export interface GuardResult {
  blocked: boolean;
  chipDamage: number;
  guardBroken: boolean;
  finalDamage: number;
}

// ── Grab range check result ───────────────────────────────────────────────────
export interface GrabRangeResult {
  /** Whether the opponent is within grab range */
  inRange: boolean;
  /** Distance to opponent */
  distance: number;
  /** Grab range of the move */
  grabRange: number;
  /** Whether the throw succeeded (in range + opponent not in invincible state) */
  throwSucceeded: boolean;
}

// ── Walking velocity state ────────────────────────────────────────────────────
interface WalkVelocity {
  forward: number;
  strafe: number;
}

// ── Wakeup timing constants ───────────────────────────────────────────────────
const KNOCKDOWN_DURATION = 1.2;
const WAKEUP_BUFFER_WINDOW = 0.8;
const TECH_ROLL_DURATION = 0.45;
const BACKRISE_DURATION = 0.55;
const QUICKSTAND_DURATION = 0.30;

// ── HitStun constants ─────────────────────────────────────────────────────────
/** HitStun duration = active frames of the attack that landed (in seconds) */
const HITSTUN_ACTIVE_FRAME_MULTIPLIER = 1.0;
/** Minimum hitstun regardless of attack active frames */
const HITSTUN_MIN = 0.18;
/** Maximum hitstun cap */
const HITSTUN_MAX = 0.65;

// ── Walking acceleration constants ───────────────────────────────────────────
const WALK_ACCEL = 8.0;
const WALK_DECEL = 14.0;
const WALK_MAX_SPEED = 1.0;
const BACKDASH_VELOCITY = -1.0;
const BACKDASH_DURATION = 0.28;
const BACKDASH_DECEL = 6.0;

// ── Frame-accurate animation transition thresholds ───────────────────────────
/**
 * Hysteresis band for walk animation gating.
 * Enter walk animation only when velocity exceeds ENTER threshold.
 * Exit walk animation (→ idle) only when velocity drops below EXIT threshold.
 * The gap between them prevents rapid walk↔idle oscillation (jitter).
 */
const WALK_ANIM_ENTER = 0.18;   // velocity must exceed this to start walk anim
const WALK_ANIM_EXIT  = 0.08;   // velocity must drop below this to return to idle

// ── Crossfade duration constants ──────────────────────────────────────────────
/** Crossfade duration for walk→idle transition (frames at 60fps) */
const CROSSFADE_WALK_IDLE_FRAMES = 6;
/** Crossfade duration for strafe→backdash transition */
const CROSSFADE_STRAFE_BACKDASH_FRAMES = 4;
/** Crossfade duration for attack transitions */
const CROSSFADE_ATTACK_FRAMES = 3;
/** Crossfade duration for hit/stun transitions */
const CROSSFADE_HIT_FRAMES = 2;

// ── Command throw input detection ─────────────────────────────────────────────
/** Forward input threshold to qualify as "forward" for command throw */
const CMD_THROW_FORWARD_THRESHOLD = 0.5;
/** Time window (ms) within which forward + guard must be pressed */
const CMD_THROW_WINDOW_MS = 200;

// ── Tekken combination input window ──────────────────────────────────────────
/** Time window (ms) for simultaneous button presses to count as a combination */
const TEKKEN_COMBO_WINDOW_MS = 80;

// ── State machine ─────────────────────────────────────────────────────────────
export class FighterStateMachine {
  private actionState: ActionState = 'Idle';
  private motionState: FighterMotionState = 'idle';

  private currentMove: MoveWindow | null = null;
  private moveTimer = 0;
  private moveElapsed = 0;
  private prevMoveElapsed = 0;
  /** Playback lock captured when the swing started. Hitboxes use this, not a second clock. */
  private attackLock = 0;
  private readonly FPS = 60;

  private queuedAction: QueuedAction | null = null;

  private inputBuffer: BufferEntry[] = [];
  /** 10-frame input buffer at 60fps = 167ms. Holds inputs during block stun recovery. */
  private readonly BUFFER_WINDOW_MS = 167;

  // ── HitStun state ─────────────────────────────────────────────────────────
  private hitStunTimer = 0;
  /** The attack move that caused this hitstun (for duration calculation) */
  private hitStunSourceMove: MoveWindow | null = null;

  // ── Stun/crumple timer ────────────────────────────────────────────────────
  private stunTimer = 0;

  // ── Knockdown / wakeup state ──────────────────────────────────────────────
  private knockdownTimer = 0;
  private wakeupBuffered: WakeupOption = null;
  private wakeupActionTimer = 0;
  private wakeupActionState: WakeupOption = null;

  // ── Walking velocity ──────────────────────────────────────────────────────
  private walkVelocity: WalkVelocity = { forward: 0, strafe: 0 };

  // ── Backdash state ────────────────────────────────────────────────────────
  private backdashTimer = 0;
  private isBackdashing = false;

  // ── Command throw state ───────────────────────────────────────────────────
  private commandThrowTimer = 0;
  private commandThrowSucceeded = false;
  /** Pending combo route after a successful throw */
  private throwComboQueue: Array<'light' | 'heavy'> = [];
  private throwComboIndex = 0;
  private throwComboTimer = 0;

  // ── Grab range visualization ──────────────────────────────────────────────
  private grabRangeActive = false;
  private grabRangeTimer = 0;
  private readonly GRAB_RANGE_DISPLAY_DURATION = 0.35;

  // ── Crossfade state (for debug overlay) ──────────────────────────────────
  private crossfadeActive = false;
  private crossfadeFromClip = 'idle';
  private crossfadeToClip = 'idle';
  private crossfadeTimer = 0;
  private crossfadeDuration = 0;

  // ── Heat state (Tekken 8 mechanic) ────────────────────────────────────────
  private inHeatState = false;
  private heatTimer = 0;
  private readonly HEAT_DURATION = 10.0; // 10 seconds

  // ── Rage Art availability ─────────────────────────────────────────────────
  /** Set externally by GameBattleArena based on current HP */
  private rageArtAvailable = false;

  // ── Tekken combination press timestamps ──────────────────────────────────
  private lpPressTime = 0;
  private rpPressTime = 0;
  private lkPressTime = 0;
  private rkPressTime = 0;

  private jumpAirTimer = 0;

  /** Limbs dialed in the current string. Cleared when the fighter returns to idle. */
  private limbChain: Limb[] = [];
  private queuedLimb: Limb | null = null;
  private swingConnected = false;
  private attackGenerationN = 0;
  private pendingStep = 0;
  private stringLabel = '';
  private genericLinks = 0;
  private heatDashQueued = false;
  private heatDashSpent = false;
  private readonly MAX_GENERIC_LINKS = 3;

  private specialMoves: SpecialMoveDefinition[] = [...DEFAULT_SPECIAL_MOVES];
  /** Roster id — seeds directional clips so fighters don't share one swing. */
  private fighterId = '';

  private prevInput: FighterInput = {
    forward: 0, strafe: 0, light: false, heavy: false,
    guard: false, crouch: false, grapple: false, escape: false,
    lp: false, rp: false, lk: false, rk: false,
    heatBurst: false, rageArt: false, leftThrow: false, rightThrow: false,
  };

  // ── Forward press timestamp for command throw detection ───────────────────
  private forwardPressTime = 0;

  // ── Public getters ──────────────────────────────────────────────────────────
  get current(): FighterMotionState { return this.motionState; }
  /** Bumps every time a new swing starts, including 1 into another 1. */
  get attackGeneration(): number { return this.attackGenerationN; }
  /** "1,2" or "HEAT DASH" for the combo counter. Empty when not in a route. */
  get comboTag(): string { return this.stringLabel; }
  get limbDepth(): number { return this.limbChain.length; }
  /** World units to step toward the opponent. Cleared on read. */
  consumeStep(): number {
    const step = this.pendingStep;
    this.pendingStep = 0;
    return step;
  }
  /** The previous swing touched them (hit or block). Whiff stays false. */
  notifyContact(connected: boolean) {
    if (connected) this.swingConnected = true;
  }
  get isCrouching(): boolean {
    return this.motionState === 'crouch' || (this.actionState === 'Guard' && !!this.prevInput.crouch);
  }
  /** Still inside startup — a hit here is a counter. */
  get inAttackStartup(): boolean {
    return this.actionState === 'Attacking' && !!this.currentMove && this.moveElapsed < this.currentMove.startup - 0.008;
  }
  /** Clip the mesh should play for the committed attack. Null when not attacking. */
  get activeAttackClip(): string | null {
    if (this.actionState !== 'Attacking' && this.actionState !== 'CommandThrow') return null;
    return this.currentMove?.clip ?? null;
  }
  bindFighter(id: string) {
    this.fighterId = id;
  }
  get action(): ActionState { return this.actionState; }
  get isRecovering(): boolean {
    if (!this.currentMove) return false;
    const recoveryStart = this.currentMove.startup + this.currentMove.active;
    return this.moveElapsed >= recoveryStart;
  }
  get isInAttack(): boolean { return this.actionState === 'Attacking'; }
  get isStunned(): boolean {
    return this.actionState === 'Stunned' || this.actionState === 'Crumple';
  }
  get isKnockedDown(): boolean { return this.actionState === 'Knockdown'; }
  get isInHitStun(): boolean { return this.actionState === 'HitStun'; }
  get isInCommandThrow(): boolean { return this.actionState === 'CommandThrow'; }
  get isInHeatState(): boolean { return this.inHeatState; }

  /** Whether grab range visualization should be shown */
  get showGrabRange(): boolean { return this.grabRangeActive; }
  /** Grab range radius for visualization */
  get grabRangeRadius(): number { return COMMAND_THROW_MOVE.grabRange ?? 1.4; }

  getQueuedAction(): { type: string; label: string } | null {
    if (!this.queuedAction) return null;
    const labels: Record<string, string> = {
      light: 'L', heavy: 'H', guard: 'G', grapple: 'GR', commandThrow: 'CT',
    };
    return { type: this.queuedAction.type, label: labels[this.queuedAction.type] ?? this.queuedAction.type.toUpperCase() };
  }

  getRecoveryProgress(): number {
    if (!this.currentMove || !this.isRecovering) return 0;
    const recoveryStart = this.currentMove.startup + this.currentMove.active;
    const recoveryDuration = this.currentMove.recovery;
    if (recoveryDuration <= 0) return 1;
    return Math.min(1, (this.moveElapsed - recoveryStart) / recoveryDuration);
  }

  /** Returns HitStun progress 0-1 (0 = just entered, 1 = exiting) */
  getHitStunProgress(): number {
    if (this.actionState !== 'HitStun' || !this.hitStunSourceMove) return 0;
    const total = this.computeHitStunDuration(this.hitStunSourceMove);
    if (total <= 0) return 1;
    return Math.min(1, 1 - (this.hitStunTimer / total));
  }

  getBufferedWakeup(): WakeupOption { return this.wakeupBuffered; }
  getWalkVelocity(): WalkVelocity { return { ...this.walkVelocity }; }

  /** Returns throw combo progress info for HUD */
  getThrowComboState(): { active: boolean; route: string[]; index: number } {
    return {
      active: this.throwComboQueue.length > 0 && this.throwComboIndex < this.throwComboQueue.length,
      route: this.throwComboQueue,
      index: this.throwComboIndex,
    };
  }

  /** Returns current crossfade state for debug overlay */
  getCrossfadeState(): CrossfadeState {
    return {
      isCrossfading: this.crossfadeActive,
      fromClip: this.crossfadeFromClip,
      toClip: this.crossfadeToClip,
      progress: this.crossfadeDuration > 0 ? Math.min(1, 1 - this.crossfadeTimer / this.crossfadeDuration) : 0,
      duration: this.crossfadeDuration,
    };
  }

  /** Set rage art availability based on current HP percentage */
  setRageArtAvailable(hpPercent: number) {
    this.rageArtAvailable = hpPercent <= 0.25;
  }

  registerSpecialMoves(moves: SpecialMoveDefinition[]) {
    // Character kit first so unique signatures win on shared sequences
    // (heavy,heavy,light is both Power Surge and many finishers).
    this.specialMoves = [...moves, ...DEFAULT_SPECIAL_MOVES.filter(
      (def) => !moves.some((m) => m.id === def.id),
    )];
  }

  // ── Apply HitStun (duration = active frames of the attacking move) ─────────
  /**
   * Apply HitStun state. Duration is derived from the active frames of the
   * move that landed, clamped between HITSTUN_MIN and HITSTUN_MAX.
   * This replaces the old applyStun for normal hits.
   */
  applyHitStun(
    sourceMove: MoveWindow | null,
    fallbackDuration = 0.3,
    reaction: FighterMotionState = 'hit',
  ) {
    const duration = sourceMove
      ? this.computeHitStunDuration(sourceMove)
      : Math.max(HITSTUN_MIN, Math.min(HITSTUN_MAX, fallbackDuration));

    const pose: FighterMotionState = reaction === 'hitLow' || reaction === 'hitHigh' ? reaction : 'hit';
    this.beginCrossfade(this.motionState, pose, CROSSFADE_HIT_FRAMES / this.FPS);
    this.actionState = 'HitStun';
    this.motionState = pose;
    this.hitStunTimer = duration;
    this.hitStunSourceMove = sourceMove;
    this.currentMove = null;
    this.moveTimer = 0;
    this.moveElapsed = 0;
    this.queuedAction = null;
    this.walkVelocity = { forward: 0, strafe: 0 };
    this.isBackdashing = false;
    this.jumpAirTimer = 0;
    this.limbChain = [];
    this.queuedLimb = null;
    this.stringLabel = '';
    this.swingConnected = false;
    console.log(`[FSM] 💥 HitStun applied — duration=${duration.toFixed(3)}s (active=${sourceMove?.active?.toFixed(3) ?? 'N/A'}s)`);
  }

  // ── Legacy applyStun (kept for compatibility, routes to HitStun or Crumple) ─
  applyStun(duration: number, isCrumple = false, reaction: FighterMotionState = 'hit') {
    if (isCrumple) {
      this.actionState = 'Crumple';
      this.motionState = 'knockdown';
      this.stunTimer = duration;
      this.currentMove = null;
      this.moveTimer = 0;
      this.moveElapsed = 0;
      this.queuedAction = null;
      this.walkVelocity = { forward: 0, strafe: 0 };
      this.isBackdashing = false;
    } else {
      // Route to HitStun with provided duration
      this.applyHitStun(null, duration, reaction);
    }
  }

  applyKnockdown() {
    this.actionState = 'Knockdown';
    this.motionState = 'knockdown';
    this.knockdownTimer = KNOCKDOWN_DURATION;
    this.wakeupBuffered = null;
    this.wakeupActionTimer = 0;
    this.wakeupActionState = null;
    this.currentMove = null;
    this.moveTimer = 0;
    this.moveElapsed = 0;
    this.queuedAction = null;
    this.walkVelocity = { forward: 0, strafe: 0 };
    this.isBackdashing = false;
    this.throwComboQueue = [];
    this.throwComboIndex = 0;
    console.log('[FSM] ⬇️ Knockdown — wakeup buffer open in', (KNOCKDOWN_DURATION - WAKEUP_BUFFER_WINDOW).toFixed(2), 's');
  }

  processIncomingHit(move: MoveWindow): GuardResult {
    const isGuarding = this.actionState === 'Guard';
    const rawDamage = move.damage ?? 100;

    if (move.isThrow || move.isCommandThrow) {
      console.log('[FSM] 🤜 Throw — guard bypassed, full damage:', rawDamage);
      return { blocked: false, chipDamage: 0, guardBroken: true, finalDamage: rawDamage };
    }

    if (move.isUnblockable) {
      console.log('[FSM] 💥 Unblockable — guard bypassed, full damage:', rawDamage);
      return { blocked: false, chipDamage: 0, guardBroken: true, finalDamage: rawDamage };
    }

    if (isGuarding) {
      const chipDamage = Math.max(1, Math.floor(rawDamage * 0.05));
      console.log(`[FSM] 🛡️ Blocked — chip=${chipDamage} (5% of ${rawDamage})`);
      return { blocked: true, chipDamage, guardBroken: false, finalDamage: chipDamage };
    }

    return { blocked: false, chipDamage: 0, guardBroken: false, finalDamage: rawDamage };
  }

  checkGrabRange(
    selfX: number,
    opponentX: number,
    opponentActionState: ActionState,
  ): GrabRangeResult {
    const grabRange = COMMAND_THROW_MOVE.grabRange ?? 1.4;
    const distance = Math.abs(selfX - opponentX);
    const inRange = distance <= grabRange;

    // Opponent is invincible during wakeup animations
    const opponentInvincible =
      opponentActionState === 'WakeupTechRoll' ||
      opponentActionState === 'WakeupBackrise' ||
      opponentActionState === 'Knockdown';

    const throwSucceeded = inRange && !opponentInvincible;

    // Activate grab range visualization
    this.grabRangeActive = true;
    this.grabRangeTimer = this.GRAB_RANGE_DISPLAY_DURATION;

    console.log(
      `[FSM] 🤲 Grab range check — dist=${distance.toFixed(2)}, range=${grabRange}, inRange=${inRange}, succeeded=${throwSucceeded}`,
    );

    return { inRange, distance, grabRange, throwSucceeded };
  }

  getHitboxWindow(): HitboxWindow {
    if (!this.currentMove || (this.actionState !== 'Attacking' && this.actionState !== 'CommandThrow')) {
      return { active: false, progress: 0, move: null, currentFrame: 0 };
    }
    const move = this.currentMove;
    const elapsed = this.moveElapsed;
    const currentFrame = Math.floor(elapsed * this.FPS);
    // Seconds, not "frame 8 of a 60fps chart." A 2-frame active used to
    // fall between raf samples, so the fist visually connected and the
    // hitbox never existed.
    const lock = Math.max(0.16, this.attackLock || (move.startup + move.active + move.recovery));
    let start = move.startup;
    let end = move.startup + Math.max(move.active, 0.05);
    if (isSpinClip(move.clip)) {
      start = lock * 0.40;
      end = Math.min(lock * 0.72, start + 0.28);
    } else if (end > lock * 0.95) {
      start = lock * 0.30;
      end = lock * 0.62;
    }
    const active = elapsed >= start && this.prevMoveElapsed <= end;
    const span = Math.max(0.001, end - start);
    const progress = active ? Math.max(0, Math.min(1, (elapsed - start) / span)) : 0;

    return { active, progress, move, currentFrame };
  }

  // ── Main update ─────────────────────────────────────────────────────────────
  update(input: FighterInput, dt: number): FighterMotionState {
    const now = performance.now();

    // ── Resolve Tekken 4-limb inputs into light/heavy/throw ──────────────
    const resolvedInput = this.resolveTekkenInputs(input, now);

    const risingLight = resolvedInput.light && !this.prevInput.light;
    const risingHeavy = resolvedInput.heavy && !this.prevInput.heavy;
    const risingGuard = resolvedInput.guard && !this.prevInput.guard;
    const risingGrapple = (resolvedInput.grapple ?? false) && !(this.prevInput.grapple ?? false);
    const risingLp = (resolvedInput.lp ?? false) && !(this.prevInput.lp ?? false);
    const risingRp = (resolvedInput.rp ?? false) && !(this.prevInput.rp ?? false);
    const risingLk = (resolvedInput.lk ?? false) && !(this.prevInput.lk ?? false);
    const risingRk = (resolvedInput.rk ?? false) && !(this.prevInput.rk ?? false);

    const risingForwardPos = resolvedInput.forward > 0.5 && this.prevInput.forward <= 0.5;
    const risingForwardNeg = resolvedInput.forward < -0.5 && this.prevInput.forward >= -0.5;
    const risingStrafe = Math.abs(resolvedInput.strafe) > 0.5 && Math.abs(this.prevInput.strafe) <= 0.5;

    // Track forward press time for command throw detection
    if (risingForwardPos) {
      this.forwardPressTime = now;
    }

    if (risingLight) this.pushBuffer('light', now);
    if (risingHeavy) this.pushBuffer('heavy', now);
    if (risingGuard) this.pushBuffer('guard', now);
    if (risingGrapple) this.pushBuffer('grapple', now);

    this.prevInput = { ...resolvedInput };

    // ── Crossfade tick ────────────────────────────────────────────────────
    if (this.crossfadeActive) {
      this.crossfadeTimer = Math.max(0, this.crossfadeTimer - dt);
      if (this.crossfadeTimer <= 0) {
        this.crossfadeActive = false;
      }
    }

    // ── Heat state tick ───────────────────────────────────────────────────
    if (this.inHeatState) {
      this.heatTimer = Math.max(0, this.heatTimer - dt);
      if (this.heatTimer <= 0) {
        this.inHeatState = false;
        console.log('[FSM] 🔥 Heat State expired');
      }
    }

    // ── Grab range visualization timer ────────────────────────────────────
    if (this.grabRangeActive) {
      this.grabRangeTimer = Math.max(0, this.grabRangeTimer - dt);
      if (this.grabRangeTimer <= 0) this.grabRangeActive = false;
    }

    // ── Throw combo chain routing ─────────────────────────────────────────
    if (this.throwComboQueue.length > 0 && this.throwComboIndex < this.throwComboQueue.length) {
      this.throwComboTimer = Math.max(0, this.throwComboTimer - dt);
      if (this.throwComboTimer <= 0) {
        const nextHit = this.throwComboQueue[this.throwComboIndex];
        this.throwComboIndex++;
        console.log(`[FSM] ⛓️ Throw combo chain — hit ${this.throwComboIndex}/${this.throwComboQueue.length}: ${nextHit}`);
        if (nextHit === 'light') {
          this.throwComboTimer = DEFAULT_MOVE_WINDOWS.lightAttack.startup + DEFAULT_MOVE_WINDOWS.lightAttack.active + DEFAULT_MOVE_WINDOWS.lightAttack.recovery;
          return this.beginAttack('lightAttack', DEFAULT_MOVE_WINDOWS.lightAttack);
        } else {
          this.throwComboTimer = DEFAULT_MOVE_WINDOWS.heavyAttack.startup + DEFAULT_MOVE_WINDOWS.heavyAttack.active + DEFAULT_MOVE_WINDOWS.heavyAttack.recovery;
          return this.beginAttack('heavyAttack', DEFAULT_MOVE_WINDOWS.heavyAttack);
        }
      }
      return this.motionState;
    } else if (this.throwComboQueue.length > 0 && this.throwComboIndex >= this.throwComboQueue.length) {
      // Combo chain complete
      this.throwComboQueue = [];
      this.throwComboIndex = 0;
    }

    // ── Knockdown / wakeup tick ──────────────────────────────────────────────
    if (this.actionState === 'Knockdown') {
      this.knockdownTimer = Math.max(0, this.knockdownTimer - dt);
      const inBufferWindow = this.knockdownTimer <= WAKEUP_BUFFER_WINDOW;

      if (inBufferWindow && this.wakeupBuffered === null) {
        if (risingForwardPos) {
          this.wakeupBuffered = 'quickStand';
          console.log('[FSM] ⬆️ Wakeup buffered: quickStand');
        } else if (risingForwardNeg || risingStrafe) {
          this.wakeupBuffered = 'techRoll';
          console.log('[FSM] 🔄 Wakeup buffered: techRoll');
        } else if (risingGuard) {
          this.wakeupBuffered = 'backrise';
          console.log('[FSM] ↩️ Wakeup buffered: backrise');
        }
      }

      if (this.knockdownTimer <= 0) {
        return this.executeWakeup(this.wakeupBuffered ?? 'quickStand');
      }
      return this.motionState;
    }

    // ── Wakeup action tick ───────────────────────────────────────────────────
    if (this.wakeupActionState !== null) {
      this.wakeupActionTimer = Math.max(0, this.wakeupActionTimer - dt);
      if (this.wakeupActionTimer <= 0) {
        this.wakeupActionState = null;
        this.actionState = 'Idle';
        this.motionState = 'idle';
        console.log('[FSM] ✅ Wakeup action complete → Idle');
      }
      return this.motionState;
    }

    // ── HitStun tick (precise recovery-frame exit) ────────────────────────
    if (this.actionState === 'HitStun') {
      this.hitStunTimer = Math.max(0, this.hitStunTimer - dt);
      // Whole stun, not just the last few frames — a late press used to vanish.
      if (risingLp) this.queuedLimb = 'lp';
      if (risingRp) this.queuedLimb = 'rp';
      if (risingLk) this.queuedLimb = 'lk';
      if (risingRk) this.queuedLimb = 'rk';
      if (risingLight && !this.queuedLimb && !this.queuedAction) this.queuedAction = { type: 'light' };
      if (risingHeavy && !this.queuedLimb && !this.queuedAction) this.queuedAction = { type: 'heavy' };
      if (risingGuard && !this.queuedAction) this.queuedAction = { type: 'guard' };
      if (this.hitStunTimer <= 0) {
        this.hitStunSourceMove = null;
        this.actionState = 'Idle';
        this.motionState = 'idle';
        console.log('[FSM] ✅ HitStun expired → Idle');
        if (this.queuedLimb) {
          const limb = this.queuedLimb;
          this.queuedLimb = null;
          this.queuedAction = null;
          return this.openLimb(limb);
        }
        if (this.queuedAction) {
          const queued = this.queuedAction;
          this.queuedAction = null;
          return this.executeQueuedAction(queued);
        }
      }
      return this.motionState;
    }

    // ── Stun / Crumple tick ──────────────────────────────────────────────────
    if (this.actionState === 'Stunned' || this.actionState === 'Crumple') {
      this.stunTimer = Math.max(0, this.stunTimer - dt);
      if (this.stunTimer <= 0) {
        this.actionState = 'Idle';
        this.motionState = 'idle';
      }
      return this.motionState;
    }

    // ── Command throw tick ────────────────────────────────────────────────
    if (this.actionState === 'CommandThrow') {
      this.moveTimer = Math.max(0, this.moveTimer - dt);
      this.prevMoveElapsed = this.moveElapsed;
      this.moveElapsed += dt;

      if (this.moveTimer <= 0) {
        this.currentMove = null;
        this.actionState = 'Idle';
        this.motionState = 'idle';
        this.moveElapsed = 0;
        console.log('[FSM] ✅ CommandThrow complete → Idle');
        // Begin throw combo chain if throw succeeded
        if (this.commandThrowSucceeded && this.throwComboQueue.length > 0) {
          this.throwComboIndex = 0;
          this.throwComboTimer = 0.05; // small delay before first combo hit
          console.log('[FSM] ⛓️ Starting throw combo chain:', this.throwComboQueue);
        }
        this.commandThrowSucceeded = false;
      }
      return this.motionState;
    }

    // ── ThrowWhiff tick ───────────────────────────────────────────────────
    if (this.actionState === 'ThrowWhiff') {
      this.moveTimer = Math.max(0, this.moveTimer - dt);
      if (this.moveTimer <= 0) {
        this.actionState = 'Idle';
        this.motionState = 'idle';
        console.log('[FSM] ✅ ThrowWhiff complete → Idle');
      }
      return this.motionState;
    }

    // ── Attack tick ──────────────────────────────────────────────────────────
    if (this.actionState === 'Attacking' && this.currentMove) {
      this.moveTimer = Math.max(0, this.moveTimer - dt);
      this.prevMoveElapsed = this.moveElapsed;
      this.moveElapsed += dt;

      if (risingLp) this.queuedLimb = 'lp';
      if (risingRp) this.queuedLimb = 'rp';
      if (risingLk) this.queuedLimb = 'lk';
      if (risingRk) this.queuedLimb = 'rk';
      if (this.inHeatState && this.swingConnected && (resolvedInput.dashing || resolvedInput.running) && !this.heatDashSpent) {
        this.heatDashQueued = true;
      }

      const cancelAt = this.currentMove.cancelAt
        ?? (this.currentMove.startup + this.currentMove.active + this.currentMove.recovery * 0.72);
      if (this.moveElapsed >= cancelAt) {
        const canceled = this.tryStringCancel(!!resolvedInput.crouch);
        if (canceled) return canceled;
      }

      if (this.isRecovering) {
        if (risingLight && !this.queuedAction) this.queuedAction = { type: 'light' };
        if (risingHeavy && !this.queuedAction) this.queuedAction = { type: 'heavy' };
        if (risingGuard && !this.queuedAction) this.queuedAction = { type: 'guard' };
        if (risingGrapple && !this.queuedAction) this.queuedAction = { type: 'grapple' };
      }

      if (this.moveTimer <= 0) {
        const late = this.swingConnected ? this.tryStringCancel(!!resolvedInput.crouch) : null;
        if (late) return late;

        this.currentMove = null;
        this.actionState = 'Idle';
        this.moveElapsed = 0;
        this.limbChain = [];
        this.stringLabel = '';
        this.genericLinks = 0;
        this.heatDashSpent = false;
        this.heatDashQueued = false;
        this.queuedLimb = null;

        if (this.queuedAction) {
          const queued = this.queuedAction;
          this.queuedAction = null;
          return this.executeQueuedAction(queued);
        }
      } else {
        return this.motionState;
      }
    }

    // ── Backdash tick ────────────────────────────────────────────────────────
    if (this.isBackdashing) {
      this.backdashTimer = Math.max(0, this.backdashTimer - dt);
      const decel = BACKDASH_DECEL * dt;
      if (this.walkVelocity.forward < 0) {
        this.walkVelocity.forward = Math.min(0, this.walkVelocity.forward + decel);
      }
      if (this.backdashTimer <= 0) {
        this.isBackdashing = false;
        this.walkVelocity.forward = 0;
        this.beginCrossfade('walkBackward', 'idle', CROSSFADE_WALK_IDLE_FRAMES / this.FPS);
        this.actionState = 'Idle';
        this.motionState = 'idle';
      }
      return this.motionState;
    }

    // ── Idle / Walking — process new inputs ──────────────────────────────────

    // ── Rage Art: available below 25% HP ─────────────────────────────────
    if (resolvedInput.rageArt && this.rageArtAvailable && this.actionState !== 'Attacking') {
      console.log('[FSM] 💢 Rage Art activated!');
      return this.beginAttack('heavyAttack', RAGE_ART_MOVE);
    }

    // ── Heat Burst: 2+3 (RP+LK) ──────────────────────────────────────────
    if (resolvedInput.heatBurst && !this.inHeatState && this.actionState !== 'Attacking') {
      console.log('[FSM] 🔥 Heat Burst activated!');
      this.inHeatState = true;
      this.heatTimer = this.HEAT_DURATION;
      return this.beginAttack('heavyAttack', HEAT_BURST_MOVE);
    }

    // ── Left Throw (1+3): LP+LK ──────────────────────────────────────────
    if (resolvedInput.leftThrow && this.actionState !== 'Attacking') {
      console.log('[FSM] 🤜 Left Throw (1+3)');
      return this.beginCommandThrowWithMove(LEFT_THROW_MOVE);
    }

    // ── Right Throw (2+4): RP+RK ─────────────────────────────────────────
    if (resolvedInput.rightThrow && this.actionState !== 'Attacking') {
      console.log('[FSM] 🤛 Right Throw (2+4)');
      return this.beginCommandThrowWithMove(RIGHT_THROW_MOVE);
    }

    // ── Command throw detection: Forward + Guard within CMD_THROW_WINDOW_MS ──
    if (risingGuard && resolvedInput.forward > CMD_THROW_FORWARD_THRESHOLD) {
      const timeSinceForward = now - this.forwardPressTime;
      if (timeSinceForward <= CMD_THROW_WINDOW_MS) {
        console.log('[FSM] 🤲 Command throw input detected (Forward+Guard)');
        return this.beginCommandThrow();
      }
    }

    const special = this.detectSpecialMove(now);
    if (special) {
      this.walkVelocity = { forward: 0, strafe: 0 };
      return this.beginAttack(special.move.animation, special.move);
    }

    if (risingLk && !risingLp) return this.openLimb('lk');
    if (risingRk && !risingRp) return this.openLimb('rk');
    if (risingLp || (risingLight && !risingLk && !risingRk)) return this.openLimb('lp');
    if (risingRp || (risingHeavy && !risingLk && !risingRk)) return this.openLimb('rp');

    if (resolvedInput.guard) {
      this.actionState = 'Guard';
      this.motionState = resolvedInput.crouch ? 'crouch' : 'guard';
      this.walkVelocity = { forward: 0, strafe: 0 };
      return this.motionState;
    }

    if (resolvedInput.jump || this.actionState === 'Jumping' || this.jumpAirTimer > 0) {
      if (resolvedInput.jump && this.jumpAirTimer <= 0) this.jumpAirTimer = 0.55;
      this.jumpAirTimer = Math.max(0, this.jumpAirTimer - dt);
      const airFwd = Math.abs(resolvedInput.forward) > 0.1 ? Math.sign(resolvedInput.forward) : 0;
      const airStr = Math.abs(resolvedInput.strafe) > 0.1 ? Math.sign(resolvedInput.strafe) : 0;
      this.walkVelocity.forward = this.smoothVelocity(this.walkVelocity.forward, airFwd, dt);
      this.walkVelocity.strafe = this.smoothVelocity(this.walkVelocity.strafe, airStr, dt);
      if (!resolvedInput.jump && this.jumpAirTimer <= 0) {
        this.actionState = 'Idle';
      } else {
        this.actionState = 'Jumping';
        this.motionState = resolvedInput.forward > 0.3 ? 'jumpForward' : resolvedInput.forward < -0.3 ? 'jumpBack' : 'jump';
        return this.motionState;
      }
    }

    if (resolvedInput.crouch && Math.abs(resolvedInput.forward) < 0.2 && Math.abs(resolvedInput.strafe) < 0.2) {
      this.actionState = 'Idle';
      this.motionState = 'crouch';
      this.walkVelocity = { forward: 0, strafe: 0 };
      return this.motionState;
    }

    if (resolvedInput.backdashing && !this.isBackdashing) {
      return this.beginBackdash();
    }

    if (resolvedInput.running) {
      this.actionState = 'Walking';
      this.updateWalking(resolvedInput, dt);
      this.motionState = resolvedInput.forward < 0 ? 'walkBackward' : 'run';
      return this.motionState;
    }

    if (resolvedInput.dashing) {
      this.actionState = 'Walking';
      this.updateWalking(resolvedInput, dt);
      this.motionState = 'dash';
      return this.motionState;
    }

    const backTap = resolvedInput.forward < -0.7 && this.prevInput.forward >= -0.3;
    if (backTap && !this.isBackdashing && this.actionState !== 'Attacking') {
      return this.beginBackdash();
    }

    return this.updateWalking(resolvedInput, dt);
  }

  // ── Resolve Tekken 4-limb inputs into standard inputs ─────────────────────
  /**
   * Maps Tekken's 1/2/3/4 limb buttons and combination inputs to the
   * existing light/heavy/guard/throw system.
   *
   * Tekken mapping:
   *   1 (LP) → light attack
   *   2 (RP) → heavy attack
   *   3 (LK) → light attack (kick variant, same slot)
   *   4 (RK) → heavy attack (kick variant, same slot)
   *   1+3 (LP+LK) → left throw
   *   2+4 (RP+RK) → right throw
   *   1+2 (LP+RP) → parry / heavy strike
   *   3+4 (LK+RK) → heavy kick combo
   *   2+3 (RP+LK) → heat burst
   */
  private resolveTekkenInputs(input: FighterInput, now: number): FighterInput {
    const resolved = { ...input };

    // Track individual limb press times for combination detection
    if (input.lp && !this.prevInput.lp) this.lpPressTime = now;
    if (input.rp && !this.prevInput.rp) this.rpPressTime = now;
    if (input.lk && !this.prevInput.lk) this.lkPressTime = now;
    if (input.rk && !this.prevInput.rk) this.rkPressTime = now;

    // Detect simultaneous presses within TEKKEN_COMBO_WINDOW_MS
    const lpActive = input.lp ?? false;
    const rpActive = input.rp ?? false;
    const lkActive = input.lk ?? false;
    const rkActive = input.rk ?? false;

    const lpRpSimult = lpActive && rpActive && Math.abs(this.lpPressTime - this.rpPressTime) <= TEKKEN_COMBO_WINDOW_MS;
    const lkRkSimult = lkActive && rkActive && Math.abs(this.lkPressTime - this.rkPressTime) <= TEKKEN_COMBO_WINDOW_MS;
    const lpLkSimult = lpActive && lkActive && Math.abs(this.lpPressTime - this.lkPressTime) <= TEKKEN_COMBO_WINDOW_MS;
    const rpRkSimult = rpActive && rkActive && Math.abs(this.rpPressTime - this.rkPressTime) <= TEKKEN_COMBO_WINDOW_MS;
    const rpLkSimult = rpActive && lkActive && Math.abs(this.rpPressTime - this.lkPressTime) <= TEKKEN_COMBO_WINDOW_MS;

    // Combination inputs take priority over single presses
    if (rpLkSimult || input.heatBurst) {
      // 2+3 = Heat Burst
      resolved.heatBurst = true;
      resolved.light = false;
      resolved.heavy = false;
    } else if (lpLkSimult || input.leftThrow) {
      // 1+3 = Left Throw
      resolved.leftThrow = true;
      resolved.light = false;
    } else if (rpRkSimult || input.rightThrow) {
      // 2+4 = Right Throw
      resolved.rightThrow = true;
      resolved.heavy = false;
    } else if (lpRpSimult) {
      // 1+2 = Parry / heavy two-handed strike → maps to heavy
      resolved.heavy = true;
      resolved.light = false;
    } else if (lkRkSimult) {
      // 3+4 = Heavy kick combo → maps to heavy
      resolved.heavy = true;
      resolved.light = false;
    } else {
      // Single limb presses
      if (lpActive || lkActive) resolved.light = true;
      if (rpActive || rkActive) resolved.heavy = true;
    }

    return resolved;
  }

  // ── Compute HitStun duration from active frames of the source move ─────────
  private computeHitStunDuration(move: MoveWindow): number {
    const activeSeconds = move.active * HITSTUN_ACTIVE_FRAME_MULTIPLIER;
    return Math.max(HITSTUN_MIN, Math.min(HITSTUN_MAX, activeSeconds));
  }

  // ── Begin crossfade between animation clips ────────────────────────────────
  private beginCrossfade(fromClip: string, toClip: string, durationSeconds: number) {
    if (fromClip === toClip) return;
    this.crossfadeActive = true;
    this.crossfadeFromClip = fromClip;
    this.crossfadeToClip = toClip;
    this.crossfadeDuration = durationSeconds;
    this.crossfadeTimer = durationSeconds;
  }

  // ── Begin command throw with a specific move ──────────────────────────────
  private beginCommandThrowWithMove(move: MoveWindow): FighterMotionState {
    const clip = move.clip ?? directionalAttackClip(this.fighterId, 'CommandThrow', {
      forward: this.prevInput.forward,
      crouch: !!this.prevInput.crouch,
    }) ?? undefined;
    this.actionState = 'CommandThrow';
    this.motionState = 'heavyAttack';
    this.currentMove = { ...move, clip };
    const frameTotal = move.startup + move.active + move.recovery;
    this.moveTimer = computeAttackLockDuration('CommandThrow', frameTotal);
    this.moveElapsed = 0;
    this.queuedAction = null;
    this.commandThrowSucceeded = false;
    this.throwComboQueue = [...(move.throwComboRoute ?? [])];
    this.throwComboIndex = 0;
    this.grabRangeActive = true;
    this.grabRangeTimer = move.startup + move.active;
    return this.motionState;
  }

  // ── Begin command throw ────────────────────────────────────────────────────
  private beginCommandThrow(): FighterMotionState {
    const clip = directionalAttackClip(this.fighterId, 'CommandThrow', {
      forward: this.prevInput.forward,
      crouch: !!this.prevInput.crouch,
    }) ?? undefined;
    this.actionState = 'CommandThrow';
    this.motionState = 'heavyAttack';
    this.currentMove = { ...COMMAND_THROW_MOVE, clip };
    const frameTotal = COMMAND_THROW_MOVE.startup + COMMAND_THROW_MOVE.active + COMMAND_THROW_MOVE.recovery;
    this.moveTimer = computeAttackLockDuration('CommandThrow', frameTotal);
    this.moveElapsed = 0;
    this.queuedAction = null;
    this.commandThrowSucceeded = false;
    // Pre-load the throw combo route
    this.throwComboQueue = [...(COMMAND_THROW_MOVE.throwComboRoute ?? [])];
    this.throwComboIndex = 0;
    // Activate grab range visualization
    this.grabRangeActive = true;
    this.grabRangeTimer = COMMAND_THROW_MOVE.startup + COMMAND_THROW_MOVE.active;
    console.log('[FSM] 🤲 CommandThrow started — grab range:', COMMAND_THROW_MOVE.grabRange);
    return this.motionState;
  }

  /** Called by GameBattleArena when command throw hitbox connects */
  resolveCommandThrow(throwSucceeded: boolean) {
    this.commandThrowSucceeded = throwSucceeded;
    if (!throwSucceeded) {
      // Whiff — cancel into ThrowWhiff state with extra recovery penalty
      this.actionState = 'ThrowWhiff';
      this.motionState = 'idle';
      this.moveTimer = COMMAND_THROW_MOVE.recovery * 1.5; // 50% extra recovery on whiff
      this.currentMove = null;
      this.throwComboQueue = [];
      console.log('[FSM] ❌ CommandThrow whiffed — extra recovery penalty');
    } else {
      console.log('[FSM] ✅ CommandThrow connected — combo chain queued:', this.throwComboQueue);
    }
  }

  private updateWalking(input: FighterInput, dt: number): FighterMotionState {
    const targetForward = Math.abs(input.forward) > 0.1 ? Math.sign(input.forward) * Math.min(1, Math.abs(input.forward)) : 0;
    const targetStrafe = Math.abs(input.strafe) > 0.1 ? Math.sign(input.strafe) * Math.min(1, Math.abs(input.strafe)) : 0;

    const prevForward = this.walkVelocity.forward;
    const prevStrafe = this.walkVelocity.strafe;

    this.walkVelocity.forward = this.smoothVelocity(this.walkVelocity.forward, targetForward, dt);
    this.walkVelocity.strafe = this.smoothVelocity(this.walkVelocity.strafe, targetStrafe, dt);

    const absForward = Math.abs(this.walkVelocity.forward);
    const absStrafe = Math.abs(this.walkVelocity.strafe);

    // ── Hysteresis: use different thresholds for entering vs exiting walk ────
    // If currently idle, require ENTER threshold to start walking.
    // If currently walking, only stop at EXIT threshold.
    // This prevents rapid idle↔walk oscillation from micro-inputs.
    const currentlyMoving = this.actionState === 'Walking' || this.actionState === 'Backdashing';
    const exitThreshold = currentlyMoving ? WALK_ANIM_EXIT : WALK_ANIM_ENTER;
    const moving = absForward > exitThreshold || absStrafe > exitThreshold;

    if (!moving) {
      // Snap to zero to prevent float drift
      if (absForward < 0.02) this.walkVelocity.forward = 0;
      if (absStrafe < 0.02) this.walkVelocity.strafe = 0;

      // Crossfade walk→idle when decelerating to a stop
      // Only fire if we were actually in a walk motion state (not already idle)
      const wasMoving = Math.abs(prevForward) > WALK_ANIM_EXIT || Math.abs(prevStrafe) > WALK_ANIM_EXIT;
      if (wasMoving && this.motionState !== 'idle') {
        this.beginCrossfade(this.motionState, 'idle', CROSSFADE_WALK_IDLE_FRAMES / this.FPS);
      }

      this.actionState = 'Idle';
      this.motionState = 'idle';
      return this.motionState;
    }

    this.actionState = 'Walking';

    // ── Determine dominant direction ─────────────────────────────────────────
    // Use a small dead-zone ratio to prevent direction flipping when forward
    // and strafe are nearly equal (prevents locked-in direction jitter).
    const DIRECTION_DOMINANCE_RATIO = 1.15; // forward must be 15% stronger than strafe to dominate
    let newMotion: FighterMotionState = this.motionState;

    const forwardDominant = absForward * DIRECTION_DOMINANCE_RATIO >= absStrafe;
    const strafeDominant  = absStrafe  * DIRECTION_DOMINANCE_RATIO >= absForward;

    if (forwardDominant && absForward > exitThreshold) {
      if (this.walkVelocity.forward > 0) {
        newMotion = 'walkForward';
      } else {
        newMotion = 'walkBackward';
      }
    } else if (strafeDominant && absStrafe > exitThreshold) {
      if (this.walkVelocity.strafe > 0) {
        newMotion = 'strafeRight';
      } else {
        newMotion = 'strafeLeft';
      }
    }
    // If neither is dominant (equal magnitudes), keep current motion to avoid flip

    // ── Frame-accurate crossfade on direction change ─────────────────────────
    if (newMotion !== this.motionState) {
      // Detect strafe→backward transition (could be start of backdash)
      const isStrafeToDash =
        (this.motionState === 'strafeLeft' || this.motionState === 'strafeRight') &&
        newMotion === 'walkBackward';
      const crossfadeFrames = isStrafeToDash
        ? CROSSFADE_STRAFE_BACKDASH_FRAMES
        : CROSSFADE_WALK_IDLE_FRAMES;
      this.beginCrossfade(this.motionState, newMotion, crossfadeFrames / this.FPS);
      this.motionState = newMotion;
    }

    return this.motionState;
  }

  private smoothVelocity(current: number, target: number, dt: number): number {
    if (Math.abs(target) < 0.01) {
      const decel = WALK_DECEL * dt;
      if (current > 0) return Math.max(0, current - decel);
      if (current < 0) return Math.min(0, current + decel);
      return 0;
    }
    const accel = WALK_ACCEL * dt;
    if (current < target) return Math.min(target, current + accel);
    if (current > target) return Math.max(target, current - accel);
    return current;
  }

  private beginBackdash(): FighterMotionState {
    this.isBackdashing = true;
    this.backdashTimer = BACKDASH_DURATION;
    this.walkVelocity.forward = BACKDASH_VELOCITY;
    this.walkVelocity.strafe = 0;
    // Crossfade strafe/walk → backdash
    this.beginCrossfade(this.motionState, 'walkBackward', CROSSFADE_STRAFE_BACKDASH_FRAMES / this.FPS);
    this.actionState = 'Backdashing';
    this.motionState = 'walkBackward';
    console.log('[FSM] ↩️ Backdash started');
    return this.motionState;
  }

  private executeWakeup(option: NonNullable<WakeupOption>): FighterMotionState {
    this.wakeupBuffered = null;
    this.wakeupActionState = option;

    switch (option) {
      case 'techRoll':
        this.actionState = 'WakeupTechRoll';
        this.motionState = 'walkForward';
        this.wakeupActionTimer = TECH_ROLL_DURATION;
        console.log('[FSM] 🔄 Wakeup: techRoll');
        break;
      case 'backrise':
        this.actionState = 'WakeupBackrise';
        this.motionState = 'walkBackward';
        this.wakeupActionTimer = BACKRISE_DURATION;
        console.log('[FSM] ↩️ Wakeup: backrise');
        break;
      case 'quickStand':
      default:
        this.actionState = 'WakeupQuickStand';
        this.motionState = 'idle';
        this.wakeupActionTimer = QUICKSTAND_DURATION;
        console.log('[FSM] ⬆️ Wakeup: quickStand');
        break;
    }
    return this.motionState;
  }

  private openLimb(limb: Limb): FighterMotionState {
    this.walkVelocity = { forward: 0, strafe: 0 };
    this.genericLinks = 0;
    this.heatDashSpent = false;
    this.heatDashQueued = false;
    this.queuedLimb = null;
    const crouching = !!this.prevInput.crouch;
    const rushing = !!(this.prevInput.running || this.prevInput.dashing);
    if (rushing && !crouching) {
      this.limbChain = [limb];
      const kick = limb === 'rk' || limb === 'lk';
      this.stringLabel = kick ? 'RUN KICK' : 'RUN';
      const hit = kick ? RUN_KICK : RUN_ATTACK;
      this.pendingStep = hit.stepIn;
      return this.beginBuilt(hitToWindow(hit, this.stringLabel));
    }
    const matched = matchString([limb], crouching);
    if (matched) {
      this.limbChain = [limb];
      this.stringLabel = '';
      const hit = matched.route.hits[0];
      this.pendingStep = hit.stepIn;
      return this.beginBuilt(hitToWindow(hit));
    }
    this.limbChain = [];
    this.stringLabel = '';
    if (limb === 'rk') return this.beginAttack('heavyKick', DEFAULT_MOVE_WINDOWS.heavyKick);
    if (limb === 'rp') return this.beginAttack('heavyAttack', DEFAULT_MOVE_WINDOWS.heavyAttack);
    if (limb === 'lk') return this.beginAttack('lightKick', DEFAULT_MOVE_WINDOWS.lightKick);
    return this.beginAttack('lightAttack', DEFAULT_MOVE_WINDOWS.lightAttack);
  }

  /**
   * Charted routes cancel on time even if the last swing whiffed.
   * A button that is not the next hit of the route only comes out early
   * when the swing connected. Heat dash needs Heat plus a connect.
   */
  private tryStringCancel(crouching: boolean): FighterMotionState | null {
    if (this.heatDashQueued && this.swingConnected && !this.heatDashSpent) {
      this.heatDashQueued = false;
      this.heatDashSpent = true;
      this.queuedLimb = null;
      this.stringLabel = 'HEAT DASH';
      this.pendingStep = HEAT_DASH_HIT.stepIn;
      return this.beginBuilt(hitToWindow(HEAT_DASH_HIT, 'HEAT DASH'));
    }
    const limb = this.queuedLimb;
    if (!limb) return null;
    const chain = [...this.limbChain, limb];
    const matched = matchString(chain, crouching);
    const extending = this.limbChain.length > 0 && !!matched;
    if (matched && (extending || this.swingConnected)) {
      this.queuedLimb = null;
      this.limbChain = chain;
      const hit = matched.route.hits[matched.index];
      this.stringLabel = chain.length > 1 ? matched.route.name : '';
      this.pendingStep = hit.stepIn;
      return this.beginBuilt(hitToWindow(hit, chain.length > 1 ? matched.route.name : undefined));
    }
    if (this.swingConnected && this.genericLinks < this.MAX_GENERIC_LINKS) {
      this.queuedLimb = null;
      this.genericLinks += 1;
      const digits: Record<Limb, string> = { lp: '1', rp: '2', lk: '3', rk: '4' };
      this.limbChain = chain.slice(-4);
      this.stringLabel = this.limbChain.map((part) => digits[part]).join(',');
      const hit = genericLink(limb);
      this.pendingStep = hit.stepIn;
      return this.beginBuilt(hitToWindow(hit));
    }
    return null;
  }

  private keepChain = false;

  private beginBuilt(built: BuiltAttack): FighterMotionState {
    this.keepChain = true;
    this.inputBuffer = [];
    return this.beginAttack(built.animation, built);
  }

  private beginAttack(motion: FighterMotionState, move: MoveWindow): FighterMotionState {
    const prevState = this.motionState;
    const airborne = this.actionState === 'Jumping' || this.jumpAirTimer > 0;
    const variant = Math.max(0, this.limbChain.length - 1);
    const picked = move.clip ?? directionalAttackClip(this.fighterId, motion, {
      forward: this.prevInput.forward,
      crouch: !!this.prevInput.crouch,
      airborne,
    }, variant) ?? undefined;
    const stamped: MoveWindow = { ...move, clip: picked };
    const keep = this.keepChain;
    this.keepChain = false;
    if (!keep) {
      this.limbChain = [];
      this.stringLabel = '';
      this.genericLinks = 0;
    }
    this.swingConnected = false;
    this.queuedLimb = null;
    this.attackGenerationN += 1;
    this.beginCrossfade(this.motionState, motion, CROSSFADE_ATTACK_FRAMES / this.FPS);
    this.actionState = 'Attacking';
    this.motionState = motion;
    this.currentMove = stamped;
    const frameTotal = move.startup + move.active + move.recovery;
    this.moveTimer = computeAttackLockDuration(motion, frameTotal, stamped.clip);
    this.attackLock = this.moveTimer;
    this.moveElapsed = 0;
    this.prevMoveElapsed = 0;
    this.queuedAction = null;
    console.log(
      `[FSM] ⚔️  STATE TRANSITION: "${prevState}" → "${motion}" ` +
      `[${move.specialName ?? motion}] ` +
      `startup=${move.startup.toFixed(3)}s active=${move.active.toFixed(3)}s recovery=${move.recovery.toFixed(3)}s ` +
      `lock=${this.moveTimer.toFixed(3)}s damage=${move.damage ?? 'N/A'} isSpecial=${move.isSpecial ?? false}`,
    );
    return motion;
  }

  private executeQueuedAction(queued: QueuedAction): FighterMotionState {
    switch (queued.type) {
      case 'light':
        return this.beginAttack('lightAttack', DEFAULT_MOVE_WINDOWS.lightAttack);
      case 'heavy':
        return this.beginAttack('heavyAttack', DEFAULT_MOVE_WINDOWS.heavyAttack);
      case 'commandThrow':
        return this.beginCommandThrow();
      case 'guard':
        this.actionState = 'Guard';
        this.motionState = 'guard';
        return this.motionState;
      default:
        this.actionState = 'Idle';
        this.motionState = 'idle';
        return this.motionState;
    }
  }

  private pushBuffer(key: keyof FighterInput, now: number) {
    this.inputBuffer.push({ key, timestamp: now });
    const cutoff = now - this.BUFFER_WINDOW_MS;
    this.inputBuffer = this.inputBuffer.filter(e => e.timestamp >= cutoff);
    if (this.inputBuffer.length > 8) this.inputBuffer.shift();
  }

  private detectSpecialMove(now: number): SpecialMoveDefinition | null {
    const cutoff = now - this.BUFFER_WINDOW_MS;
    const recent = this.inputBuffer.filter(e => e.timestamp >= cutoff);

    for (const special of this.specialMoves) {
      const seq = special.sequence;
      if (recent.length < seq.length) continue;
      const tail = recent.slice(-seq.length);
      const matches = seq.every((key, i) => tail[i].key === key);
      if (matches) {
        this.inputBuffer = this.inputBuffer.filter(e => !tail.includes(e));
        return special;
      }
    }
    return null;
  }
}
