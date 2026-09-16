/**
 * LocomotionSystem — Tekken-style locomotion architecture
 *
 * Two completely separate movement systems:
 *
 * 1. PROGRAMMATIC LOCOMOTION (walking/dashing):
 *    - Code manually pushes the root position along X/Z axes
 *    - Walk/dash animations are purely cosmetic — they loop while code moves the capsule
 *    - Root bone stays at floor zero; position is driven by velocity math
 *
 * 2. ROOT MOTION (lunging attacks):
 *    - Code stops pushing the position
 *    - The GLB animation clip contains forward displacement on the root bone
 *    - Engine reads the root bone delta each frame and applies it to the collision capsule
 *    - Prevents skating/sliding during complex strikes like Paul's Death Fist
 *
 * Root Bone Convention:
 *    - Root sits at absolute zero on the floor between the character's feet
 *    - Pelvis/Hips is the center of gravity — all weight-shift animations drive from here
 *    - Distance between P1 and P2 is calculated from their root positions
 */

import * as THREE from 'three';

// ── Locomotion mode ───────────────────────────────────────────────────────────
export type LocomotionMode = 'programmatic' | 'rootMotion';

// ── Root motion data extracted from a GLB animation frame ────────────────────
export interface RootMotionDelta {
  /** World-space X displacement this frame */
  dx: number;
  /** World-space Z displacement this frame */
  dz: number;
  /** Whether this frame has meaningful root motion (above threshold) */
  hasMotion: boolean;
}

// ── Locomotion state for a single fighter ────────────────────────────────────
export interface LocomotionState {
  /** Current world-space position of the root (floor level) */
  rootX: number;
  rootZ: number;
  /** Current velocity (programmatic mode only) */
  velocityX: number;
  velocityZ: number;
  /** Active locomotion mode */
  mode: LocomotionMode;
  /** Facing direction: 1 = right (+X), -1 = left (-X) */
  facing: 1 | -1;
}

// ── Attack root motion profiles ───────────────────────────────────────────────
/**
 * Root motion profiles for attacks that contain forward displacement.
 * These are used when the GLB clip does NOT have root motion baked in —
 * we synthesize the displacement from the move's frame data.
 *
 * Values are in world units per second of the active window.
 */
export const ATTACK_ROOT_MOTION_PROFILES: Record<string, { forwardDisplacement: number; hasRootMotion: boolean }> = {
  // Standard attacks — no root motion (stationary)
  lightAttack:   { forwardDisplacement: 0.0,  hasRootMotion: false },
  heavyAttack:   { forwardDisplacement: 0.35, hasRootMotion: true  }, // slight lunge
  CommandThrow:  { forwardDisplacement: 0.50, hasRootMotion: true  }, // grab lunge
  // Special moves — strong root motion
  power_surge:   { forwardDisplacement: 0.80, hasRootMotion: true  }, // Death Fist equivalent
  quick_combo:   { forwardDisplacement: 0.20, hasRootMotion: true  },
};

// ── Movement constants ────────────────────────────────────────────────────────
const WALK_SPEED = 2.2;          // world units/sec
const DASH_SPEED = 4.5;          // world units/sec
const BACKDASH_SPEED = 3.8;      // world units/sec
const SIDESTEP_SPEED = 1.8;      // world units/sec (Z axis)
const WALK_ACCEL = 12.0;         // acceleration rate
const WALK_DECEL = 18.0;         // deceleration rate
const ROOT_MOTION_THRESHOLD = 0.005; // minimum displacement to count as root motion

// ── Stage boundary ────────────────────────────────────────────────────────────
const STAGE_X_MIN = -4.5;
const STAGE_X_MAX = 4.5;
const STAGE_Z_MIN = -2.0;
const STAGE_Z_MAX = 2.0;

/**
 * LocomotionSystem — manages a single fighter's position using the
 * Tekken dual-system architecture.
 */
export class LocomotionSystem {
  private state: LocomotionState;

  // Root motion tracking
  private rootMotionAccumX = 0;
  private rootMotionAccumZ = 0;
  private prevRootBonePos = new THREE.Vector3();
  private rootBoneInitialized = false;

  // Attack root motion synthesis (when GLB has no baked root motion)
  private attackRootMotionActive = false;
  private attackRootMotionProfile: { forwardDisplacement: number; hasRootMotion: boolean } | null = null;
  private attackRootMotionElapsed = 0;
  private attackRootMotionDuration = 0;

  constructor(initialX: number, initialZ: number, facing: 1 | -1) {
    this.state = {
      rootX: initialX,
      rootZ: initialZ,
      velocityX: 0,
      velocityZ: 0,
      mode: 'programmatic',
      facing,
    };
  }

  get position(): { x: number; z: number } {
    return { x: this.state.rootX, z: this.state.rootZ };
  }

  get velocity(): { x: number; z: number } {
    return { x: this.state.velocityX, z: this.state.velocityZ };
  }

  get mode(): LocomotionMode {
    return this.state.mode;
  }

  // ── Switch to root motion mode (attack with forward displacement) ──────────
  beginRootMotionAttack(attackKey: string, activeDuration: number) {
    const profile = ATTACK_ROOT_MOTION_PROFILES[attackKey];
    if (!profile || !profile.hasRootMotion) return;

    this.state.mode = 'rootMotion';
    this.state.velocityX = 0;
    this.state.velocityZ = 0;
    this.attackRootMotionActive = true;
    this.attackRootMotionProfile = profile;
    this.attackRootMotionElapsed = 0;
    this.attackRootMotionDuration = activeDuration;

    console.log(`[Locomotion] 🥊 Root motion attack: "${attackKey}" displacement=${profile.forwardDisplacement}u over ${activeDuration.toFixed(3)}s`);
  }

  // ── Return to programmatic locomotion ─────────────────────────────────────
  endRootMotionAttack() {
    this.state.mode = 'programmatic';
    this.attackRootMotionActive = false;
    this.attackRootMotionProfile = null;
    this.attackRootMotionElapsed = 0;
    this.rootBoneInitialized = false; // reset bone tracking for next attack
  }

  // ── Update from GLB root bone world position (for baked root motion) ───────
  updateFromRootBone(rootBoneWorldPos: THREE.Vector3): RootMotionDelta {
    if (!this.rootBoneInitialized) {
      this.prevRootBonePos.copy(rootBoneWorldPos);
      this.rootBoneInitialized = true;
      return { dx: 0, dz: 0, hasMotion: false };
    }

    const dx = rootBoneWorldPos.x - this.prevRootBonePos.x;
    const dz = rootBoneWorldPos.z - this.prevRootBonePos.z;
    this.prevRootBonePos.copy(rootBoneWorldPos);

    const hasMotion = Math.abs(dx) > ROOT_MOTION_THRESHOLD || Math.abs(dz) > ROOT_MOTION_THRESHOLD;

    if (hasMotion && this.state.mode === 'rootMotion') {
      this.state.rootX = Math.max(STAGE_X_MIN, Math.min(STAGE_X_MAX, this.state.rootX + dx));
      this.state.rootZ = Math.max(STAGE_Z_MIN, Math.min(STAGE_Z_MAX, this.state.rootZ + dz));
    }

    return { dx, dz, hasMotion };
  }

  // ── Main update — call every frame ────────────────────────────────────────
  update(
    forwardInput: number,
    strafeInput: number,
    dt: number,
    isDashing: boolean,
    isBackdashing: boolean,
  ): void {
    if (this.state.mode === 'rootMotion') {
      this.updateRootMotion(dt);
      return;
    }

    // Programmatic locomotion
    this.updateProgrammatic(forwardInput, strafeInput, dt, isDashing, isBackdashing);
  }

  private updateProgrammatic(
    forwardInput: number,
    strafeInput: number,
    dt: number,
    isDashing: boolean,
    isBackdashing: boolean,
  ): void {
    const maxSpeed = isDashing ? DASH_SPEED : isBackdashing ? BACKDASH_SPEED : WALK_SPEED;
    const strafeMax = SIDESTEP_SPEED;

    // Target velocities from input
    const targetVX = Math.abs(forwardInput) > 0.1
      ? Math.sign(forwardInput) * maxSpeed * this.state.facing
      : 0;
    const targetVZ = Math.abs(strafeInput) > 0.1
      ? Math.sign(strafeInput) * strafeMax
      : 0;

    // Smooth velocity with acceleration/deceleration
    this.state.velocityX = this.smoothVel(this.state.velocityX, targetVX, dt);
    this.state.velocityZ = this.smoothVel(this.state.velocityZ, targetVZ, dt);

    // Apply to root position
    this.state.rootX = Math.max(STAGE_X_MIN, Math.min(STAGE_X_MAX,
      this.state.rootX + this.state.velocityX * dt
    ));
    this.state.rootZ = Math.max(STAGE_Z_MIN, Math.min(STAGE_Z_MAX,
      this.state.rootZ + this.state.velocityZ * dt
    ));
  }

  private updateRootMotion(dt: number): void {
    if (!this.attackRootMotionActive || !this.attackRootMotionProfile) return;

    this.attackRootMotionElapsed += dt;
    const progress = Math.min(1, this.attackRootMotionElapsed / Math.max(0.001, this.attackRootMotionDuration));

    // Synthesized root motion: bell-curve displacement (peak at 50% of active window)
    const bellCurve = Math.sin(progress * Math.PI);
    const frameDisplacement = this.attackRootMotionProfile.forwardDisplacement * bellCurve * dt / Math.max(0.001, this.attackRootMotionDuration);

    this.state.rootX = Math.max(STAGE_X_MIN, Math.min(STAGE_X_MAX,
      this.state.rootX + frameDisplacement * this.state.facing
    ));

    if (progress >= 1.0) {
      this.endRootMotionAttack();
    }
  }

  private smoothVel(current: number, target: number, dt: number): number {
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

  // ── Set position directly (teleport / round reset) ────────────────────────
  setPosition(x: number, z: number) {
    this.state.rootX = x;
    this.state.rootZ = z;
    this.state.velocityX = 0;
    this.state.velocityZ = 0;
    this.endRootMotionAttack();
  }

  // ── Update facing direction ────────────────────────────────────────────────
  setFacing(facing: 1 | -1) {
    this.state.facing = facing;
  }

  // ── Stop all movement (hit stun, knockdown) ───────────────────────────────
  halt() {
    this.state.velocityX = 0;
    this.state.velocityZ = 0;
    this.endRootMotionAttack();
  }

  // ── Apply pushback from a hit ─────────────────────────────────────────────
  applyPushback(amount: number) {
    // Pushback is always away from the attacker (opposite to facing)
    const pushX = -this.state.facing * amount;
    this.state.rootX = Math.max(STAGE_X_MIN, Math.min(STAGE_X_MAX, this.state.rootX + pushX));
  }

  // ── Clamp X position (used for fighter separation enforcement) ────────────
  clampX(x: number) {
    this.state.rootX = Math.max(STAGE_X_MIN, Math.min(STAGE_X_MAX, x));
    // Kill velocity toward the clamped direction
    if ((x <= STAGE_X_MIN && this.state.velocityX < 0) ||
        (x >= STAGE_X_MAX && this.state.velocityX > 0)) {
      this.state.velocityX = 0;
    }
  }
}
