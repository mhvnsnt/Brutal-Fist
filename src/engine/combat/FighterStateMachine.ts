import type { FighterMotionState } from '../retarget/AnimationController';

// ── Action States ─────────────────────────────────────────────────────────────
export type ActionState =
  | 'Idle' | 'Walking' | 'Backdashing' | 'Attacking' | 'Stunned' | 'Crumple' |'Guard' | 'Knockdown' | 'WakeupTechRoll' | 'WakeupBackrise' | 'WakeupQuickStand';

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
  type: 'light' | 'heavy' | 'guard' | 'grapple';
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
  /** Whether the guard absorbed the hit */
  blocked: boolean;
  /** Chip damage dealt through the block (always > 0 even on block) */
  chipDamage: number;
  /** Whether the move broke through guard (throw or unblockable) */
  guardBroken: boolean;
  /** Full damage if guard broken, chip damage otherwise */
  finalDamage: number;
}

// ── Walking velocity state ────────────────────────────────────────────────────
interface WalkVelocity {
  forward: number;   // -1..1 current velocity
  strafe: number;    // -1..1 current velocity
}

// ── Wakeup timing constants ───────────────────────────────────────────────────
const KNOCKDOWN_DURATION = 1.2;        // seconds lying on ground before forced stand
const WAKEUP_BUFFER_WINDOW = 0.8;      // seconds before knockdown ends to accept wakeup input
const TECH_ROLL_DURATION = 0.45;       // seconds for tech-roll animation
const BACKRISE_DURATION = 0.55;        // seconds for backrise animation
const QUICKSTAND_DURATION = 0.30;      // seconds for quick-stand animation

// ── Walking acceleration constants ───────────────────────────────────────────
const WALK_ACCEL = 8.0;                // velocity units/sec² acceleration
const WALK_DECEL = 14.0;               // velocity units/sec² deceleration (faster stop)
const WALK_MAX_SPEED = 1.0;            // max walk velocity magnitude
const BACKDASH_VELOCITY = -1.0;        // instant backward velocity on backdash
const BACKDASH_DURATION = 0.28;        // seconds backdash lasts
const BACKDASH_DECEL = 6.0;            // deceleration after backdash peak

// ── Frame-accurate animation transition thresholds ───────────────────────────
// Minimum velocity before walk animation triggers (prevents jitter)
const WALK_ANIM_THRESHOLD = 0.15;
// Velocity at which we switch from walkBackward to backdash anim
const BACKDASH_ANIM_THRESHOLD = -0.85;

// ── State machine ─────────────────────────────────────────────────────────────
export class FighterStateMachine {
  // Action state
  private actionState: ActionState = 'Idle';
  // Animation motion state
  private motionState: FighterMotionState = 'idle';

  // Current move being executed
  private currentMove: MoveWindow | null = null;
  // Timer counting down total move duration
  private moveTimer = 0;
  // Elapsed time in current move (for frame-data math)
  private moveElapsed = 0;
  // FPS assumption for frame-data calculations
  private readonly FPS = 60;

  // Input queue: one action buffered during recovery
  private queuedAction: QueuedAction | null = null;

  // Input sequence buffer for special move detection
  private inputBuffer: BufferEntry[] = [];
  private readonly BUFFER_WINDOW_MS = 600;

  // Stun/crumple timer
  private stunTimer = 0;

  // ── Knockdown / wakeup state ──────────────────────────────────────────────
  private knockdownTimer = 0;
  private wakeupBuffered: WakeupOption = null;
  private wakeupActionTimer = 0;
  private wakeupActionState: WakeupOption = null;

  // ── Walking velocity (smooth acceleration/deceleration) ───────────────────
  private walkVelocity: WalkVelocity = { forward: 0, strafe: 0 };

  // ── Backdash state ────────────────────────────────────────────────────────
  private backdashTimer = 0;
  private isBackdashing = false;

  // Special moves catalog
  private specialMoves: SpecialMoveDefinition[] = [...DEFAULT_SPECIAL_MOVES];

  // Previous raw input (for edge detection)
  private prevInput: FighterInput = {
    forward: 0, strafe: 0, light: false, heavy: false,
    guard: false, crouch: false, grapple: false, escape: false,
  };

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

  /** Returns the currently queued follow-up action (buffered during recovery), or null */
  getQueuedAction(): { type: string; label: string } | null {
    if (!this.queuedAction) return null;
    const labels: Record<string, string> = {
      light: 'L', heavy: 'H', guard: 'G', grapple: 'GR',
    };
    return { type: this.queuedAction.type, label: labels[this.queuedAction.type] ?? this.queuedAction.type.toUpperCase() };
  }

  /** Returns recovery progress 0-1 (0 = not in recovery, 1 = recovery complete) */
  getRecoveryProgress(): number {
    if (!this.currentMove || !this.isRecovering) return 0;
    const recoveryStart = this.currentMove.startup + this.currentMove.active;
    const recoveryDuration = this.currentMove.recovery;
    if (recoveryDuration <= 0) return 1;
    return Math.min(1, (this.moveElapsed - recoveryStart) / recoveryDuration);
  }

  /** Returns buffered wakeup option (visible on HUD during knockdown) */
  getBufferedWakeup(): WakeupOption { return this.wakeupBuffered; }

  /** Returns current walk velocity for position integration */
  getWalkVelocity(): WalkVelocity { return { ...this.walkVelocity }; }

  // ── Register custom special moves ──────────────────────────────────────────
  registerSpecialMoves(moves: SpecialMoveDefinition[]) {
    this.specialMoves = [...moves, ...DEFAULT_SPECIAL_MOVES];
  }

  // ── Apply stun (called externally when hit lands) ──────────────────────────
  applyStun(duration: number, isCrumple = false) {
    this.actionState = isCrumple ? 'Crumple' : 'Stunned';
    this.motionState = isCrumple ? 'knockdown' : 'hit';
    this.stunTimer = duration;
    this.currentMove = null;
    this.moveTimer = 0;
    this.moveElapsed = 0;
    this.queuedAction = null;
    this.walkVelocity = { forward: 0, strafe: 0 };
    this.isBackdashing = false;
  }

  /**
   * Apply knockdown — fighter falls and enters wakeup buffer window.
   * During KNOCKDOWN_DURATION - WAKEUP_BUFFER_WINDOW seconds, directional inputs
   * are buffered as wakeup options (tech-roll, backrise, quick-stand).
   */
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
    console.log('[FSM] ⬇️ Knockdown — wakeup buffer open in', (KNOCKDOWN_DURATION - WAKEUP_BUFFER_WINDOW).toFixed(2), 's');
  }

  /**
   * Process incoming damage through the guard system.
   * Returns GuardResult with chip damage, guard break info, and final damage.
   *
   * Guard rules:
   *   - Throws (isThrow=true): guard does NOT block — full damage
   *   - Unblockable (isUnblockable=true): guard does NOT reduce damage — full damage
   *   - Normal moves while guarding: 50% damage reduction, chip = 5% of original
   *   - Not guarding: full damage
   */
  processIncomingHit(move: MoveWindow): GuardResult {
    const isGuarding = this.actionState === 'Guard';
    const rawDamage = move.damage ?? 100;

    // Throws bypass guard entirely
    if (move.isThrow) {
      console.log('[FSM] 🤜 Throw — guard bypassed, full damage:', rawDamage);
      return { blocked: false, chipDamage: 0, guardBroken: true, finalDamage: rawDamage };
    }

    // Unblockable moves bypass guard entirely
    if (move.isUnblockable) {
      console.log('[FSM] 💥 Unblockable — guard bypassed, full damage:', rawDamage);
      return { blocked: false, chipDamage: 0, guardBroken: true, finalDamage: rawDamage };
    }

    if (isGuarding) {
      // 50% damage reduction on block
      const chipDamage = Math.max(1, Math.floor(rawDamage * 0.05));
      const finalDamage = chipDamage;
      console.log(`[FSM] 🛡️ Blocked — chip=${chipDamage} (5% of ${rawDamage}), 50% reduction applied`);
      return { blocked: true, chipDamage, guardBroken: false, finalDamage };
    }

    // Not guarding — full damage
    return { blocked: false, chipDamage: 0, guardBroken: false, finalDamage: rawDamage };
  }

  // ── Get current hitbox window state ────────────────────────────────────────
  getHitboxWindow(): HitboxWindow {
    if (!this.currentMove || this.actionState !== 'Attacking') {
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

    // ── Detect rising edges for buffer ──────────────────────────────────────
    const risingLight = input.light && !this.prevInput.light;
    const risingHeavy = input.heavy && !this.prevInput.heavy;
    const risingGuard = input.guard && !this.prevInput.guard;
    const risingGrapple = (input.grapple ?? false) && !(this.prevInput.grapple ?? false);

    // Directional rising edges for wakeup detection
    const risingForwardPos = input.forward > 0.5 && this.prevInput.forward <= 0.5;
    const risingForwardNeg = input.forward < -0.5 && this.prevInput.forward >= -0.5;
    const risingStrafe = Math.abs(input.strafe) > 0.5 && Math.abs(this.prevInput.strafe) <= 0.5;

    // Push rising edges into sequence buffer
    if (risingLight) this.pushBuffer('light', now);
    if (risingHeavy) this.pushBuffer('heavy', now);
    if (risingGuard) this.pushBuffer('guard', now);
    if (risingGrapple) this.pushBuffer('grapple', now);

    this.prevInput = { ...input };

    // ── Knockdown / wakeup tick ──────────────────────────────────────────────
    if (this.actionState === 'Knockdown') {
      this.knockdownTimer = Math.max(0, this.knockdownTimer - dt);
      const inBufferWindow = this.knockdownTimer <= WAKEUP_BUFFER_WINDOW;

      // Accept wakeup inputs during the buffer window
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

    // ── Stun / Crumple tick ──────────────────────────────────────────────────
    if (this.actionState === 'Stunned' || this.actionState === 'Crumple') {
      this.stunTimer = Math.max(0, this.stunTimer - dt);
      if (this.stunTimer <= 0) {
        this.actionState = 'Idle';
        this.motionState = 'idle';
      }
      return this.motionState;
    }

    // ── Attack tick ──────────────────────────────────────────────────────────
    if (this.actionState === 'Attacking' && this.currentMove) {
      this.moveTimer = Math.max(0, this.moveTimer - dt);
      this.moveElapsed += dt;

      // Queue inputs during recovery frames
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
      // Decelerate backdash velocity
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

    // Check for special move sequences first (highest priority)
    const special = this.detectSpecialMove(now);
    if (special) {
      this.walkVelocity = { forward: 0, strafe: 0 };
      return this.beginAttack(special.move.animation, special.move);
    }

    // Standard attacks
    if (risingLight) {
      this.walkVelocity = { forward: 0, strafe: 0 };
      return this.beginAttack('lightAttack', DEFAULT_MOVE_WINDOWS.lightAttack);
    }
    if (risingHeavy) {
      this.walkVelocity = { forward: 0, strafe: 0 };
      return this.beginAttack('heavyAttack', DEFAULT_MOVE_WINDOWS.heavyAttack);
    }

    // ── Guard (G button) ─────────────────────────────────────────────────────
    // Guard is active while button is held. Chip damage and throw/unblockable
    // detection are handled in processIncomingHit().
    if (input.guard) {
      this.actionState = 'Guard';
      this.motionState = 'guard';
      this.walkVelocity = { forward: 0, strafe: 0 };
      return this.motionState;
    }

    // ── Backdash detection: tap backward twice or hold back + guard ──────────
    // Backdash triggers when forward input is strongly negative (back direction)
    // and was neutral the previous frame (tap detection).
    const backTap = input.forward < -0.7 && this.prevInput.forward >= -0.3;
    if (backTap && !this.isBackdashing && this.actionState !== 'Attacking') {
      return this.beginBackdash();
    }

    // ── Walking with acceleration/deceleration curves ─────────────────────
    return this.updateWalking(input, dt);
  }

  // ── Walking with smooth acceleration/deceleration ──────────────────────────
  private updateWalking(input: FighterInput, dt: number): FighterMotionState {
    const targetForward = Math.abs(input.forward) > 0.1 ? Math.sign(input.forward) * Math.min(1, Math.abs(input.forward)) : 0;
    const targetStrafe = Math.abs(input.strafe) > 0.1 ? Math.sign(input.strafe) * Math.min(1, Math.abs(input.strafe)) : 0;

    // Accelerate toward target, decelerate when releasing
    this.walkVelocity.forward = this.smoothVelocity(this.walkVelocity.forward, targetForward, dt);
    this.walkVelocity.strafe = this.smoothVelocity(this.walkVelocity.strafe, targetStrafe, dt);

    const absForward = Math.abs(this.walkVelocity.forward);
    const absStrafe = Math.abs(this.walkVelocity.strafe);
    const moving = absForward > WALK_ANIM_THRESHOLD || absStrafe > WALK_ANIM_THRESHOLD;

    if (!moving) {
      // Snap velocity to zero when below threshold to prevent drift
      if (absForward < 0.02) this.walkVelocity.forward = 0;
      if (absStrafe < 0.02) this.walkVelocity.strafe = 0;
      this.actionState = 'Idle';
      this.motionState = 'idle';
      return this.motionState;
    }

    this.actionState = 'Walking';

    // Frame-accurate animation selection based on dominant axis and velocity direction
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

  /** Smooth velocity toward target using acceleration/deceleration curves */
  private smoothVelocity(current: number, target: number, dt: number): number {
    if (Math.abs(target) < 0.01) {
      // Decelerating — apply faster decel rate
      const decel = WALK_DECEL * dt;
      if (current > 0) return Math.max(0, current - decel);
      if (current < 0) return Math.min(0, current + decel);
      return 0;
    }
    // Accelerating toward target
    const accel = WALK_ACCEL * dt;
    if (current < target) return Math.min(target, current + accel);
    if (current > target) return Math.max(target, current - accel);
    return current;
  }

  // ── Begin backdash ──────────────────────────────────────────────────────────
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

  // ── Execute wakeup option ───────────────────────────────────────────────────
  private executeWakeup(option: NonNullable<WakeupOption>): FighterMotionState {
    this.wakeupBuffered = null;
    this.wakeupActionState = option;

    switch (option) {
      case 'techRoll':
        this.actionState = 'WakeupTechRoll';
        this.motionState = 'walkForward'; // use walk forward as tech-roll proxy
        this.wakeupActionTimer = TECH_ROLL_DURATION;
        console.log('[FSM] 🔄 Wakeup: techRoll');
        break;
      case 'backrise':
        this.actionState = 'WakeupBackrise';
        this.motionState = 'walkBackward'; // use walk backward as backrise proxy
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

  // ── Begin an attack ─────────────────────────────────────────────────────────
  private beginAttack(motion: FighterMotionState, move: MoveWindow): FighterMotionState {
    this.actionState = 'Attacking';
    this.motionState = motion;
    this.currentMove = move;
    this.moveTimer = move.startup + move.active + move.recovery;
    this.moveElapsed = 0;
    this.queuedAction = null;
    return motion;
  }

  // ── Execute a queued (chained) action ──────────────────────────────────────
  private executeQueuedAction(queued: QueuedAction): FighterMotionState {
    switch (queued.type) {
      case 'light':
        return this.beginAttack('lightAttack', DEFAULT_MOVE_WINDOWS.lightAttack);
      case 'heavy':
        return this.beginAttack('heavyAttack', DEFAULT_MOVE_WINDOWS.heavyAttack);
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

  // ── Push to input sequence buffer ──────────────────────────────────────────
  private pushBuffer(key: keyof FighterInput, now: number) {
    this.inputBuffer.push({ key, timestamp: now });
    const cutoff = now - this.BUFFER_WINDOW_MS;
    this.inputBuffer = this.inputBuffer.filter(e => e.timestamp >= cutoff);
    if (this.inputBuffer.length > 8) this.inputBuffer.shift();
  }

  // ── Detect special move from buffer ────────────────────────────────────────
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
