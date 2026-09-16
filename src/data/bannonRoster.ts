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
  /** Only set from mhvnsnt/Bannon books/canon. Never guessed. */
  pronouns?: 'he/him' | 'she/her';
  model: string;
  attire?: string;
  /** Raw GLB URL for 3D bust / combat mesh — not the grid sprite */
  portraitUrl: string;
  /** 2D PSX grid headshot. Separate from the 3D GLB so tiny boxes never load SkinnedMeshes. */
  gridPortrait?: string;
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
  extraMove3?: string;
  extraMove4?: string;
  extraMove5?: string;
  extraMove6?: string;
  extraMove7?: string;
  extraMove8?: string;
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
    pronouns: 'he/him',
    bio: 'Marquis Deshaun Whitacre under the steel mask. Real name beneath all ring personas: Marquis → Solaris Justice (face) → Bannon (The Broken Architect / The Executioner) → Maime (feral leak). He preaches Structure as Truth. He is not a woman. Source: mhvnsnt/Bannon Off The Top Rope Book 1.',
    personality: 'Quiet, intensely focused on philosophy and numerology. Seeks authentic emotional connection. Hates pretense. Driven artist who views every match as a statement. Voice muffled/processed until Maime leaks through.',
    fightingStyle: 'Power Wrestling / Technical Hybrid. Explosive grapples, heavy strikes, and high-impact throws. Payback finisher activates when poise is broken.',
    model: 'BANNON.glb',
    portraitUrl: `${BANNON_RAW}/BANNON.glb`,
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
    role: 'Feral Alter / Geburah',
    faction: 'AWE',
    factionAlignment: 'alliance',
    poise: 85, hp: 10000, speed: 90, strength: 78, physicsScale: 1.0,
    payback: 'Verbal Leakage',
    manager: 'None',
    pronouns: 'he/him',
    bio: "Marquis Deshaun Whitacre's psychotic, traumatized alter-ego given a body — not a woman. White skull/clown facepaint, short twisted hair, jeans-with-chains / tattered gear. Maime is the raw voice that leaks through Bannon's processed filter. One man, three personas: Marquis / Bannon / Maime. Source: mhvnsnt/Bannon canon/01_book1_life_in_limbo.md.",
    personality: 'Raw, high-pitched, manic. Trauma-born in a cell. Opposite of Justice. When the filter drops, he talks.',
    fightingStyle: 'Feral / Geburah. Unprotected elbows, momentum, Devil-Within juggles. Book 5 already made Maime a distinct combat mode that bypasses the skill tree — not a technical striker.',
    model: 'MAIME.glb',
    portraitUrl: `${BANNON_RAW}/MAIME.glb`,
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
    role: 'The Obsidian Hex / Denial Grappler',
    faction: 'AWE',
    factionAlignment: 'alliance',
    poise: 90, hp: 10000, speed: 88, strength: 86, physicsScale: 1.0,
    payback: 'The Vacancy',
    manager: 'None',
    pronouns: 'she/her',
    bio: 'Game-only (not in the six books). Black woman, white chola/vamp facepaint, spiked leather. Life Path uncomputable — a blind spot in Marquis\'s numerology OS. She midwifes Maime as proof a self can exist without a number. Source: mhvnsnt/Bannon canon/godwithin/noncanon_roster.md.',
    personality: 'Genuinely gray, not a cartoon villain. Speaks little. Exists outside the number cage everyone else runs on.',
    fightingStyle: 'Denial Grappler. Counters and momentum-theft, not raw power. Finisher The Vacancy — no setup, ends the sequence mid-motion.',
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
    pronouns: 'he/him',
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
    pronouns: 'he/him',
    bio: "Andre Curtis. Ring: Stick-Up / Cyborg Stick-Up / Reverend Stick-Up. Street: Jackboy. Born Americus, GA, Oct 6 2001. Libra Sun. Bannon's tag partner then blood feud (Life in Limbo). Finishers: Leap of Faith swanton, Super Leap of Faith 450, Fire Thunder Driver, Twist of Fate. Source: canon/characters/stick_up_jackboy.txt + Book 1.",
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
    role: 'Anti-Pattern Brawler',
    faction: 'AWE (Rebel)',
    factionAlignment: 'alliance',
    poise: 88, hp: 10000, speed: 93, strength: 80, physicsScale: 1.0,
    payback: 'The Undefined',
    manager: 'None',
    pronouns: 'he/him',
    bio: "Onyx stable, game-only. Anti-Pattern Brawler — Life Path recalculates to a different digit every read. Offense is non-deterministic (real RNG in attack selection). Finisher The Undefined randomizes between three finishers, no tell. Lio Rush/Blackheart-type. Source: canon/godwithin/noncanon_roster.md.",
    personality: 'Unreadable. Nothing he throws twice looks the same. Not running on the numerology engine.',
    fightingStyle: 'Anti-Pattern Brawler. Non-deterministic offense. Finisher The Undefined.',
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
    role: 'Mimic / Read',
    faction: 'AWE (Rebel)',
    factionAlignment: 'alliance',
    poise: 86, hp: 10000, speed: 91, strength: 79, physicsScale: 1.0,
    payback: 'The Reflection',
    manager: 'None',
    pronouns: 'she/her',
    bio: "Onyx stable, game-only. No Life Path of her own — hers is whatever the opponent runs. Finisher The Reflection: she hits you with your own move. Shotzi-type goth punk. Source: canon/godwithin/noncanon_roster.md.",
    personality: 'Quiet, copycat. She is a corrupted reflection, not a silent assassin original.',
    fightingStyle: 'Mimic/Read. No signature of her own. The Reflection returns the opponent\'s last move.',
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
    pronouns: 'he/him',
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
    role: 'The Showstopper / High Flyer',
    faction: 'NWC',
    factionAlignment: 'corporate',
    poise: 90, hp: 10000, speed: 82, strength: 88, physicsScale: 1.0,
    payback: 'The Curtain Call',
    manager: 'None',
    pronouns: 'he/him',
    bio: 'Book 6 / 5 canon. HBK/Showstopper archetype — not a powerhouse wall. Charismatic, toothpick-flicking, "chico" swagger. Finisher THE CURTAIN CALL superkick. Triple X rivalry (sold out, went corporate). Source: canon/06_book6_kayfabe_is_real.md.',
    personality: 'Showoff who still means the work rate. "Tuning up the band." Calls people brother. Party in the storm.',
    fightingStyle: 'High flyer / HBK. Superkick Curtain Call. Not a power-brawler enforcer.',
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
    role: 'The Interference / Loudmouth',
    faction: 'Onyx Stable',
    factionAlignment: 'chaos',
    poise: 87, hp: 10000, speed: 89, strength: 84, physicsScale: 1.0,
    payback: 'Dead Air',
    manager: 'None',
    pronouns: 'he/him',
    bio: "Game-only, Onyx stable. Two conflicting Life Paths superimposed. Flickers/glitches only near Onyx or Maime. Enzo-style motor-mouth. Finisher Dead Air (leaping tornado DDT) / The Corrupted Frame. Source: CANON_MODELS.md + noncanon_roster.md.",
    personality: 'Manic, never shuts up. Interference as a gimmick. Visual glitch is the tell, not a personality rewrite.',
    fightingStyle: 'High flyer / interference. Dead Air tornado DDT. Powerbomb glitch on impact (Corrupted Frame).',
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
    role: 'Silent Submission / System Error',
    faction: 'Chaos',
    factionAlignment: 'chaos',
    poise: 84, hp: 10000, speed: 90, strength: 80, physicsScale: 1.0,
    payback: 'The Unheard',
    manager: 'None',
    bio: 'Onyx stable, game-only. Life Path resolves to 0 — impossible under the universe\'s rules. Silent. No entrance, no mic. Recruits people whose number already failed them. Finisher The Unheard (sudden guillotine). Gender not stated in canon — do not guess.',
    personality: 'Eerie and detached. No promo. Stares through opponents.',
    fightingStyle: 'Silent submission specialist. The Unheard guillotine from nowhere.',
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
    pronouns: 'she/her',
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
    role: 'Cerebral Assassin / Hedonist',
    faction: 'The Administration',
    factionAlignment: 'corporate',
    poise: 85, hp: 10000, speed: 90, strength: 83, physicsScale: 1.0,
    payback: 'The Game',
    manager: 'None',
    pronouns: 'he/him',
    bio: 'Lars Van Horn. HHH/cerebral-assassin archetype themed around XXX and hedonism more than "the Game" kayfabe — still cerebral, part animal, high-class snob. Book canon Administration. Source: BannonFullRosterManifest.cpp + Drive filename notes.',
    personality: 'Theatrical snob. Corporate. Hall Nighter calls him a sellout.',
    fightingStyle: 'Cerebral assassin / power. Pedigree-family offense, not a high-flying showman.',
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
    pronouns: 'he/him',
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
  // Ring names: Tarzan Duran, Tarzanian Devil, Wildlife. CZW / GCW / JCW / GTS / XPW.
  // Attires: skinned + dec_rig28.
  {
    id: 'tarzanian_devil',
    name: 'Tarzanian Devil',
    dna: 'TARZANIAN_DEVIL',
    role: 'Wildman Luchador / Hardcore High Flyer',
    faction: 'Independent',
    factionAlignment: 'independent',
    poise: 86, hp: 10000, speed: 92, strength: 84, physicsScale: 1.0,
    payback: 'Jungle Juice',
    manager: 'None',
    pronouns: 'he/him',
    bio: 'The Tarzanian Devil is the roster\'s dirtbag luchador — a shirtless wildman who swings between high-flying lucha and hardcore brawling. Gold hoop, messy hair, Tarzan yell on the way in. Based on indie wrestler Tarzan Duran (Wildlife), trained under Joel Maximo, with CZW / GCW / JCW / GTS deathmatch miles. Independent circuit energy, no faction leash.',
    personality: 'Loose cannon. Hilarious, loud, lives on three things: wrestling, chaos, and the scream. Never more dangerous than when he looks like he is having fun.',
    fightingStyle: 'Lucha + deathmatch hybrid. Knife-edge chops set the pace; Tarzan Scale dives close distance; Driver Counter flashes a crucifix pin off a powerbomb. Finisher Jungle Juice is a two-part grapple: Inverted Facelock Toss (back-to-back cravate, opponent backflips over the shoulder, lands face-to-face) into an Impaler DDT. Jungle Bomb (diving senton) is the aerial signature, not the finisher.',
    model: 'TARZANIAN_DEVIL_skinned.glb',
    attire: 'Default',
    portraitUrl: `${BANNON_RAW}/TARZANIAN_DEVIL_skinned.glb`,
    gridPortrait: '/portraits/tarzanian_devil.png',
    defaultMoveSet: {
      idle: 'bf_idle', walkForward: 'bf_walk_fwd', walkBackward: 'bf_walk_back',
      crouch: 'bf_crouch', guard: 'bf_guard',
      lightAttack: 'bf_knife_edge_chop', heavyAttack: 'bf_tarzan_scale',
      lowKick: 'bf_low_kick', highKick: 'bf_spin_kick',
      primaryCombo: 'bf_rush_combo',
      counter: 'bf_driver_counter',
      grappleInitiate: 'bf_clinch',
      primaryThrow: 'bf_inverted_facelock_toss',
      knockdown: 'bf_knockdown', wakeup: 'bf_wakeup_kick',
      hitReaction: 'bf_hit_reaction', ko: 'bf_ko',
      signature: 'bf_jungle_juice',
      extraMove1: 'bf_jungle_bomb',
      extraMove2: 'bf_hurricanrana',
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
  const gridPortrait = fighter.gridPortrait ?? `/portraits/${fighter.id}.png`;
  const entry = getGlbEntryForFighter(fighter.id, fighter.model);
  if (!entry) return { ...fighter, gridPortrait };
  return {
    ...fighter,
    model: entry.model,
    attire: fighter.attire ?? entry.attire,
    portraitUrl: resolveGlbUrl(entry.model, entry.overrideUrl),
    gridPortrait,
  };
}
