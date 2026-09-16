/**
 * AnimationProvenanceGate
 *
 * Keeps test-only procedural placeholders from being mistaken for real
 * authored animation. This is deliberately independent of rig creation:
 * the gate only classifies evidence already present in an AnimationClip.
 */

import * as THREE from 'three';

export type AnimationEvidence =
  | 'AUTHORED_CLIP'
  | 'RETARGETED_AUTHORED_CLIP'
  | 'PLACEHOLDER_TEST_CLIP'
  | 'MISSING_CLIP'
  | 'UNKNOWN';

export interface AnimationEvidenceReport {
  clipName: string;
  evidence: AnimationEvidence;
  source?: string;
  semanticState?: string;
  trackCount: number;
  mappedBones: number;
  unmappedBones: number;
  combatUsable: boolean;
  reason: string;
}

/**
 * Classify a clip without granting PASS merely because a mixer can play it.
 * Placeholder clips are useful for exercising the pipeline, but remain
 * TEST_ONLY and can never satisfy the authored-animation combat gate.
 */
export function classifyAnimationClip(clip: THREE.AnimationClip | null | undefined): AnimationEvidenceReport {
  if (!clip) {
    return {
      clipName: 'missing',
      evidence: 'MISSING_CLIP',
      trackCount: 0,
      mappedBones: 0,
      unmappedBones: 0,
      combatUsable: false,
      reason: 'No animation clip was supplied.',
    };
  }

  const meta = ((clip as any).userData ?? {}) as Record<string, unknown>;
  const source = typeof meta.source === 'string' ? meta.source : undefined;
  const semanticState = typeof meta.semanticState === 'string' ? meta.semanticState : undefined;
  const trackCount = clip.tracks.length;
  const mappedBones = typeof meta.mappedBones === 'number' ? meta.mappedBones : 0;
  const unmappedBones = typeof meta.unmappedBones === 'number' ? meta.unmappedBones : 0;
  const provenance = typeof meta.provenance === 'string' ? meta.provenance.toLowerCase() : '';
  const sourceLower = source?.toLowerCase() ?? '';

  const isPlaceholder =
    meta.testOnly === true ||
    meta.procedural === true ||
    provenance.includes('placeholder') ||
    provenance.includes('procedural') ||
    sourceLower === 'procedural';

  if (isPlaceholder) {
    return {
      clipName: clip.name,
      evidence: 'PLACEHOLDER_TEST_CLIP',
      source,
      semanticState,
      trackCount,
      mappedBones,
      unmappedBones,
      combatUsable: false,
      reason: 'Procedural/test animation may exercise the pipeline but cannot establish authored animation authority.',
    };
  }

  if (trackCount === 0) {
    return {
      clipName: clip.name,
      evidence: 'MISSING_CLIP',
      source,
      semanticState,
      trackCount,
      mappedBones,
      unmappedBones,
      combatUsable: false,
      reason: 'Clip contains no tracks.',
    };
  }

  const retargeted =
    meta.retargeted === true ||
    provenance.includes('retarget') ||
    sourceLower.includes('retarget');

  return {
    clipName: clip.name,
    evidence: retargeted ? 'RETARGETED_AUTHORED_CLIP' : 'AUTHORED_CLIP',
    source,
    semanticState,
    trackCount,
    mappedBones,
    unmappedBones,
    combatUsable: unmappedBones === 0,
    reason: unmappedBones === 0
      ? 'Animation has non-placeholder tracks and complete reported bone mapping.'
      : 'Animation has unmapped bone tracks and requires retarget validation before combat use.',
  };
}

export function assertAuthoredAnimation(clip: THREE.AnimationClip | null | undefined): AnimationEvidenceReport {
  const report = classifyAnimationClip(clip);
  if (!report.combatUsable) {
    throw new Error(`[AnimationProvenanceGate] ${report.evidence}: ${report.reason}`);
  }
  return report;
}
