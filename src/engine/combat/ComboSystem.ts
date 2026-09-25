/**
 * ComboSystem — detects consecutive hits within a 2-second window,
 * tracks live combo count, and computes damage scaling per successive hit.
 *
 * Damage scaling: 10–25% reduction per successive hit (capped at 75% total reduction).
 * Hit 1: 100%, Hit 2: 90%, Hit 3: 80%, Hit 4: 75%, Hit 5+: 75%
 */

export interface ComboState {
  count: number;
  /** Damage multiplier for the NEXT hit (0.75–1.0) */
  damageMultiplier: number;
  /** Timestamp of the last registered hit */
  lastHitTime: number;
  /** Whether the combo is still active (within 2s window) */
  active: boolean;
  /** Total combo damage accumulated */
  totalDamage: number;
  /** Player this combo belongs to */
  player: 'p1' | 'p2';
  /** Route or read, e.g. "1,2,4" / "COUNTER" / "JUGGLE". */
  tag?: string;
}

export interface ComboSystemState {
  p1Combo: ComboState;
  p2Combo: ComboState;
}

const COMBO_WINDOW_MS = 2000; // 2-second window
const BASE_SCALING_PER_HIT = 0.10; // 10% reduction per hit
const MIN_MULTIPLIER = 0.75; // floor at 75% damage

export function createComboState(player: 'p1' | 'p2'): ComboState {
  return {
    count: 0,
    damageMultiplier: 1.0,
    lastHitTime: 0,
    active: false,
    totalDamage: 0,
    player,
  };
}

/**
 * Register a new hit and update combo state.
 * Returns the scaled damage value and updated combo state.
 */
export function registerHit(
  state: ComboState,
  rawDamage: number,
  now: number,
): { scaledDamage: number; newState: ComboState } {
  const timeSinceLast = now - state.lastHitTime;
  const withinWindow = state.active && timeSinceLast <= COMBO_WINDOW_MS;

  let newCount: number;
  let newMultiplier: number;

  if (withinWindow) {
    // Extend combo
    newCount = state.count + 1;
    // Each successive hit reduces damage by 10–25% (we use 10% per hit)
    newMultiplier = Math.max(MIN_MULTIPLIER, 1.0 - (newCount - 1) * BASE_SCALING_PER_HIT);
  } else {
    // New combo
    newCount = 1;
    newMultiplier = 1.0;
  }

  const scaledDamage = Math.round(rawDamage * newMultiplier);

  const newState: ComboState = {
    count: newCount,
    damageMultiplier: newMultiplier,
    lastHitTime: now,
    active: true,
    totalDamage: withinWindow ? state.totalDamage + scaledDamage : scaledDamage,
    player: state.player,
  };

  return { scaledDamage, newState };
}

/**
 * Tick the combo system — expire combos that exceed the 2s window.
 * Call this every frame.
 */
export function tickComboSystem(
  p1Combo: ComboState,
  p2Combo: ComboState,
  now: number,
): { p1Combo: ComboState; p2Combo: ComboState } {
  const expireCombo = (combo: ComboState): ComboState => {
    if (!combo.active) return combo;
    if (now - combo.lastHitTime > COMBO_WINDOW_MS) {
      return { ...combo, active: false };
    }
    return combo;
  };

  return {
    p1Combo: expireCombo(p1Combo),
    p2Combo: expireCombo(p2Combo),
  };
}

/** Get display label for damage scaling */
export function getScalingLabel(multiplier: number): string {
  const pct = Math.round(multiplier * 100);
  if (pct >= 100) return '';
  return `${pct}% DMG`;
}
