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

/** Minimum lock (seconds) so a jab is never a 4-frame flicker. */
export const MIN_ATTACK_LOCK_S: Record<string, number> = {
  lightAttack: 0.58,
  light: 0.58,
  Startup: 0.58,
  Active: 0.58,
  heavyAttack: 0.78,
  heavy: 0.78,
  lightKick: 0.66,
  heavyKick: 0.84,
  CommandThrow: 0.92,
  heatBurst: 0.80,
  rageArt: 1.05,
  powerCrush: 0.85,
  jumpAttack: 0.70,
  runAttack: 0.72,
};

const DEFAULT_MIN_LOCK_S = 0.58;
/** Hard cap so a 2.2s Mixamo clip does not freeze the fighter for 2s. */
export const MAX_ATTACK_LOCK_S = 1.15;

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
export function computeAttackLockDuration(motion: string, frameTotalSeconds: number): number {
  const minLock = MIN_ATTACK_LOCK_S[motion] ?? DEFAULT_MIN_LOCK_S;
  const lock = Math.max(frameTotalSeconds, minLock);
  return Math.min(lock, Math.max(frameTotalSeconds, MAX_ATTACK_LOCK_S));
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
  return Math.max(0.7, Math.min(3.4, scale));
}

/**
 * Visual playback window for the mixer. Independent of authored frame-data
 * so a 1.73s Mixamo clip still compresses into a fighter-speed jab.
 */
export function computeVisualPlaybackLock(motion: string): number {
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
