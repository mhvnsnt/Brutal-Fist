import type * as THREE from 'three';

export type AnimationSourceType = 'AUTHORED_CLIP' | 'RETARGETED_AUTHORED_CLIP' | 'PLACEHOLDER_TEST_CLIP' | 'MISSING_CLIP';

export interface AnimationSourceRecord {
  clipName: string;
  semanticState: string;
  sourceType: AnimationSourceType;
  source: string;
  license: string;
  trackCount: number;
  resolvedTracks: number;
  unresolvedTracks: string[];
  canonicalSkeleton: string;
  registeredAt: number;
}

const records = new Map<string, AnimationSourceRecord>();

function key(semanticState: string, clipName: string) {
  return `${semanticState}::${clipName}`;
}

export function validateClipAgainstSkeleton(
  clip: THREE.AnimationClip,
  skeletonBones: readonly THREE.Bone[],
): { resolvedTracks: number; unresolvedTracks: string[] } {
  const names = new Set(skeletonBones.map(b => b.name));
  const unresolvedTracks: string[] = [];
  let resolvedTracks = 0;
  for (const track of clip.tracks) {
    const boneName = track.name.split('.')[0];
    if (names.has(boneName)) resolvedTracks++;
    else unresolvedTracks.push(track.name);
  }
  return { resolvedTracks, unresolvedTracks };
}

export function registerAuthoredClip(
  clip: THREE.AnimationClip,
  options: {
    semanticState: string;
    source: string;
    license?: string;
    canonicalSkeleton?: string;
    skeletonBones: readonly THREE.Bone[];
    sourceType?: Extract<AnimationSourceType, 'AUTHORED_CLIP' | 'RETARGETED_AUTHORED_CLIP'>;
  },
): AnimationSourceRecord {
  const resolution = validateClipAgainstSkeleton(clip, options.skeletonBones);
  const record: AnimationSourceRecord = {
    clipName: clip.name,
    semanticState: options.semanticState,
    sourceType: options.sourceType ?? 'AUTHORED_CLIP',
    source: options.source,
    license: options.license ?? 'unknown',
    trackCount: clip.tracks.length,
    resolvedTracks: resolution.resolvedTracks,
    unresolvedTracks: resolution.unresolvedTracks,
    canonicalSkeleton: options.canonicalSkeleton ?? 'BANNON_CANONICAL',
    registeredAt: Date.now(),
  };
  records.set(key(record.semanticState, record.clipName), record);
  return record;
}

export function getAnimationSource(semanticState: string, clipName: string) {
  return records.get(key(semanticState, clipName));
}

export function getAnimationSourceRecords() {
  return [...records.values()];
}

export function clearAnimationSourceRegistry() {
  records.clear();
}
