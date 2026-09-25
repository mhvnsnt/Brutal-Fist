/**
 * HitEffectSystem — short universal impact flashes.
 *
 * Schwarzerblitz / Tekken shape, without per-fighter colors:
 *  Layer 1: white-hot core
 *  Layer 2: one shared heat tint (high / mid / low / block / counter)
 *  Layer 3: a few directional streaks
 *
 * Life is a handful of frames at 60Hz (block 4, clean 5, wall 7, counter 8, heat 10).
 * Age uses the real delta AND a wall clock, so a 2fps hitch cannot leave
 * a spark on screen. Do not cap the decay at 50ms.
 *
 * Height is the attack level, not a single locked torso Y:
 *  high 1.55, mid HIT_FX_WORLD_Y (1.05), low 0.38, plus airborne lift.
 */

import { HIT_FX_WORLD_Y } from '../V7OrientationContract';

// ── Hit effect types ──────────────────────────────────────────────────────────
export type HitEffectType = 'clean_hit' | 'block' | 'counter_hit' | 'wall_splat' | 'floor_slam';

export type AttackHeight = 'high' | 'mid' | 'low';

/** Shared spark palette. No CHARACTER_BLOOM, no faction color. */
export const SPARK_COLOR = {
  high: '#fff7ea',
  mid: '#ffb15a',
  low: '#e8c27a',
  block: '#b7d4ea',
  counter: '#ffffff',
  heat: '#ff7a18',
  wall: '#fff4e0',
} as const;

/** Seconds. A few frames, then gone. */
export const SPARK_LIFE_S: Record<HitEffectType | 'heat', number> = {
  block: 4 / 60,
  clean_hit: 5 / 60,
  wall_splat: 7 / 60,
  floor_slam: 7 / 60,
  counter_hit: 8 / 60,
  heat: 10 / 60,
};

export function sparkWorldY(level: AttackHeight | undefined, airborneY = 0): number {
  const base = level === 'high' ? 1.55 : level === 'low' ? 0.38 : HIT_FX_WORLD_Y;
  return base + Math.max(0, airborneY);
}

export function sparkColorFor(type: HitEffectType, level?: AttackHeight, heat = false): string {
  if (heat) return SPARK_COLOR.heat;
  if (type === 'block') return SPARK_COLOR.block;
  if (type === 'counter_hit') return SPARK_COLOR.counter;
  if (type === 'wall_splat' || type === 'floor_slam') return SPARK_COLOR.wall;
  if (level === 'high') return SPARK_COLOR.high;
  if (level === 'low') return SPARK_COLOR.low;
  return SPARK_COLOR.mid;
}

/** Contact point, biased toward the victim so the flash sits on their body. */
export function sparkContact(
  victimX: number,
  victimZ: number,
  attackerX: number,
  attackerZ: number,
  level: AttackHeight | undefined,
  airborneY = 0,
): { attackLevel: AttackHeight; worldX: number; worldY: number; worldZ: number } {
  const attackLevel: AttackHeight = level === 'high' || level === 'low' ? level : 'mid';
  return {
    attackLevel,
    worldX: victimX + (attackerX - victimX) * 0.28,
    worldY: sparkWorldY(attackLevel, airborneY),
    worldZ: victimZ + (attackerZ - victimZ) * 0.28,
  };
}

// ── Hit weight for camera shake ───────────────────────────────────────────────
export type HitWeight = 'light' | 'medium' | 'heavy' | 'counter' | 'super';

// ── Directional streak ────────────────────────────────────────────────────────
export interface DirectionalStreak {
  angle: number;
  length: number;
  width: number;
  color: string;
  alpha: number;
}

// ── Point light flash data ────────────────────────────────────────────────────
export interface PointLightFlash {
  x: number;
  y: number;
  z: number;
  color: string;
  intensity: number;
  maxIntensity: number;
  framesRemaining: number;
  totalFrames: number;
}

// ── Camera shake state ────────────────────────────────────────────────────────
export interface CameraShakeState {
  active: boolean;
  offsetX: number;
  offsetY: number;
  magnitude: number;
  framesRemaining: number;
  totalFrames: number;
}

export function createCameraShakeState(): CameraShakeState {
  return { active: false, offsetX: 0, offsetY: 0, magnitude: 0, framesRemaining: 0, totalFrames: 0 };
}

// ── Hit effect slot (pooled) ──────────────────────────────────────────────────
export interface HitEffectSlot {
  active: boolean;
  type: HitEffectType;
  screenX: number;
  screenY: number;
  worldX: number;
  worldY: number;
  worldZ: number;
  /** Universal spark tint. Not a per-fighter bloom. */
  characterColor: string;
  attackLevel: AttackHeight;
  scale: number;
  /** Life remaining in seconds */
  life: number;
  maxLife: number;
  streaks: DirectionalStreak[];
  attackAngle: number;
  pointLight: PointLightFlash | null;
  /** performance.now() when the spark was spawned. 0 if inactive. */
  bornAtMs: number;
}

export const HIT_EFFECT_POOL_SIZE = 8;

export interface HitEffectPool {
  slots: HitEffectSlot[];
  cameraShake: CameraShakeState;
  screenFlash: number;
}

export function createHitEffectPool(): HitEffectPool {
  const slots: HitEffectSlot[] = [];
  for (let i = 0; i < HIT_EFFECT_POOL_SIZE; i++) {
    slots.push({
      active: false,
      type: 'clean_hit',
      screenX: 0, screenY: 0,
      worldX: 0, worldY: 0, worldZ: 0,
      characterColor: '#ffffff',
      attackLevel: 'mid',
      scale: 1.0,
      life: 0,
      maxLife: SPARK_LIFE_S.clean_hit,
      streaks: [],
      attackAngle: 0,
      pointLight: null,
      bornAtMs: 0,
    });
  }
  return {
    slots,
    cameraShake: createCameraShakeState(),
    screenFlash: 0,
  };
}

function generateStreaks(
  type: HitEffectType,
  sparkColor: string,
  attackAngle: number,
  scale: number,
): DirectionalStreak[] {
  const streaks: DirectionalStreak[] = [];

  if (type === 'block') {
    for (let i = 0; i < 6; i++) {
      streaks.push({
        angle: (Math.PI * 2 * i) / 6,
        length: 12 * scale,
        width: 2,
        color: SPARK_COLOR.block,
        alpha: 0.7,
      });
    }
    return streaks;
  }

  const baseCount = type === 'counter_hit' ? 8 : 6;
  const baseLength = type === 'counter_hit' ? 28 * scale : 18 * scale;

  for (let i = 0; i < baseCount; i++) {
    const spread = Math.PI * 0.7;
    const angle = attackAngle + (Math.random() - 0.5) * spread;
    const length = baseLength * (0.5 + Math.random() * 0.8);
    streaks.push({
      angle,
      length,
      width: 1.5 + Math.random() * 2,
      color: sparkColor,
      alpha: 0.8 + Math.random() * 0.2,
    });
  }

  for (let i = 0; i < 4; i++) {
    const angle = attackAngle + (Math.random() - 0.5) * 0.8;
    streaks.push({
      angle,
      length: baseLength * 0.6,
      width: 1,
      color: '#ffffff',
      alpha: 1.0,
    });
  }

  return streaks;
}

export interface SpawnHitEffectParams {
  type: HitEffectType;
  screenX: number;
  screenY: number;
  worldX: number;
  worldY: number;
  worldZ: number;
  /** Accepted so older call sites compile. The tint ignores this. */
  characterColor?: string;
  attackAngle?: number;
  damage?: number;
  attackLevel?: AttackHeight;
  /** Heat burst / rage. Universal orange, still only a few frames. */
  heat?: boolean;
  /** Test clock. Omit in the game; spawn uses performance.now(). */
  nowMs?: number;
}

/**
 * Spawn a hit effect into the pool.
 * Finds an inactive slot and reuses it. Mutates the pool and returns it.
 */
export function spawnHitEffect(pool: HitEffectPool, params: SpawnHitEffectParams): HitEffectPool {
  const {
    type, screenX, screenY, worldX, worldY, worldZ,
    attackAngle = 0, damage = 20, heat = false, nowMs,
  } = params;

  const attackLevel: AttackHeight = params.attackLevel
    ?? (worldY >= 1.35 ? 'high' : worldY <= 0.62 ? 'low' : 'mid');
  const color = sparkColorFor(type, attackLevel, heat);

  let slotIdx = pool.slots.findIndex(s => !s.active);
  if (slotIdx === -1) slotIdx = 0;

  const isCounter = type === 'counter_hit';
  const scale = isCounter ? 1.35
    : type === 'wall_splat' || type === 'floor_slam' ? 1.2
    : damage > 80 ? 1.12
    : 1;
  const maxLife = heat ? SPARK_LIFE_S.heat : SPARK_LIFE_S[type];

  const pointLightFrames = isCounter ? 4 : heat ? 5 : 3;
  const pointLightIntensity = isCounter ? 2.2 : heat ? 2.6 : type === 'block' ? 0.8 : 1.6;

  const pointLight: PointLightFlash = {
    x: worldX, y: worldY, z: worldZ,
    color,
    intensity: pointLightIntensity,
    maxIntensity: pointLightIntensity,
    framesRemaining: pointLightFrames,
    totalFrames: pointLightFrames,
  };

  pool.slots[slotIdx] = {
    active: true,
    type,
    screenX, screenY,
    worldX, worldY, worldZ,
    characterColor: color,
    attackLevel,
    scale,
    life: maxLife,
    maxLife,
    streaks: generateStreaks(type, color, attackAngle, scale),
    attackAngle,
    pointLight,
    bornAtMs: nowMs ?? (typeof performance !== 'undefined' ? performance.now() : 0),
  };

  pool.cameraShake = getCameraShakeForHit(type, damage);
  const flashIntensity = isCounter ? 0.35 : heat ? 0.45 : type === 'block' ? 0.08 : 0.16;
  pool.screenFlash = Math.max(pool.screenFlash, flashIntensity);
  return pool;
}

export function getCameraShakeForHit(type: HitEffectType, damage: number): CameraShakeState {
  if (type === 'block') {
    return { active: true, offsetX: 0, offsetY: 0, magnitude: 1, framesRemaining: 3, totalFrames: 3 };
  }
  if (type === 'counter_hit') {
    return { active: true, offsetX: 0, offsetY: 0, magnitude: 6, framesRemaining: 6, totalFrames: 6 };
  }
  if (type === 'floor_slam' || type === 'wall_splat') {
    return { active: true, offsetX: 0, offsetY: 0, magnitude: 5, framesRemaining: 6, totalFrames: 6 };
  }
  if (damage > 80) {
    return { active: true, offsetX: 0, offsetY: 0, magnitude: 3, framesRemaining: 4, totalFrames: 4 };
  }
  return { active: true, offsetX: 0, offsetY: 0, magnitude: 1.2, framesRemaining: 3, totalFrames: 3 };
}

const TICK_DT = 1 / 60;

/** Mutates the pool. A hitch must expire the spark, not freeze it at full alpha. */
export function tickHitEffectPoolInPlace(pool: HitEffectPool, dt = TICK_DT, nowMs?: number): HitEffectPool {
  const step = Math.max(0, dt);
  const now = nowMs ?? (typeof performance !== 'undefined' ? performance.now() : 0);
  const frames = step * 60;

  for (const slot of pool.slots) {
    if (!slot.active) continue;
    const age = slot.bornAtMs > 0 ? Math.max(0, (now - slot.bornAtMs) / 1000) : 0;
    const lived = Math.max(slot.maxLife - slot.life + step, age);
    if (lived >= slot.maxLife - 1e-4) {
      slot.active = false;
      slot.life = 0;
      slot.pointLight = null;
      slot.bornAtMs = 0;
      continue;
    }
    slot.life = slot.maxLife - lived;
    const pl = slot.pointLight;
    if (pl && pl.framesRemaining > 0) {
      pl.framesRemaining -= frames;
      if (pl.framesRemaining <= 0) {
        slot.pointLight = null;
      } else {
        pl.intensity = pl.maxIntensity * (pl.framesRemaining / pl.totalFrames);
      }
    }
  }

  const shake = pool.cameraShake;
  if (shake.active && shake.framesRemaining > 0) {
    shake.framesRemaining -= frames;
    const t = Math.max(0, shake.framesRemaining / Math.max(1, shake.totalFrames));
    const mag = shake.magnitude * t;
    shake.offsetX = (Math.random() - 0.5) * 2 * mag;
    shake.offsetY = (Math.random() - 0.5) * 2 * mag;
    shake.active = shake.framesRemaining > 0;
  } else if (shake.active) {
    pool.cameraShake = createCameraShakeState();
  }

  pool.screenFlash = pool.screenFlash > 0.01
    ? pool.screenFlash * Math.pow(0.72, frames)
    : 0;

  return pool;
}

export function tickHitEffectPool(pool: HitEffectPool, dt = TICK_DT, nowMs?: number): HitEffectPool {
  return tickHitEffectPoolInPlace(pool, dt, nowMs);
}

export function getActivePointLights(pool: HitEffectPool): PointLightFlash[] {
  return pool.slots
    .filter(s => s.active && s.pointLight !== null)
    .map(s => s.pointLight!);
}

export interface HitEffectRenderData {
  screenX: number;
  screenY: number;
  characterColor: string;
  scale: number;
  alpha: number;
  type: HitEffectType;
  streaks: DirectionalStreak[];
  coreRadius: number;
  coronaRadius: number;
}

export function getHitEffectRenderData(pool: HitEffectPool): HitEffectRenderData[] {
  return pool.slots
    .filter(s => s.active)
    .map(s => {
      const alpha = s.maxLife > 0 ? s.life / s.maxLife : 0;
      const baseRadius = s.type === 'block' ? 18 : s.type === 'counter_hit' ? 28 : 20;
      return {
        screenX: s.screenX,
        screenY: s.screenY,
        characterColor: s.characterColor,
        scale: s.scale,
        alpha,
        type: s.type,
        streaks: s.streaks,
        coreRadius: Math.max(0, (baseRadius * 0.35) * s.scale * (0.5 + alpha * 0.5)),
        coronaRadius: Math.max(0, baseRadius * s.scale * (0.4 + alpha * 0.6)),
      };
    });
}
