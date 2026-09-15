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
    model: 'BANNON.glb',
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
    bio: 'A precise, technically gifted fighter whose speed and accuracy make her a constant threat. She fights with calculated efficiency, never wasting a movement.',
    personality: 'Methodical and focused. Speaks little but observes everything. Finds beauty in perfect technique.',
    fightingStyle: 'Technical Striking / Speed. Fast combos, precise counters, and quick throws. Excels at punishing mistakes.',
    model: 'MAIME.glb',
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
    model: 'ONYX.glb',
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
    bio: "Kennedy's most trusted, cold-hearted weapon. A technical powerhouse driven by vindictive precision. His LP 6 responsibility manifests as a twisted need to enforce order through pain. The ultimate physical test — a past trauma made flesh.",
    personality: 'Cold and calculating in the ring. Outside it, he anonymously volunteers at community centers — a deep contradiction between his brutal role and his private need to nurture order. The Executioner vs. the Caregiver.',
    fightingStyle: 'Technical Power / Vindictive. Combines submission holds with devastating power moves. Methodical destruction followed by the Final Verdict tombstone piledriver.',
    model: 'CAIN_ELIAS_ring.glb',
    attire: 'Ring',
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
    bio: "A soul driven to be a Master Builder (LP 11), whose energy is now forced into Stan's rigid physical construction. Fights with machine-like precision, punctuated by conspiracy rants. The ultimate proof of Stan's corporate reach.",
    personality: 'Naturally seeks balance and harmony (Libra), but this need is brutally suppressed by the system. Robotic in movement, theatrical in finishers — the Leap of Faith is performed with a Messiah pose or finger guns.',
    fightingStyle: 'Technical/Brutal Hybrid. Machine-like precision strikes and submissions, with theatrical high-flying finishers. The Leap of Faith (swanton bomb) and super variants are his calling cards.',
    model: 'STICKUP.glb',
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
    bio: 'A lightning-fast fighter who uses blistering pace and agility to break down opponents. Cipher operates in the shadows, striking from unexpected angles and vanishing before retaliation.',
    personality: 'Mysterious and calculating. Speaks in riddles. Finds the gaps in every defense and exploits them with surgical precision.',
    fightingStyle: 'Speed / Agility. Rapid multi-hit combos, quick counters, and evasive movement. The Cipher Protocol finisher is a rapid multi-hit strike sequence.',
    model: 'CIPHER.glb',
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
    personality: 'Quiet and unsettling. Moves like a ghost. Uses silence as a weapon. Opponents never know where the next attack is coming from.',
    fightingStyle: 'Psychological / Aerial. Misdirection, rapid dodges, and unexpected aerial attacks. The Echo Slam reverberates through the opponent.',
    model: 'ECHO.glb',
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
    bio: "Bannon's former manager, now Kennedy's bodyguard. A volatile cocktail of paranoid intensity and explosive impulse. His need for control is rooted in deep insecurity and financial desperation.",
    personality: 'Volatile and paranoid. Sprints everywhere, shouts contracts and statistics. Wears immaculate, expensive designer clothes. The Corduroy Kid is always scheming.',
    fightingStyle: 'Brawler / Interference. Dirty tactics, rope breaks, and managerial interference. When forced to fight, uses explosive power moves.',
    model: 'CODY_sober.glb',
    attire: 'Sober',
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
    personality: 'Aggressive and territorial. Demands adoration. Stomps everywhere in heavy boots. Fiercely protective of his position in the AWE hierarchy.',
    fightingStyle: 'Power Brawler / Endurance. Absorbs damage and delivers crushing impact. The Hall Night Driver is a devastating late-night finisher.',
    model: 'HALL_NIGHTER.glb',
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
    personality: 'Manic and energetic. Never stops moving. Talks constantly during matches. Finds structure suffocating and chaos liberating.',
    fightingStyle: 'Electric Striker / Speed Brawler. Rapid-fire strikes, spinning attacks, and chaotic combos. The Static Shock finisher is an electric rush combo.',
    model: 'STATIC.glb',
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
];

export const getBannonFighter = (id: string): BannonFighterProfile | null =>
  BANNON_ROSTER.find(f => f.id === id) ?? null;

export const getBannonFightersByFaction = (alignment: BannonFighterProfile['factionAlignment']): BannonFighterProfile[] =>
  BANNON_ROSTER.filter(f => f.factionAlignment === alignment);

export const getAllBannonFighters = (): readonly BannonFighterProfile[] => BANNON_ROSTER;
