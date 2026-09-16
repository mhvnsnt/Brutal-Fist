import type { FighterMotionState } from '../retarget/AnimationController';

// ── Action States ─────────────────────────────────────────────────────────────
export type ActionState =
  | 'Idle' | 'Walking' | 'Backdashing' | 'Attacking' | 'Stunned' | 'Crumple' |'Guard' | 'Knockdown' | 'WakeupTechRoll' | 'WakeupBackrise' | 'WakeupQuickStand'
  | 'HitStun' | 'CommandThrow' | 'ThrowWhiff';

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
}

// ── Special Move Definitions ──────────────────────────────────────────────────
export interface SpecialMoveDefinition {
  id: string;
  name: string;
  sequence: Array<keyof FighterInput>;
  move: MoveWindow;
}

// ── Built-in move windows ─────────────────────────────────────────────────────
export const DEFAULT_MOVE_WINDOWS: Record<'lightAttack' | 'heavyAttack', MoveWindow> = {
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
const WALK_ANIM_THRESHOLD = 0.15;
const BACKDASH_ANIM_THRESHOLD = -0.85;

// ── Command throw input detection ─────────────────────────────────────────────
/** Forward input threshold to qualify as "forward" for command throw */
const CMD_THROW_FORWARD_THRESHOLD = 0.5;
/** Time window (ms) within which forward + guard must be pressed */
const CMD_THROW_WINDOW_MS = 200;

// ── State machine ─────────────────────────────────────────────────────────────
export class FighterStateMachine {
  private actionState: ActionState = 'Idle';
  private motionState: FighterMotionState = 'idle';

  private currentMove: MoveWindow | null = null;
  private moveTimer = 0;
  private moveElapsed = 0;
  private readonly FPS = 60;

  private queuedAction: QueuedAction | null = null;

  private inputBuffer: BufferEntry[] = [];
  private readonly BUFFER_WINDOW_MS = 600;

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

  private specialMoves: SpecialMoveDefinition[] = [...DEFAULT_SPECIAL_MOVES];

  private prevInput: FighterInput = {
    forward: 0, strafe: 0, light: false, heavy: false,
    guard: false, crouch: false, grapple: false, escape: false,
  };

  // ── Forward press timestamp for command throw detection ───────────────────
  private forwardPressTime = 0;

  // ── Public getters ──────────────────────────────────────────────────────────
  get current(): FighterMotionState { return this.motionState; }
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

  registerSpecialMoves(moves: SpecialMoveDefinition[]) {
    this.specialMoves = [...moves, ...DEFAULT_SPECIAL_MOVES];
  }

  // ── Apply HitStun (duration = active frames of the attacking move) ─────────
  /**
   * Apply HitStun state. Duration is derived from the active frames of the
   * move that landed, clamped between HITSTUN_MIN and HITSTUN_MAX.
   * This replaces the old applyStun for normal hits.
   */
  applyHitStun(sourceMove: MoveWindow | null, fallbackDuration = 0.3) {
    const duration = sourceMove
      ? this.computeHitStunDuration(sourceMove)
      : Math.max(HITSTUN_MIN, Math.min(HITSTUN_MAX, fallbackDuration));

    this.actionState = 'HitStun';
    this.motionState = 'hit';
    this.hitStunTimer = duration;
    this.hitStunSourceMove = sourceMove;
    this.currentMove = null;
    this.moveTimer = 0;
    this.moveElapsed = 0;
    this.queuedAction = null;
    this.walkVelocity = { forward: 0, strafe: 0 };
    this.isBackdashing = false;
    console.log(`[FSM] 💥 HitStun applied — duration=${duration.toFixed(3)}s (active=${sourceMove?.active?.toFixed(3) ?? 'N/A'}s)`);
  }

  // ── Legacy applyStun (kept for compatibility, routes to HitStun or Crumple) ─
  applyStun(duration: number, isCrumple = false) {
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
      this.applyHitStun(null, duration);
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

  /**
   * Check grab range against opponent position.
   * Returns GrabRangeResult with distance, range, and success flag.
   * Also activates grab range visualization.
   */
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
    const totalDuration = move.startup + move.active + move.recovery;
    const elapsed = totalDuration - this.moveTimer;
    const currentFrame = Math.floor(elapsed * this.FPS);

    const startFrame = move.hitboxStartFrame ?? Math.floor(move.startup * this.FPS);
    const endFrame = move.hitboxEndFrame ?? Math.floor((move.startup + move.active) * this.FPS);

    const active = currentFrame >= startFrame && currentFrame <= endFrame;
    const progress = active
      ? (currentFrame - startFrame) / Math.max(1, endFrame - startFrame)
      : 0;

    return { active, progress, move, currentFrame };
  }

  // ── Main update ─────────────────────────────────────────────────────────────
  update(input: FighterInput, dt: number): FighterMotionState {
    const now = performance.now();

    const risingLight = input.light && !this.prevInput.light;
    const risingHeavy = input.heavy && !this.prevInput.heavy;
    const risingGuard = input.guard && !this.prevInput.guard;
    const risingGrapple = (input.grapple ?? false) && !(this.prevInput.grapple ?? false);

    const risingForwardPos = input.forward > 0.5 && this.prevInput.forward <= 0.5;
    const risingForwardNeg = input.forward < -0.5 && this.prevInput.forward >= -0.5;
    const risingStrafe = Math.abs(input.strafe) > 0.5 && Math.abs(this.prevInput.strafe) <= 0.5;

    // Track forward press time for command throw detection
    if (risingForwardPos) {
      this.forwardPressTime = now;
    }

    if (risingLight) this.pushBuffer('light', now);
    if (risingHeavy) this.pushBuffer('heavy', now);
    if (risingGuard) this.pushBuffer('guard', now);
    if (risingGrapple) this.pushBuffer('grapple', now);

    this.prevInput = { ...input };

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
      // Buffer inputs during last 20% of hitstun (recovery frames)
      const progress = this.getHitStunProgress();
      if (progress >= 0.8) {
        if (risingLight && !this.queuedAction) this.queuedAction = { type: 'light' };
        if (risingHeavy && !this.queuedAction) this.queuedAction = { type: 'heavy' };
        if (risingGuard && !this.queuedAction) this.queuedAction = { type: 'guard' };
      }
      if (this.hitStunTimer <= 0) {
        this.hitStunSourceMove = null;
        this.actionState = 'Idle';
        this.motionState = 'idle';
        console.log('[FSM] ✅ HitStun expired → Idle');
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
      this.moveElapsed += dt;

      if (this.isRecovering) {
        if (risingLight && !this.queuedAction) this.queuedAction = { type: 'light' };
        if (risingHeavy && !this.queuedAction) this.queuedAction = { type: 'heavy' };
        if (risingGuard && !this.queuedAction) this.queuedAction = { type: 'guard' };
        if (risingGrapple && !this.queuedAction) this.queuedAction = { type: 'grapple' };
      }

      if (this.moveTimer <= 0) {
        this.currentMove = null;
        this.actionState = 'Idle';
        this.moveElapsed = 0;

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
        this.actionState = 'Idle';
        this.motionState = 'idle';
      }
      return this.motionState;
    }

    // ── Idle / Walking — process new inputs ──────────────────────────────────

    // ── Command throw detection: Forward + Guard within CMD_THROW_WINDOW_MS ──
    if (risingGuard && input.forward > CMD_THROW_FORWARD_THRESHOLD) {
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

    if (risingLight) {
      this.walkVelocity = { forward: 0, strafe: 0 };
      return this.beginAttack('lightAttack', DEFAULT_MOVE_WINDOWS.lightAttack);
    }
    if (risingHeavy) {
      this.walkVelocity = { forward: 0, strafe: 0 };
      return this.beginAttack('heavyAttack', DEFAULT_MOVE_WINDOWS.heavyAttack);
    }

    if (input.guard) {
      this.actionState = 'Guard';
      this.motionState = 'guard';
      this.walkVelocity = { forward: 0, strafe: 0 };
      return this.motionState;
    }

    const backTap = input.forward < -0.7 && this.prevInput.forward >= -0.3;
    if (backTap && !this.isBackdashing && this.actionState !== 'Attacking') {
      return this.beginBackdash();
    }

    return this.updateWalking(input, dt);
  }

  // ── Compute HitStun duration from active frames of the source move ─────────
  private computeHitStunDuration(move: MoveWindow): number {
    const activeSeconds = move.active * HITSTUN_ACTIVE_FRAME_MULTIPLIER;
    return Math.max(HITSTUN_MIN, Math.min(HITSTUN_MAX, activeSeconds));
  }

  // ── Begin command throw ────────────────────────────────────────────────────
  private beginCommandThrow(): FighterMotionState {
    this.actionState = 'CommandThrow';
    this.motionState = 'heavyAttack';
    this.currentMove = COMMAND_THROW_MOVE;
    this.moveTimer = COMMAND_THROW_MOVE.startup + COMMAND_THROW_MOVE.active + COMMAND_THROW_MOVE.recovery;
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

    this.walkVelocity.forward = this.smoothVelocity(this.walkVelocity.forward, targetForward, dt);
    this.walkVelocity.strafe = this.smoothVelocity(this.walkVelocity.strafe, targetStrafe, dt);

    const absForward = Math.abs(this.walkVelocity.forward);
    const absStrafe = Math.abs(this.walkVelocity.strafe);
    const moving = absForward > WALK_ANIM_THRESHOLD || absStrafe > WALK_ANIM_THRESHOLD;

    if (!moving) {
      if (absForward < 0.02) this.walkVelocity.forward = 0;
      if (absStrafe < 0.02) this.walkVelocity.strafe = 0;
      this.actionState = 'Idle';
      this.motionState = 'idle';
      return this.motionState;
    }

    this.actionState = 'Walking';

    if (absForward >= absStrafe) {
      if (this.walkVelocity.forward > WALK_ANIM_THRESHOLD) {
        this.motionState = 'walkForward';
      } else if (this.walkVelocity.forward < -WALK_ANIM_THRESHOLD) {
        this.motionState = 'walkBackward';
      }
    } else {
      if (this.walkVelocity.strafe > WALK_ANIM_THRESHOLD) {
        this.motionState = 'strafeRight';
      } else if (this.walkVelocity.strafe < -WALK_ANIM_THRESHOLD) {
        this.motionState = 'strafeLeft';
      }
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

  private beginAttack(motion: FighterMotionState, move: MoveWindow): FighterMotionState {
    this.actionState = 'Attacking';
    this.motionState = motion;
    this.currentMove = move;
    this.moveTimer = move.startup + move.active + move.recovery;
    this.moveElapsed = 0;
    this.queuedAction = null;
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
