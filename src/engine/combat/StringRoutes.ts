/**
 * Dialed attack strings. These are the routes the buttons actually play,
 * not a single canned "combo" move.
 *
 * 1 = LP, 2 = RP, 3 = LK, 4 = RK.
 * A matching chain cancels on `cancelAt` even if the previous hit whiffed
 * (you dialed it). Anything that is NOT on a route only cancels early
 * when the previous swing connected — that is the hit-confirm.
 *
 * Keyboard: U / Z = 1, I / X = 2, J = 3, K = 4.
 * Heat dash is not a limb: while Heat is up, double-tap forward during
 * a connected swing to dash in and keep the combo.
 */

export type Limb = 'lp' | 'rp' | 'lk' | 'rk';
export type AttackLevel = 'high' | 'mid' | 'low';
export type AttackMotion = 'lightAttack' | 'heavyAttack' | 'lightKick' | 'heavyKick';

export interface StringHit {
  limb: Limb;
  motion: AttackMotion;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  attackLevel: AttackLevel;
  /** 0 stays on the ground. 0.5+ pops. 0.85+ screws (they fall on landing). */
  launch: number;
  hitstun: number;
  blockstun: number;
  /** Seconds from this swing's start when the next dialed button may come out. */
  cancelAt: number;
  /** Step toward the opponent as the swing starts so the next hit can reach. */
  stepIn: number;
  reach: number;
  width: number;
  depth: number;
  pushback: number;
  /** Bank clip for this hit. Absent → direction pool, and the step index rotates it. */
  clip?: string;
}

export interface AttackString {
  id: string;
  name: string;
  /** First hit only comes out while holding down. */
  requiresCrouch?: boolean;
  hits: StringHit[];
}

const jab: StringHit = {
  limb: 'lp', motion: 'lightAttack',
  startup: 0.05, active: 0.04, recovery: 0.16,
  damage: 28, attackLevel: 'high', launch: 0,
  hitstun: 0.22, blockstun: 0.10, cancelAt: 0.13,
  stepIn: 0.10, reach: 1.0, width: 0.7, depth: 0.48, pushback: 0.06,
  clip: 'BOXING',
};

const cross: StringHit = {
  limb: 'rp', motion: 'heavyAttack',
  startup: 0.07, active: 0.05, recovery: 0.20,
  damage: 48, attackLevel: 'mid', launch: 0,
  hitstun: 0.26, blockstun: 0.12, cancelAt: 0.16,
  stepIn: 0.12, reach: 1.05, width: 0.74, depth: 0.5, pushback: 0.10,
  clip: 'BIG_BODY_BLOW',
};

export const ATTACK_STRINGS: AttackString[] = [
  {
    id: 'jab',
    name: '1,1,2',
    hits: [
      jab,
      {
        ...jab,
        startup: 0.04, active: 0.04, recovery: 0.15,
        damage: 26, cancelAt: 0.12, stepIn: 0.08, pushback: 0.05,
        clip: 'BOXING__1_',
      },
      {
        limb: 'rp', motion: 'heavyAttack',
        startup: 0.06, active: 0.05, recovery: 0.22,
        damage: 58, attackLevel: 'mid', launch: 0.12,
        hitstun: 0.30, blockstun: 0.14, cancelAt: 0.16,
        stepIn: 0.14, reach: 1.08, width: 0.76, depth: 0.5, pushback: 0.12,
        clip: 'COMBO_PUNCH',
      },
    ],
  },
  {
    id: 'confirm',
    name: '1,2,4',
    hits: [
      jab,
      cross,
      {
        limb: 'rk', motion: 'heavyKick',
        startup: 0.08, active: 0.06, recovery: 0.26,
        damage: 78, attackLevel: 'mid', launch: 0.7,
        hitstun: 0.36, blockstun: 0.16, cancelAt: 0.20,
        stepIn: 0.18, reach: 1.2, width: 0.82, depth: 0.52, pushback: 0.08,
        clip: 'AU',
      },
    ],
  },
  {
    id: 'kicks',
    name: '3,3,4',
    hits: [
      {
        limb: 'lk', motion: 'lightKick',
        startup: 0.06, active: 0.05, recovery: 0.18,
        damage: 34, attackLevel: 'mid', launch: 0,
        hitstun: 0.24, blockstun: 0.11, cancelAt: 0.14,
        stepIn: 0.12, reach: 1.08, width: 0.72, depth: 0.48, pushback: 0.08,
        clip: 'ILLEGAL_KNEE',
      },
      {
        limb: 'lk', motion: 'lightKick',
        startup: 0.05, active: 0.05, recovery: 0.18,
        damage: 36, attackLevel: 'low', launch: 0,
        hitstun: 0.26, blockstun: 0.12, cancelAt: 0.14,
        stepIn: 0.10, reach: 1.02, width: 0.7, depth: 0.46, pushback: 0.06,
        clip: 'TIGER_FEINT_KICK',
      },
      {
        limb: 'rk', motion: 'heavyKick',
        startup: 0.08, active: 0.07, recovery: 0.26,
        damage: 80, attackLevel: 'mid', launch: 0.78,
        hitstun: 0.38, blockstun: 0.16, cancelAt: 0.20,
        stepIn: 0.16, reach: 1.18, width: 0.8, depth: 0.5, pushback: 0.08,
        clip: 'CAPOEIRA',
      },
    ],
  },
  {
    id: 'two',
    name: '2,2,1',
    hits: [
      {
        limb: 'rp', motion: 'heavyAttack',
        startup: 0.07, active: 0.05, recovery: 0.20,
        damage: 44, attackLevel: 'mid', launch: 0,
        hitstun: 0.26, blockstun: 0.12, cancelAt: 0.15,
        stepIn: 0.12, reach: 1.06, width: 0.74, depth: 0.5, pushback: 0.08,
        clip: 'BOXING__3_',
      },
      {
        limb: 'rp', motion: 'heavyAttack',
        startup: 0.06, active: 0.05, recovery: 0.20,
        damage: 46, attackLevel: 'mid', launch: 0,
        hitstun: 0.26, blockstun: 0.12, cancelAt: 0.15,
        stepIn: 0.10, reach: 1.06, width: 0.74, depth: 0.5, pushback: 0.08,
        clip: 'BASH',
      },
      {
        limb: 'lp', motion: 'lightAttack',
        startup: 0.05, active: 0.04, recovery: 0.16,
        damage: 32, attackLevel: 'high', launch: 0.2,
        hitstun: 0.28, blockstun: 0.12, cancelAt: 0.14,
        stepIn: 0.10, reach: 1.0, width: 0.7, depth: 0.48, pushback: 0.08,
        clip: 'BOXING__2_',
      },
    ],
  },
  {
    id: 'magic',
    name: '1,3,2',
    hits: [
      jab,
      {
        limb: 'lk', motion: 'lightKick',
        startup: 0.06, active: 0.05, recovery: 0.18,
        damage: 36, attackLevel: 'mid', launch: 0,
        hitstun: 0.24, blockstun: 0.11, cancelAt: 0.14,
        stepIn: 0.12, reach: 1.06, width: 0.72, depth: 0.48, pushback: 0.06,
        clip: 'ILLEGAL_KNEE',
      },
      {
        ...cross,
        clip: 'BASEBALL_HIT',
        launch: 0.18,
        damage: 54,
      },
    ],
  },
  {
    id: 'low',
    name: 'd+3,2',
    requiresCrouch: true,
    hits: [
      {
        limb: 'lk', motion: 'lightKick',
        startup: 0.07, active: 0.05, recovery: 0.20,
        damage: 40, attackLevel: 'low', launch: 0,
        hitstun: 0.28, blockstun: 0.14, cancelAt: 0.15,
        stepIn: 0.14, reach: 1.05, width: 0.7, depth: 0.46, pushback: 0.06,
        clip: 'ILLEGAL_KNEE',
      },
      {
        limb: 'rp', motion: 'heavyAttack',
        startup: 0.07, active: 0.05, recovery: 0.22,
        damage: 56, attackLevel: 'mid', launch: 0.28,
        hitstun: 0.30, blockstun: 0.14, cancelAt: 0.16,
        stepIn: 0.12, reach: 1.05, width: 0.74, depth: 0.48, pushback: 0.10,
        clip: 'BOXING__4_',
      },
    ],
  },
  {
    id: 'crouch-mid',
    name: 'd+1,2',
    requiresCrouch: true,
    hits: [
      {
        limb: 'lp', motion: 'lightAttack',
        startup: 0.06, active: 0.04, recovery: 0.18,
        damage: 32, attackLevel: 'mid', launch: 0,
        hitstun: 0.24, blockstun: 0.12, cancelAt: 0.14,
        stepIn: 0.10, reach: 1.0, width: 0.7, depth: 0.46, pushback: 0.06,
        clip: 'BOXING__5_',
      },
      {
        limb: 'rp', motion: 'heavyAttack',
        startup: 0.07, active: 0.05, recovery: 0.20,
        damage: 50, attackLevel: 'mid', launch: 0.16,
        hitstun: 0.28, blockstun: 0.13, cancelAt: 0.16,
        stepIn: 0.12, reach: 1.04, width: 0.74, depth: 0.48, pushback: 0.08,
        clip: 'BIG_BODY_BLOW',
      },
    ],
  },
];

/** Running 1 or 2. Closes the gap instead of starting a standing string. */
export const RUN_ATTACK: StringHit = {
  limb: 'lp', motion: 'heavyAttack',
  startup: 0.07, active: 0.06, recovery: 0.22,
  damage: 52, attackLevel: 'mid', launch: 0.15,
  hitstun: 0.28, blockstun: 0.14, cancelAt: 0.18,
  stepIn: 0.85, reach: 1.15, width: 0.8, depth: 0.55, pushback: 0.1,
  clip: 'BODY_JAB_CROSS',
};

/** Running 4. A fast drop kick, not the hurricane. */
export const RUN_KICK: StringHit = {
  limb: 'rk', motion: 'heavyKick',
  startup: 0.08, active: 0.06, recovery: 0.24,
  damage: 64, attackLevel: 'mid', launch: 0.55,
  hitstun: 0.32, blockstun: 0.14, cancelAt: 0.18,
  stepIn: 0.95, reach: 1.2, width: 0.82, depth: 0.55, pushback: 0.08,
  clip: 'DROP_KICK',
};

/** Forward dash cancel while Heat is active and the last swing connected. */
export const HEAT_DASH_HIT: StringHit = {
  limb: 'lp', motion: 'heavyAttack',
  startup: 0.05, active: 0.08, recovery: 0.22,
  damage: 46, attackLevel: 'mid', launch: 0.5,
  hitstun: 0.34, blockstun: 0.16, cancelAt: 0.16,
  stepIn: 1.05, reach: 1.1, width: 0.8, depth: 0.55, pushback: 0.08,
  clip: 'BASH',
};

const LIMB_MOTION: Record<Limb, AttackMotion> = {
  lp: 'lightAttack',
  rp: 'heavyAttack',
  lk: 'lightKick',
  rk: 'heavyKick',
};

/** Free-form follow-up. Slower than a charted string, and only on connect. */
export function genericLink(limb: Limb): StringHit {
  const motion = LIMB_MOTION[limb];
  const kick = limb === 'lk' || limb === 'rk';
  return {
    limb,
    motion,
    startup: kick ? 0.07 : 0.05,
    active: 0.05,
    recovery: 0.18,
    damage: limb === 'rk' ? 62 : limb === 'rp' ? 46 : 28,
    attackLevel: limb === 'lp' ? 'high' : limb === 'lk' ? 'low' : 'mid',
    launch: limb === 'rk' ? 0.45 : 0,
    hitstun: 0.24,
    blockstun: 0.11,
    cancelAt: 0.15,
    stepIn: 0.12,
    reach: kick ? 1.08 : 0.96,
    width: 0.7,
    depth: 0.46,
    pushback: 0.16,
  };
}

export interface BuiltAttack {
  startup: number;
  active: number;
  recovery: number;
  animation: AttackMotion;
  damage: number;
  attackLevel: AttackLevel;
  launchPower: number;
  hitstun: number;
  blockstun: number;
  cancelAt: number;
  stepIn: number;
  reach: number;
  width: number;
  depth: number;
  pushback: number;
  specialName?: string;
  isSpecial?: boolean;
  clip?: string;
}

export function hitToWindow(hit: StringHit, label?: string): BuiltAttack {
  return {
    startup: hit.startup,
    active: hit.active,
    recovery: hit.recovery,
    animation: hit.motion,
    damage: hit.damage,
    attackLevel: hit.attackLevel,
    launchPower: hit.launch,
    hitstun: hit.hitstun,
    blockstun: hit.blockstun,
    cancelAt: hit.cancelAt,
    stepIn: hit.stepIn,
    reach: hit.reach,
    width: hit.width,
    depth: hit.depth,
    pushback: hit.pushback,
    specialName: label,
    isSpecial: label === 'HEAT DASH',
    clip: hit.clip,
  };
}

/**
 * Longest charted route whose hits[0..chain.length) equal `chain`.
 * Crouch routes only match while crouching. At length 1 a crouch route
 * wins over a standing route when the fighter is crouched.
 */
export function matchString(
  chain: Limb[],
  crouching: boolean,
): { route: AttackString; index: number } | null {
  if (chain.length === 0) return null;
  let best: { route: AttackString; index: number } | null = null;
  for (const route of ATTACK_STRINGS) {
    if (route.requiresCrouch && !crouching) continue;
    if (route.hits.length < chain.length) continue;
    const matches = chain.every((limb, i) => route.hits[i].limb === limb);
    if (!matches) continue;
    const candidate = { route, index: chain.length - 1 };
    if (!best) {
      best = candidate;
      continue;
    }
    const crouchWin = !!route.requiresCrouch && !best.route.requiresCrouch && crouching && chain.length === 1;
    if (crouchWin || route.hits.length > best.route.hits.length) best = candidate;
  }
  return best;
}
