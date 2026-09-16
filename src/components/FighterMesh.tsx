'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { DEFAULT_PSX_RENDER } from '../render/psx';
import { BoneHitboxSystem } from '../engine/locomotion/BoneHitboxSystem';
import { AutoRigDetector, type RigDiagnosticReport } from '../engine/locomotion/AutoRigDetector';
import { ATTACK_ROOT_MOTION_PROFILES } from '../engine/locomotion/LocomotionSystem';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
export interface FighterMeshProps {
  /** FighterStateMachine motion state key — drives animation playback */
  state: string;
  /** Optional explicit animation override (takes priority over state) */
  animation?: string;
  /** GLB URL — null renders nothing */
  modelUrl: string | null;
  /** World-space position — set by parent screen, never hardcoded here */
  position: [number, number, number];
  /** Facing direction — used only for hitbox offset math, NOT for rotation */
  facing: 1 | -1;
  /**
   * World-space Y rotation — set by parent screen.
   * CharacterSelect: 0 for both (face camera)
   * CombatArena3D:   P1=0, P2=Math.PI
   * FighterMesh itself is COMPLETELY DUMB about rotation — it just applies what it receives.
   */
  rotationY?: number;
  tint?: string;
  showHitbox?: boolean;
  hitboxGeometry?: { offsetX: number; offsetZ: number; width: number; depth: number } | null;
  /**
   * Monotonically-increasing counter — forces re-trigger even when animation key
   * string hasn't changed (e.g. two consecutive lightAttacks).
   */
  animationTrigger?: number;
  /**
   * Current locomotion velocity from FighterStateMachine.getWalkVelocity().
   * Used for velocity-weighted blend gating to prevent jitter on micro-inputs.
   */
  locomotionVelocity?: { forward: number; strafe: number };
  /**
   * Hit-stop freeze: when true, the animation mixer is paused.
   * Set by GameBattleArena when a heavy attack lands.
   */
  hitStopActive?: boolean;
  /**
   * Callback fired once the rig diagnostic report is ready.
   * Used by DebugOverlayHUD to show rig quality.
   */
  onRigDiagnostic?: (report: RigDiagnosticReport) => void;
  /**
   * Callback fired each frame with the bone hitbox system reference.
   * Used by GameBattleArena for bone-parented collision checks.
   */
  onBoneHitboxReady?: (system: BoneHitboxSystem) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Animation alias table — maps FighterStateMachine states → GLB clip names
// ─────────────────────────────────────────────────────────────────────────────
const ANIMATION_ALIASES: Record<string, string[]> = {
  idle:              ['idle', 'Idle', 'neutral', 'Neutral', 'standing', 'Standing', 'bind', 'T-pose', 'TPose', 'tpose', 'rest', 'Rest'],
  Neutral:           ['idle', 'Idle', 'neutral', 'Neutral', 'standing', 'Standing'],
  walk:              ['walk', 'Walk', 'walking', 'Walking', 'run', 'Run'],
  Walking:           ['walk', 'Walk', 'walking', 'Walking', 'run', 'Run'],
  walkForward:       ['walkForward', 'WalkForward', 'walk', 'Walk', 'walking', 'Walking', 'forward', 'Forward', 'run', 'Run'],
  walkBackward:      ['walkBack', 'WalkBack', 'walkBackward', 'WalkBackward', 'walk', 'Walk', 'backward', 'Backward'],
  strafeLeft:        ['strafeLeft', 'StrafeLeft', 'walk', 'Walk'],
  strafeRight:       ['strafeRight', 'StrafeRight', 'walk', 'Walk'],
  // Backdash maps to walkBackward clip — fastest available retreat animation
  Backdashing:       ['backdash', 'Backdash', 'backDash', 'BackDash', 'walkBack', 'WalkBack', 'walkBackward', 'WalkBackward', 'walk', 'Walk'],
  light:             ['light', 'Light', 'punch', 'Punch', 'attack', 'Attack', 'jab', 'Jab', 'lightAttack', 'LightAttack'],
  lightAttack:       ['lightAttack', 'LightAttack', 'light', 'Light', 'punch', 'Punch', 'jab', 'Jab', 'attack', 'Attack', 'hit', 'Hit', 'strike', 'Strike'],
  heavy:             ['heavy', 'Heavy', 'strong', 'Strong', 'heavyAttack', 'HeavyAttack', 'cross', 'Cross'],
  heavyAttack:       ['heavyAttack', 'HeavyAttack', 'heavy', 'Heavy', 'strong', 'Strong', 'cross', 'Cross', 'kick', 'Kick', 'attack', 'Attack', 'strike', 'Strike'],
  guard:             ['guard', 'Guard', 'block', 'Block', 'defend', 'Defend'],
  block:             ['block', 'Block', 'guard', 'Guard'],
  Blockstun:         ['block', 'Block', 'guard', 'Guard'],
  hit:               ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'hitstun', 'Hitstun', 'damage', 'Damage', 'react', 'React'],
  Hitstun:           ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'damage', 'Damage'],
  HitStun:           ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'damage', 'Damage'],
  Stunned:           ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'damage', 'Damage'],
  knockdown:         ['knockdown', 'Knockdown', 'ko', 'KO', 'knockout', 'Knockout', 'death', 'Death', 'fall', 'Fall', 'down', 'Down'],
  Knockdown:         ['knockdown', 'Knockdown', 'ko', 'KO', 'fall', 'Fall', 'down', 'Down'],
  ko:                ['ko', 'KO', 'knockout', 'Knockout', 'death', 'Death', 'fall', 'Fall', 'knockdown', 'Knockdown'],
  KO:                ['ko', 'KO', 'knockout', 'Knockout', 'death', 'Death', 'fall', 'Fall', 'knockdown', 'Knockdown'],
  Crumple:           ['ko', 'KO', 'knockdown', 'Knockdown', 'fall', 'Fall', 'death', 'Death'],
  Startup:           ['lightAttack', 'LightAttack', 'attack', 'Attack', 'punch', 'Punch', 'jab', 'Jab'],
  Active:            ['lightAttack', 'LightAttack', 'attack', 'Attack', 'punch', 'Punch', 'kick', 'Kick'],
  // Wakeup states — map to available locomotion clips
  WakeupTechRoll:    ['techRoll', 'TechRoll', 'roll', 'Roll', 'walkForward', 'WalkForward', 'walk', 'Walk'],
  WakeupBackrise:    ['backrise', 'Backrise', 'getUp', 'GetUp', 'walkBackward', 'WalkBackward', 'walk', 'Walk'],
  WakeupQuickStand:  ['quickStand', 'QuickStand', 'getUp', 'GetUp', 'idle', 'Idle', 'standing', 'Standing'],
  // Guard state
  Guard:             ['guard', 'Guard', 'block', 'Block', 'defend', 'Defend'],
  // CommandThrow / ThrowWhiff
  CommandThrow:      ['heavyAttack', 'HeavyAttack', 'heavy', 'Heavy', 'grab', 'Grab', 'throw', 'Throw'],
  ThrowWhiff:        ['idle', 'Idle', 'neutral', 'Neutral'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Crossfade durations per state key (in seconds)
// Frame counts at 60fps: 6f=0.100s, 4f=0.067s, 3f=0.050s, 2f=0.033s
// ─────────────────────────────────────────────────────────────────────────────
const FADE_DURATIONS: Record<string, number> = {
  // Locomotion — gentle blends
  idle:              0.100,  // 6 frames
  Neutral:           0.100,
  walk:              0.100,
  walkForward:       0.100,
  walkBackward:      0.100,
  Walking:           0.100,
  strafeLeft:        0.100,
  strafeRight:       0.100,
  // Backdash — slightly faster snap (4 frames)
  Backdashing:       0.067,
  // Wakeup
  WakeupTechRoll:    0.083,
  WakeupBackrise:    0.083,
  WakeupQuickStand:  0.067,
  // Attacks — fast snaps
  light:             0.050,
  lightAttack:       0.050,
  Startup:           0.050,
  Active:            0.033,
  heavy:             0.067,
  heavyAttack:       0.067,
  CommandThrow:      0.067,
  // Hit reactions — very fast
  hit:               0.033,
  Hitstun:           0.033,
  HitStun:           0.033,
  Stunned:           0.033,
  // Knockdown
  knockdown:         0.067,
  Knockdown:         0.067,
  ko:                0.067,
  KO:                0.067,
  Crumple:           0.067,
  // Guard
  guard:             0.083,
  Guard:             0.083,
  block:             0.083,
  Blockstun:         0.083,
  // Throw whiff
  ThrowWhiff:        0.083,
};
const DEFAULT_FADE = 0.083;

// ─────────────────────────────────────────────────────────────────────────────
// States that loop continuously
// ─────────────────────────────────────────────────────────────────────────────
const LOOP_STATES = new Set([
  'idle', 'Neutral', 'walk', 'walkForward', 'walkBackward', 'Walking',
  'strafeLeft', 'strafeRight', 'guard', 'Guard', 'block', 'Blockstun',
  'Knockdown', 'WakeupTechRoll', 'WakeupBackrise', 'WakeupQuickStand',
  'Backdashing',
]);

const ATTACK_STATES = new Set(['lightAttack', 'heavyAttack', 'light', 'heavy', 'Startup', 'Active', 'CommandThrow']);

// ─────────────────────────────────────────────────────────────────────────────
// Velocity threshold — below this magnitude, don't trigger walk animation
// Prevents jitter from micro-inputs that don't reach full walk speed
// ─────────────────────────────────────────────────────────────────────────────
const VELOCITY_ANIM_THRESHOLD = 0.12;

/**
 * Minimum time (seconds) a crossfade must be held before another can begin.
 * Prevents rapid state oscillation (walk→idle→walk in <3 frames) from
 * stacking crossfades and causing visual jitter.
 */
const MIN_CROSSFADE_HOLD_S = 0.05; // 3 frames at 60fps

// ─────────────────────────────────────────────────────────────────────────────
// AGENT LAW: Forward-direction detection
// Many GLBs are exported from Blender with +Z as forward (Blender default).
// Three.js / glTF standard is -Z forward. When a model faces +Z it appears
// 180° wrong in the arena. We detect this by sampling the bounding box:
// if the model's geometry centroid is behind the origin in Z after normalization,
// the model was exported facing +Z and needs a 180° Y correction.
// This is applied INSIDE the normalized scene group so it never affects the
// outer group's rotationY (which is set by the parent for P1/P2 orientation).
// ─────────────────────────────────────────────────────────────────────────────
function detectForwardCorrection(scene: THREE.Object3D): number {
  // Collect all skinned mesh / mesh positions to find the "face" direction.
  // Strategy: find the nose/head area. If the model has a head bone, use it.
  // Otherwise, use the bounding box centroid Z vs the hips Z.
  // If head centroid Z > hips centroid Z, model faces +Z → needs 180° correction.
  const allBones: THREE.Bone[] = [];
  scene.traverse((child) => {
    if ((child as THREE.Bone).isBone) allBones.push(child as THREE.Bone);
  });

  if (allBones.length === 0) return 0;

  // Find head bone
  const headBone = allBones.find(b => {
    const n = b.name.toLowerCase();
    return n.includes('head') && !n.includes('headtop') && !n.includes('headend');
  });
  // Find hips bone
  const hipsBone = allBones.find(b => {
    const n = b.name.toLowerCase();
    return n.includes('hip') || n.includes('pelvis') || n.includes('root') || n === 'hips';
  });

  if (!headBone || !hipsBone) return 0;

  const headPos = new THREE.Vector3();
  const hipsPos = new THREE.Vector3();
  headBone.getWorldPosition(headPos);
  hipsBone.getWorldPosition(hipsPos);

  // If head is in front of hips in +Z direction, model faces +Z → needs 180° flip
  // glTF standard: character should face -Z (toward camera at Z+)
  // Threshold: only correct if difference is significant (> 0.05 units)
  if (headPos.z - hipsPos.z > 0.05) {
    console.log(`[FighterMesh] 🔄 Forward correction: head.z=${headPos.z.toFixed(3)} > hips.z=${hipsPos.z.toFixed(3)} → applying 180° Y rotation`);
    return Math.PI;
  }

  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolve the best matching clip name from available actions
// ─────────────────────────────────────────────────────────────────────────────
function resolveClipName(key: string, availableClips: string[]): string | null {
  const aliases = ANIMATION_ALIASES[key] ?? [key];

  // 1. Exact alias match (case-insensitive)
  let found = availableClips.find(c =>
    aliases.some(a => c.toLowerCase() === a.toLowerCase())
  );
  if (found) return found;

  // 2. Partial substring match on key
  found = availableClips.find(c => c.toLowerCase().includes(key.toLowerCase()));
  if (found) return found;

  // 3. Attack fallback — any clip with attack/punch/kick/strike/jab/cross
  if (ATTACK_STATES.has(key)) {
    found = availableClips.find(c => {
      const lc = c.toLowerCase();
      return lc.includes('attack') || lc.includes('punch') || lc.includes('kick') ||
             lc.includes('hit') || lc.includes('strike') || lc.includes('jab') || lc.includes('cross');
    });
    if (found) return found;
  }

  // 4. Walk/movement fallback
  if (key.startsWith('walk') || key.startsWith('strafe') || key === 'Walking' || key === 'Backdashing') {
    found = availableClips.find(c => {
      const lc = c.toLowerCase();
      return lc.includes('walk') || lc.includes('run') || lc.includes('move') || lc.includes('forward');
    });
    if (found) return found;
  }

  // 5. Hit/stun fallback
  if (key === 'hit' || key === 'Hitstun' || key === 'HitStun' || key === 'Stunned') {
    found = availableClips.find(c => {
      const lc = c.toLowerCase();
      return lc.includes('hit') || lc.includes('hurt') || lc.includes('flinch') || lc.includes('damage');
    });
    if (found) return found;
  }

  // 6. KO/knockdown fallback
  if (key === 'ko' || key === 'KO' || key === 'knockdown' || key === 'Knockdown' || key === 'Crumple') {
    found = availableClips.find(c => {
      const lc = c.toLowerCase();
      return lc.includes('ko') || lc.includes('fall') || lc.includes('down') || lc.includes('death') || lc.includes('knockdown');
    });
    if (found) return found;
  }

  // 7. Wakeup fallback → walk or idle
  if (key.startsWith('Wakeup')) {
    found = availableClips.find(c => c.toLowerCase().includes('walk'));
    if (found) return found;
  }

  // 8. Idle fallback → first available clip
  found = availableClips.find(c => c.toLowerCase().includes('idle'));
  if (found) return found;

  return availableClips[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalized scene result
// ─────────────────────────────────────────────────────────────────────────────
interface NormalizedResult {
  scene: THREE.Group;
  /** Y rotation to apply to the inner scene to correct forward direction */
  forwardCorrectionY: number;
  /** AnimationMixer bound to the normalized scene's actual bones */
  mixer: THREE.AnimationMixer;
  /** Actions map: clip name → AnimationAction */
  actions: Record<string, THREE.AnimationAction>;
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT LAW: Universal GLB normalization
//
// ALL characters use the same normalization pipeline:
//   1. Clone scene (deep clone preserves skinning)
//   2. Normalize root bone to floor if needed
//   3. Scale to TARGET_HEIGHT via Box3
//   4. Offset so bounding box bottom sits at Y=0 (floor)
//   5. Reset root scene rotation to 0 (NOT child rotations)
//   6. Detect forward direction — apply inner correction if model faces +Z
//   7. Create AnimationMixer on the CLONED scene (not the outer group)
//      so clips drive the actual visible mesh bones
//   8. Retarget animation clips from original scene to cloned scene
//
// NEVER use per-character manual Y offsets.
// NEVER hardcode rotation corrections per character.
// NEVER bind the mixer to the outer group — it must target the cloned scene.
// ─────────────────────────────────────────────────────────────────────────────
function normalizeGLB(
  scene: THREE.Group,
  animations: THREE.AnimationClip[],
  gltfUrl: string,
  report: RigDiagnosticReport,
): NormalizedResult {
  const cloned = scene.clone(true);

  // Step 1: Normalize root bone to floor BEFORE Box3 (fixes skeleton-offset models)
  if (!report.hasRootAtFloor) {
    AutoRigDetector.normalizeRootToFloor(cloned);
  }

  // Step 2: Compute bounding box on raw clone
  cloned.updateMatrixWorld(true);
  const rawBox = new THREE.Box3().setFromObject(cloned);
  const rawSize = rawBox.getSize(new THREE.Vector3());

  // Step 3: Scale uniformly so total Y height = 1.85 units
  const TARGET_HEIGHT = 1.85;
  const scale = rawSize.y > 0.01 ? TARGET_HEIGHT / rawSize.y : 1;
  cloned.scale.setScalar(scale);

  // Step 4: Recompute box AFTER scaling
  cloned.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(cloned);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

  // Step 5: Offset so bottom of bounding box sits exactly at Y=0
  // CRITICAL: use scaledBox.min.y so ALL characters stand on the floor
  // regardless of where their geometry origin is.
  cloned.position.set(
    -scaledCenter.x,
    -scaledBox.min.y,
    -scaledCenter.z,
  );

  // Step 6: Reset ONLY the root scene rotation (not children)
  // Resetting children breaks models with non-zero root bone orientations.
  cloned.rotation.set(0, 0, 0);

  // Step 7: Force matrix world update so bone world positions are accurate
  cloned.updateMatrixWorld(true);

  // Step 8: Detect forward direction AFTER normalization
  // This must happen after position/scale are set so world positions are correct.
  const forwardCorrectionY = detectForwardCorrection(cloned);

  // Step 9: Apply PSX vertex snapping to visible meshes
  cloned.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((mat) => {
      const m = mat as THREE.MeshStandardMaterial;
      if (m.map) {
        m.map.minFilter = THREE.NearestFilter;
        m.map.magFilter = THREE.NearestFilter;
        m.map.generateMipmaps = false;
        m.needsUpdate = true;
      }
      m.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <project_vertex>',
          `vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
           vec4 clipPosition = projectionMatrix * mvPosition;
           float snapRes = ${DEFAULT_PSX_RENDER.renderWidth.toFixed(1)};
           vec2 ndc = clipPosition.xy / clipPosition.w;
           ndc = floor(ndc * snapRes + 0.5) / snapRes;
           clipPosition.xy = ndc * clipPosition.w;
           gl_Position = clipPosition;`
        );
      };
    });
  });

  // Step 10: AGENT LAW — Create AnimationMixer on the CLONED scene.
  // This is the critical fix for "animations play on invisible skeleton":
  // The mixer MUST target the same object that is rendered (the cloned scene),
  // not the outer Three.js group. When the mixer targets the outer group but
  // the cloned scene is added as a child, bone transforms from the mixer
  // apply to the original (invisible) scene's skeleton, not the visible clone.
  const mixer = new THREE.AnimationMixer(cloned);

  // Step 11: Retarget animation clips from original scene to cloned scene.
  // Build a name→uuid map for the cloned scene's objects.
  const cloneMap = new Map<string, THREE.Object3D>();
  cloned.traverse((obj) => {
    if (obj.name) cloneMap.set(obj.name, obj);
  });

  const actions: Record<string, THREE.AnimationAction> = {};

  for (const clip of animations) {
    // Retarget: remap track names to cloned scene objects
    const retargetedTracks: THREE.KeyframeTrack[] = [];
    for (const track of clip.tracks) {
      const dotIdx = track.name.indexOf('.');
      if (dotIdx === -1) {
        retargetedTracks.push(track.clone());
        continue;
      }
      const boneName = track.name.slice(0, dotIdx);
      const property = track.name.slice(dotIdx);
      const targetObj = cloneMap.get(boneName);
      if (targetObj) {
        const newTrack = track.clone();
        // Use UUID-based binding so mixer targets the cloned bone directly
        newTrack.name = `${targetObj.uuid}${property}`;
        retargetedTracks.push(newTrack);
      } else {
        // Bone not found in clone — keep original name (mixer will try to resolve)
        retargetedTracks.push(track.clone());
      }
    }

    const retargetedClip = new THREE.AnimationClip(clip.name, clip.duration, retargetedTracks);
    const action = mixer.clipAction(retargetedClip);
    actions[clip.name] = action;
  }

  console.log(
    `[FighterMesh] ✅ Normalized "${gltfUrl.split('/').pop()}" — ` +
    `rigQuality=${report.quality} convention=${report.convention} ` +
    `bones=${report.totalBones} rootAtFloor=${report.hasRootAtFloor} ` +
    `forwardCorrection=${(forwardCorrectionY * 180 / Math.PI).toFixed(0)}° ` +
    `clips=[${animations.map(a => a.name).join(', ')}]`
  );

  return { scene: cloned, forwardCorrectionY, mixer, actions };
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner component — loaded inside Suspense, receives the GLTF scene + animations
// ─────────────────────────────────────────────────────────────────────────────
function FighterMeshInner({
  gltfUrl,
  state,
  animation,
  position,
  facing,
  rotationY = 0,
  tint,
  showHitbox = false,
  hitboxGeometry = null,
  animationTrigger = 0,
  locomotionVelocity,
  hitStopActive = false,
  onRigDiagnostic,
  onBoneHitboxReady,
}: {
  gltfUrl: string;
  state: string;
  animation?: string;
  position: [number, number, number];
  facing: 1 | -1;
  rotationY?: number;
  tint?: string;
  showHitbox?: boolean;
  hitboxGeometry?: FighterMeshProps['hitboxGeometry'];
  animationTrigger?: number;
  locomotionVelocity?: { forward: number; strafe: number };
  hitStopActive?: boolean;
  onRigDiagnostic?: (report: RigDiagnosticReport) => void;
  onBoneHitboxReady?: (system: BoneHitboxSystem) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [normalized, setNormalized] = useState<NormalizedResult | null>(null);

  // ── Jitter-prevention refs ────────────────────────────────────────────────
  /** The clip name that is currently playing (or crossfading to) */
  const activeClipRef = useRef<string | null>(null);
  /** Timestamp of the last crossfade start — enforces MIN_CROSSFADE_HOLD_S */
  const lastCrossfadeTimeRef = useRef<number>(0);
  /** The resolved clip name of the last state we committed to */
  const committedClipRef = useRef<string | null>(null);

  // ── Bone hitbox system ────────────────────────────────────────────────────
  const boneHitboxRef = useRef<BoneHitboxSystem>(new BoneHitboxSystem());

  // ── Active attack key for root motion ────────────────────────────────────
  const activeAttackKeyRef = useRef<string | null>(null);

  // useGLTF caches the result — safe to call per-fighter
  const { scene, animations } = useGLTF(gltfUrl);

  // ── Universal normalization + mixer creation ──────────────────────────────
  useEffect(() => {
    if (!scene) return;

    // Run rig diagnostic on the original scene
    const report = AutoRigDetector.analyze(scene, animations);
    onRigDiagnostic?.(report);

    // Normalize and create mixer bound to the cloned visible scene
    const result = normalizeGLB(scene as THREE.Group, animations, gltfUrl, report);

    // Initialize bone hitbox system from the normalized scene
    result.scene.updateMatrixWorld(true);
    boneHitboxRef.current.initFromSkeleton(result.scene);
    onBoneHitboxReady?.(boneHitboxRef.current);

    setNormalized(result);

    // Cleanup: stop all actions when model changes
    return () => {
      result.mixer.stopAllAction();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, gltfUrl]);

  // ── Bind FighterStateMachine state → AnimationMixer playback ─────────────
  useEffect(() => {
    if (!normalized) return;
    const { actions, mixer } = normalized;

    const availableClips = Object.keys(actions);
    if (availableClips.length === 0) {
      console.warn(`[FighterMesh] ⚠️ No animation clips available for "${gltfUrl.split('/').pop()}"`);
      return;
    }

    // Resolve the target animation key
    const inputKey = animation ?? state;
    const clipName = resolveClipName(inputKey, availableClips);

    // ── VELOCITY GATE: suppress locomotion transitions for micro-inputs ──────
    // If the state is a locomotion state and velocity is below threshold,
    // don't trigger a new crossfade — let the current clip finish blending.
    const isLocomotionState = ['walkForward', 'walkBackward', 'strafeLeft', 'strafeRight', 'Walking', 'walk'].includes(inputKey);
    if (isLocomotionState && locomotionVelocity) {
      const velMag = Math.sqrt(
        locomotionVelocity.forward * locomotionVelocity.forward +
        locomotionVelocity.strafe * locomotionVelocity.strafe
      );
      if (velMag < VELOCITY_ANIM_THRESHOLD) {
        // Velocity too low — don't commit to walk animation yet, stay on current
        return;
      }
    }

    // ── Root motion: activate for attacks with forward displacement ──────────
    const isAttack = ATTACK_STATES.has(inputKey);
    if (isAttack) {
      const profile = ATTACK_ROOT_MOTION_PROFILES[inputKey];
      if (profile?.hasRootMotion) {
        activeAttackKeyRef.current = inputKey;
        // Activate bone hitboxes for this attack
        boneHitboxRef.current.activateAttack(inputKey);
      } else {
        activeAttackKeyRef.current = null;
      }
    } else {
      // Non-attack state: deactivate hitboxes
      if (activeAttackKeyRef.current) {
        boneHitboxRef.current.deactivateAll();
        activeAttackKeyRef.current = null;
      }
    }

    // ── CONSOLE TRACE: input → state → clip ──────────────────────────────────
    console.log(
      `[FighterMesh] 🎬 input="${inputKey}" → clip="${clipName ?? 'NONE'}" ` +
      `(trigger=${animationTrigger}) vel={fwd=${locomotionVelocity?.forward?.toFixed(2) ?? '?'},str=${locomotionVelocity?.strafe?.toFixed(2) ?? '?'}}`
    );

    if (!clipName || !actions[clipName]) {
      console.warn(`[FighterMesh] ⚠️ No matching clip for state="${state}" animation="${animation}" on "${gltfUrl.split('/').pop()}"`);
      return;
    }

    const nextAction = actions[clipName];
    const fadeDuration = FADE_DURATIONS[inputKey] ?? DEFAULT_FADE;
    const isLoop = LOOP_STATES.has(inputKey);
    // isAttack already declared above

    // Find currently playing action
    const currentAction = availableClips
      .map(k => actions[k])
      .find(a => a?.isRunning());

    const isSameClip = clipName === committedClipRef.current;

    // For attack re-triggers (same clip, new trigger count) — restart from beginning
    if (isSameClip && isAttack && animationTrigger > 0) {
      console.log(`[FighterMesh] 🔁 Re-triggering attack clip "${clipName}" from start`);
      nextAction.stop();
      nextAction.reset();
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.play();
      activeClipRef.current = clipName;
      committedClipRef.current = clipName;
      lastCrossfadeTimeRef.current = performance.now() / 1000;
      return;
    }

    // ── HOLD GATE: prevent crossfade stacking within MIN_CROSSFADE_HOLD_S ────
    // Exception: attacks and hit reactions always fire immediately
    const isUrgent = isAttack || ['hit', 'Hitstun', 'HitStun', 'Stunned', 'knockdown', 'Knockdown', 'ko', 'KO', 'Crumple'].includes(inputKey);
    const now = performance.now() / 1000;
    const timeSinceLastCrossfade = now - lastCrossfadeTimeRef.current;

    if (!isUrgent && isSameClip) {
      // Already playing this clip — no action needed
      return;
    }

    if (!isUrgent && timeSinceLastCrossfade < MIN_CROSSFADE_HOLD_S) {
      // Too soon since last crossfade — skip to prevent jitter
      console.log(`[FighterMesh] ⏸ Crossfade suppressed (hold=${timeSinceLastCrossfade.toFixed(3)}s < ${MIN_CROSSFADE_HOLD_S}s) for "${clipName}"`);
      return;
    }

    // Configure the next action
    nextAction.setLoop(isLoop ? THREE.LoopRepeat : THREE.LoopOnce, isLoop ? Infinity : 1);
    nextAction.clampWhenFinished = !isLoop;
    nextAction.reset();
    nextAction.setEffectiveTimeScale(1);
    nextAction.setEffectiveWeight(1);

    if (currentAction && currentAction !== nextAction) {
      // Crossfade from current → next
      currentAction.crossFadeTo(nextAction, fadeDuration, true);
      nextAction.play();
      console.log(`[FighterMesh] ↔️ Crossfade "${currentAction.getClip().name}" → "${clipName}" (${(fadeDuration * 1000).toFixed(0)}ms / ${Math.round(fadeDuration * 60)}f)`);
    } else {
      nextAction.fadeIn(fadeDuration).play();
      console.log(`[FighterMesh] ▶️ FadeIn "${clipName}" (${(fadeDuration * 1000).toFixed(0)}ms)`);
    }

    activeClipRef.current = clipName;
    committedClipRef.current = clipName;
    lastCrossfadeTimeRef.current = now;
  }, [state, animation, animationTrigger, normalized, gltfUrl, locomotionVelocity]);

  // ── Auto-play idle on mount once scene is normalized ─────────────────────
  useEffect(() => {
    if (!normalized) return;
    const { actions } = normalized;
    const availableClips = Object.keys(actions);
    if (availableClips.length === 0) return;

    const idleClip = resolveClipName('idle', availableClips);
    if (idleClip && actions[idleClip]) {
      const idleAction = actions[idleClip];
      idleAction.setLoop(THREE.LoopRepeat, Infinity);
      idleAction.reset().play();
      activeClipRef.current = idleClip;
      committedClipRef.current = idleClip;
      lastCrossfadeTimeRef.current = performance.now() / 1000;
      console.log(`[FighterMesh] 🟢 Auto-play idle="${idleClip}" on mount for "${gltfUrl.split('/').pop()}"`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalized]);

  // ── Hit-stop: pause/resume mixer time scale ───────────────────────────────
  useEffect(() => {
    if (!normalized) return;
    const { mixer } = normalized;
    if (hitStopActive) {
      mixer.timeScale = 0;
    } else {
      mixer.timeScale = 1;
    }
  }, [hitStopActive, normalized]);

  // ── useFrame: position + rotation + mixer update + bone hitbox ───────────
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const attacking = state === 'Startup' || state === 'Active';
    const bob = (state === 'Neutral' || state === 'idle')
      ? Math.sin(performance.now() * 0.005) * 0.025
      : 0;

    // Position — driven entirely by props from parent screen
    groupRef.current.position.set(position[0], position[1] + bob, position[2]);

    // Rotation — driven entirely by rotationY prop from parent screen
    groupRef.current.rotation.y = rotationY;

    // Attack pulse — uniform scale, no mirroring
    const attackScale = attacking ? 1.03 : 1.0;
    groupRef.current.scale.set(attackScale, attackScale, attackScale);

    // AGENT LAW: Advance the mixer manually since we no longer use useAnimations.
    // The mixer is bound to the cloned scene, so this drives the actual visible mesh.
    if (!hitStopActive && normalized) {
      normalized.mixer.update(delta);
    }

    // Update bone hitbox system (tracks bone world positions)
    if (!hitStopActive) {
      boneHitboxRef.current.update(delta);
    }
  });

  if (!normalized) return null;

  const activeSpheres = boneHitboxRef.current.getActiveSpheres();

  return (
    <group ref={groupRef} position={position}>
      {/*
        AGENT LAW: The inner group applies the forward correction rotation.
        This is SEPARATE from the outer group's rotationY (P1/P2 orientation).
        forwardCorrectionY is 0 for correctly-exported models (Bannon, Maime).
        forwardCorrectionY is Math.PI for models exported facing +Z (most others).
        This is detected automatically — never hardcoded per character.
      */}
      <group rotation={[0, normalized.forwardCorrectionY, 0]}>
        <primitive object={normalized.scene} />
      </group>

      {/* Legacy AABB hitbox (shown when bone hitboxes are unavailable) */}
      {showHitbox && hitboxGeometry && activeSpheres.length === 0 && (
        <mesh
          position={[
            hitboxGeometry.offsetX * (facing < 0 ? -1 : 1),
            1.0,
            hitboxGeometry.offsetZ,
          ]}
        >
          <boxGeometry args={[hitboxGeometry.width, 1.6, hitboxGeometry.depth]} />
          <meshBasicMaterial color="#ff2222" wireframe transparent opacity={0.6} />
        </mesh>
      )}

      {/* Bone-parented hitbox spheres — rendered at bone world positions */}
      {showHitbox && activeSpheres.map((sphere, i) => (
        <mesh
          key={`bone-hitbox-${sphere.boneSlot}-${i}`}
          position={[
            sphere.worldCenter.x - position[0],
            sphere.worldCenter.y - position[1],
            sphere.worldCenter.z - position[2],
          ]}
        >
          <sphereGeometry args={[sphere.radius, 8, 8]} />
          <meshBasicMaterial
            color={sphere.attackLevel === 'high' ? '#ff4400' : sphere.attackLevel === 'low' ? '#ffaa00' : '#ff2222'}
            wireframe
            transparent
            opacity={0.7}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback placeholder while GLB loads
// ─────────────────────────────────────────────────────────────────────────────
function FighterPlaceholder({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.925, 0]}>
        <boxGeometry args={[0.5, 1.85, 0.3]} />
        <meshBasicMaterial color="#333333" wireframe />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public export — wraps inner component in Suspense
// ─────────────────────────────────────────────────────────────────────────────
export function FighterMesh({
  modelUrl,
  position,
  facing,
  rotationY = 0,
  state,
  animation,
  tint,
  showHitbox = false,
  hitboxGeometry = null,
  animationTrigger = 0,
  locomotionVelocity,
  hitStopActive = false,
  onRigDiagnostic,
  onBoneHitboxReady,
}: FighterMeshProps) {
  if (!modelUrl) return <FighterPlaceholder position={position} />;

  return (
    <Suspense fallback={<FighterPlaceholder position={position} />}>
      <FighterMeshInner
        gltfUrl={modelUrl}
        state={state}
        animation={animation}
        position={position}
        facing={facing}
        rotationY={rotationY}
        tint={tint}
        showHitbox={showHitbox}
        hitboxGeometry={hitboxGeometry}
        animationTrigger={animationTrigger}
        locomotionVelocity={locomotionVelocity}
        hitStopActive={hitStopActive}
        onRigDiagnostic={onRigDiagnostic}
        onBoneHitboxReady={onBoneHitboxReady}
      />
    </Suspense>
  );
}
