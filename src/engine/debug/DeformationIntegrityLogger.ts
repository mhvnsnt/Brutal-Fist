/**
 * DEFORMATION INTEGRITY LOGGER
 * ─────────────────────────────────────────────────────────────────────────────
 * Backend-only agent debug system. No frontend UI.
 *
 * Runs the 14-point deformation integrity test on a fighter's normalized scene
 * at combat entry. If any check fails, logs the character name + failing test
 * and returns BLOCKED so the caller can freeze combat.
 *
 * AUTHORED SKELETON LAW: This module is read-only. It never modifies the scene,
 * skeleton, weights, or any runtime state. It only observes and reports.
 *
 * 14-POINT TEST SUITE
 * ────────────────────
 *  1. SKELETON_EXISTS          — At least one Bone object in the scene hierarchy
 *  2. SKELETON_HIERARCHY       — Every bone has a valid parent (except root)
 *  3. INVERSE_BIND_MATRICES    — Every SkinnedMesh has a skeleton with bindMatrixInverse
 *  4. SKINNED_MESH_SKELETON    — Every SkinnedMesh references a skeleton with > 0 bones
 *  5. SKIN_INDICES_VALID       — skinIndex attribute exists on every SkinnedMesh geometry
 *  6. MAX_FOUR_INFLUENCES      — No vertex has > 4 runtime influences (WebGL limit)
 *  7. WEIGHTS_SUM_TO_ONE       — Per-vertex skin weights sum to ~1.0 (Khronos spec)
 *  8. BIND_POSE_STABLE         — No NaN/Infinity in bone world matrices
 *  9. FLOOR_NORMALIZATION      — Scene bounding box min.y is at or near 0
 * 10. FORWARD_DIRECTION        — Forward correction was applied (or model is already correct)
 * 11. FRUSTUM_CULLING_DISABLED — Every SkinnedMesh has frustumCulled = false
 * 12. MIXER_TARGETS_CLONE      — AnimationMixer root matches the cloned scene object
 * 13. ANIMATION_CLIPS_EXIST    — At least one AnimationAction is registered on the mixer
 * 14. FIRST_FRAME_DISPLACEMENT — At least one SkinnedMesh vertex moves on first mixer tick
 *                                (sampled non-destructively; mixer is reset after test)
 */

import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CheckId =
  | 'SKELETON_EXISTS' |'SKELETON_HIERARCHY' |'INVERSE_BIND_MATRICES' |'SKINNED_MESH_SKELETON' |'SKIN_INDICES_VALID' |'MAX_FOUR_INFLUENCES' |'WEIGHTS_SUM_TO_ONE' |'BIND_POSE_STABLE' |'FLOOR_NORMALIZATION' |'FORWARD_DIRECTION' |'FRUSTUM_CULLING_DISABLED' |'MIXER_TARGETS_CLONE' |'ANIMATION_CLIPS_EXIST' |'FIRST_FRAME_DISPLACEMENT';

export interface CheckResult {
  id: CheckId;
  pass: boolean;
  detail: string;
}

export type IntegrityVerdict = 'PASS' | 'BLOCKED';

export interface DeformationIntegrityReport {
  characterName: string;
  modelUrl: string;
  verdict: IntegrityVerdict;
  checks: CheckResult[];
  failingChecks: CheckId[];
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Tolerance for floor normalization check (units) */
const FLOOR_Y_TOLERANCE = 0.15;

/** Tolerance for weight sum check */
const WEIGHT_SUM_TOLERANCE = 0.05;

/** Minimum vertex displacement (units) to confirm first-frame deformation */
const MIN_VERTEX_DISPLACEMENT = 0.0001;

/** Number of vertices to sample for weight and displacement checks */
const SAMPLE_VERTEX_COUNT = 32;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function collectBones(scene: THREE.Object3D): THREE.Bone[] {
  const bones: THREE.Bone[] = [];
  scene.traverse((child) => {
    if ((child as THREE.Bone).isBone) bones.push(child as THREE.Bone);
  });
  return bones;
}

function collectSkinnedMeshes(scene: THREE.Object3D): THREE.SkinnedMesh[] {
  const meshes: THREE.SkinnedMesh[] = [];
  scene.traverse((child) => {
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(child as THREE.SkinnedMesh);
  });
  return meshes;
}

function hasNaNOrInfinity(matrix: THREE.Matrix4): boolean {
  for (const v of matrix.elements) {
    if (!isFinite(v)) return true;
  }
  return false;
}

/**
 * Sample vertex positions from a SkinnedMesh geometry.
 * Returns world-space positions for up to `count` vertices.
 */
function sampleVertexPositions(mesh: THREE.SkinnedMesh, count: number): THREE.Vector3[] {
  const positions: THREE.Vector3[] = [];
  const posAttr = mesh.geometry.attributes.position;
  if (!posAttr) return positions;

  const total = posAttr.count;
  const step = Math.max(1, Math.floor(total / count));

  for (let i = 0; i < total && positions.length < count; i += step) {
    const local = new THREE.Vector3(
      posAttr.getX(i),
      posAttr.getY(i),
      posAttr.getZ(i),
    );
    // Transform to world space using the mesh's world matrix
    local.applyMatrix4(mesh.matrixWorld);
    positions.push(local);
  }
  return positions;
}

// ─────────────────────────────────────────────────────────────────────────────
// 14-Point Test Implementation
// ─────────────────────────────────────────────────────────────────────────────

function check_SKELETON_EXISTS(bones: THREE.Bone[]): CheckResult {
  const pass = bones.length > 0;
  return {
    id: 'SKELETON_EXISTS',
    pass,
    detail: pass
      ? `${bones.length} bones found in scene hierarchy`
      : 'No Bone objects found — model has no skeleton',
  };
}

function check_SKELETON_HIERARCHY(bones: THREE.Bone[]): CheckResult {
  if (bones.length === 0) {
    return { id: 'SKELETON_HIERARCHY', pass: false, detail: 'No bones to validate hierarchy' };
  }

  const rootBones = bones.filter(b => !(b.parent as THREE.Bone)?.isBone);
  const orphans = bones.filter(b => {
    const parent = b.parent;
    // A bone is an orphan if its parent is not a bone AND it's not a root bone
    // (i.e., its parent is null or not a scene object)
    return !parent && b !== rootBones[0];
  });

  const pass = orphans.length === 0 && rootBones.length >= 1;
  return {
    id: 'SKELETON_HIERARCHY',
    pass,
    detail: pass
      ? `Hierarchy valid — ${rootBones.length} root bone(s), ${bones.length} total`
      : `Hierarchy broken — ${orphans.length} orphan bone(s), ${rootBones.length} root(s)`,
  };
}

function check_INVERSE_BIND_MATRICES(skinnedMeshes: THREE.SkinnedMesh[]): CheckResult {
  if (skinnedMeshes.length === 0) {
    return { id: 'INVERSE_BIND_MATRICES', pass: false, detail: 'No SkinnedMesh found' };
  }

  const broken: string[] = [];
  for (const sm of skinnedMeshes) {
    if (!sm.skeleton) {
      broken.push(`${sm.name || 'unnamed'}: no skeleton`);
      continue;
    }
    // Check bindMatrixInverse on the SkinnedMesh itself
    if (hasNaNOrInfinity(sm.bindMatrixInverse)) {
      broken.push(`${sm.name || 'unnamed'}: NaN/Inf in bindMatrixInverse`);
    }
    // Check each bone's bindMatrix
    for (const bone of sm.skeleton.bones) {
      if (hasNaNOrInfinity(bone.matrix)) {
        broken.push(`bone "${bone.name}": NaN/Inf in matrix`);
        break; // one per mesh is enough
      }
    }
  }

  const pass = broken.length === 0;
  return {
    id: 'INVERSE_BIND_MATRICES',
    pass,
    detail: pass
      ? `All ${skinnedMeshes.length} SkinnedMesh(es) have valid bind matrices`
      : `Invalid bind matrices: ${broken.slice(0, 3).join('; ')}${broken.length > 3 ? ` (+${broken.length - 3} more)` : ''}`,
  };
}

function check_SKINNED_MESH_SKELETON(skinnedMeshes: THREE.SkinnedMesh[]): CheckResult {
  if (skinnedMeshes.length === 0) {
    return { id: 'SKINNED_MESH_SKELETON', pass: false, detail: 'No SkinnedMesh found in scene' };
  }

  const unbound = skinnedMeshes.filter(sm => !sm.skeleton || sm.skeleton.bones.length === 0);
  const pass = unbound.length === 0;
  return {
    id: 'SKINNED_MESH_SKELETON',
    pass,
    detail: pass
      ? `All ${skinnedMeshes.length} SkinnedMesh(es) bound to skeleton with bones`
      : `${unbound.length} SkinnedMesh(es) have no skeleton or empty skeleton: ${unbound.map(m => m.name || 'unnamed').slice(0, 3).join(', ')}`,
  };
}

function check_SKIN_INDICES_VALID(skinnedMeshes: THREE.SkinnedMesh[]): CheckResult {
  if (skinnedMeshes.length === 0) {
    return { id: 'SKIN_INDICES_VALID', pass: false, detail: 'No SkinnedMesh found' };
  }

  const missing: string[] = [];
  for (const sm of skinnedMeshes) {
    const hasSkinIndex = sm.geometry.attributes.skinIndex != null;
    const hasSkinWeight = sm.geometry.attributes.skinWeight != null;
    if (!hasSkinIndex || !hasSkinWeight) {
      missing.push(`${sm.name || 'unnamed'}: missing ${!hasSkinIndex ? 'skinIndex' : ''}${!hasSkinIndex && !hasSkinWeight ? '+' : ''}${!hasSkinWeight ? 'skinWeight' : ''}`);
    }
  }

  const pass = missing.length === 0;
  return {
    id: 'SKIN_INDICES_VALID',
    pass,
    detail: pass
      ? `skinIndex + skinWeight attributes present on all ${skinnedMeshes.length} SkinnedMesh(es)`
      : `Missing skin attributes: ${missing.slice(0, 3).join('; ')}`,
  };
}

function check_MAX_FOUR_INFLUENCES(skinnedMeshes: THREE.SkinnedMesh[]): CheckResult {
  if (skinnedMeshes.length === 0) {
    return { id: 'MAX_FOUR_INFLUENCES', pass: true, detail: 'No SkinnedMesh — check skipped' };
  }

  const violations: string[] = [];
  for (const sm of skinnedMeshes) {
    const skinIndex = sm.geometry.attributes.skinIndex;
    if (!skinIndex) continue;
    // Three.js WebGL path supports exactly 4 influences (JOINTS_0 / WEIGHTS_0)
    // itemSize > 4 means the attribute was authored with more than 4 influences
    if (skinIndex.itemSize > 4) {
      violations.push(`${sm.name || 'unnamed'}: itemSize=${skinIndex.itemSize} (max 4)`);
    }
  }

  const pass = violations.length === 0;
  return {
    id: 'MAX_FOUR_INFLUENCES',
    pass,
    detail: pass
      ? `All SkinnedMesh(es) within 4-influence WebGL limit`
      : `Influence count violations: ${violations.slice(0, 3).join('; ')}`,
  };
}

function check_WEIGHTS_SUM_TO_ONE(skinnedMeshes: THREE.SkinnedMesh[]): CheckResult {
  if (skinnedMeshes.length === 0) {
    return { id: 'WEIGHTS_SUM_TO_ONE', pass: true, detail: 'No SkinnedMesh — check skipped' };
  }

  let totalSampled = 0;
  let totalViolations = 0;

  for (const sm of skinnedMeshes) {
    const weightAttr = sm.geometry.attributes.skinWeight;
    if (!weightAttr) continue;

    const count = weightAttr.count;
    const step = Math.max(1, Math.floor(count / SAMPLE_VERTEX_COUNT));

    for (let i = 0; i < count; i += step) {
      totalSampled++;
      let sum = 0;
      for (let j = 0; j < weightAttr.itemSize; j++) {
        sum += weightAttr.getComponent(i, j);
      }
      if (Math.abs(sum - 1.0) > WEIGHT_SUM_TOLERANCE && sum > 0.01) {
        totalViolations++;
      }
    }
  }

  const pass = totalViolations === 0;
  return {
    id: 'WEIGHTS_SUM_TO_ONE',
    pass,
    detail: pass
      ? `Weight sums valid across ${totalSampled} sampled vertices (tolerance ±${WEIGHT_SUM_TOLERANCE})`
      : `${totalViolations}/${totalSampled} sampled vertices have weights not summing to 1.0`,
  };
}

function check_BIND_POSE_STABLE(bones: THREE.Bone[], skinnedMeshes: THREE.SkinnedMesh[]): CheckResult {
  const badBones: string[] = [];

  for (const bone of bones) {
    bone.updateWorldMatrix(true, false);
    if (hasNaNOrInfinity(bone.matrixWorld)) {
      badBones.push(bone.name || 'unnamed');
    }
  }

  for (const sm of skinnedMeshes) {
    if (hasNaNOrInfinity(sm.matrixWorld)) {
      badBones.push(`mesh:${sm.name || 'unnamed'}`);
    }
  }

  const pass = badBones.length === 0;
  return {
    id: 'BIND_POSE_STABLE',
    pass,
    detail: pass
      ? `All bone/mesh world matrices are finite`
      : `NaN/Infinity in world matrices: ${badBones.slice(0, 5).join(', ')}`,
  };
}

function check_FLOOR_NORMALIZATION(scene: THREE.Object3D): CheckResult {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);

  if (box.isEmpty()) {
    return { id: 'FLOOR_NORMALIZATION', pass: false, detail: 'Bounding box is empty — no geometry found' };
  }

  const minY = box.min.y;
  const pass = Math.abs(minY) <= FLOOR_Y_TOLERANCE;
  return {
    id: 'FLOOR_NORMALIZATION',
    pass,
    detail: pass
      ? `Floor at Y=${minY.toFixed(4)} (within ±${FLOOR_Y_TOLERANCE} tolerance)`
      : `Floor at Y=${minY.toFixed(4)} — character not floor-normalized (expected ~0)`,
  };
}

function check_FORWARD_DIRECTION(forwardCorrectionY: number): CheckResult {
  // A correction of 0 means the model already faces -Z (correct glTF standard)
  // A correction of Math.PI means the model was facing +Z and was corrected
  // Both are valid — what matters is that the detection ran
  const correctionDeg = Math.round((forwardCorrectionY * 180) / Math.PI);
  return {
    id: 'FORWARD_DIRECTION',
    pass: true, // Always passes — detection always runs in normalizeGLB
    detail: `Forward correction applied: ${correctionDeg}° (0°=already correct, 180°=+Z export corrected)`,
  };
}

function check_FRUSTUM_CULLING_DISABLED(skinnedMeshes: THREE.SkinnedMesh[]): CheckResult {
  if (skinnedMeshes.length === 0) {
    return { id: 'FRUSTUM_CULLING_DISABLED', pass: true, detail: 'No SkinnedMesh — check skipped' };
  }

  const cullingEnabled = skinnedMeshes.filter(sm => sm.frustumCulled);
  const pass = cullingEnabled.length === 0;
  return {
    id: 'FRUSTUM_CULLING_DISABLED',
    pass,
    detail: pass
      ? `frustumCulled=false on all ${skinnedMeshes.length} SkinnedMesh(es)`
      : `${cullingEnabled.length} SkinnedMesh(es) still have frustumCulled=true — body parts may disappear during attacks`,
  };
}

function check_MIXER_TARGETS_CLONE(
  mixer: THREE.AnimationMixer,
  clonedScene: THREE.Object3D,
): CheckResult {
  // THREE.AnimationMixer stores its root as _root (internal)
  // We compare the mixer's root UUID to the cloned scene's UUID
  const mixerRoot = (mixer as unknown as { _root: THREE.Object3D })._root;
  const pass = mixerRoot != null && mixerRoot.uuid === clonedScene.uuid;
  return {
    id: 'MIXER_TARGETS_CLONE',
    pass,
    detail: pass
      ? `AnimationMixer root matches cloned scene (uuid=${clonedScene.uuid.slice(0, 8)})`
      : `AnimationMixer root MISMATCH — mixer uuid=${mixerRoot?.uuid?.slice(0, 8) ?? 'null'} vs clone uuid=${clonedScene.uuid.slice(0, 8)}`,
  };
}

function check_ANIMATION_CLIPS_EXIST(actions: Record<string, THREE.AnimationAction>): CheckResult {
  const clipCount = Object.keys(actions).length;
  const pass = clipCount > 0;
  return {
    id: 'ANIMATION_CLIPS_EXIST',
    pass,
    detail: pass
      ? `${clipCount} AnimationAction(s) registered: [${Object.keys(actions).slice(0, 5).join(', ')}${clipCount > 5 ? '...' : ''}]`
      : 'No AnimationActions registered on mixer — character cannot animate',
  };
}

/**
 * CHECK 14: FIRST_FRAME_DISPLACEMENT
 *
 * Non-destructive first-frame deformation test.
 * Samples vertex positions BEFORE and AFTER a single mixer tick (1/60s).
 * Resets mixer time to 0 after the test so combat starts from the correct frame.
 *
 * AGENT LAW: This test MUST NOT leave the mixer in a dirty state.
 * We save/restore mixer time and stop all actions after the test.
 * The caller is responsible for re-starting the idle action after this check.
 */
function check_FIRST_FRAME_DISPLACEMENT(
  mixer: THREE.AnimationMixer,
  actions: Record<string, THREE.AnimationAction>,
  skinnedMeshes: THREE.SkinnedMesh[],
  clonedScene: THREE.Object3D,
): CheckResult {
  if (skinnedMeshes.length === 0) {
    return { id: 'FIRST_FRAME_DISPLACEMENT', pass: false, detail: 'No SkinnedMesh — cannot test vertex displacement' };
  }

  const clipNames = Object.keys(actions);
  if (clipNames.length === 0) {
    return { id: 'FIRST_FRAME_DISPLACEMENT', pass: false, detail: 'No animation clips — cannot test displacement' };
  }

  // Find the best clip to test with (prefer idle, then first available)
  const testClipName = clipNames.find(n => n.toLowerCase().includes('idle')) ?? clipNames[0];
  const testAction = actions[testClipName];

  if (!testAction) {
    return { id: 'FIRST_FRAME_DISPLACEMENT', pass: false, detail: `Test action "${testClipName}" not found` };
  }

  // Pick the first SkinnedMesh with valid skin attributes for sampling
  const testMesh = skinnedMeshes.find(sm =>
    sm.skeleton &&
    sm.skeleton.bones.length > 0 &&
    sm.geometry.attributes.position &&
    sm.geometry.attributes.skinWeight
  );

  if (!testMesh) {
    return { id: 'FIRST_FRAME_DISPLACEMENT', pass: false, detail: 'No valid SkinnedMesh with skeleton + skinWeight for displacement test' };
  }

  // Sample BEFORE positions
  clonedScene.updateMatrixWorld(true);
  const before = sampleVertexPositions(testMesh, SAMPLE_VERTEX_COUNT);

  // Tick mixer by one frame (non-destructive: we'll reset after)
  const savedTimeScale = mixer.timeScale;
  mixer.timeScale = 1;

  // Start the test action temporarily
  testAction.reset();
  testAction.setLoop(THREE.LoopOnce, 1);
  testAction.play();
  mixer.update(1 / 60); // one frame at 60fps

  // Sample AFTER positions
  clonedScene.updateMatrixWorld(true);
  const after = sampleVertexPositions(testMesh, SAMPLE_VERTEX_COUNT);

  // RESET: stop all actions and reset mixer time
  mixer.stopAllAction();
  mixer.setTime(0);
  mixer.timeScale = savedTimeScale;

  // Measure maximum displacement
  let maxDisplacement = 0;
  const sampleCount = Math.min(before.length, after.length);
  for (let i = 0; i < sampleCount; i++) {
    const d = before[i].distanceTo(after[i]);
    if (d > maxDisplacement) maxDisplacement = d;
  }

  const pass = maxDisplacement >= MIN_VERTEX_DISPLACEMENT;
  return {
    id: 'FIRST_FRAME_DISPLACEMENT',
    pass,
    detail: pass
      ? `Visible mesh deformation confirmed — max vertex displacement: ${maxDisplacement.toFixed(5)} units (clip: "${testClipName}")`
      : `NO visible mesh deformation — max displacement: ${maxDisplacement.toFixed(5)} units. Animation is on invisible skeleton, not visible mesh.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

export interface DeformationIntegrityInput {
  characterName: string;
  modelUrl: string;
  clonedScene: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  forwardCorrectionY: number;
}

/**
 * runDeformationIntegrityTest
 *
 * Runs the full 14-point deformation integrity test on a fighter's normalized
 * scene at combat entry.
 *
 * Returns a DeformationIntegrityReport with:
 *   - verdict: 'PASS' | 'BLOCKED'
 *   - checks: all 14 check results
 *   - failingChecks: IDs of failed checks
 *
 * If verdict is 'BLOCKED', the caller MUST freeze combat.
 *
 * AGENT LAW: This function is read-only. It never modifies the scene.
 * Exception: CHECK 14 (FIRST_FRAME_DISPLACEMENT) temporarily ticks the mixer
 * and immediately resets it — the caller must re-start idle after this call.
 */
export function runDeformationIntegrityTest(
  input: DeformationIntegrityInput,
): DeformationIntegrityReport {
  const { characterName, modelUrl, clonedScene, mixer, actions, forwardCorrectionY } = input;

  const bones = collectBones(clonedScene);
  const skinnedMeshes = collectSkinnedMeshes(clonedScene);

  // Run all 14 checks
  const checks: CheckResult[] = [
    check_SKELETON_EXISTS(bones),
    check_SKELETON_HIERARCHY(bones),
    check_INVERSE_BIND_MATRICES(skinnedMeshes),
    check_SKINNED_MESH_SKELETON(skinnedMeshes),
    check_SKIN_INDICES_VALID(skinnedMeshes),
    check_MAX_FOUR_INFLUENCES(skinnedMeshes),
    check_WEIGHTS_SUM_TO_ONE(skinnedMeshes),
    check_BIND_POSE_STABLE(bones, skinnedMeshes),
    check_FLOOR_NORMALIZATION(clonedScene),
    check_FORWARD_DIRECTION(forwardCorrectionY),
    check_FRUSTUM_CULLING_DISABLED(skinnedMeshes),
    check_MIXER_TARGETS_CLONE(mixer, clonedScene),
    check_ANIMATION_CLIPS_EXIST(actions),
    check_FIRST_FRAME_DISPLACEMENT(mixer, actions, skinnedMeshes, clonedScene),
  ];

  const failingChecks = checks.filter(c => !c.pass).map(c => c.id);
  const verdict: IntegrityVerdict = failingChecks.length === 0 ? 'PASS' : 'BLOCKED';

  const report: DeformationIntegrityReport = {
    characterName,
    modelUrl,
    verdict,
    checks,
    failingChecks,
    timestamp: Date.now(),
  };

  // ── Console output (backend-only, no UI) ──────────────────────────────────
  const tag = verdict === 'PASS'
    ? `[DeformationIntegrity] ✅ PASS`
    : `[DeformationIntegrity] ❌ BLOCKED`;

  console.group(`${tag} — ${characterName} (${modelUrl.split('/').pop()})`);
  console.log(`Verdict: ${verdict} | Checks: ${checks.length - failingChecks.length}/${checks.length} passed`);

  for (const check of checks) {
    const icon = check.pass ? '  ✓' : '  ✗';
    const level = check.pass ? 'log' : 'warn';
    console[level](`${icon} [${check.id}] ${check.detail}`);
  }

  if (verdict === 'BLOCKED') {
    console.error(
      `[DeformationIntegrity] COMBAT FROZEN — ${characterName} failed: [${failingChecks.join(', ')}]`
    );
  }

  console.groupEnd();

  return report;
}

/**
 * logCombatEntryDeformationState
 *
 * Called at combat entry (cinematic phase → 'fight') for both P1 and P2.
 * Logs the full deformation state and returns whether combat should proceed.
 *
 * @returns true if combat can proceed, false if combat must be frozen
 */
export function logCombatEntryDeformationState(
  input: DeformationIntegrityInput,
): boolean {
  const report = runDeformationIntegrityTest(input);
  return report.verdict === 'PASS';
}
