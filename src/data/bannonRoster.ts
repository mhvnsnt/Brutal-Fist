export interface BannonFighterProfile {
  id: string;
  name: string;
  dna: string;
  role: string;
  poise: number;
  hp: number;
  speed: number;
  strength: number;
  physicsScale: number;
  payback: string;
  manager: string;
  bio: string;
}

/** Build-time seed of the authoritative Bannon roster. Expand only from Bannon/roster.json. */
export const BANNON_ROSTER: readonly BannonFighterProfile[] = [
  { id: 'bannon', name: 'Bannon', dna: 'BANNON_V1_CORE', role: 'Wrestler', poise: 95, hp: 10000, speed: 85, strength: 90, physicsScale: 1.1, payback: 'Beast Mode', manager: 'None', bio: 'The physical nucleus and absolute force of the Bannon Engine.' },
  { id: 'cierra', name: 'Cierra', dna: 'CIERRA_FLY_99', role: 'Wrestler', poise: 85, hp: 9000, speed: 98, strength: 75, physicsScale: 0.95, payback: 'Teleport Strike', manager: 'None', bio: 'High-velocity high-flyer built around speed and precision.' },
  { id: 'marquis', name: 'Marquis', dna: 'MARQUIS_BOSS_ALPHA', role: 'Wrestler', poise: 100, hp: 12000, speed: 80, strength: 98, physicsScale: 1.2, payback: 'Low Blow', manager: 'Cierra', bio: 'The Administrator with final authority and heavyweight power.' },
  { id: 'nexus_prime', name: 'Nexus Prime', dna: 'NEXUS_AI_CORRUPT', role: 'Wrestler', poise: 90, hp: 10500, speed: 92, strength: 88, physicsScale: 1.05, payback: 'Code Crash', manager: 'None', bio: 'High-velocity autonomous combatant built around unpredictable math.' },
];

export const getBannonFighter = (id: string) => BANNON_ROSTER.find((fighter) => fighter.id === id) ?? null;
