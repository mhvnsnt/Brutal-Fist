export interface SchwarzerblitzCharacterSchema {
  name: string;
  displayName: string;
  mesh: string;
  meshScale: number;
  hitSfx?: string;
  movesFile: string;
  bonesFile?: string;
  hitboxFile?: string;
  hurtboxFile?: string;
  life: number;
  walkSpeed: number;
  jumpSpeed: number;
  weight: number;
  stanceFrames: number;
  walkFrames: number;
  backWalkFrames: number;
  sidestepFrames: number;
  standGuardFrames: number;
  crouchFrames: number;
  runFrames: number;
  jumpFrames: number;
  aiArchetype: 'Aggressor' | 'Tactician' | 'Luchador' | 'Balanced' | 'JackOfAllTrades';
}

export const BRUTAL_FIST_CHARACTER_DEFAULTS: SchwarzerblitzCharacterSchema = {
  name: 'Bannon',
  displayName: 'BANNON',
  mesh: 'public-drive-glb',
  meshScale: 1,
  movesFile: 'brutal-fist/moves/bannon.json',
  bonesFile: 'brutal-fist/characters/bannon.bones.json',
  hitboxFile: 'brutal-fist/characters/bannon.hitboxes.json',
  hurtboxFile: 'brutal-fist/characters/bannon.hurtboxes.json',
  life: 250,
  walkSpeed: 0.075,
  jumpSpeed: 0.18,
  weight: 1,
  stanceFrames: 6,
  walkFrames: 6,
  backWalkFrames: 6,
  sidestepFrames: 8,
  standGuardFrames: 5,
  crouchFrames: 8,
  runFrames: 6,
  jumpFrames: 24,
  aiArchetype: 'Balanced'
};
