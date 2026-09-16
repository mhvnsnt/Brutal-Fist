/**
 * PreCombatRosterGate.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * AUTHORITATIVE pre-combat gate. Not a proxy / WARN deferred to AnimationTestArena.
 *
 * Measures:
 *   - preferred Bannon Euler motion-bank clips load + convert
 *   - semantic coverage (MISSING_CLIP stays MISSING_CLIP)
 *   - track counts / angular travel from conversion
 *   - GLB reachability for the selected fighter models (HEAD / URL)
 *
 * Full live SkinnedMesh deformation still requires a browser + loaded GLB;
 * this gate FAIL-CLOSES FIGHT when authored preferred clips are missing or
 * when roster GLB is unreachable. Procedural placeholders NEVER unlock FIGHT.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as THREE from 'three';
import { loadBannonClipsFromPublic } from '../retarget/BannonClipJsonAdapter';
import {
  PREFERRED_REQUIRED_SEMANTIC_STATES,
  PREFERRED_SEMANTIC_CLIP_FILES,
  BANNON_CLIP_CDN_BASE,
} from '../retarget/BannonMotionBankPreferred';
import { BANNON_GLB_PLAYABLE_MODELS } from '../../data/bannonGlbRoster';
import type { BannonFighterProfile } from '../../data/bannonRoster';

export type GateCheckStatus = 'PASS' | 'FAIL' | 'WARN' | 'PENDING';

export interface GateCheck {
  id: string;
  label: string;
  status: GateCheckStatus;
  value?: string | number;
  remediation?: string;
}

export interface FighterGateResult {
  fighterId: string;
  fighterName: string;
  glbFile: string;
  glbUrl: string | null;
  glbReachable: boolean;
  overallStatus: 'PASS' | 'BLOCKED' | 'WARN';
  checks: GateCheck[];
  remediationSteps: string[];
  /** Per-state verdicts for preferred semantic set */
  semanticVerdicts: Record<string, 'RETARGETED_AUTHORED_CLIP' | 'AUTHORED_CLIP' | 'PLACEHOLDER_TEST_CLIP' | 'MISSING_CLIP'>;
  clipsLoaded: number;
  clipsConverted: number;
  totalTracks: number;
  totalAngularTravel: number;
  missingStates: string[];
}

export interface PreCombatRosterGateReport {
  timestamp: string;
  source: string;
  indexSizeHint: number;
  clipsLoaded: number;
  clipsConverted: number;
  unresolvedPreferredStates: string[];
  totalAngularTravel: number;
  totalTracks: number;
  p1: FighterGateResult;
  p2: FighterGateResult;
  fightAuthorized: boolean;
  remediationSteps: string[];
}

const BANNON_MODELS_CDN = 'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/models';

function resolveGlbUrl(fighter: BannonFighterProfile): { file: string; url: string | null } {
  const entry = BANNON_GLB_PLAYABLE_MODELS.find((e) => e.id === fighter.id);
  if (!entry) return { file: 'UNKNOWN.glb', url: null };
  if (entry.overrideUrl) return { file: entry.model, url: entry.overrideUrl };
  return { file: entry.model, url: `${BANNON_MODELS_CDN}/${entry.model}` };
}

async function resolveGlbUrlWithFallback(
  fighter: BannonFighterProfile,
): Promise<{ file: string; url: string | null; reachable: boolean }> {
  const entry = BANNON_GLB_PLAYABLE_MODELS.find((e) => e.id === fighter.id);
  if (!entry) return { file: 'UNKNOWN.glb', url: null, reachable: false };
  if (entry.overrideUrl) {
    const ok = await urlExists(entry.overrideUrl);
    return { file: entry.model, url: entry.overrideUrl, reachable: ok };
  }

  const candidates: Array<{ file: string; url: string }> = [
    { file: entry.model, url: `/models/${entry.model}` },
    { file: entry.model, url: `${BANNON_MODELS_CDN}/${entry.model}` },
  ];
  if (fighter.id === 'bannon') {
    candidates.push(
      { file: 'BANNON_rigged.glb', url: '/models/BANNON_rigged.glb' },
      { file: 'BANNON_rigged.glb', url: `${BANNON_MODELS_CDN}/BANNON_rigged.glb` },
    );
  }
  if (fighter.id === 'maime') {
    candidates.push(
      { file: 'MAIME_rigged.glb', url: '/models/MAIME_rigged.glb' },
      { file: 'MAIME_rigged.glb', url: `${BANNON_MODELS_CDN}/MAIME_rigged.glb` },
    );
  }

  for (const c of candidates) {
    if (await urlExists(c.url)) {
      return { file: c.file, url: c.url, reachable: true };
    }
  }
  return { file: entry.model, url: candidates[1]?.url ?? null, reachable: false };
}

async function urlExists(url: string): Promise<boolean> {
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (head.ok) return true;
    // Some CDNs reject HEAD — try GET range
    const get = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
    return get.ok || get.status === 206;
  } catch {
    return false;
  }
}

function classifyClip(clip: THREE.AnimationClip | undefined): FighterGateResult['semanticVerdicts'][string] {
  if (!clip) return 'MISSING_CLIP';
  const ud = (clip as unknown as { userData?: Record<string, unknown> }).userData ?? {};
  if (ud.isProcedural === true || ud.clipSourceType === 'PLACEHOLDER_TEST_CLIP') {
    return 'PLACEHOLDER_TEST_CLIP';
  }
  if (ud.clipSourceType === 'RETARGETED_AUTHORED_CLIP' || ud.format === 'BANNON_EULER_RX_RY_RZ') {
    return 'RETARGETED_AUTHORED_CLIP';
  }
  return 'AUTHORED_CLIP';
}

/**
 * Run the authoritative pre-combat roster gate for two fighters.
 */

interface GlbMeasure {
  scene: THREE.Object3D;
  boneCount: number;
  skinnedMeshCount: number;
}

async function measureGlbSkeleton(url: string): Promise<GlbMeasure | null> {
  try {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    const gltf = await new Promise<any>((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });
    const scene = gltf.scene as THREE.Object3D;
    let boneCount = 0;
    let skinnedMeshCount = 0;
    scene.traverse((obj) => {
      if ((obj as THREE.Bone).isBone) boneCount++;
      if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
        skinnedMeshCount++;
        const sm = obj as THREE.SkinnedMesh;
        if (sm.skeleton?.bones?.length) {
          boneCount = Math.max(boneCount, sm.skeleton.bones.length);
        }
      }
    });
    return { scene, boneCount, skinnedMeshCount };
  } catch (e: any) {
    console.warn(`[PreCombatRosterGate] GLB measure failed for ${url}: ${e?.message ?? e}`);
    return null;
  }
}

async function measureMixerBoneTravel(
  scene: THREE.Object3D,
  clips: Map<string, THREE.AnimationClip>,
): Promise<{ maxBoneTravelMetres: number; maxBoneRotationDegrees: number } | null> {
  try {
    const { bindClipTracksToTargetBones } = await import('../retarget/BannonEulerMotionAdapter');
    const mixer = new THREE.AnimationMixer(scene);
    const clip =
      clips.get('attack_1') ??
      clips.get('hit_reaction') ??
      clips.get('idle') ??
      [...clips.values()][0];
    if (!clip) return null;

    const bound = bindClipTracksToTargetBones(clip.clone(), scene);
    if (bound.boundTracks <= 0) {
      console.warn('[PreCombatRosterGate] 0 bound tracks — cannot measure travel');
      return { maxBoneTravelMetres: 0, maxBoneRotationDegrees: 0 };
    }

    const action = mixer.clipAction(bound.clip, scene);
    action.setLoop(THREE.LoopOnce, 1).reset().play();

    const bones: THREE.Bone[] = [];
    scene.traverse((o) => {
      if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone);
    });
    const before = bones.map((b) => ({
      bone: b,
      pos: b.getWorldPosition(new THREE.Vector3()).clone(),
      quat: b.getWorldQuaternion(new THREE.Quaternion()).clone(),
    }));

    // Advance ~10 frames
    for (let i = 0; i < 10; i++) mixer.update(1 / 30);
    scene.updateMatrixWorld(true);

    let maxTravel = 0;
    let maxRot = 0;
    for (const sample of before) {
      const pos = sample.bone.getWorldPosition(new THREE.Vector3());
      const quat = sample.bone.getWorldQuaternion(new THREE.Quaternion());
      maxTravel = Math.max(maxTravel, pos.distanceTo(sample.pos));
      const angle = sample.quat.angleTo(quat) * (180 / Math.PI);
      maxRot = Math.max(maxRot, angle);
    }

    action.stop();
    mixer.stopAllAction();
    return { maxBoneTravelMetres: maxTravel, maxBoneRotationDegrees: maxRot };
  } catch (e: any) {
    console.warn(`[PreCombatRosterGate] mixer travel measure failed: ${e?.message ?? e}`);
    return null;
  }
}

export async function runPreCombatRosterGate(
  p1Fighter: BannonFighterProfile,
  p2Fighter: BannonFighterProfile,
): Promise<PreCombatRosterGateReport> {
  const remediationSteps: string[] = [];

  // Load preferred motion bank through the same public path CharacterPipeline uses
  let clips = new Map<string, THREE.AnimationClip>();
  let loadError: string | null = null;
  try {
    clips = await loadBannonClipsFromPublic();
  } catch (e: any) {
    loadError = e?.message ?? String(e);
    remediationSteps.push(
      `Motion bank load failed: ${loadError}. Ensure network access to ${BANNON_CLIP_CDN_BASE} or mirror clips under public/assets/moves/clips/.`,
    );
  }

  const semanticVerdicts: FighterGateResult['semanticVerdicts'] = {} as FighterGateResult['semanticVerdicts'];
  let totalTracks = 0;
  let totalAngularTravel = 0;
  let clipsConverted = 0;
  const missingStates: string[] = [];

  for (const state of PREFERRED_REQUIRED_SEMANTIC_STATES) {
    const clip = clips.get(state);
    const verdict = classifyClip(clip);
    semanticVerdicts[state] = verdict;
    if (verdict === 'MISSING_CLIP' || verdict === 'PLACEHOLDER_TEST_CLIP') {
      missingStates.push(state);
    }
    if (clip) {
      clipsConverted++;
      totalTracks += clip.tracks.length;
      const ud = (clip as unknown as { userData?: Record<string, unknown> }).userData ?? {};
      if (typeof ud.totalAngularTravel === 'number') {
        totalAngularTravel += ud.totalAngularTravel;
      }
    }
  }

  const authoredOk =
    missingStates.length === 0 &&
    PREFERRED_REQUIRED_SEMANTIC_STATES.every((s) => {
      const v = semanticVerdicts[s];
      return v === 'AUTHORED_CLIP' || v === 'RETARGETED_AUTHORED_CLIP';
    });

  if (!authoredOk) {
    remediationSteps.push(
      `MISSING_CLIP / non-authored preferred states: [${missingStates.join(', ') || 'none'}]. ` +
      `Preferred map: ${JSON.stringify(PREFERRED_SEMANTIC_CLIP_FILES)}`,
    );
  }

  async function buildFighter(fighter: BannonFighterProfile): Promise<FighterGateResult> {
    const resolved = await resolveGlbUrlWithFallback(fighter);
    const file = resolved.file;
    const url = resolved.url;
    const glbReachable = resolved.reachable;
    const entry = BANNON_GLB_PLAYABLE_MODELS.find((e) => e.id === fighter.id);
    const checks: GateCheck[] = [];
    const fighterRemediation: string[] = [];

    checks.push({
      id: 'glb_registered',
      label: 'GLB Asset Registered',
      status: entry ? 'PASS' : 'FAIL',
      value: file,
      remediation: entry ? undefined : `Register ${fighter.id} in bannonGlbRoster.ts`,
    });
    if (!entry) fighterRemediation.push(`Register ${fighter.id} in bannonGlbRoster.ts`);

    checks.push({
      id: 'glb_reachable',
      label: 'GLB Reachable (CDN/local)',
      status: glbReachable ? 'PASS' : 'FAIL',
      value: url ?? 'NONE',
      remediation: glbReachable
        ? undefined
        : `GLB not reachable at ${url ?? 'n/a'}. Init BannonSource submodule or mirror models under public/models/.`,
    });
    if (!glbReachable) {
      fighterRemediation.push(
        `Fetch ${file} from Bannon assets/models/ (submodule BannonSource empty on this clone).`,
      );
    }

    const rigStatus = entry?.rigStatus ?? 'unknown';
    const hasSkinnedHint = rigStatus === 'skinned' || rigStatus === 'named-part';
    checks.push({
      id: 'skeleton_hint',
      label: 'Skeleton / SkinnedMesh roster hint',
      status: hasSkinnedHint ? 'PASS' : 'FAIL',
      value: rigStatus,
      remediation: hasSkinnedHint
        ? undefined
        : `Roster rigStatus=${rigStatus}. Need skinned *_rigged_ready.glb / BANNON_rigged.glb.`,
    });
    if (!hasSkinnedHint) {
      fighterRemediation.push(`Upgrade ${file} to skinned rigged_ready GLB.`);
    }

    checks.push({
      id: 'animation_clips',
      label: 'Preferred motion-bank clips > 0',
      status: clipsConverted > 0 ? 'PASS' : 'FAIL',
      value: `${clipsConverted}/${PREFERRED_REQUIRED_SEMANTIC_STATES.length} converted`,
      remediation:
        clipsConverted > 0
          ? undefined
          : `loadBannonClipsFromPublic() returned 0 clips. Check CDN ${BANNON_CLIP_CDN_BASE} or local mirror.`,
    });

    checks.push({
      id: 'no_missing_clips',
      label: 'No MISSING_CLIP for required semantic states',
      status: authoredOk ? 'PASS' : 'FAIL',
      value: authoredOk
        ? 'all preferred states AUTHORED/RETARGETED'
        : `MISSING/PLACEHOLDER: [${missingStates.join(', ')}]`,
      remediation: authoredOk
        ? undefined
        : `Fix preferred clip load/convert for: ${missingStates.join(', ')}`,
    });

    checks.push({
      id: 'track_travel',
      label: 'Converted tracks + angular travel',
      status: totalTracks > 0 && totalAngularTravel > 0 ? 'PASS' : 'FAIL',
      value: `tracks=${totalTracks}, travel=${totalAngularTravel.toFixed(2)} rad`,
      remediation:
        totalTracks > 0 && totalAngularTravel > 0
          ? undefined
          : 'Converted clips produced 0 tracks or 0 angular travel — Euler adapter did not ingest bank format.',
    });

    const glbMeasure = url ? await measureGlbSkeleton(url) : null;
    checks.push({
      id: 'skeleton_bones_measured',
      label: 'Skeleton bones > 0 (measured)',
      status: glbMeasure && glbMeasure.boneCount > 0 ? 'PASS' : 'FAIL',
      value: glbMeasure ? glbMeasure.boneCount : 'NOT_MEASURED',
      remediation:
        glbMeasure && glbMeasure.boneCount > 0
          ? undefined
          : `Could not measure bones from ${url ?? file}. Init BannonSource or mirror GLB.`,
    });
    checks.push({
      id: 'skinned_meshes_measured',
      label: 'Visible SkinnedMeshes > 0 (measured)',
      status: glbMeasure && glbMeasure.skinnedMeshCount > 0 ? 'PASS' : 'FAIL',
      value: glbMeasure ? glbMeasure.skinnedMeshCount : 'NOT_MEASURED',
      remediation:
        glbMeasure && glbMeasure.skinnedMeshCount > 0
          ? undefined
          : `No SkinnedMesh measured on ${file}.`,
    });

    let deformationStatus: GateCheckStatus = 'FAIL';
    let deformationValue: string | number = 'NOT_MEASURED';
    let deformationRemediation: string | undefined =
      'Browser mixer tick required for bone travel. Conversion PASS ≠ skinned PASS.';
    if (glbMeasure && glbMeasure.boneCount > 0 && clipsConverted > 0) {
      const travel = await measureMixerBoneTravel(glbMeasure.scene, clips);
      if (travel && (travel.maxBoneTravelMetres > 0 || travel.maxBoneRotationDegrees > 0.5)) {
        deformationStatus = 'PASS';
        deformationValue = `maxTravel=${travel.maxBoneTravelMetres.toFixed(4)}m rot=${travel.maxBoneRotationDegrees.toFixed(2)}deg`;
        deformationRemediation = undefined;
      } else {
        deformationValue = travel
          ? `maxTravel=${travel.maxBoneTravelMetres.toFixed(4)}m rot=${travel.maxBoneRotationDegrees.toFixed(2)}deg (insufficient)`
          : 'MIXER_MEASURE_FAILED';
        deformationRemediation =
          'Mixer update produced insufficient bone travel on target skeleton — tracks may not resolve.';
      }
    }
    checks.push({
      id: 'live_deformation',
      label: 'Measured bone travel / deformation',
      status: deformationStatus,
      value: deformationValue,
      remediation: deformationRemediation,
    });
    if (deformationStatus !== 'PASS') {
      fighterRemediation.push(
        'Live bone travel not PASS — FIGHT blocked until mixer drives measurable deformation on cloned skeleton.',
      );
    }
    if (!glbMeasure || glbMeasure.boneCount <= 0) {
      fighterRemediation.push(`Measure failed for GLB ${file}.`);
    }

    const hasFail = checks.some((c) => c.status === 'FAIL');
    const hasWarn = checks.some((c) => c.status === 'WARN');
    const overallStatus: FighterGateResult['overallStatus'] = hasFail
      ? 'BLOCKED'
      : hasWarn
        ? 'WARN'
        : 'PASS';

    return {
      fighterId: fighter.id,
      fighterName: fighter.name,
      glbFile: file,
      glbUrl: url,
      glbReachable,
      overallStatus,
      checks,
      remediationSteps: fighterRemediation,
      semanticVerdicts: { ...semanticVerdicts },
      clipsLoaded: clips.size,
      clipsConverted,
      totalTracks,
      totalAngularTravel,
      missingStates: [...missingStates],
    };
  }

  const p1 = await buildFighter(p1Fighter);
  const p2 = await buildFighter(p2Fighter);

  for (const step of p1.remediationSteps) remediationSteps.push(`P1: ${step}`);
  for (const step of p2.remediationSteps) remediationSteps.push(`P2: ${step}`);

  // AUTHORITATIVE: FIGHT only when both PASS. WARN/BLOCKED never unlock.
  const fightAuthorized = p1.overallStatus === 'PASS' && p2.overallStatus === 'PASS';

  const report: PreCombatRosterGateReport = {
    timestamp: new Date().toISOString(),
    source: BANNON_CLIP_CDN_BASE,
    indexSizeHint: Object.keys(PREFERRED_SEMANTIC_CLIP_FILES).length,
    clipsLoaded: clips.size,
    clipsConverted,
    unresolvedPreferredStates: missingStates,
    totalAngularTravel,
    totalTracks,
    p1,
    p2,
    fightAuthorized,
    remediationSteps,
  };

  console.log(
    `[PreCombatRosterGate] fightAuthorized=${fightAuthorized} ` +
      `converted=${clipsConverted}/${PREFERRED_REQUIRED_SEMANTIC_STATES.length} ` +
      `missing=[${missingStates.join(', ')}] tracks=${totalTracks} travel=${totalAngularTravel.toFixed(2)}`,
  );

  return report;
}
