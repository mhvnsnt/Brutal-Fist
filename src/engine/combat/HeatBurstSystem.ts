/**
 * HeatBurstSystem — Tekken 8-style Heat Burst stance mode
 *
 * Heat Burst (2+3 / RP+LK):
 *  - Activates Heat State (stance mode) for HEAT_DURATION_FRAMES
 *  - During Heat State, fighter gets access to stance-specific attacks
 *  - Heat State can be broken by opponent landing a Power Crush or specific moves
 *  - Heat Burst itself is an attack — if it connects, it deals damage and activates Heat
 *  - If Heat Burst is blocked, Heat State still activates but with reduced duration
 *  - Heat State has recovery frames when it expires naturally
 *
 * PowerCrush (passive super armor):
 *  - Activated by specific input (hold back + heavy)
 *  - Absorbs incoming attacks without flinching (super armor)
 *  - But takes reduced health bleed (chip damage) while absorbing
 *  - Power Crush is broken if hit by a throw or a grab
 *  - Power Crush has a limited active window (POWER_CRUSH_ACTIVE_FRAMES)
 *
 * Rage Art (cinematic super move):
 *  - Only available when HP < 25% (Rage threshold)
 *  - Triggers a cinematic camera sequence
 *  - Deals massive damage (RAGE_ART_DAMAGE)
 *  - Fires announcer event on activation
 *  - Can only be used ONCE per match
 *  - Has super armor during startup frames
 */

// ── Heat Burst constants ──────────────────────────────────────────────────────
export const HEAT_DURATION_FRAMES = 300;        // ~5 seconds at 60fps
export const HEAT_BURST_DAMAGE = 120;           // damage if Heat Burst connects
export const HEAT_BURST_BLOCKED_DURATION = 180; // reduced Heat duration if blocked
export const HEAT_RECOVERY_FRAMES = 30;         // recovery frames when Heat expires
export const HEAT_BREAK_STAGGER_FRAMES = 25;    // stagger frames when Heat is broken

// ── Heat stance-specific attack definitions ───────────────────────────────────
export interface HeatAttack {
  id: string;
  name: string;
  damage: number;
  startupFrames: number;
  activeFrames: number;
  recoveryFrames: number;
  animation: string;
  /** Whether this attack is only available in Heat State */
  heatOnly: boolean;
  /** Whether this attack extends Heat duration on hit */
  extendsHeat: boolean;
  heatExtensionFrames: number;
}

export const HEAT_ATTACKS: HeatAttack[] = [
  {
    id: 'heat_smash',
    name: 'Heat Smash',
    damage: 200,
    startupFrames: 14,
    activeFrames: 8,
    recoveryFrames: 28,
    animation: 'heavyAttack',
    heatOnly: true,
    extendsHeat: false,
    heatExtensionFrames: 0,
  },
  {
    id: 'heat_dash',
    name: 'Heat Dash',
    damage: 80,
    startupFrames: 8,
    activeFrames: 12,
    recoveryFrames: 18,
    animation: 'lightAttack',
    heatOnly: true,
    extendsHeat: true,
    heatExtensionFrames: 60,
  },
  {
    id: 'heat_engager',
    name: 'Heat Engager',
    damage: 150,
    startupFrames: 18,
    activeFrames: 10,
    recoveryFrames: 35,
    animation: 'heavyAttack',
    heatOnly: true,
    extendsHeat: true,
    heatExtensionFrames: 90,
  },
];

// ── Power Crush constants ─────────────────────────────────────────────────────
export const POWER_CRUSH_ACTIVE_FRAMES = 45;    // frames of super armor
export const POWER_CRUSH_HEALTH_BLEED_PCT = 0.15; // 15% of incoming damage taken as chip
export const POWER_CRUSH_STARTUP_FRAMES = 12;   // frames before armor activates
export const POWER_CRUSH_RECOVERY_FRAMES = 38;  // recovery after Power Crush ends

// ── Rage Art constants ────────────────────────────────────────────────────────
export const RAGE_ART_HP_THRESHOLD = 0.25;      // available below 25% HP
export const RAGE_ART_DAMAGE = 350;             // cinematic super damage
export const RAGE_ART_STARTUP_FRAMES = 15;      // super armor startup
export const RAGE_ART_CINEMATIC_DURATION_MS = 2200; // cinematic sequence duration
export const RAGE_ART_RECOVERY_FRAMES = 60;     // recovery after Rage Art

// ── Heat State ────────────────────────────────────────────────────────────────
export interface HeatState {
  /** Whether Heat State is currently active */
  active: boolean;
  /** Frames remaining in Heat State */
  framesRemaining: number;
  /** Whether Heat Burst was blocked (reduced duration) */
  activatedOnBlock: boolean;
  /** Whether Heat State was broken by opponent */
  broken: boolean;
  /** Stagger frames remaining after Heat break */
  breakStaggerFrames: number;
  /** Whether fighter is in Heat recovery (just expired) */
  inRecovery: boolean;
  /** Recovery frames remaining */
  recoveryFrames: number;
  /** Whether Heat Burst has been used this round */
  used: boolean;
}

export function createHeatState(): HeatState {
  return {
    active: false,
    framesRemaining: 0,
    activatedOnBlock: false,
    broken: false,
    breakStaggerFrames: 0,
    inRecovery: false,
    recoveryFrames: 0,
    used: false,
  };
}

// ── Power Crush State ─────────────────────────────────────────────────────────
export interface PowerCrushState {
  /** Whether Power Crush is currently active */
  active: boolean;
  /** Whether super armor is currently absorbing */
  armorActive: boolean;
  /** Frames remaining in active armor window */
  armorFramesRemaining: number;
  /** Startup frames remaining before armor activates */
  startupFramesRemaining: number;
  /** Recovery frames remaining after Power Crush */
  recoveryFramesRemaining: number;
  /** Total chip damage absorbed this Power Crush */
  chipDamageAbsorbed: number;
}

export function createPowerCrushState(): PowerCrushState {
  return {
    active: false,
    armorActive: false,
    armorFramesRemaining: 0,
    startupFramesRemaining: 0,
    recoveryFramesRemaining: 0,
    chipDamageAbsorbed: 0,
  };
}

// ── Rage Art State ────────────────────────────────────────────────────────────
export interface RageArtState {
  /** Whether Rage Art is currently executing */
  executing: boolean;
  /** Whether Rage Art has been used this match (one use per match) */
  usedThisMatch: boolean;
  /** Whether Rage Art is available (HP below threshold) */
  available: boolean;
  /** Whether cinematic sequence is playing */
  cinematicActive: boolean;
  /** Startup frames remaining (super armor window) */
  startupFramesRemaining: number;
  /** Recovery frames remaining after Rage Art */
  recoveryFramesRemaining: number;
}

export function createRageArtState(): RageArtState {
  return {
    executing: false,
    usedThisMatch: false,
    available: false,
    cinematicActive: false,
    startupFramesRemaining: 0,
    recoveryFramesRemaining: 0,
  };
}

// ── Heat Burst activation ─────────────────────────────────────────────────────
/**
 * Activate Heat State.
 * @param onBlock - true if Heat Burst was blocked (reduced duration)
 */
export function activateHeat(heat: HeatState, onBlock: boolean): HeatState {
  if (heat.used) return heat; // can only use once per round
  return {
    ...heat,
    active: true,
    framesRemaining: onBlock ? HEAT_BURST_BLOCKED_DURATION : HEAT_DURATION_FRAMES,
    activatedOnBlock: onBlock,
    broken: false,
    breakStaggerFrames: 0,
    inRecovery: false,
    recoveryFrames: 0,
    used: true,
  };
}

/**
 * Break Heat State (opponent landed Power Crush or specific move).
 */
export function breakHeat(heat: HeatState): HeatState {
  if (!heat.active) return heat;
  return {
    ...heat,
    active: false,
    framesRemaining: 0,
    broken: true,
    breakStaggerFrames: HEAT_BREAK_STAGGER_FRAMES,
  };
}

/**
 * Extend Heat duration when a Heat Engager connects.
 */
export function extendHeat(heat: HeatState, extensionFrames: number): HeatState {
  if (!heat.active) return heat;
  return {
    ...heat,
    framesRemaining: Math.min(heat.framesRemaining + extensionFrames, HEAT_DURATION_FRAMES),
  };
}

/**
 * Tick Heat State each frame.
 */
export function tickHeat(heat: HeatState): HeatState {
  if (heat.breakStaggerFrames > 0) {
    return { ...heat, breakStaggerFrames: heat.breakStaggerFrames - 1 };
  }
  if (heat.inRecovery) {
    const newRecovery = heat.recoveryFrames - 1;
    return { ...heat, recoveryFrames: newRecovery, inRecovery: newRecovery > 0 };
  }
  if (!heat.active) return heat;

  const newFrames = heat.framesRemaining - 1;
  if (newFrames <= 0) {
    // Heat expired — enter recovery
    return {
      ...heat,
      active: false,
      framesRemaining: 0,
      inRecovery: true,
      recoveryFrames: HEAT_RECOVERY_FRAMES,
    };
  }
  return { ...heat, framesRemaining: newFrames };
}

// ── Power Crush activation ────────────────────────────────────────────────────
export function activatePowerCrush(pc: PowerCrushState): PowerCrushState {
  if (pc.active || pc.recoveryFramesRemaining > 0) return pc;
  return {
    ...pc,
    active: true,
    armorActive: false,
    armorFramesRemaining: POWER_CRUSH_ACTIVE_FRAMES,
    startupFramesRemaining: POWER_CRUSH_STARTUP_FRAMES,
    recoveryFramesRemaining: 0,
    chipDamageAbsorbed: 0,
  };
}

/**
 * Process incoming damage through Power Crush armor.
 * Returns { absorbed: true, chipDamage } if armor absorbs the hit.
 * Returns { absorbed: false } if armor is not active or hit is a throw.
 */
export function processPowerCrushHit(
  pc: PowerCrushState,
  incomingDamage: number,
  isThrow: boolean,
): { absorbed: boolean; chipDamage: number; newState: PowerCrushState } {
  if (!pc.armorActive || isThrow) {
    return { absorbed: false, chipDamage: incomingDamage, newState: pc };
  }
  const chipDamage = Math.floor(incomingDamage * POWER_CRUSH_HEALTH_BLEED_PCT);
  return {
    absorbed: true,
    chipDamage,
    newState: {
      ...pc,
      chipDamageAbsorbed: pc.chipDamageAbsorbed + chipDamage,
    },
  };
}

/**
 * Tick Power Crush state each frame.
 */
export function tickPowerCrush(pc: PowerCrushState): PowerCrushState {
  if (!pc.active) return pc;

  if (pc.startupFramesRemaining > 0) {
    const newStartup = pc.startupFramesRemaining - 1;
    return {
      ...pc,
      startupFramesRemaining: newStartup,
      armorActive: newStartup === 0,
    };
  }

  if (pc.armorActive) {
    const newArmor = pc.armorFramesRemaining - 1;
    if (newArmor <= 0) {
      return {
        ...pc,
        armorActive: false,
        armorFramesRemaining: 0,
        active: false,
        recoveryFramesRemaining: POWER_CRUSH_RECOVERY_FRAMES,
      };
    }
    return { ...pc, armorFramesRemaining: newArmor };
  }

  if (pc.recoveryFramesRemaining > 0) {
    const newRecovery = pc.recoveryFramesRemaining - 1;
    return { ...pc, recoveryFramesRemaining: newRecovery };
  }

  return { ...pc, active: false };
}

// ── Rage Art activation ───────────────────────────────────────────────────────
/**
 * Update Rage Art availability based on current HP percentage.
 */
export function updateRageArtAvailability(rageArt: RageArtState, hpPercent: number): RageArtState {
  return {
    ...rageArt,
    available: !rageArt.usedThisMatch && hpPercent <= RAGE_ART_HP_THRESHOLD,
  };
}

/**
 * Activate Rage Art cinematic super.
 * Returns null if not available.
 */
export function activateRageArt(rageArt: RageArtState): RageArtState | null {
  if (!rageArt.available || rageArt.usedThisMatch) return null;
  return {
    ...rageArt,
    executing: true,
    usedThisMatch: true,
    available: false,
    cinematicActive: true,
    startupFramesRemaining: RAGE_ART_STARTUP_FRAMES,
    recoveryFramesRemaining: 0,
  };
}

/**
 * Complete Rage Art cinematic — called after cinematic sequence ends.
 */
export function completeRageArtCinematic(rageArt: RageArtState): RageArtState {
  return {
    ...rageArt,
    cinematicActive: false,
    executing: false,
    recoveryFramesRemaining: RAGE_ART_RECOVERY_FRAMES,
  };
}

/**
 * Tick Rage Art state each frame.
 */
export function tickRageArt(rageArt: RageArtState): RageArtState {
  if (rageArt.startupFramesRemaining > 0) {
    return { ...rageArt, startupFramesRemaining: rageArt.startupFramesRemaining - 1 };
  }
  if (rageArt.recoveryFramesRemaining > 0) {
    const newRecovery = rageArt.recoveryFramesRemaining - 1;
    return { ...rageArt, recoveryFramesRemaining: newRecovery };
  }
  return rageArt;
}

/**
 * Check if Rage Art super armor is active (during startup frames).
 */
export function isRageArtArmorActive(rageArt: RageArtState): boolean {
  return rageArt.executing && rageArt.startupFramesRemaining > 0;
}
