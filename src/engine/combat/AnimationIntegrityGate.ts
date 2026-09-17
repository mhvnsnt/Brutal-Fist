/**
 * AnimationIntegrityGate.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Per-fighter animation integrity gate.
 *
 * Clip source classification:
 *   AUTHORED_CLIP           — real authored animation from the GLB asset
 *   RETARGETED_AUTHORED_CLIP — authored clip retargeted from a different skeleton
 *   PLACEHOLDER_TEST_CLIP   — procedural placeholder (pipeline test only)
 *   MISSING_CLIP            — no usable animation for this semantic state
 *
 * Integrity verdicts:
 *   PASS      — real authored/retargeted animation deforming the visible mesh
 *   TEST_ONLY — procedural placeholder successfully drives mixer
 *   BLOCKED   — no usable authored animation
 *   UNKNOWN   — insufficient evidence
 *
 * UNKNOWN is never PASS.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as THREE from 'three';

// ── Clip source classification ────────────────────────────────────────────────

/**
 * Distinguishes the provenance of each animation clip in the pipeline.
 * PROCEDURAL_PLACEHOLDER clips must NOT be treated as real animation success.
 */
export type ClipSourceType =
  | 'AUTHORED_CLIP'            // real authored animation from the GLB asset
  | 'RETARGETED_AUTHORED_CLIP' // authored clip retargeted from a different skeleton
  | 'PLACEHOLDER_TEST_CLIP'    // procedural placeholder — pipeline test only
  | 'MISSING_CLIP';            // no usable animation for this semantic state

/**
 * Classify a clip by its name convention.
 * Procedural placeholders are named with the suffix "_procedural_placeholder".
 */
export function classifyClipSource(clipName: string): ClipSourceType {
  if (!clipName) return 'MISSING_CLIP';
  const lc = clipName.toLowerCase();
  if (lc.includes('procedural_placeholder') || lc.includes('_placeholder')) {
    return 'PLACEHOLDER_TEST_CLIP';
  }
  if (lc.includes('retargeted') || lc.includes('_retarget')) {
    return 'RETARGETED_AUTHORED_CLIP';
  }
  return 'AUTHORED_CLIP';
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AnimationIntegrityInput {
  /** Short character name for logging (e.g. "BANNON", "MAIME") */
  characterName: string;
  /** The cloned scene that the mixer targets (the VISIBLE scene) */
  clonedScene: THREE.Object3D;
  /** The AnimationMixer bound to clonedScene */
  mixer: THREE.AnimationMixer;
  /** All AnimationActions keyed by clip name */
  actions: Record<string, THREE.AnimationAction>;
  /** The currently active clip name (if any) */
  activeClipName?: string | null;
}

export interface BoneTravelMeasurement {
  boneName: string;
  positionBefore: THREE.Vector3;
  positionAfter: THREE.Vector3;
  distanceMetres: number;
  rotationDegrees: number;
}

/**
 * PASS      — real authored/retargeted animation deforming the visible mesh
 * TEST_ONLY — procedural placeholder successfully drives mixer
 * BLOCKED   — no usable authored animation
 * UNKNOWN   — insufficient evidence
 */
export type IntegrityVerdict = 'PASS' | 'TEST_ONLY' | 'BLOCKED' | 'UNKNOWN';

export interface ClipSourceSummary {
  clipName: string;
  sourceType: ClipSourceType;
  trackCount: number;
  resolvedTracks: number;
}

export interface AnimationIntegrityReport {
  characterName: string;
  timestamp: string;
  // ── Asset counts ──────────────────────────────────────────────────────────
  visibleMeshCount: number;
  skinnedMeshCount: number;
  skeletonBoneCount: number;
  // ── Animation data ────────────────────────────────────────────────────────
  animationClipCount: number;
  totalTrackCount: number;
  resolvedTrackCount: number;
  unresolvedTrackCount: number;
  unresolvedTrackNames: string[];
  // ── Clip source classification ────────────────────────────────────────────
  clipSources: ClipSourceSummary[];
  authoredClipCount: number;
  retargetedClipCount: number;
  placeholderClipCount: number;
  missingClipCount: number;
  // ── Playback state ────────────────────────────────────────────────────────
  activeClipName: string | null;
  activeClipSourceType: ClipSourceType;
  activeClipDuration: number | null;
  mixerRootIsVisibleClone: boolean;
  mixerUpdateCount: number;
  // ── Bone travel (measured over one synthetic tick) ────────────────────────
  boneTravel: BoneTravelMeasurement[];
  maxBoneTravelMetres: number;
  maxBoneRotationDegrees: number;
  // ── Verdict ───────────────────────────────────────────────────────────────
  verdict: IntegrityVerdict;
  failingChecks: string[];
  warningChecks: string[];
  // ── Raw log lines (for console output) ───────────────────────────────────
  logLines: string[];
}

// ── Key bones to measure travel for ──────────────────────────────────────────
const TRAVEL_BONES = [
  'Hips', 'mixamorigHips',
  'RightHand', 'mixamorigRightHand',
  'LeftHand', 'mixamorigLeftHand',
  'RightFoot', 'mixamorigRightFoot',
  'LeftFoot', 'mixamorigLeftFoot',
  'Head', 'mixamorigHead',
  'Spine', 'mixamorigSpine',
];

// ── Main gate function ────────────────────────────────────────────────────────

export function runAnimationIntegrityGate(
  input: AnimationIntegrityInput,
): AnimationIntegrityReport {
  const { characterName, clonedScene, mixer, actions, activeClipName } = input;
  const logLines: string[] = [];
  const failingChecks: string[] = [];
  const warningChecks: string[] = [];

  const log = (line: string) => {
    logLines.push(line);
    console.log(line);
  };

  log(`\n${'═'.repeat(60)}`);
  log(`ANIMATION INTEGRITY GATE — ${characterName}`);
  log('═'.repeat(60));

  // ── 1. Count visible meshes ───────────────────────────────────────────────
  let visibleMeshCount = 0;
  let skinnedMeshCount = 0;
  let skeletonBoneCount = 0;
  const allBoneNames: string[] = [];

  clonedScene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    const skinnedMesh = child as THREE.SkinnedMesh;
    const bone = child as THREE.Bone;

    if (mesh.isMesh) visibleMeshCount++;
    if (skinnedMesh.isSkinnedMesh) skinnedMeshCount++;
    if (bone.isBone) {
      skeletonBoneCount++;
      allBoneNames.push(bone.name);
    }
  });

  log(`  VISIBLE MESHES:   ${visibleMeshCount}`);
  log(`  SKINNED MESHES:   ${skinnedMeshCount}`);
  log(`  SKELETON BONES:   ${skeletonBoneCount}`);

  if (visibleMeshCount === 0) {
    failingChecks.push('NO_VISIBLE_MESH');
    log(`  ❌ NO_VISIBLE_MESH — nothing to render`);
  }
  if (skinnedMeshCount === 0) {
    warningChecks.push('NO_SKINNED_MESH');
    log(`  ⚠️  NO_SKINNED_MESH — mesh cannot deform via skeleton`);
  }
  if (skeletonBoneCount === 0) {
    warningChecks.push('NO_SKELETON');
    log(`  ⚠️  NO_SKELETON — no bones found in cloned scene`);
  }

  // ── 2. Animation clip and track validation + source classification ────────
  const clipNames = Object.keys(actions);
  const animationClipCount = clipNames.length;
  let totalTrackCount = 0;
  let resolvedTrackCount = 0;
  let unresolvedTrackCount = 0;
  const unresolvedTrackNames: string[] = [];
  const clipSources: ClipSourceSummary[] = [];

  let authoredClipCount = 0;
  let retargetedClipCount = 0;
  let placeholderClipCount = 0;
  let missingClipCount = 0;

  // Build object name set for track resolution
  const objectNameSet = new Set<string>();
  clonedScene.traverse((child) => {
    if (child.name) objectNameSet.add(child.name);
  });

  for (const clipName of clipNames) {
    const action = actions[clipName];
    if (!action) continue;
    const clip = action.getClip();
    const sourceType = classifyClipSource(clipName);

    let clipResolved = 0;
    let clipTotal = 0;

    for (const track of clip.tracks) {
      totalTrackCount++;
      clipTotal++;
      const dotIdx = track.name.lastIndexOf('.');
      const withoutProp = dotIdx !== -1 ? track.name.slice(0, dotIdx) : track.name;
      const pipeIdx = withoutProp.lastIndexOf('|');
      const targetName = pipeIdx !== -1 ? withoutProp.slice(pipeIdx + 1) : withoutProp;

      if (objectNameSet.has(targetName)) {
        resolvedTrackCount++;
        clipResolved++;
      } else {
        unresolvedTrackCount++;
        if (unresolvedTrackNames.length < 10) {
          unresolvedTrackNames.push(`${clipName}::${targetName}`);
        }
      }
    }

    clipSources.push({ clipName, sourceType, trackCount: clipTotal, resolvedTracks: clipResolved });

    switch (sourceType) {
      case 'AUTHORED_CLIP':            authoredClipCount++;    break;
      case 'RETARGETED_AUTHORED_CLIP': retargetedClipCount++;  break;
      case 'PLACEHOLDER_TEST_CLIP':    placeholderClipCount++; break;
      case 'MISSING_CLIP':             missingClipCount++;     break;
    }
  }

  log(`  ANIMATION CLIPS:  ${animationClipCount}`);
  log(`    AUTHORED:        ${authoredClipCount}`);
  log(`    RETARGETED:      ${retargetedClipCount}`);
  log(`    PLACEHOLDER:     ${placeholderClipCount}${placeholderClipCount > 0 ? ' ⚠️  (pipeline test only — not real animation)' : ''}`);
  log(`    MISSING:         ${missingClipCount}`);
  log(`  TRACKS:           ${totalTrackCount}`);
  log(`  RESOLVED TRACKS:  ${resolvedTrackCount}`);
  log(`  UNRESOLVED TRACKS:${unresolvedTrackCount}`);

  if (animationClipCount === 0) {
    warningChecks.push('NO_ANIMATION_CLIPS');
    log(`  ⚠️  NO_ANIMATION_CLIPS — character will be static (bind pose)`);
    log(`     → Source: check BANNON_rigged.glb / Bannon mocap pipeline`);
  }

  if (placeholderClipCount > 0 && authoredClipCount === 0 && retargetedClipCount === 0) {
    warningChecks.push('ONLY_PLACEHOLDER_CLIPS');
    log(`  ⚠️  ONLY_PLACEHOLDER_CLIPS — no authored/retargeted clips present`);
    log(`     → Pipeline test mode only. Statues are NOT fixed.`);
    log(`     → Required: real BANNON_rigged.glb + authored animation clips`);
  }

  if (unresolvedTrackCount > 0) {
    warningChecks.push('UNRESOLVED_TRACKS');
    log(`  ⚠️  UNRESOLVED_TRACKS — ${unresolvedTrackCount} track(s) target bones not in skeleton`);
    unresolvedTrackNames.forEach(t => log(`     • ${t}`));
    if (allBoneNames.length > 0) {
      log(`     Available bones (${allBoneNames.length}): ${allBoneNames.slice(0, 8).join(', ')}${allBoneNames.length > 8 ? ` +${allBoneNames.length - 8} more` : ''}`);
    }
  }

  // ── 3. Active clip state ──────────────────────────────────────────────────
  let resolvedActiveClipName: string | null = activeClipName ?? null;
  let activeClipDuration: number | null = null;
  let mixerUpdateCount = 0;

  for (const [name, action] of Object.entries(actions)) {
    if (action?.isRunning()) {
      resolvedActiveClipName = name;
      activeClipDuration = action.getClip().duration;
      mixerUpdateCount++;
    }
  }

  const activeClipSourceType: ClipSourceType = resolvedActiveClipName
    ? classifyClipSource(resolvedActiveClipName)
    : 'MISSING_CLIP';

  log(`  ACTIVE CLIP:      ${resolvedActiveClipName ?? 'NONE'} [${activeClipSourceType}]`);
  if (activeClipDuration !== null) {
    log(`  CLIP DURATION:    ${activeClipDuration.toFixed(3)}s`);
  }

  // ── 4. Mixer root validation ──────────────────────────────────────────────
  const mixerRoot = (mixer as any)._root as THREE.Object3D | undefined;
  const mixerRootIsVisibleClone = mixerRoot === clonedScene;

  log(`  MIXER ROOT:       ${mixerRootIsVisibleClone ? 'visible clone ✅' : 'WRONG OBJECT ❌'}`);

  if (!mixerRootIsVisibleClone) {
    failingChecks.push('MIXER_WRONG_ROOT');
    log(`  ❌ MIXER_WRONG_ROOT — mixer is not targeting the visible cloned scene`);
  }

  // ── 5. Bone travel measurement ────────────────────────────────────────────
  const boneTravel: BoneTravelMeasurement[] = [];
  let maxBoneTravelMetres = 0;
  let maxBoneRotationDegrees = 0;

  if (animationClipCount > 0 && resolvedActiveClipName) {
    const bonesToMeasure: THREE.Bone[] = [];
    clonedScene.traverse((child) => {
      const bone = child as THREE.Bone;
      if (!bone.isBone) return;
      const normalizedName = bone.name.replace(/^mixamorig/, '');
      if (TRAVEL_BONES.some(tb => tb === bone.name || tb.replace(/^mixamorig/, '') === normalizedName)) {
        bonesToMeasure.push(bone);
      }
    });

    clonedScene.updateMatrixWorld(true);
    const beforePositions = new Map<string, THREE.Vector3>();
    const beforeQuaternions = new Map<string, THREE.Quaternion>();
    for (const bone of bonesToMeasure) {
      beforePositions.set(bone.uuid, bone.getWorldPosition(new THREE.Vector3()));
      beforeQuaternions.set(bone.uuid, bone.getWorldQuaternion(new THREE.Quaternion()));
    }

    mixer.update(1 / 60);
    clonedScene.updateMatrixWorld(true);

    for (const bone of bonesToMeasure) {
      const posBefore = beforePositions.get(bone.uuid)!;
      const quatBefore = beforeQuaternions.get(bone.uuid)!;
      const posAfter = bone.getWorldPosition(new THREE.Vector3());
      const quatAfter = bone.getWorldQuaternion(new THREE.Quaternion());

      const distMetres = posBefore.distanceTo(posAfter);
      const dotProduct = Math.abs(quatBefore.dot(quatAfter));
      const clampedDot = Math.min(1, dotProduct);
      const rotDegrees = (2 * Math.acos(clampedDot) * 180) / Math.PI;

      boneTravel.push({
        boneName: bone.name,
        positionBefore: posBefore,
        positionAfter: posAfter,
        distanceMetres: distMetres,
        rotationDegrees: rotDegrees,
      });

      if (distMetres > maxBoneTravelMetres) maxBoneTravelMetres = distMetres;
      if (rotDegrees > maxBoneRotationDegrees) maxBoneRotationDegrees = rotDegrees;
    }

    mixer.update(-1 / 60);
    clonedScene.updateMatrixWorld(true);

    log(`  BONE TRAVEL:      max=${maxBoneTravelMetres.toFixed(4)}m / ${maxBoneRotationDegrees.toFixed(2)}°`);

    if (maxBoneTravelMetres < 0.0001 && maxBoneRotationDegrees < 0.01) {
      warningChecks.push('ZERO_BONE_TRAVEL');
      log(`  ⚠️  ZERO_BONE_TRAVEL — bones did not move during mixer tick`);
    } else {
      const travelSource = activeClipSourceType === 'PLACEHOLDER_TEST_CLIP' ?'⚠️  Bone motion detected (PLACEHOLDER only — not authored deformation)' :'✅ Bone motion detected — animation is reaching the skeleton';
      log(`  ${travelSource}`);
    }
  } else {
    log(`  BONE TRAVEL:      SKIPPED (no active clip or no animation clips)`);
  }

  // ── 6. Verdict ────────────────────────────────────────────────────────────
  let verdict: IntegrityVerdict;

  if (failingChecks.length > 0) {
    verdict = 'BLOCKED';
  } else if (
    warningChecks.includes('NO_SKINNED_MESH') ||
    warningChecks.includes('NO_SKELETON') ||
    warningChecks.includes('NO_ANIMATION_CLIPS') ||
    warningChecks.includes('ZERO_BONE_TRAVEL')
  ) {
    verdict = 'UNKNOWN';
  } else if (
    warningChecks.includes('ONLY_PLACEHOLDER_CLIPS') ||
    (placeholderClipCount > 0 && authoredClipCount === 0 && retargetedClipCount === 0)
  ) {
    // Placeholder clips drive the mixer but are NOT real animation success
    verdict = 'TEST_ONLY';
  } else if (authoredClipCount > 0 || retargetedClipCount > 0) {
    verdict = 'PASS';
  } else {
    verdict = 'UNKNOWN';
  }

  const verdictIcon =
    verdict === 'PASS'      ? '✅' :
    verdict === 'TEST_ONLY' ? '🧪' :
    verdict === 'BLOCKED'   ? '❌' : '⚠️ ';

  log(`  VERDICT:          ${verdictIcon} ${verdict}`);

  if (verdict === 'TEST_ONLY') {
    log(`  → TEST_ONLY: procedural placeholder successfully drives mixer`);
    log(`  → This is NOT a fix for the statue problem.`);
    log(`  → Required for PASS: real AUTHORED_CLIP or RETARGETED_AUTHORED_CLIP`);
  }
  if (verdict === 'UNKNOWN') {
    log(`  → UNKNOWN is not PASS. Fix the warnings above before declaring success.`);
  }
  if (verdict === 'BLOCKED') {
    log(`  → BLOCKED: ${failingChecks.join(', ')}`);
    log(`  → Fix the source GLB asset. Do NOT generate synthetic rigging at runtime.`);
  }
  if (verdict === 'PASS') {
    log(`  → PASS: real authored/retargeted animation deforming the visible mesh`);
  }

  log('═'.repeat(60) + '\n');

  return {
    characterName,
    timestamp: new Date().toISOString(),
    visibleMeshCount,
    skinnedMeshCount,
    skeletonBoneCount,
    animationClipCount,
    totalTrackCount,
    resolvedTrackCount,
    unresolvedTrackCount,
    unresolvedTrackNames,
    clipSources,
    authoredClipCount,
    retargetedClipCount,
    placeholderClipCount,
    missingClipCount,
    activeClipName: resolvedActiveClipName,
    activeClipSourceType,
    activeClipDuration,
    mixerRootIsVisibleClone,
    mixerUpdateCount,
    boneTravel,
    maxBoneTravelMetres,
    maxBoneRotationDegrees,
    verdict,
    failingChecks,
    warningChecks,
    logLines,
  };
}

// ── Convenience: run gate for both fighters ───────────────────────────────────

export interface DualFighterGateInput {
  p1: AnimationIntegrityInput;
  p2: AnimationIntegrityInput;
}

export interface DualFighterGateResult {
  p1Report: AnimationIntegrityReport;
  p2Report: AnimationIntegrityReport;
  /** true only if BOTH fighters pass with real authored/retargeted clips */
  bothPass: boolean;
  /** true if either fighter is BLOCKED (unrenderable) */
  anyBlocked: boolean;
  /** true if either fighter is TEST_ONLY (placeholder clips only) */
  anyTestOnly: boolean;
}

export function runDualFighterIntegrityGate(
  input: DualFighterGateInput,
): DualFighterGateResult {
  const p1Report = runAnimationIntegrityGate(input.p1);
  const p2Report = runAnimationIntegrityGate(input.p2);

  return {
    p1Report,
    p2Report,
    bothPass: p1Report.verdict === 'PASS' && p2Report.verdict === 'PASS',
    anyBlocked: p1Report.verdict === 'BLOCKED' || p2Report.verdict === 'BLOCKED',
    anyTestOnly: p1Report.verdict === 'TEST_ONLY' || p2Report.verdict === 'TEST_ONLY',
  };
}
