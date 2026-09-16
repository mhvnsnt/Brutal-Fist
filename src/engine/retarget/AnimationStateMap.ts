/**
 * AnimationStateMap — canonical clip name → FighterMotionState mapping
 *
 * Alias sources:
 *   - Schwarzerblitz engine (github.com/AndreaOrru/schwarzerblitz-engine)
 *   - mhvnsnt/BrutalfistbaseofTekken3Recompiled animation namespace
 *   - mhvnsnt/Bannon character animation data
 *   - Mixamo standard animation names
 *   - Generic / Blender default names
 *
 * AGENT LAW: Every new animation alias added here MUST be lowercase with
 * all non-alphanumeric characters stripped. The normalizeClipState function
 * strips these characters before lookup, so aliases must match that form.
 */

import type { FighterMotionState } from './AnimationController';

const aliases: Record<string, FighterMotionState> = {
  // ── Idle / Neutral ──────────────────────────────────────────────────────────
  idle:                  'idle',
  stance:                'idle',
  neutral:               'idle',
  standing:              'idle',
  standingpose:          'idle',
  combatidle:            'idle',
  fightingstance:        'idle',
  readystance:           'idle',
  tpose:                 'idle',
  bindpose:              'idle',
  rest:                  'idle',
  // Schwarzerblitz aliases
  sbwidle:               'idle',
  sbwstance:             'idle',
  sbwneutral:            'idle',
  // Tekken aliases
  tidle:                 'idle',
  tstance:               'idle',
  // Bannon aliases
  bfidle:                'idle',
  bfstance:              'idle',
  // Mixamo aliases
  mixamoidle:            'idle',
  mixamostance:          'idle',

  // ── Walk Forward ────────────────────────────────────────────────────────────
  walk:                  'walkForward',
  walkforward:           'walkForward',
  forwardwalk:           'walkForward',
  walkfwd:               'walkForward',
  movingforward:         'walkForward',
  advance:               'walkForward',
  approach:              'walkForward',
  // Schwarzerblitz
  sbwwalkfwd:            'walkForward',
  sbwwalkforward:        'walkForward',
  // Tekken
  twalkfwd:              'walkForward',
  twalk:                 'walkForward',
  // Bannon
  bfwalkfwd:             'walkForward',
  bfwalk:                'walkForward',
  // Mixamo
  walkingforward:        'walkForward',
  slowwalk:              'walkForward',

  // ── Walk Backward ───────────────────────────────────────────────────────────
  walkback:              'walkBackward',
  walkbackward:          'walkBackward',
  backwalk:              'walkBackward',
  walkbwd:               'walkBackward',
  retreat:               'walkBackward',
  movingbackward:        'walkBackward',
  // Schwarzerblitz
  sbwwalkback:           'walkBackward',
  sbwwalkbwd:            'walkBackward',
  // Tekken
  twalkback:             'walkBackward',
  // Bannon
  bfwalkback:            'walkBackward',

  // ── Strafe Left ─────────────────────────────────────────────────────────────
  strafeleft:            'strafeLeft',
  sidestepleft:          'strafeLeft',
  sidestep_left:         'strafeLeft',
  moveleft:              'strafeLeft',
  stepleft:              'strafeLeft',
  // Tekken sidestep
  tsidestepleft:         'strafeLeft',
  tssleft:               'strafeLeft',
  // Schwarzerblitz
  sbwstrafeleft:         'strafeLeft',

  // ── Strafe Right ────────────────────────────────────────────────────────────
  straferight:           'strafeRight',
  sidestepright:         'strafeRight',
  sidestep_right:        'strafeRight',
  moveright:             'strafeRight',
  stepright:             'strafeRight',
  // Tekken sidestep
  tsidestepright:        'strafeRight',
  tssright:              'strafeRight',
  // Schwarzerblitz
  sbwstraferight:        'strafeRight',

  // ── Crouch ──────────────────────────────────────────────────────────────────
  crouch:                'crouch',
  duck:                  'crouch',
  lowstance:             'crouch',
  crouching:             'crouch',
  crouchstance:          'crouch',
  lowguard:              'crouch',
  // Tekken
  tcrouch:               'crouch',
  tcrouching:            'crouch',
  // Schwarzerblitz
  sbwcrouch:             'crouch',
  // Bannon
  bfcrouch:              'crouch',
  // Mixamo
  crouchingpose:         'crouch',

  // ── Guard / Block ───────────────────────────────────────────────────────────
  guard:                 'guard',
  block:                 'guard',
  defend:                'guard',
  parry:                 'guard',
  blocking:              'guard',
  guarding:              'guard',
  highblock:             'guard',
  standingblock:         'guard',
  // Tekken
  tguard:                'guard',
  tblock:                'guard',
  // Schwarzerblitz
  sbwguard:              'guard',
  sbwblock:              'guard',
  // Bannon
  bfguard:               'guard',
  bfblock:               'guard',

  // ── Light Attack ────────────────────────────────────────────────────────────
  jab:                   'lightAttack',
  punch:                 'lightAttack',
  lightattack:           'lightAttack',
  light:                 'lightAttack',
  quickpunch:            'lightAttack',
  lightpunch:            'lightAttack',
  punch1:                'lightAttack',
  lp:                    'lightAttack',
  leftpunch:             'lightAttack',
  // Tekken 1-button
  t1:                    'lightAttack',
  tjab:                  'lightAttack',
  tlp:                   'lightAttack',
  // Schwarzerblitz
  sbwlightattack:        'lightAttack',
  sbwjab:                'lightAttack',
  sbwpunchlight:         'lightAttack',
  // Bannon
  bfjab:                 'lightAttack',
  bfchop:                'lightAttack',
  bflightattack:         'lightAttack',
  // Mixamo
  punchingleft:          'lightAttack',
  punchingright:         'lightAttack',
  jabpunch:              'lightAttack',

  // ── Heavy Attack ────────────────────────────────────────────────────────────
  heavyattack:           'heavyAttack',
  heavy:                 'heavyAttack',
  kick:                  'heavyAttack',
  cross:                 'heavyAttack',
  strong:                'heavyAttack',
  rightpunch:            'heavyAttack',
  punch2:                'heavyAttack',
  rp:                    'heavyAttack',
  hook:                  'heavyAttack',
  uppercut:              'heavyAttack',
  roundhouse:            'heavyAttack',
  highkick:              'heavyAttack',
  spinningkick:          'heavyAttack',
  // Tekken 2-button
  t2:                    'heavyAttack',
  t3:                    'heavyAttack',
  t4:                    'heavyAttack',
  tcross:                'heavyAttack',
  trp:                   'heavyAttack',
  tlk:                   'heavyAttack',
  trk:                   'heavyAttack',
  // Schwarzerblitz
  sbwheavyattack:        'heavyAttack',
  sbwcross:              'heavyAttack',
  sbwpunchheavy:         'heavyAttack',
  // Bannon
  bfcross:               'heavyAttack',
  bfelbow:               'heavyAttack',
  bfuppercut:            'heavyAttack',
  bfheavyattack:         'heavyAttack',
  bfmidkick:             'heavyAttack',
  bfhighkick:            'heavyAttack',
  bfspinningkick:        'heavyAttack',
  // Mixamo
  kickingleft:           'heavyAttack',
  kickingright:          'heavyAttack',
  kickingforward:        'heavyAttack',

  // ── Hit Reaction ────────────────────────────────────────────────────────────
  hit:                   'hit',
  hitreaction:           'hit',
  hitstun:               'hit',
  hurt:                  'hit',
  flinch:                'hit',
  damage:                'hit',
  react:                 'hit',
  stagger:               'hit',
  recoil:                'hit',
  // Tekken
  thit:                  'hit',
  thitstun:              'hit',
  // Schwarzerblitz
  sbwhit:                'hit',
  sbwhitreaction:        'hit',
  // Bannon
  bfhitreaction:         'hit',
  // Mixamo
  gettinghit:            'hit',
  hitimpact:             'hit',

  // ── Knockdown ───────────────────────────────────────────────────────────────
  knockdown:             'knockdown',
  down:                  'knockdown',
  fall:                  'knockdown',
  falling:               'knockdown',
  floored:               'knockdown',
  groundhit:             'knockdown',
  hardknockdown:         'knockdown',
  // Tekken
  tknockdown:            'knockdown',
  // Schwarzerblitz
  sbwknockdown:          'knockdown',
  // Bannon
  bfknockdown:           'knockdown',
  bfhardknockdown:       'knockdown',
  // Mixamo
  fallingback:           'knockdown',
  fallingforward:        'knockdown',
  knockeddown:           'knockdown',

  // ── Wakeup ──────────────────────────────────────────────────────────────────
  wake:                  'wake',
  wakeup:                'wake',
  getup:                 'wake',
  risingup:              'wake',
  standingup:            'wake',
  recovery:              'wake',
  // Tekken
  twakeup:               'wake',
  // Schwarzerblitz
  sbwwakeup:             'wake',
  // Bannon
  bfwakeup:              'wake',
  bfwakeupkick:          'wake',
  // Mixamo
  gettingup:             'wake',
  getupfromground:       'wake',

  // ── Backdash ────────────────────────────────────────────────────────────────
  backdash:              'Backdashing',
  backstepping:          'Backdashing',
  backstep:              'Backdashing',
  dashback:              'Backdashing',
  quickretreat:          'Backdashing',
  // Tekken
  tbackdash:             'Backdashing',
  // Schwarzerblitz
  sbwbackdash:           'Backdashing',

  // ── Wakeup Tech Roll ────────────────────────────────────────────────────────
  techroll:              'WakeupTechRoll',
  roll:                  'WakeupTechRoll',
  rollforward:           'WakeupTechRoll',
  forwardroll:           'WakeupTechRoll',
  // Tekken
  ttechroll:             'WakeupTechRoll',
  // Schwarzerblitz
  sbwtechroll:           'WakeupTechRoll',

  // ── Wakeup Backrise ─────────────────────────────────────────────────────────
  backrise:              'WakeupBackrise',
  rollback:              'WakeupBackrise',
  backrollup:            'WakeupBackrise',
  // Tekken
  tbackrise:             'WakeupBackrise',

  // ── Wakeup Quick Stand ──────────────────────────────────────────────────────
  quickstand:            'WakeupQuickStand',
  quickgetup:            'WakeupQuickStand',
  fastgetup:             'WakeupQuickStand',
  // Tekken
  tquickstand:           'WakeupQuickStand',

  // ── Command Throw ───────────────────────────────────────────────────────────
  commandthrow:          'CommandThrow',
  grab:                  'CommandThrow',
  throw:                 'CommandThrow',
  grapple:               'CommandThrow',
  suplex:                'CommandThrow',
  slam:                  'CommandThrow',
  // Tekken throws
  leftthrow:             'CommandThrow',
  rightthrow:            'CommandThrow',
  t13:                   'CommandThrow',
  t24:                   'CommandThrow',
  // Schwarzerblitz
  sbwthrow:              'CommandThrow',
  sbwgrab:               'CommandThrow',
  // Bannon
  bfgrab:                'CommandThrow',
  bfthrow:               'CommandThrow',
  bfbeastmode:           'CommandThrow',

  // ── Throw Whiff ─────────────────────────────────────────────────────────────
  throwwhiff:            'ThrowWhiff',
  grabwhiff:             'ThrowWhiff',
  missedgrab:            'ThrowWhiff',
};

export function normalizeClipState(name: string): FighterMotionState | null {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return aliases[key] ?? null;
}

export function mapAnimationClips<T extends { name: string }>(clips: T[]) {
  const mapped = new Map<FighterMotionState, T>();
  for (const clip of clips) {
    const state = normalizeClipState(clip.name);
    if (state && !mapped.has(state)) mapped.set(state, clip);
  }
  return mapped;
}

/**
 * Get all known aliases for a given FighterMotionState.
 * Useful for building animation search lists.
 */
export function getAliasesForState(state: FighterMotionState): string[] {
  return Object.entries(aliases)
    .filter(([, v]) => v === state)
    .map(([k]) => k);
}
