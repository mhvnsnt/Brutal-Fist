/**
 * HitEffectSystem — AAA billboarded 3-layer spark system
 *
 * Architecture (Tekken hit effect layers):
 *  Layer 1: White-hot core — pure white center, always blown-out
 *  Layer 2: Character color corona — surrounds white core with fighter's identity color
 *  Layer 3: Directional streaks — sharp jagged streaks along attack trajectory
 *
 * Contextual shapes:
 *  - Clean hit: explosive jagged starbursts in character color
 *  - Block: universal pale blue/grey circular shield spark
 *  - Counter-hit: same as clean hit but 200% scale, longer duration, + screen shake
 *
 * Environmental illumination:
 *  - THREE.PointLight at impact XYZ, tinted to attacker's color
 *  - Exists for exactly 3-5 frames then vanishes (flashbulb, not glow stick)
 *
 * Object pooling:
 *  - Pre-allocate pool of 5 hit-spark effect slots
 *  - Reuse slots instead of creating new meshes on every hit
 *  - Prevents mobile GC stutter
 *
 * Camera shake:
 *  - Light punch: 1px for 3 frames
 *  - Heavy punch: 5px for 10 frames
 *  - Counter-hit: 8px for 15 frames
 *
 * NOTE: This system provides the data/state for hit effects.
 * The actual Three.js rendering is done in CombatArena3D.tsx using this data.
 */

// ── Hit effect types ──────────────────────────────────────────────────────────
export type HitEffectType = 'clean_hit' | 'block' | 'counter_hit' | 'wall_splat' | 'floor_slam';

// ── Hit weight for camera shake ───────────────────────────────────────────────
export type HitWeight = 'light' | 'medium' | 'heavy' | 'counter' | 'super';

// ── Directional streak ────────────────────────────────────────────────────────
export interface DirectionalStreak {
  angle: number;   // radians
  length: number;  // streak length in screen pixels
  width: number;   // streak width
  color: string;   // character color
  alpha: number;   // 0-1
}

// ── Point light flash data ────────────────────────────────────────────────────
export interface PointLightFlash {
  /** World-space position of the impact */
  x: number;
  y: number;
  z: number;
  /** Light color (attacker's character color) */
  color: string;
  /** Current intensity (fades to 0 over 5 frames) */
  intensity: number;
  /** Max intensity */
  maxIntensity: number;
  /** Frames remaining (3-5 frames) */
  framesRemaining: number;
  /** Total frames */
  totalFrames: number;
}

// ── Camera shake state ────────────────────────────────────────────────────────
export interface CameraShakeState {
  active: boolean;
  /** Current X offset in pixels */
  offsetX: number;
  /** Current Y offset in pixels */
  offsetY: number;
  /** Magnitude of shake */
  magnitude: number;
  /** Frames remaining */
  framesRemaining: number;
  /** Total frames */
  totalFrames: number;
}

export function createCameraShakeState(): CameraShakeState {
  return { active: false, offsetX: 0, offsetY: 0, magnitude: 0, framesRemaining: 0, totalFrames: 0 };
}

// ── Hit effect slot (pooled) ──────────────────────────────────────────────────
export interface HitEffectSlot {
  /** Whether this slot is currently active */
  active: boolean;
  /** Type of hit effect */
  type: HitEffectType;
  /** Screen-space X position */
  screenX: number;
  /** Screen-space Y position */
  screenY: number;
  /** World-space position for point light */
  worldX: number;
  worldY: number;
  worldZ: number;
  /** Character color (corona layer) */
  characterColor: string;
  /** Scale multiplier (1.0 = normal, 2.0 = counter-hit) */
  scale: number;
  /** Life remaining (0-1, 1 = just spawned) */
  life: number;
  /** Max life in seconds */
  maxLife: number;
  /** Directional streaks */
  streaks: DirectionalStreak[];
  /** Attack direction angle (radians) for streak orientation */
  attackAngle: number;
  /** Point light flash */
  pointLight: PointLightFlash | null;
}

// ── Hit effect pool ───────────────────────────────────────────────────────────
export const HIT_EFFECT_POOL_SIZE = 5;

export interface HitEffectPool {
  slots: HitEffectSlot[];
  cameraShake: CameraShakeState;
  /** Global screen flash intensity (0-1) */
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
      scale: 1.0,
      life: 0,
      maxLife: 0.4,
      streaks: [],
      attackAngle: 0,
      pointLight: null,
    });
  }
  return {
    slots,
    cameraShake: createCameraShakeState(),
    screenFlash: 0,
  };
}

// ── Streak generation ─────────────────────────────────────────────────────────
function generateStreaks(
  type: HitEffectType,
  characterColor: string,
  attackAngle: number,
  scale: number,
): DirectionalStreak[] {
  const streaks: DirectionalStreak[] = [];

  if (type === 'block') {
    // Block: circular shield sparks — no directional streaks, just radial
    for (let i = 0; i < 6; i++) {
      streaks.push({
        angle: (Math.PI * 2 * i) / 6,
        length: 12 * scale,
        width: 2,
        color: '#8ab4d4', // pale blue shield color
        alpha: 0.7,
      });
    }
    return streaks;
  }

  // Clean hit / counter-hit: jagged directional streaks
  const baseCount = type === 'counter_hit' ? 12 : 8;
  const baseLength = type === 'counter_hit' ? 35 * scale : 20 * scale;

  for (let i = 0; i < baseCount; i++) {
    // Bias streaks toward attack direction
    const spread = Math.PI * 0.7;
    const angle = attackAngle + (Math.random() - 0.5) * spread;
    const length = baseLength * (0.5 + Math.random() * 0.8);
    streaks.push({
      angle,
      length,
      width: 1.5 + Math.random() * 2,
      color: characterColor,
      alpha: 0.8 + Math.random() * 0.2,
    });
  }

  // Add a few white-hot core streaks
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

// ── Spawn hit effect ──────────────────────────────────────────────────────────
export interface SpawnHitEffectParams {
  type: HitEffectType;
  screenX: number;
  screenY: number;
  worldX: number;
  worldY: number;
  worldZ: number;
  characterColor: string;
  attackAngle?: number;
  damage?: number;
}

/**
 * Spawn a hit effect into the pool.
 * Finds the oldest/inactive slot and reuses it.
 */
export function spawnHitEffect(pool: HitEffectPool, params: SpawnHitEffectParams): HitEffectPool {
  const {
    type, screenX, screenY, worldX, worldY, worldZ,
    characterColor, attackAngle = 0, damage = 100,
  } = params;

  // Find inactive slot, or steal the oldest active one
  let slotIdx = pool.slots.findIndex(s => !s.active);
  if (slotIdx === -1) slotIdx = 0; // steal first slot

  const isCounter = type === 'counter_hit';
  const isHeavy = damage > 150 || isCounter;
  const scale = isCounter ? 2.0 : isHeavy ? 1.4 : 1.0;
  const maxLife = isCounter ? 0.6 : isHeavy ? 0.45 : 0.35;

  // Point light: 3-5 frames
  const pointLightFrames = isCounter ? 5 : isHeavy ? 4 : 3;
  const pointLightIntensity = isCounter ? 8.0 : isHeavy ? 5.0 : 3.0;

  const pointLight: PointLightFlash = {
    x: worldX, y: worldY, z: worldZ,
    color: type === 'block' ? '#8ab4d4' : characterColor,
    intensity: pointLightIntensity,
    maxIntensity: pointLightIntensity,
    framesRemaining: pointLightFrames,
    totalFrames: pointLightFrames,
  };

  const newSlot: HitEffectSlot = {
    active: true,
    type,
    screenX, screenY,
    worldX, worldY, worldZ,
    characterColor,
    scale,
    life: maxLife,
    maxLife,
    streaks: generateStreaks(type, characterColor, attackAngle, scale),
    attackAngle,
    pointLight,
  };

  const newSlots = [...pool.slots];
  newSlots[slotIdx] = newSlot;

  // Camera shake
  const shake = getCameraShakeForHit(type, damage);

  // Screen flash
  const flashIntensity = isCounter ? 0.9 : isHeavy ? 0.5 : 0.25;

  return {
    slots: newSlots,
    cameraShake: shake,
    screenFlash: Math.max(pool.screenFlash, flashIntensity),
  };
}

// ── Camera shake calculation ──────────────────────────────────────────────────
export function getCameraShakeForHit(type: HitEffectType, damage: number): CameraShakeState {
  if (type === 'block') {
    return { active: true, offsetX: 0, offsetY: 0, magnitude: 1, framesRemaining: 3, totalFrames: 3 };
  }
  if (type === 'counter_hit') {
    return { active: true, offsetX: 0, offsetY: 0, magnitude: 8, framesRemaining: 15, totalFrames: 15 };
  }
  if (type === 'floor_slam' || type === 'wall_splat') {
    return { active: true, offsetX: 0, offsetY: 0, magnitude: 6, framesRemaining: 12, totalFrames: 12 };
  }
  if (damage > 200) {
    return { active: true, offsetX: 0, offsetY: 0, magnitude: 5, framesRemaining: 10, totalFrames: 10 };
  }
  if (damage > 100) {
    return { active: true, offsetX: 0, offsetY: 0, magnitude: 3, framesRemaining: 6, totalFrames: 6 };
  }
  return { active: true, offsetX: 0, offsetY: 0, magnitude: 1, framesRemaining: 3, totalFrames: 3 };
}

// ── Tick hit effect pool ──────────────────────────────────────────────────────
const TICK_DT = 1 / 60; // 60fps tick

export function tickHitEffectPool(pool: HitEffectPool): HitEffectPool {
  // Tick slots
  const newSlots = pool.slots.map(slot => {
    if (!slot.active) return slot;

    const newLife = slot.life - TICK_DT;
    if (newLife <= 0) {
      return { ...slot, active: false, life: 0, pointLight: null };
    }

    // Tick point light
    let newPointLight = slot.pointLight;
    if (newPointLight && newPointLight.framesRemaining > 0) {
      const newFrames = newPointLight.framesRemaining - 1;
      const newIntensity = newFrames <= 0 ? 0 :
        newPointLight.maxIntensity * (newFrames / newPointLight.totalFrames);
      newPointLight = newFrames <= 0 ? null : {
        ...newPointLight,
        framesRemaining: newFrames,
        intensity: newIntensity,
      };
    }

    return { ...slot, life: newLife, pointLight: newPointLight };
  });

  // Tick camera shake
  let newShake = pool.cameraShake;
  if (newShake.active && newShake.framesRemaining > 0) {
    const t = newShake.framesRemaining / newShake.totalFrames;
    const decayedMag = newShake.magnitude * t;
    newShake = {
      ...newShake,
      offsetX: (Math.random() - 0.5) * 2 * decayedMag,
      offsetY: (Math.random() - 0.5) * 2 * decayedMag,
      framesRemaining: newShake.framesRemaining - 1,
      active: newShake.framesRemaining > 1,
    };
  } else if (newShake.active) {
    newShake = createCameraShakeState();
  }

  // Fade screen flash
  const newFlash = pool.screenFlash > 0.01 ? pool.screenFlash * 0.82 : 0;

  return { slots: newSlots, cameraShake: newShake, screenFlash: newFlash };
}

// ── Get active point lights ───────────────────────────────────────────────────
export function getActivePointLights(pool: HitEffectPool): PointLightFlash[] {
  return pool.slots
    .filter(s => s.active && s.pointLight !== null)
    .map(s => s.pointLight!);
}

// ── Render data for canvas overlay ───────────────────────────────────────────
export interface HitEffectRenderData {
  screenX: number;
  screenY: number;
  characterColor: string;
  scale: number;
  alpha: number; // life / maxLife
  type: HitEffectType;
  streaks: DirectionalStreak[];
  /** White core radius */
  coreRadius: number;
  /** Corona radius */
  coronaRadius: number;
}

export function getHitEffectRenderData(pool: HitEffectPool): HitEffectRenderData[] {
  return pool.slots
    .filter(s => s.active)
    .map(s => {
      const alpha = s.life / s.maxLife;
      const baseRadius = s.type === 'block' ? 18 : s.type === 'counter_hit' ? 40 : 24;
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
