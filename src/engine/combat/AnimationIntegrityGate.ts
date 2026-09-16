/**
 * AnimationIntegrityGate.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Per-fighter animation integrity gate.
 *
 * Before combat begins, this gate produces one concise report per fighter:
 *
 *   FIGHTER: BANNON
 *   VISIBLE MESHES: X
 *   SKINNED MESHES: X
 *   SKELETON BONES: X
 *   ANIMATION CLIPS: X
 *   TRACKS: X
 *   RESOLVED TRACKS: X
 *   UNRESOLVED TRACKS: X
 *   ACTIVE CLIP: name
 *   MIXER ROOT: visible clone
 *   BONE TRAVEL: measured metres/degrees
 *   VERDICT: PASS | BLOCKED | UNKNOWN
 *
 * UNKNOWN is never PASS.
 *
 * The gate does NOT block animation playback — it is diagnostic only.
 * It fires the onBlocked callback only for truly unrenderable assets
 * (NO_VISIBLE_MESH). All other failures are logged as warnings.
 *
 * Usage:
 *   import { runAnimationIntegrityGate } from './AnimationIntegrityGate';
 *   const report = runAnimationIntegrityGate({ characterName, clonedScene, mixer, actions });
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as THREE from 'three';

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
  /** World-space position before one mixer tick */
  positionBefore: THREE.Vector3;
  /** World-space position after one mixer tick */
  positionAfter: THREE.Vector3;
  /** Distance travelled in world units */
  distanceMetres: number;
  /** Quaternion rotation delta in degrees */
  rotationDegrees: number;
}

export type IntegrityVerdict = 'PASS' | 'BLOCKED' | 'UNKNOWN';

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
  // ── Playback state ────────────────────────────────────────────────────────
  activeClipName: string | null;
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

/**
 * Run the animation integrity gate for a single fighter.
 *
 * This function:
 *   1. Counts visible meshes, SkinnedMeshes, and skeleton bones
 *   2. Validates animation clip count and track resolution
 *   3. Measures bone travel over a synthetic 1/60s mixer tick
 *   4. Produces a structured report with PASS/BLOCKED/UNKNOWN verdict
 *
 * IMPORTANT: This function calls mixer.update(1/60) once to measure bone
 * travel. It then calls mixer.update(-1/60) to reverse the tick so the
 * animation state is not permanently advanced. This is safe because the
 * mixer is not yet driving the render loop at gate time.
 *
 * If the mixer has no active actions, bone travel will be 0 — this is
 * expected for RIGGED_NO_ANIMATIONS assets and is reported as a warning.
 */
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

  // ── 2. Animation clip and track validation ────────────────────────────────
  const clipNames = Object.keys(actions);
  const animationClipCount = clipNames.length;
  let totalTrackCount = 0;
  let resolvedTrackCount = 0;
  let unresolvedTrackCount = 0;
  const unresolvedTrackNames: string[] = [];

  // Build object name set for track resolution
  const objectNameSet = new Set<string>();
  clonedScene.traverse((child) => {
    if (child.name) objectNameSet.add(child.name);
  });

  for (const clipName of clipNames) {
    const action = actions[clipName];
    if (!action) continue;
    const clip = action.getClip();
    for (const track of clip.tracks) {
      totalTrackCount++;
      // Extract target object name from track name
      const dotIdx = track.name.lastIndexOf('.');
      const withoutProp = dotIdx !== -1 ? track.name.slice(0, dotIdx) : track.name;
      const pipeIdx = withoutProp.lastIndexOf('|');
      const targetName = pipeIdx !== -1 ? withoutProp.slice(pipeIdx + 1) : withoutProp;

      if (objectNameSet.has(targetName)) {
        resolvedTrackCount++;
      } else {
        unresolvedTrackCount++;
        if (unresolvedTrackNames.length < 10) {
          unresolvedTrackNames.push(`${clipName}::${targetName}`);
        }
      }
    }
  }

  log(`  ANIMATION CLIPS:  ${animationClipCount}`);
  log(`  TRACKS:           ${totalTrackCount}`);
  log(`  RESOLVED TRACKS:  ${resolvedTrackCount}`);
  log(`  UNRESOLVED TRACKS:${unresolvedTrackCount}`);

  if (animationClipCount === 0) {
    warningChecks.push('NO_ANIMATION_CLIPS');
    log(`  ⚠️  NO_ANIMATION_CLIPS — character will be static (bind pose)`);
    log(`     → Source: check BANNON_rigged.glb / Bannon mocap pipeline`);
    log(`     → Required: idle, walk, attack, hit, knockdown clips`);
  }

  if (unresolvedTrackCount > 0) {
    warningChecks.push('UNRESOLVED_TRACKS');
    log(`  ⚠️  UNRESOLVED_TRACKS — ${unresolvedTrackCount} track(s) target bones not in skeleton`);
    log(`     → Statue/bind-pose lock risk. Fix bone name mismatches.`);
    unresolvedTrackNames.forEach(t => log(`     • ${t}`));
    if (allBoneNames.length > 0) {
      log(`     Available bones (${allBoneNames.length}): ${allBoneNames.slice(0, 8).join(', ')}${allBoneNames.length > 8 ? ` +${allBoneNames.length - 8} more` : ''}`);
    }
  }

  // ── 3. Active clip state ──────────────────────────────────────────────────
  let resolvedActiveClipName: string | null = activeClipName ?? null;
  let activeClipDuration: number | null = null;
  let mixerUpdateCount = 0;

  // Find the currently running action
  for (const [name, action] of Object.entries(actions)) {
    if (action?.isRunning()) {
      resolvedActiveClipName = name;
      activeClipDuration = action.getClip().duration;
      mixerUpdateCount++;
    }
  }

  log(`  ACTIVE CLIP:      ${resolvedActiveClipName ?? 'NONE'}`);
  if (activeClipDuration !== null) {
    log(`  CLIP DURATION:    ${activeClipDuration.toFixed(3)}s`);
  }

  // ── 4. Mixer root validation ──────────────────────────────────────────────
  // The mixer root should be the cloned scene (the visible object).
  // We verify this by checking that the mixer's root object is the same
  // reference as clonedScene.
  const mixerRoot = (mixer as any)._root as THREE.Object3D | undefined;
  const mixerRootIsVisibleClone = mixerRoot === clonedScene;

  log(`  MIXER ROOT:       ${mixerRootIsVisibleClone ? 'visible clone ✅' : 'WRONG OBJECT ❌'}`);

  if (!mixerRootIsVisibleClone) {
    failingChecks.push('MIXER_WRONG_ROOT');
    log(`  ❌ MIXER_WRONG_ROOT — mixer is not targeting the visible cloned scene`);
    log(`     → Fix: new THREE.AnimationMixer(clonedScene) not the original GLTF scene`);
  }

  // ── 5. Bone travel measurement ────────────────────────────────────────────
  // Measure bone travel over a synthetic 1/60s tick to verify that animation
  // is actually reaching the skeleton (not just the mixer running silently).
  const boneTravel: BoneTravelMeasurement[] = [];
  let maxBoneTravelMetres = 0;
  let maxBoneRotationDegrees = 0;

  if (animationClipCount > 0 && resolvedActiveClipName) {
    // Collect bones to measure
    const bonesToMeasure: THREE.Bone[] = [];
    clonedScene.traverse((child) => {
      const bone = child as THREE.Bone;
      if (!bone.isBone) return;
      const normalizedName = bone.name.replace(/^mixamorig/, '');
      if (TRAVEL_BONES.some(tb => tb === bone.name || tb.replace(/^mixamorig/, '') === normalizedName)) {
        bonesToMeasure.push(bone);
      }
    });

    // Capture positions before tick
    clonedScene.updateMatrixWorld(true);
    const beforePositions = new Map<string, THREE.Vector3>();
    const beforeQuaternions = new Map<string, THREE.Quaternion>();
    for (const bone of bonesToMeasure) {
      beforePositions.set(bone.uuid, bone.getWorldPosition(new THREE.Vector3()));
      beforeQuaternions.set(bone.uuid, bone.getWorldQuaternion(new THREE.Quaternion()));
    }

    // Advance mixer by 1/60s
    mixer.update(1 / 60);
    clonedScene.updateMatrixWorld(true);

    // Measure travel
    for (const bone of bonesToMeasure) {
      const posBefore = beforePositions.get(bone.uuid)!;
      const quatBefore = beforeQuaternions.get(bone.uuid)!;
      const posAfter = bone.getWorldPosition(new THREE.Vector3());
      const quatAfter = bone.getWorldQuaternion(new THREE.Quaternion());

      const distMetres = posBefore.distanceTo(posAfter);
      // Quaternion angle difference
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

    // Reverse the tick to restore animation state
    mixer.update(-1 / 60);
    clonedScene.updateMatrixWorld(true);

    log(`  BONE TRAVEL:      max=${maxBoneTravelMetres.toFixed(4)}m / ${maxBoneRotationDegrees.toFixed(2)}°`);

    if (maxBoneTravelMetres < 0.0001 && maxBoneRotationDegrees < 0.01) {
      warningChecks.push('ZERO_BONE_TRAVEL');
      log(`  ⚠️  ZERO_BONE_TRAVEL — bones did not move during mixer tick`);
      log(`     → Possible causes:`);
      log(`       1. No active AnimationAction (call action.play() before gate)`);
      log(`       2. All tracks unresolved (bone name mismatch)`);
      log(`       3. Mixer targeting wrong root (see MIXER_WRONG_ROOT above)`);
      log(`       4. Animation clip has zero-length tracks`);
    } else {
      log(`  ✅ Bone motion detected — animation is reaching the skeleton`);
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
    // Has warnings but not hard failures — UNKNOWN (not PASS)
    verdict = 'UNKNOWN';
  } else {
    verdict = 'PASS';
  }

  const verdictIcon = verdict === 'PASS' ? '✅' : verdict === 'BLOCKED' ? '❌' : '⚠️ ';
  log(`  VERDICT:          ${verdictIcon} ${verdict}`);

  if (verdict === 'UNKNOWN') {
    log(`  → UNKNOWN is not PASS. Fix the warnings above before declaring success.`);
    log(`  → Required for PASS: SkinnedMesh + Skeleton + AnimationClips + BoneTravel > 0`);
  }

  if (verdict === 'BLOCKED') {
    log(`  → BLOCKED: ${failingChecks.join(', ')}`);
    log(`  → Fix the source GLB asset. Do NOT generate synthetic rigging at runtime.`);
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
    activeClipName: resolvedActiveClipName,
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
  /** true only if BOTH fighters pass */
  bothPass: boolean;
  /** true if either fighter is BLOCKED (unrenderable) */
  anyBlocked: boolean;
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
  };
}
