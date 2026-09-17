/**
 * BANNON ROSTER — Full Character Profiles
 * 
 * Character data sourced from: github.com/mhvnsnt/Bannon
 * "Off The Top Rope" cast and characters document.
 * All characters, bios, personalities, and move sets are original Bannon IP.
 * Used with owner permission.
 * 
 * Move set animation aliases reference:
 *   - Schwarzerblitz open-source engine animations
 *   - BrutalfistbaseofTekken3Recompiled animation namespace
 */

import { getGlbEntryForFighter } from './bannonGlbRoster';
import { BANNON_MODELS_RAW, resolveGlbUrl } from './bannonGlbUrl';
import { pronounsForFighter, type CanonPronouns } from './canonPronouns';

export interface BannonFighterProfile {
  id: string;
  name: string;
  dna: string;
  role: string;
  faction: string;
  factionAlignment: 'alliance' | 'corporate' | 'chaos' | 'independent';
  poise: number;
  hp: number;
  speed: number;
  strength: number;
  physicsScale: number;
  payback: string;
  manager: string;
  bio: string;
  personality: string;
  fightingStyle: string;
  model: string;
  attire?: string;
  /** Canon pronouns from mhvnsnt/Bannon. Never infer from the mesh. */
  pronouns?: CanonPronouns;
  /** Raw GLB URL for 3D bust / combat mesh — not the grid sprite */
  portraitUrl: string;
  /** 2D PSX grid headshot. Separate from the 3D GLB so tiny boxes never load SkinnedMeshes. */
  gridPortrait?: string;
  /** Full-resolution concept plate for the select grid (Tekken-style HQ mug). */
  conceptArtUrl?: string;
  /** Fast HQ mug used in the roster boxes (downscaled generated plate, not pixelated). */
  selectMugUrl?: string;
  /** GLB-accurate bust render baked from the combat mesh. */
  likenessUrl?: string;
  /** Painted Tekken-style card derived from the GLB likeness. */
  paintedUrl?: string;
  /** Crunched sprite used by in-fight HUD / art book. */
  pixelPortrait?: string;
  // Per-character move set — IDs from BrutalFistMoveCatalog
  defaultMoveSet: CharacterMoveSet;
}

export interface CharacterMoveSet {
  // Locomotion (always present)
  idle: string;
  walkForward: string;
  walkBackward: string;
  crouch: string;
  guard: string;
  // Core attacks
  lightAttack: string;
  heavyAttack: string;
  // Kick
  lowKick: string;
  highKick: string;
  // Combo
  primaryCombo: string;
  // Counter
  counter: string;
  // Grapple
  grappleInitiate: string;
  // Throw
  primaryThrow: string;
  // Knockdown / wakeup / reaction / KO
  knockdown: string;
  wakeup: string;
  hitReaction: string;
  ko: string;
  // Signature finisher
  signature: string;
  // Optional extras
  extraMove1?: string;
  extraMove2?: string;
}

// ─── ROSTER ──────────────────────────────────────────────────────────────────

const BANNON_RAW = BANNON_MODELS_RAW;

export const BANNON_ROSTER: readonly BannonFighterProfile[] = [

  // ── BANNON ──────────────────────────────────────────────────────────────────
  {
    id: 'bannon',
    name: 'Bannon',
    dna: 'BANNON_V1_CORE',
    role: 'Protagonist / Power Wrestler',
    faction: 'AWE (Rebel)',
    factionAlignment: 'alliance',
    poise: 95, hp: 10000, speed: 85, strength: 90, physicsScale: 1.1,
    payback: 'Beast Mode',
    manager: 'None',
    bio: 'The physical nucleus and absolute force of the Bannon Engine. A redeemed anti-hero who found true loyalty after shedding control. Fights to prove that authentic expression and loyalty are stronger than corporate control.',
    personality: 'Quiet, intensely focused on philosophy and numerology. Seeks authentic emotional connection. Hates pretense. Driven artist who views every match as a statement.',
    fightingStyle: 'Power Wrestling / Technical Hybrid. Explosive grapples, heavy strikes, and high-impact throws. Payback finisher activates when poise is broken.',
    model: 'BANNON_rigged.glb',
    portraitUrl: `${BANNON_RAW}/BANNON_rigged.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_jab', heavyAttack: 'bf_cross',
      lowKick: 'bf_low_kick', highKick: 'bf_high_kick',
      primaryCombo: 'bf_jab_cross_hook',
      counter: 'bf_reversal',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_powerbomb',
      knockdown: 'bf_knockdown', wakeup: 'bf_wakeup',
      hitReaction: 'bf_hit_reaction', ko: 'bf_ko',
      signature: 'bf_beast_mode',
      extraMove1: 'bf_uppercut',
      extraMove2: 'bf_body_slam',
    }
  },

  // ── MAIME ────────────────────────────────────────────────────────────────────
  {
    id: 'maime',
    name: 'Maime',
    dna: 'MAIME',
    role: 'Technical Striker',
    faction: 'AWE',
    factionAlignment: 'alliance',
    poise: 85, hp: 10000, speed: 90, strength: 78, physicsScale: 1.0,
    payback: 'Precision Protocol',
    manager: 'None',
    bio: 'A precise, technically gifted fighter whose speed and accuracy make him a constant threat. He fights with calculated efficiency, never wasting a movement.',
    personality: 'Methodical and focused. Speaks little but observes everything. Finds beauty in perfect technique.',
    fightingStyle: 'Technical Striking / Speed. Fast combos, precise counters, and quick throws. Excels at punishing mistakes.',
    model: 'MAIME_skinned.glb',
    pronouns: 'he/him',
    portraitUrl: `${BANNON_RAW}/MAIME_skinned.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_jab', heavyAttack: 'bf_elbow',
      lowKick: 'bf_low_kick', highKick: 'bf_mid_kick',
      primaryCombo: 'bf_jab_cross',
      counter: 'bf_mars_counter',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_exploder',
      knockdown: 'bf_knockdown', wakeup: 'bf_wakeup',
      hitReaction: 'bf_hit_reaction', ko: 'bf_ko',
      signature: 'bf_maime_driver',
      extraMove1: 'bf_spin_kick',
      extraMove2: 'bf_armor_breaker',
    }
  },

  // ── ONYX ─────────────────────────────────────────────────────────────────────
  {
    id: 'onyx',
    name: 'Onyx',
    dna: 'ONYX',
    role: 'Power Brawler',
    faction: 'AWE',
    factionAlignment: 'alliance',
    poise: 90, hp: 10000, speed: 88, strength: 86, physicsScale: 1.0,
    payback: 'Onyx Crush',
    manager: 'None',
    bio: 'A relentless power brawler whose raw physical presence dominates the ring. Onyx fights with crushing force and an iron will that refuses to break.',
    personality: 'Stoic and determined. Speaks through actions, not words. Deeply loyal to those who earn it.',
    fightingStyle: 'Power Brawler. Heavy strikes, crushing throws, and endurance-based combat. Wears opponents down before finishing them.',
    model: 'ONYX_street.glb',
    portraitUrl: `${BANNON_RAW}/ONYX_street.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_chop', heavyAttack: 'bf_hook',
      lowKick: 'bf_low_kick', highKick: 'bf_high_kick',
      primaryCombo: 'bf_rush_combo',
      counter: 'bf_armor_breaker',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_body_slam',
      knockdown: 'bf_knockdown', wakeup: 'bf_wakeup',
      hitReaction: 'bf_hit_reaction', ko: 'bf_ko',
      signature: 'bf_onyx_crush',
      extraMove1: 'bf_uppercut',
      extraMove2: 'bf_dvd',
    }
  },

  // ── CAIN ELIAS ───────────────────────────────────────────────────────────────
  {
    id: 'cain_elias',
    name: 'Cain Elias',
    dna: 'CAIN_ELIAS',
    role: 'Ultimate Enforcer / Technical Power',
    faction: 'Corporate Structure (Former AWE Enforcer)',
    factionAlignment: 'corporate',
    poise: 92, hp: 10000, speed: 84, strength: 91, physicsScale: 1.05,
    payback: 'Final Verdict',
    manager: 'Edwin J. Kennedy',
    bio: "Kennedy's most trusted, cold-hearted weapon. A technical powerhouse driven by vindictive precision. His LP 6 responsibility manifests as a twisted need to enforce order through pain.",
    personality: 'Cold and calculating in the ring. Outside it, he anonymously volunteers at community centers — a deep contradiction between his brutal role and his private need to nurture order.',
    fightingStyle: 'Technical Power / Vindictive. Combines submission holds with devastating power moves. Methodical destruction followed by the Final Verdict tombstone piledriver.',
    model: 'CAIN_ELIAS_ring.glb',
    attire: 'Ring',
    portraitUrl: `${BANNON_RAW}/CAIN_ELIAS_ring.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_elbow', heavyAttack: 'bf_uppercut',
      lowKick: 'bf_low_kick', highKick: 'bf_mid_kick',
      primaryCombo: 'bf_jab_cross',
      counter: 'bf_reversal',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_suplex',
      knockdown: 'bf_hard_knockdown', wakeup: 'bf_wakeup',
      hitReaction: 'bf_hit_reaction', ko: 'bf_ko',
      signature: 'bf_final_verdict',
      extraMove1: 'bf_full_nelson',
      extraMove2: 'bf_brainbuster',
    }
  },

  // ── STICK-UP ─────────────────────────────────────────────────────────────────
  {
    id: 'stick_up',
    name: 'Stick-Up',
    dna: 'STICKUP',
    role: "The Weapon / System's Optimized Asset",
    faction: 'JPCW / Corporate Conspiracy',
    factionAlignment: 'corporate',
    poise: 85, hp: 10000, speed: 87, strength: 82, physicsScale: 1.0,
    payback: 'Optimization Drive',
    manager: "Stan 'Honey' Combs",
    bio: "A soul driven to be a Master Builder (LP 11), whose energy is now forced into Stan's rigid physical construction. Fights with machine-like precision, punctuated by conspiracy rants.",
    personality: 'Naturally seeks balance and harmony (Libra), but this need is brutally suppressed by the system. Robotic in movement, theatrical in finishers.',
    fightingStyle: 'Technical/Brutal Hybrid. Machine-like precision strikes and submissions, with theatrical high-flying finishers. The Leap of Faith (swanton bomb) is his calling card.',
    model: 'STICKUP.glb',
    portraitUrl: `${BANNON_RAW}/STICKUP.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_jab', heavyAttack: 'bf_cross',
      lowKick: 'bf_low_kick', highKick: 'bf_spinning_kick',
      primaryCombo: 'bf_kickbox_combo',
      counter: 'bf_armor_breaker',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_exploder',
      knockdown: 'bf_knockdown', wakeup: 'bf_wakeup_kick',
      hitReaction: 'bf_hit_reaction', ko: 'bf_ko',
      signature: 'bf_leap_of_faith',
      extraMove1: 'bf_cobra_clutch',
      extraMove2: 'bf_iron_palm',
    }
  },

  // ── CIPHER ───────────────────────────────────────────────────────────────────
  {
    id: 'cipher',
    name: 'Cipher',
    dna: 'CIPHER',
    role: 'Agile Disruptor / Speed Fighter',
    faction: 'AWE (Rebel)',
    factionAlignment: 'alliance',
    poise: 88, hp: 10000, speed: 93, strength: 80, physicsScale: 1.0,
    payback: 'Cipher Protocol',
    manager: 'None',
    bio: 'A lightning-fast fighter who uses blistering pace and agility to break down opponents. Cipher operates in the shadows, striking from unexpected angles.',
    personality: 'Mysterious and calculating. Speaks in riddles. Finds the gaps in every defense and exploits them with surgical precision.',
    fightingStyle: 'Speed / Agility. Rapid multi-hit combos, quick counters, and evasive movement. The Cipher Protocol finisher is a rapid multi-hit strike sequence.',
    model: 'CIPHER_feral.glb',
    portraitUrl: `${BANNON_RAW}/CIPHER_feral.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_jab', heavyAttack: 'bf_elbow',
      lowKick: 'bf_low_kick', highKick: 'bf_spinning_kick',
      primaryCombo: 'bf_rush_combo',
      counter: 'bf_mars_counter',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_exploder',
      knockdown: 'bf_knockdown', wakeup: 'bf_wakeup_kick',
      hitReaction: 'bf_hit_reaction', ko: 'bf_ko',
      signature: 'bf_cipher_strike',
      extraMove1: 'bf_shining_wizard',
      extraMove2: 'bf_dragon_screw',
    }
  },

  // ── ECHO ─────────────────────────────────────────────────────────────────────
  {
    id: 'echo',
    name: 'Echo',
    dna: 'ECHO',
    role: 'Psychological Threat / Aerial',
    faction: 'AWE (Rebel)',
    factionAlignment: 'alliance',
    poise: 86, hp: 10000, speed: 91, strength: 79, physicsScale: 1.0,
    payback: 'Echo Slam',
    manager: 'None',
    bio: 'A mysterious fighter who uses misdirection and psychological games to unsettle opponents. Echo attacks from unexpected angles and uses rapid counter-strikes to punish overconfidence.',
    personality: 'Quiet and unsettling. Moves like a ghost. Uses silence as a weapon.',
    fightingStyle: 'Psychological / Aerial. Misdirection, rapid dodges, and unexpected aerial attacks. The Echo Slam reverberates through the opponent.',
    model: 'ECHO.glb',
    portraitUrl: `${BANNON_RAW}/ECHO.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_jab', heavyAttack: 'bf_hook',
      lowKick: 'bf_dragon_screw', highKick: 'bf_shining_wizard',
      primaryCombo: 'bf_jab_cross',
      counter: 'bf_reversal',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_body_slam',
      knockdown: 'bf_knockdown', wakeup: 'bf_wakeup',
      hitReaction: 'bf_hit_reaction', ko: 'bf_ko',
      signature: 'bf_echo_slam',
      extraMove1: 'bf_cobra_clutch',
      extraMove2: 'bf_spin_kick',
    }
  },

  // ── CODY ─────────────────────────────────────────────────────────────────────
  {
    id: 'cody',
    name: 'Cody',
    dna: 'CODY',
    role: 'Toxic Pawn / Former Manager',
    faction: 'Corporate Structure (Kennedy/Combs)',
    factionAlignment: 'corporate',
    poise: 84, hp: 10000, speed: 86, strength: 83, physicsScale: 1.0,
    payback: 'Cody Buster',
    manager: 'Edwin J. Kennedy',
    bio: "Bannon's former manager, now Kennedy's bodyguard. A volatile cocktail of paranoid intensity and explosive impulse.",
    personality: 'Volatile and paranoid. Sprints everywhere, shouts contracts and statistics. Wears immaculate, expensive designer clothes.',
    fightingStyle: 'Brawler / Interference. Dirty tactics, rope breaks, and managerial interference. When forced to fight, uses explosive power moves.',
    model: 'CODY_sober.glb',
    attire: 'Sober',
    portraitUrl: `${BANNON_RAW}/CODY_sober.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_jab', heavyAttack: 'bf_hook',
      lowKick: 'bf_low_kick', highKick: 'bf_mid_kick',
      primaryCombo: 'bf_jab_cross_hook',
      counter: 'bf_armor_breaker',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_body_slam',
      knockdown: 'bf_knockdown', wakeup: 'bf_wakeup',
      hitReaction: 'bf_hit_reaction', ko: 'bf_ko',
      signature: 'bf_cody_buster',
      extraMove1: 'bf_uppercut',
      extraMove2: 'bf_suplex',
    }
  },

  // ── HALL NIGHTER ─────────────────────────────────────────────────────────────
  {
    id: 'hall_nighter',
    name: 'Hall Nighter',
    dna: 'HALL_NIGHTER',
    role: 'Powerhouse Enforcer',
    faction: 'AWE Asset',
    factionAlignment: 'corporate',
    poise: 90, hp: 10000, speed: 82, strength: 88, physicsScale: 1.0,
    payback: 'Hall Night Driver',
    manager: 'None',
    bio: 'A rugged veteran powerhouse built on toughness and sheer physical durability. Hall Nighter represents the old guard — a physical wall that absorbs massive damage and delivers crushing impact.',
    personality: 'Aggressive and territorial. Demands adoration. Stomps everywhere in heavy boots.',
    fightingStyle: 'Power Brawler / Endurance. Absorbs damage and delivers crushing impact. The Hall Night Driver is a devastating late-night finisher.',
    model: 'HALL_NIGHTER.glb',
    portraitUrl: `${BANNON_RAW}/HALL_NIGHTER.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_chop', heavyAttack: 'bf_discus_clothesline',
      lowKick: 'bf_low_kick', highKick: 'bf_high_kick',
      primaryCombo: 'bf_rush_combo',
      counter: 'bf_armor_breaker',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_running_powerbomb',
      knockdown: 'bf_hard_knockdown', wakeup: 'bf_wakeup',
      hitReaction: 'bf_heavy_hit_reaction', ko: 'bf_ko',
      signature: 'bf_hall_nighter_driver',
      extraMove1: 'bf_dvd',
      extraMove2: 'bf_brainbuster',
    }
  },

  // ── STATIC ───────────────────────────────────────────────────────────────────
  {
    id: 'static',
    name: 'Static',
    dna: 'STATIC',
    role: 'Electric Striker / Speed Brawler',
    faction: 'AWE Asset',
    factionAlignment: 'chaos',
    poise: 87, hp: 10000, speed: 89, strength: 84, physicsScale: 1.0,
    payback: 'Static Shock',
    manager: 'None',
    bio: 'An unpredictable electric striker whose chaotic energy keeps opponents off-balance. Static fights with reckless abandon, generating momentum through pure kinetic chaos.',
    personality: 'Manic and energetic. Never stops moving. Talks constantly during matches.',
    fightingStyle: 'Electric Striker / Speed Brawler. Rapid-fire strikes, spinning attacks, and chaotic combos. The Static Shock finisher is an electric rush combo.',
    model: 'STATIC.glb',
    portraitUrl: `${BANNON_RAW}/STATIC.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_jab', heavyAttack: 'bf_spinning_kick',
      lowKick: 'bf_low_kick', highKick: 'bf_shining_wizard',
      primaryCombo: 'bf_kickbox_combo',
      counter: 'bf_mars_counter',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_exploder',
      knockdown: 'bf_knockdown', wakeup: 'bf_wakeup_kick',
      hitReaction: 'bf_hit_reaction', ko: 'bf_ko',
      signature: 'bf_static_shock',
      extraMove1: 'bf_rush_combo',
      extraMove2: 'bf_dragon_screw',
    }
  },

  // ── VIPER ────────────────────────────────────────────────────────────────────
  {
    id: 'viper',
    name: 'Viper',
    dna: 'VIPER',
    role: 'Assassin / Strike Specialist',
    faction: 'Independent',
    factionAlignment: 'independent',
    poise: 83, hp: 10000, speed: 92, strength: 81, physicsScale: 1.0,
    payback: 'Viper Strike',
    manager: 'None',
    bio: 'A deadly assassin who strikes with lethal precision. Viper moves with serpentine grace, delivering venomous attacks that leave opponents reeling.',
    personality: 'Cold and calculating. Patient as a predator. Strikes only when the moment is perfect.',
    fightingStyle: 'Assassin / Precision Striker. Lightning-fast strikes, evasive movement, and lethal counters. The Viper Strike is a devastating finishing sequence.',
    model: 'VIPER.glb',
    portraitUrl: `${BANNON_RAW}/VIPER.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_jab', heavyAttack: 'bf_elbow',
      lowKick: 'bf_low_kick', highKick: 'bf_spinning_kick',
      primaryCombo: 'bf_rush_combo',
      counter: 'bf_mars_counter',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_exploder',
      knockdown: 'bf_knockdown', wakeup: 'bf_wakeup_kick',
      hitReaction: 'bf_hit_reaction', ko: 'bf_ko',
      signature: 'bf_viper_strike',
      extraMove1: 'bf_cobra_clutch',
      extraMove2: 'bf_iron_palm',
    }
  },

  // ── KOBRA ────────────────────────────────────────────────────────────────────
  {
    id: 'kobra',
    name: 'Kobra',
    dna: 'KOBRA',
    role: 'Street Fighter / Chaos Agent',
    faction: 'Chaos',
    factionAlignment: 'chaos',
    poise: 86, hp: 10000, speed: 88, strength: 85, physicsScale: 1.0,
    payback: 'Kobra Kai',
    manager: 'None',
    bio: 'A street-hardened chaos agent who thrives in unpredictable situations. Kobra uses dirty tactics and raw aggression to overwhelm opponents.',
    personality: 'Unpredictable and volatile. Thrives on chaos. Laughs during combat.',
    fightingStyle: 'Street Fighter / Chaos. Dirty tactics, unpredictable combos, and raw aggression. The Kobra Kai finisher is a brutal street-style beatdown.',
    model: 'KOBRA.glb',
    portraitUrl: `${BANNON_RAW}/KOBRA.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_jab', heavyAttack: 'bf_hook',
      lowKick: 'bf_low_kick', highKick: 'bf_high_kick',
      primaryCombo: 'bf_jab_cross_hook',
      counter: 'bf_reversal',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_body_slam',
      knockdown: 'bf_knockdown', wakeup: 'bf_wakeup',
      hitReaction: 'bf_hit_reaction', ko: 'bf_ko',
      signature: 'bf_kobra_kai',
      extraMove1: 'bf_uppercut',
      extraMove2: 'bf_spin_kick',
    }
  },

  // ── AARON RUBEN ──────────────────────────────────────────────────────────────
  {
    id: 'aaron_ruben',
    name: 'Aaron Ruben',
    dna: 'AARON_RUBEN',
    role: 'Technical Grappler / Ring General',
    faction: 'AWE',
    factionAlignment: 'alliance',
    poise: 89, hp: 10000, speed: 83, strength: 87, physicsScale: 1.0,
    payback: 'Ruben Lock',
    manager: 'None',
    bio: 'A ring general whose technical mastery and grappling expertise make him one of the most dangerous fighters in AWE. Aaron Ruben controls every match with surgical precision.',
    personality: 'Composed and analytical. Studies opponents obsessively. Speaks with quiet authority.',
    fightingStyle: 'Technical Grappler / Ring General. Submission holds, precise strikes, and ring control. The Ruben Lock submission is nearly impossible to escape.',
    model: 'AARON_RUBEN.glb',
    portraitUrl: `${BANNON_RAW}/AARON_RUBEN.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_jab', heavyAttack: 'bf_elbow',
      lowKick: 'bf_low_kick', highKick: 'bf_mid_kick',
      primaryCombo: 'bf_jab_cross',
      counter: 'bf_reversal',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_suplex',
      knockdown: 'bf_hard_knockdown', wakeup: 'bf_wakeup',
      hitReaction: 'bf_hit_reaction', ko: 'bf_ko',
      signature: 'bf_ruben_lock',
      extraMove1: 'bf_full_nelson',
      extraMove2: 'bf_brainbuster',
    }
  },

  // ── HOLLOW ───────────────────────────────────────────────────────────────────
  {
    id: 'hollow',
    name: 'Hollow',
    dna: 'HOLLOW',
    role: 'Phantom / Psychological Warfare',
    faction: 'Chaos',
    factionAlignment: 'chaos',
    poise: 84, hp: 10000, speed: 90, strength: 80, physicsScale: 1.0,
    payback: 'Hollow Point',
    manager: 'None',
    bio: 'A phantom-like fighter who uses psychological warfare and unpredictable movement to break opponents mentally before finishing them physically.',
    personality: 'Eerie and detached. Seems to feel no pain. Stares through opponents rather than at them.',
    fightingStyle: 'Phantom / Psychological. Unpredictable movement, mind games, and sudden explosive attacks. The Hollow Point finisher comes from nowhere.',
    model: 'HOLLOW.glb',
    portraitUrl: `${BANNON_RAW}/HOLLOW.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_jab', heavyAttack: 'bf_cross',
      lowKick: 'bf_low_kick', highKick: 'bf_shining_wizard',
      primaryCombo: 'bf_rush_combo',
      counter: 'bf_mars_counter',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_exploder',
      knockdown: 'bf_knockdown', wakeup: 'bf_wakeup_kick',
      hitReaction: 'bf_hit_reaction', ko: 'bf_ko',
      signature: 'bf_hollow_point',
      extraMove1: 'bf_spin_kick',
      extraMove2: 'bf_dragon_screw',
    }
  },

  // ── EDWIN KENNEDY ────────────────────────────────────────────────────────────
  {
    id: 'edwin_kennedy',
    name: 'Edwin Kennedy',
    dna: 'EDWIN_KENNEDY',
    role: 'Corporate Mastermind / Power Broker',
    faction: 'Corporate Structure',
    factionAlignment: 'corporate',
    poise: 88, hp: 10000, speed: 80, strength: 89, physicsScale: 1.05,
    payback: 'Corporate Takeover',
    manager: 'None',
    bio: "The architect of corporate control in AWE. Edwin Kennedy pulls strings from the shadows, but when forced into the ring, he's a devastating physical specimen who fights with calculated brutality.",
    personality: 'Imperious and manipulative. Treats everyone as assets or liabilities. Immaculate in appearance, ruthless in action.',
    fightingStyle: 'Corporate Power / Calculated Brutality. Deliberate, powerful strikes and throws. The Corporate Takeover is a devastating power slam sequence.',
    model: 'EDWIN_KENNEDY.glb',
    attire: 'Mustached Mogul',
    portraitUrl: `${BANNON_RAW}/EDWIN_KENNEDY.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_elbow', heavyAttack: 'bf_hook',
      lowKick: 'bf_low_kick', highKick: 'bf_mid_kick',
      primaryCombo: 'bf_jab_cross_hook',
      counter: 'bf_armor_breaker',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_running_powerbomb',
      knockdown: 'bf_hard_knockdown', wakeup: 'bf_wakeup',
      hitReaction: 'bf_heavy_hit_reaction', ko: 'bf_ko',
      signature: 'bf_corporate_takeover',
      extraMove1: 'bf_powerbomb',
      extraMove2: 'bf_brainbuster',
    }
  },

  // ── PABLO ────────────────────────────────────────────────────────────────────
  {
    id: 'pablo',
    name: 'Pablo',
    dna: 'PABLO',
    role: 'Mythic Powerhouse / Bull of the Ring',
    faction: 'Independent',
    factionAlignment: 'independent',
    poise: 93, hp: 10000, speed: 81, strength: 94, physicsScale: 1.1,
    payback: 'Bull Rush',
    manager: 'None',
    bio: 'A mythic powerhouse who channels the spirit of the bull. Pablo is an unstoppable force of nature whose raw power and resilience make him one of the most feared fighters in the roster.',
    personality: 'Proud and fierce. Fights with the fury of a charging bull. Deeply connected to his cultural heritage.',
    fightingStyle: 'Mythic Power / Bull Rush. Charging attacks, devastating throws, and raw physical dominance. The Bull Rush finisher is an unstoppable charge.',
    model: 'PABLO.glb',
    attire: 'Minotaur Painted',
    portraitUrl: `${BANNON_RAW}/PABLO.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_chop', heavyAttack: 'bf_discus_clothesline',
      lowKick: 'bf_low_kick', highKick: 'bf_high_kick',
      primaryCombo: 'bf_rush_combo',
      counter: 'bf_armor_breaker',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_running_powerbomb',
      knockdown: 'bf_hard_knockdown', wakeup: 'bf_wakeup',
      hitReaction: 'bf_heavy_hit_reaction', ko: 'bf_ko',
      signature: 'bf_bull_rush',
      extraMove1: 'bf_powerbomb',
      extraMove2: 'bf_body_slam',
    }
  },

  // ── TYNESHIA ─────────────────────────────────────────────────────────────────
  {
    id: 'tyneshia',
    name: 'Tyneshia',
    dna: 'TYNESHIA',
    role: 'Street Queen / Technical Brawler',
    faction: 'AWE (Rebel)',
    factionAlignment: 'alliance',
    poise: 87, hp: 10000, speed: 88, strength: 85, physicsScale: 1.0,
    payback: 'Hall Street Justice',
    manager: 'None',
    bio: 'A street queen who brings raw Hall Street energy into the ring. Tyneshia combines technical skill with street-smart brawling to dominate opponents.',
    personality: 'Fierce and unapologetic. Speaks her mind. Deeply loyal to her community.',
    fightingStyle: 'Street Queen / Technical Brawler. Street-smart combos, technical counters, and raw power. Hall Street Justice is her devastating finishing sequence.',
    model: 'TYNESHIA.glb',
    attire: 'Wrestling Gear',
    portraitUrl: `${BANNON_RAW}/TYNESHIA.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_jab', heavyAttack: 'bf_hook',
      lowKick: 'bf_low_kick', highKick: 'bf_spinning_kick',
      primaryCombo: 'bf_kickbox_combo',
      counter: 'bf_mars_counter',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_exploder',
      knockdown: 'bf_knockdown', wakeup: 'bf_wakeup_kick',
      hitReaction: 'bf_hit_reaction', ko: 'bf_ko',
      signature: 'bf_hall_street_justice',
      extraMove1: 'bf_spin_kick',
      extraMove2: 'bf_dvd',
    }
  },

  // ── TRIPLE XXX ───────────────────────────────────────────────────────────────
  {
    id: 'triple_xxx',
    name: 'Triple XXX',
    dna: 'TRIPLE_XXX',
    role: 'Showman / High-Flying Entertainer',
    faction: 'Corporate Structure',
    factionAlignment: 'corporate',
    poise: 85, hp: 10000, speed: 90, strength: 83, physicsScale: 1.0,
    payback: 'Triple Threat',
    manager: 'None',
    bio: 'A flamboyant showman who combines high-flying athleticism with corporate polish. Triple XXX puts on a show while delivering devastating attacks.',
    personality: 'Theatrical and self-absorbed. Every move is a performance. Demands the spotlight.',
    fightingStyle: 'Showman / High-Flying. Aerial attacks, theatrical combos, and crowd-pleasing finishers. The Triple Threat is a three-part aerial assault.',
    model: 'TRIPLE_XXX.glb',
    attire: 'Default',
    portraitUrl: `${BANNON_RAW}/TRIPLE_XXX.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_jab', heavyAttack: 'bf_elbow',
      lowKick: 'bf_low_kick', highKick: 'bf_shining_wizard',
      primaryCombo: 'bf_rush_combo',
      counter: 'bf_reversal',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_exploder',
      knockdown: 'bf_knockdown', wakeup: 'bf_wakeup_kick',
      hitReaction: 'bf_hit_reaction', ko: 'bf_ko',
      signature: 'bf_triple_threat',
      extraMove1: 'bf_leap_of_faith',
      extraMove2: 'bf_spin_kick',
    }
  },

  // ── EL TORO DE ORO ───────────────────────────────────────────────────────────
  {
    id: 'el_toro_de_oro',
    name: 'El Toro de Oro',
    dna: 'EL_TORO_DE_ORO',
    role: 'Luchador / Golden Bull',
    faction: 'Independent',
    factionAlignment: 'independent',
    poise: 91, hp: 10000, speed: 86, strength: 90, physicsScale: 1.05,
    payback: 'Golden Goring',
    manager: 'None',
    bio: 'The Golden Bull of the ring. El Toro de Oro combines luchador athleticism with raw power, delivering spectacular aerial attacks and crushing power moves.',
    personality: 'Proud and honorable. Fights with passion and flair. Deeply respected by the crowd.',
    fightingStyle: 'Luchador / Power. Aerial attacks, power slams, and spectacular finishers. The Golden Goring is a devastating charging attack.',
    model: 'EL_TORO_DE_ORO.glb',
    portraitUrl: `${BANNON_RAW}/EL_TORO_DE_ORO.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_chop', heavyAttack: 'bf_discus_clothesline',
      lowKick: 'bf_low_kick', highKick: 'bf_shining_wizard',
      primaryCombo: 'bf_rush_combo',
      counter: 'bf_armor_breaker',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_running_powerbomb',
      knockdown: 'bf_hard_knockdown', wakeup: 'bf_wakeup',
      hitReaction: 'bf_heavy_hit_reaction', ko: 'bf_ko',
      signature: 'bf_golden_goring',
      extraMove1: 'bf_body_slam',
      extraMove2: 'bf_powerbomb',
    }
  },

  // ── STAN COMBS ───────────────────────────────────────────────────────────────
  {
    id: 'stan_combs',
    name: 'Stan Combs',
    dna: 'STAN_COMBS',
    role: 'Corporate Architect / Manager Fighter',
    faction: 'JPCW / Corporate Conspiracy',
    factionAlignment: 'corporate',
    poise: 82, hp: 10000, speed: 79, strength: 86, physicsScale: 1.0,
    payback: 'Honey Trap',
    manager: 'None',
    bio: "The architect behind the corporate conspiracy. Stan 'Honey' Combs built the system that controls fighters like Stick-Up. When cornered, he fights with surprising ferocity.",
    personality: 'Smooth and manipulative. Always smiling. Hides ruthless calculation behind corporate charm.',
    fightingStyle: 'Corporate Architect / Dirty Fighter. Underhanded tactics, calculated strikes, and corporate-funded dirty moves. The Honey Trap is a deceptive finishing sequence.',
    model: 'STAN_COMBS_gear.glb',
    attire: 'Ring Gear',
    portraitUrl: `${BANNON_RAW}/STAN_COMBS_gear.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_jab', heavyAttack: 'bf_hook',
      lowKick: 'bf_low_kick', highKick: 'bf_mid_kick',
      primaryCombo: 'bf_jab_cross',
      counter: 'bf_reversal',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_body_slam',
      knockdown: 'bf_knockdown', wakeup: 'bf_wakeup',
      hitReaction: 'bf_hit_reaction', ko: 'bf_ko',
      signature: 'bf_honey_trap',
      extraMove1: 'bf_cobra_clutch',
      extraMove2: 'bf_iron_palm',
    }
  },

  // ── BRUTUS ───────────────────────────────────────────────────────────────────
  {
    id: 'brutus',
    name: 'Brutus',
    dna: 'BRUTUS',
    role: 'Unstoppable Juggernaut',
    faction: 'Independent',
    factionAlignment: 'independent',
    poise: 96, hp: 10000, speed: 78, strength: 96, physicsScale: 1.15,
    payback: 'Brutus Bomb',
    manager: 'None',
    bio: 'An unstoppable juggernaut whose sheer size and power make him a walking natural disaster. Brutus absorbs punishment that would destroy lesser fighters and keeps coming.',
    personality: 'Simple and direct. Speaks in short sentences. Respects strength above all else.',
    fightingStyle: 'Juggernaut / Pure Power. Overwhelming force, crushing throws, and unstoppable charges. The Brutus Bomb is a devastating finishing slam.',
    model: 'BRUTUS.glb',
    portraitUrl: `${BANNON_RAW}/BRUTUS.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_chop', heavyAttack: 'bf_discus_clothesline',
      lowKick: 'bf_low_kick', highKick: 'bf_high_kick',
      primaryCombo: 'bf_rush_combo',
      counter: 'bf_armor_breaker',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_running_powerbomb',
      knockdown: 'bf_hard_knockdown', wakeup: 'bf_wakeup',
      hitReaction: 'bf_heavy_hit_reaction', ko: 'bf_ko',
      signature: 'bf_brutus_bomb',
      extraMove1: 'bf_powerbomb',
      extraMove2: 'bf_body_slam',
    }
  },

  // ── TITAN ────────────────────────────────────────────────────────────────────
  {
    id: 'titan',
    name: 'Titan',
    dna: 'TITAN',
    role: 'Colossus / Immovable Object',
    faction: 'Independent',
    factionAlignment: 'independent',
    poise: 97, hp: 10000, speed: 76, strength: 97, physicsScale: 1.2,
    payback: 'Titan Fall',
    manager: 'None',
    bio: 'The immovable object of the roster. Titan is a colossus whose presence alone intimidates opponents. When he falls, the ring shakes.',
    personality: 'Silent and imposing. Communicates through action. Opponents feel his presence before they see him.',
    fightingStyle: 'Colossus / Immovable. Slow but devastating attacks, unbreakable defense, and earth-shaking throws. The Titan Fall is a finishing slam that ends matches.',
    model: 'TITAN.glb',
    portraitUrl: `${BANNON_RAW}/TITAN.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_chop', heavyAttack: 'bf_hook',
      lowKick: 'bf_low_kick', highKick: 'bf_high_kick',
      primaryCombo: 'bf_rush_combo',
      counter: 'bf_armor_breaker',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_running_powerbomb',
      knockdown: 'bf_hard_knockdown', wakeup: 'bf_wakeup',
      hitReaction: 'bf_heavy_hit_reaction', ko: 'bf_ko',
      signature: 'bf_titan_fall',
      extraMove1: 'bf_powerbomb',
      extraMove2: 'bf_brainbuster',
    }
  },

  // ── MASTER SENSEI ────────────────────────────────────────────────────────────
  {
    id: 'master_sensei',
    name: 'Master Sensei',
    dna: 'MASTER_SENSEI',
    role: 'Martial Arts Master / Discipline Incarnate',
    faction: 'Independent',
    factionAlignment: 'independent',
    poise: 91, hp: 10000, speed: 87, strength: 88, physicsScale: 1.0,
    payback: 'Five Point Palm',
    manager: 'None',
    bio: 'A martial arts master whose decades of discipline have forged him into a perfect fighting instrument. Master Sensei fights with economy and precision, never wasting a movement.',
    personality: 'Serene and wise. Speaks in lessons. Sees every fight as an opportunity to teach.',
    fightingStyle: 'Martial Arts Master / Precision. Perfect technique, devastating counters, and disciplined strikes. The Five Point Palm is a legendary finishing technique.',
    model: 'MASTER_SENSEI.glb',
    portraitUrl: `${BANNON_RAW}/MASTER_SENSEI.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_jab', heavyAttack: 'bf_elbow',
      lowKick: 'bf_low_kick', highKick: 'bf_spinning_kick',
      primaryCombo: 'bf_kickbox_combo',
      counter: 'bf_mars_counter',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_suplex',
      knockdown: 'bf_hard_knockdown', wakeup: 'bf_wakeup',
      hitReaction: 'bf_hit_reaction', ko: 'bf_ko',
      signature: 'bf_five_point_palm',
      extraMove1: 'bf_iron_palm',
      extraMove2: 'bf_cobra_clutch',
    }
  },

  // ── WRECK PATTERSON ──────────────────────────────────────────────────────────
  {
    id: 'wreck_patterson',
    name: 'Wreck Patterson',
    dna: 'WRECK_PATTERSON',
    role: 'Wrecking Machine / Demolition Expert',
    faction: 'Independent',
    factionAlignment: 'independent',
    poise: 93, hp: 10000, speed: 82, strength: 93, physicsScale: 1.1,
    payback: 'Wreck Ball',
    manager: 'None',
    bio: 'A wrecking machine who dismantles opponents piece by piece. Wreck Patterson fights with the methodical destruction of a demolition crew — nothing is left standing.',
    personality: 'Methodical and relentless. Treats every fight like a job. Takes pride in thorough destruction.',
    fightingStyle: 'Wrecking Machine / Demolition. Systematic destruction, power throws, and relentless pressure. The Wreck Ball is a devastating finishing slam.',
    model: 'WRECK_PATTERSON.glb',
    portraitUrl: `${BANNON_RAW}/WRECK_PATTERSON.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_chop', heavyAttack: 'bf_discus_clothesline',
      lowKick: 'bf_low_kick', highKick: 'bf_high_kick',
      primaryCombo: 'bf_rush_combo',
      counter: 'bf_armor_breaker',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_running_powerbomb',
      knockdown: 'bf_hard_knockdown', wakeup: 'bf_wakeup',
      hitReaction: 'bf_heavy_hit_reaction', ko: 'bf_ko',
      signature: 'bf_wreck_ball',
      extraMove1: 'bf_powerbomb',
      extraMove2: 'bf_dvd',
    }
  },

  // GLB sourced from mhvnsnt/Bannon assets/models (JAGER.glb / JAGER_beard.glb).
  {
    id: 'jager',
    name: 'Jager',
    dna: 'JAGER',
    role: 'Predator / Hunter',
    faction: 'Independent',
    factionAlignment: 'independent',
    poise: 90, hp: 10000, speed: 89, strength: 88, physicsScale: 1.0,
    payback: 'Jager Hunt',
    manager: 'None',
    bio: 'A relentless predator who hunts opponents with calculated aggression. Jager tracks weaknesses and exploits them with devastating precision.',
    personality: 'Focused and relentless. Never loses sight of the target. Fights with the patience of a hunter.',
    fightingStyle: 'Predator / Hunter. Patient stalking, explosive bursts, and devastating finishing sequences. The Jager Hunt is an unstoppable pursuit combo.',
    model: 'JAGER.glb',
    attire: 'Default',
    portraitUrl: `${BANNON_RAW}/JAGER.glb`,
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_jab', heavyAttack: 'bf_cross',
      lowKick: 'bf_low_kick', highKick: 'bf_high_kick',
      primaryCombo: 'bf_jab_cross_hook',
      counter: 'bf_reversal',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_suplex',
      knockdown: 'bf_knockdown', wakeup: 'bf_wakeup',
      hitReaction: 'bf_hit_reaction', ko: 'bf_ko',
      signature: 'bf_jager_hunt',
      extraMove1: 'bf_uppercut',
      extraMove2: 'bf_iron_palm',
    }
  },

  // ── FINXSSE ──────────────────────────────────────────────────────────────────
  // Canon: mhvnsnt/Bannon canon/characters/finxsse_match_notes.txt
  // Pronounced "N P C Finesse". GLB: NPC_FINXSSE.glb (NPC attire).
  {
    id: 'finxsse',
    name: 'Finxsse',
    dna: 'FINXSSE',
    role: 'Showman / Power-Agility Hybrid',
    faction: 'Street / Stick-Up Alliance',
    factionAlignment: 'independent',
    poise: 88, hp: 10000, speed: 91, strength: 89, physicsScale: 1.05,
    payback: 'Getbackk',
    manager: 'None',
    bio: 'NPC Finxsse — pronounced N-P-C Finesse. A direct showman from the books who mixes Brock-Lesnar power with Eddie-Guerrero agility. He wears the gold jeweled diamond cross stolen from Chainlink, a symbol of his alliance with Stick-Up and his feud with Bannon, who he calls a corporate sell-out.',
    personality: 'Good and direct. Rapper-style charisma, promo-heavy, never hides the grudge. Sees Bannon as a traitor and a snitch.',
    fightingStyle: 'Power + speed hybrid. Signature Chainsnatcher (jumping double-knee backstabber). Finisher Getbackk — a violent fireman-carry tornado slam, a modified F-5.',
    model: 'NPC_FINXSSE.glb',
    attire: 'NPC',
    portraitUrl: `${BANNON_RAW}/NPC_FINXSSE.glb`,
    gridPortrait: '/portraits/finxsse.png',
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_jab', heavyAttack: 'bf_cross',
      lowKick: 'bf_low_kick', highKick: 'bf_high_kick',
      primaryCombo: 'bf_rush_combo',
      counter: 'bf_reversal',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_suplex',
      knockdown: 'bf_knockdown', wakeup: 'bf_wakeup',
      hitReaction: 'bf_hit_reaction', ko: 'bf_ko',
      signature: 'bf_getbackk',
      extraMove1: 'bf_chainsnatcher',
      extraMove2: 'bf_uppercut',
    }
  },

  // ── TARZANIAN DEVIL ──────────────────────────────────────────────────────────
  // Owner filename: "tarzanian devil (based on Tarzan duran indie wrestler)"
  // Original Bannon character. Lucha + hardcore wildman. Attires: skinned + dec_rig28.
  {
    id: 'tarzanian_devil',
    name: 'Tarzanian Devil',
    dna: 'TARZANIAN_DEVIL',
    role: 'Wildman Luchador / Hardcore High Flyer',
    faction: 'Independent',
    factionAlignment: 'independent',
    poise: 86, hp: 10000, speed: 92, strength: 84, physicsScale: 1.0,
    payback: 'Jungle Bomb',
    manager: 'None',
    bio: 'The Tarzanian Devil is the roster\'s dirtbag luchador — a shirtless wildman who swings between high-flying lucha and hardcore brawling. Gold hoop, messy hair, Tarzan yell on the way in. Independent circuit energy, no faction leash.',
    personality: 'Loose cannon. Hilarious, loud, lives on three things: wrestling, chaos, and the scream. Never more dangerous than when he looks like he is having fun.',
    fightingStyle: 'Lucha libre / hardcore hybrid. Hurricanranas, springboards, and deathmatch grit. Finisher Jungle Bomb — a flying senton that ends with a wildman pin.',
    model: 'TARZANIAN_DEVIL_skinned.glb',
    attire: 'Default',
    portraitUrl: `${BANNON_RAW}/TARZANIAN_DEVIL_skinned.glb`,
    gridPortrait: '/portraits/tarzanian_devil.png',
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_chop', heavyAttack: 'bf_cross',
      lowKick: 'bf_low_kick', highKick: 'bf_spin_kick',
      primaryCombo: 'bf_rush_combo',
      counter: 'bf_mars_counter',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_exploder',
      knockdown: 'bf_knockdown', wakeup: 'bf_wakeup_kick',
      hitReaction: 'bf_hit_reaction', ko: 'bf_ko',
      signature: 'bf_jungle_bomb',
      extraMove1: 'bf_hurricanrana',
      extraMove2: 'bf_shining_wizard',
    }
  },
];

export const getBannonFighter = (id: string): BannonFighterProfile | null => {
  const f = BANNON_ROSTER.find(x => x.id === id);
  return f ? hydrateFighterGlb(f) : null;
};

export const getBannonFightersByFaction = (alignment: BannonFighterProfile['factionAlignment']): BannonFighterProfile[] =>
  BANNON_ROSTER.filter(f => f.factionAlignment === alignment).map(hydrateFighterGlb);

export const getAllBannonFighters = (): BannonFighterProfile[] => BANNON_ROSTER.map(hydrateFighterGlb);

/** Overlay the measured skinned GLB (and attire URL) onto a roster profile. */
export function hydrateFighterGlb(fighter: BannonFighterProfile): BannonFighterProfile {
  const conceptArtUrl = fighter.conceptArtUrl ?? `/portraits/concept/${fighter.id}.jpg?v=ai3`;
  const selectMugUrl = fighter.selectMugUrl ?? conceptArtUrl;
  const pixelPortrait = fighter.pixelPortrait ?? `/portraits/pixel/${fighter.id}.png`;
  const likenessUrl = fighter.likenessUrl ?? `/portraits/likeness/${fighter.id}.png?v=glb1`;
  const paintedUrl = fighter.paintedUrl ?? conceptArtUrl;
  const pronouns = fighter.pronouns ?? pronounsForFighter(fighter.id);
  const entry = getGlbEntryForFighter(fighter.id, fighter.model);
  if (!entry) {
    return { ...fighter, pronouns, gridPortrait: conceptArtUrl, conceptArtUrl, selectMugUrl, pixelPortrait, likenessUrl, paintedUrl };
  }
  return {
    ...fighter,
    pronouns,
    model: entry.model,
    attire: fighter.attire ?? entry.attire,
    portraitUrl: resolveGlbUrl(entry.model, entry.overrideUrl),
    gridPortrait: conceptArtUrl,
    conceptArtUrl,
    selectMugUrl,
    pixelPortrait,
    likenessUrl,
    paintedUrl,
  };
}
