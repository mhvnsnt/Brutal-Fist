/**
 * What the hitbox is allowed to do to the defender right now.
 * This is the read the game was skipping: highs miss a crouch, lows go
 * under a standing guard, mids hit a crouching guard, airborne fighters
 * only take juggles, and a swing in startup is a counter hit.
 */

import type { AttackLevel } from './StringRoutes';

export interface DefenderRead {
  crouching: boolean;
  guarding: boolean;
  airborne: boolean;
  /** Defender is still inside their own attack startup. */
  inStartup: boolean;
  /** Hits already landed during this launch. */
  juggleHits: number;
}

export type ContactKind = 'whiff' | 'block' | 'hit' | 'counter' | 'juggle';

export interface ContactJudgement {
  kind: ContactKind;
  damageScale: number;
  hitstunScale: number;
  /** Final launch strength after the read. 0 = no pop. */
  launch: number;
  /** They get popped, then fall into knockdown when they land. */
  screw: boolean;
  /** Combo is over — this hit knocks them down now. */
  drop: boolean;
}

const JUGGLE_LIMIT = 4;

export function judgeContact(
  level: AttackLevel,
  defender: DefenderRead,
  baseLaunch: number,
): ContactJudgement {
  const grounded = {
    damageScale: 1,
    hitstunScale: 1,
    launch: baseLaunch,
    screw: baseLaunch >= 0.85,
    drop: false,
  };

  if (defender.airborne && level === 'low') {
    return { kind: 'whiff', damageScale: 0, hitstunScale: 0, launch: 0, screw: false, drop: false };
  }

  if (!defender.airborne && defender.crouching && level === 'high') {
    return { kind: 'whiff', damageScale: 0, hitstunScale: 0, launch: 0, screw: false, drop: false };
  }

  if (defender.guarding && !defender.airborne) {
    const standBlocks = !defender.crouching && (level === 'high' || level === 'mid');
    const crouchBlocks = defender.crouching && level === 'low';
    if (standBlocks || crouchBlocks) {
      return { kind: 'block', damageScale: 0.08, hitstunScale: 0, launch: 0, screw: false, drop: false };
    }
  }

  if (defender.airborne) {
    const drop = defender.juggleHits >= JUGGLE_LIMIT;
    return {
      kind: 'juggle',
      damageScale: 0.9,
      hitstunScale: 1.1,
      launch: drop ? 0 : Math.max(baseLaunch, 0.46),
      screw: false,
      drop,
    };
  }

  if (defender.inStartup) {
    const pops = baseLaunch >= 0.15;
    return {
      kind: 'counter',
      damageScale: 1.22,
      hitstunScale: 1.5,
      launch: pops ? Math.max(baseLaunch, 0.55) : 0,
      screw: pops && baseLaunch >= 0.85,
      drop: false,
    };
  }

  return { kind: 'hit', ...grounded };
}
