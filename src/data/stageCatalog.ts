export type BrutalFistStageId = 'random' | 'training-grid' | 'urban-night';

export interface BrutalFistStageDefinition {
  id: BrutalFistStageId;
  name: string;
  shortName: string;
  description: string;
  accent: string;
  previewKind: 'procedural';
}

export const BRUTAL_FIST_STAGES: readonly BrutalFistStageDefinition[] = [
  {
    id: 'random',
    name: 'RANDOM',
    shortName: '?',
    description: 'Let the match choose the arena.',
    accent: '#ffffff',
    previewKind: 'procedural',
  },
  {
    id: 'training-grid',
    name: 'TRAINING GRID',
    shortName: 'GRID',
    description: 'A clean combat grid for frame-data and movement testing.',
    accent: '#f4c542',
    previewKind: 'procedural',
  },
  {
    id: 'urban-night',
    name: 'URBAN NIGHT',
    shortName: 'NIGHT',
    description: 'A dark city fight space with hard lights and deep atmosphere.',
    accent: '#8b5cf6',
    previewKind: 'procedural',
  },
];

export function resolveStageId(id: BrutalFistStageId): Exclude<BrutalFistStageId, 'random'> {
  if (id !== 'random') return id;
  return Math.random() < 0.5 ? 'training-grid' : 'urban-night';
}
