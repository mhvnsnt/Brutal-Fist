/**
 * ClipPlaybackGate — Tekken / Schwarzerblitz "play out fully" fire path.
 *
 * Night Sky / Tekken 3 recompiled / Schwarzerblitz all commit an attack once,
 * then hold the fighter in that action until startup+active+recovery (the
 * lock) elapses. The visual clip is LoopOnce + clampWhenFinished, and its
 * timeScale is clip.duration / lockDuration so EVERY keyframe plays across
 * the lock window. Idle/walk must not hard-cut a oneshot mid-punch.
 *
 * Play-fully ≠ 1.73s Mixamo boxing at 1.0× (too slow for a fighter). Long
 * Mixamo clips compress into ~0.55–0.90s so the whole punch is seen.
 *
 * Hitstun / KO / knockdown may interrupt. Queued cancels during recovery
 * are allowed by the FSM; this gate only owns CLIP playback.
 */

export const ONESHOT_COMBAT_STATES = new Set([
  'lightAttack',
  'heavyAttack',
  'lightKick',
  'heavyKick',
  'light',
  'heavy',
  'Startup',
  'Active',
  'CommandThrow',
  'heatBurst',
  'rageArt',
  'powerCrush',
  'jumpAttack',
  'runAttack',
  'crouchLightAttack',
  'crouchHeavyAttack',
]);

/** States that are allowed to cut a oneshot immediately. */
export const ONESHOT_INTERRUPT_STATES = new Set([
  'hit',
  'hitLow',
  'hitHigh',
  'launch',
  'Hitstun',
  'HitStun',
  'Stunned',
  'Crumple',
  'knockdown',
  'Knockdown',
  'ko',
  'KO',
  'Guard',
  'Blockstun',
  'block',
]);

/** Minimum lock (seconds). Long enough to read the strike, short enough to link. */
export const MIN_ATTACK_LOCK_S: Record<string, number> = {
  lightAttack: 0.24,
  light: 0.24,
  Startup: 0.22,
  Active: 0.22,
  heavyAttack: 0.32,
  heavy: 0.32,
  lightKick: 0.28,
  heavyKick: 0.34,
  CommandThrow: 0.72,
  heatBurst: 0.46,
  rageArt: 0.90,
  powerCrush: 0.46,
  jumpAttack: 0.32,
  runAttack: 0.30,
};

const DEFAULT_MIN_LOCK_S = 0.24;
/** Non-spin swings must not sit in recovery just because the Mixamo file is long. */
const FAST_LOCK_CAP_S: Record<string, number> = {
  lightAttack: 0.32,
  light: 0.32,
  Startup: 0.30,
  Active: 0.30,
  heavyAttack: 0.44,
  heavy: 0.44,
  lightKick: 0.38,
  heavyKick: 0.48,
  jumpAttack: 0.40,
  runAttack: 0.38,
};
/** Hurricane plays near authored length. Everything else is a fighter-speed swing. */
export const MAX_SPIN_LOCK_S = 1.85;

/** Only the committed spin. Drop kicks and capoeira are normal swings. */
const SPIN_CLIP = /HURRICANE/i;

export function isSpinClip(name: string | null | undefined): boolean {
  return !!name && SPIN_CLIP.test(name);
}

export interface OneshotHold {
  clipName: string;
  inputKey: string;
  lockDuration: number;
  startedAt: number;
}

/**
 * Lock window the FSM holds Attacking. Hitboxes still use the original
 * startup/active/recovery; extra lock time is recovery (cancelable).
 */
export function computeAttackLockDuration(
  motion: string,
  frameTotalSeconds: number,
  clipName?: string | null,
): number {
  if (isSpinClip(clipName)) return 1.62;
  const minLock = MIN_ATTACK_LOCK_S[motion] ?? DEFAULT_MIN_LOCK_S;
  const cap = FAST_LOCK_CAP_S[motion];
  if (cap == null) return Math.max(minLock, Math.min(Math.max(frameTotalSeconds, minLock), 1.2));
  return Math.min(cap, Math.max(minLock, frameTotalSeconds));
}

/**
 * timeScale so the whole clip fits the lock. BOXING ~1.73s jab → ~3× into 0.58s.
 * Short procedural clips (< lock) play slightly stretched so the pose holds
 * through recovery instead of popping back to bind at 0.38s of a 0.58s lock.
 */
export function computeOneshotTimeScale(clipDuration: number, lockDuration: number): number {
  const dur = Math.max(0.08, clipDuration);
  const lock = Math.max(0.12, lockDuration);
  const scale = dur / lock;
  // A 1.7s Mixamo punch has to reach its strike inside ~0.10s or the
  // combo cancel chops the windup and the swing never reads.
  return Math.max(0.85, Math.min(7.5, scale));
}

/**
 * Visual playback window for the mixer. Independent of authored frame-data
 * so a 1.73s Mixamo clip still compresses into a fighter-speed jab.
 */
export function computeVisualPlaybackLock(
  motion: string,
  clipName?: string,
  clipDuration?: number,
): number {
  if (isSpinClip(clipName)) {
    const dur = Math.max(0.4, clipDuration ?? 1.5);
    return Math.min(MAX_SPIN_LOCK_S, Math.max(1.15, dur));
  }
  return MIN_ATTACK_LOCK_S[motion] ?? DEFAULT_MIN_LOCK_S;
}

export function isOneshotCombatState(key: string): boolean {
  return ONESHOT_COMBAT_STATES.has(key);
}

export function isOneshotInterrupt(key: string): boolean {
  return ONESHOT_INTERRUPT_STATES.has(key);
}

/** True when idle/walk must not replace a still-playing punch. */
export function shouldHoldOneshot(
  incomingKey: string,
  hold: OneshotHold | null,
  clipTime: number,
  clipDuration: number,
  now: number,
): boolean {
  if (!hold) return false;
  if (isOneshotInterrupt(incomingKey)) return false;
  if (isOneshotCombatState(incomingKey) && incomingKey !== hold.inputKey) return false;
  if (isOneshotCombatState(incomingKey)) return false;

  const finishedByTime = clipDuration > 0 && clipTime >= clipDuration * 0.97;
  const finishedByLock = now - hold.startedAt >= hold.lockDuration + 0.04;
  if (finishedByTime || finishedByLock) return false;
  return true;
}

export function isOneshotFinished(clipTime: number, clipDuration: number): boolean {
  if (clipDuration <= 0) return true;
  return clipTime >= clipDuration * 0.97;
}
