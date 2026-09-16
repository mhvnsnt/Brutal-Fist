import type { FighterMotionState } from '../retarget/AnimationController';

// ── Action States ─────────────────────────────────────────────────────────────
export type ActionState =
  | 'Idle' |'Walking' |'Attacking' |'Stunned' |'Crumple' |'Guard';

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
  /** Frame index within the animation at which the hitbox becomes active */
  hitboxStartFrame?: number;
  /** Frame index within the animation at which the hitbox deactivates */
  hitboxEndFrame?: number;
  /** Total animation frames (for frame-data math) */
  totalFrames?: number;
  damage?: number;
  isSpecial?: boolean;
  specialName?: string;
}

// ── Special Move Definitions ──────────────────────────────────────────────────
export interface SpecialMoveDefinition {
  id: string;
  name: string;
  /** Sequence of input keys that must be pressed in order within the buffer window */
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
  /** 0-1 progress through the active window */
  progress: number;
  move: MoveWindow | null;
  /** Current frame index within the animation */
  currentFrame: number;
}

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
  private readonly BUFFER_WINDOW_MS = 600; // 600ms window for sequences

  // Stun/crumple timer
  private stunTimer = 0;

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

    // Push rising edges into sequence buffer
    if (risingLight) this.pushBuffer('light', now);
    if (risingHeavy) this.pushBuffer('heavy', now);
    if (risingGuard) this.pushBuffer('guard', now);
    if (risingGrapple) this.pushBuffer('grapple', now);

    this.prevInput = { ...input };

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
        // Move finished — check queued action for auto-chain
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

    // ── Idle / Walking — process new inputs ──────────────────────────────────

    // Check for special move sequences first (highest priority)
    const special = this.detectSpecialMove(now);
    if (special) {
      return this.beginAttack(special.move.animation, special.move);
    }

    // Standard attacks
    if (risingLight) {
      return this.beginAttack('lightAttack', DEFAULT_MOVE_WINDOWS.lightAttack);
    }
    if (risingHeavy) {
      return this.beginAttack('heavyAttack', DEFAULT_MOVE_WINDOWS.heavyAttack);
    }

    // Guard
    if (input.guard) {
      this.actionState = 'Guard';
      this.motionState = 'guard';
      return this.motionState;
    }

    // Movement
    const f = Math.abs(input.forward);
    const s = Math.abs(input.strafe);
    if (f > s && f > 0.1) {
      this.actionState = 'Walking';
      this.motionState = input.forward > 0 ? 'walkForward' : 'walkBackward';
      return this.motionState;
    }
    if (s > 0.1) {
      this.actionState = 'Walking';
      this.motionState = input.strafe > 0 ? 'strafeRight' : 'strafeLeft';
      return this.motionState;
    }

    this.actionState = 'Idle';
    this.motionState = 'idle';
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
    // Prune old entries outside the window
    const cutoff = now - this.BUFFER_WINDOW_MS;
    this.inputBuffer = this.inputBuffer.filter(e => e.timestamp >= cutoff);
    // Cap buffer length
    if (this.inputBuffer.length > 8) this.inputBuffer.shift();
  }

  // ── Detect special move from buffer ────────────────────────────────────────
  private detectSpecialMove(now: number): SpecialMoveDefinition | null {
    const cutoff = now - this.BUFFER_WINDOW_MS;
    const recent = this.inputBuffer.filter(e => e.timestamp >= cutoff);

    for (const special of this.specialMoves) {
      const seq = special.sequence;
      if (recent.length < seq.length) continue;

      // Try to match the sequence at the tail of the buffer
      const tail = recent.slice(-seq.length);
      const matches = seq.every((key, i) => tail[i].key === key);
      if (matches) {
        // Consume matched entries
        this.inputBuffer = this.inputBuffer.filter(
          e => !tail.includes(e)
        );
        return special;
      }
    }
    return null;
  }
}
