'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { DEFAULT_PSX_RENDER } from '../render/psx';
import { BoneHitboxSystem } from '../engine/locomotion/BoneHitboxSystem';
import { AutoRigDetector, type RigDiagnosticReport } from '../engine/locomotion/AutoRigDetector';
import { ATTACK_ROOT_MOTION_PROFILES } from '../engine/locomotion/LocomotionSystem';

export interface FighterMeshProps {
  state: string;
  animation?: string;
  modelUrl: string | null;
  position: [number, number, number];
  facing: 1 | -1;
  rotationY?: number;
  tint?: string;
  showHitbox?: boolean;
  hitboxGeometry?: { offsetX: number; offsetZ: number; width: number; depth: number } | null;
  animationTrigger?: number;
  locomotionVelocity?: { forward: number; strafe: number };
  hitStopActive?: boolean;
  onRigDiagnostic?: (report: RigDiagnosticReport) => void;
  onBoneHitboxReady?: (system: BoneHitboxSystem) => void;
}

const ANIMATION_ALIASES: Record<string, string[]> = {
  idle: ['idle', 'Idle', 'neutral', 'Neutral', 'standing', 'Standing', 'bind', 'T-pose', 'TPose', 'tpose', 'rest', 'Rest'],
  Neutral: ['idle', 'Idle', 'neutral', 'Neutral', 'standing', 'Standing'],
  walk: ['walk', 'Walk', 'walking', 'Walking', 'run', 'Run'],
  Walking: ['walk', 'Walk', 'walking', 'Walking', 'run', 'Run'],
  walkForward: ['walkForward', 'WalkForward', 'walk', 'Walk', 'walking', 'Walking', 'forward', 'Forward', 'run', 'Run'],
  walkBackward: ['walkBack', 'WalkBack', 'walkBackward', 'WalkBackward', 'walk', 'Walk', 'backward', 'Backward'],
  strafeLeft: ['strafeLeft', 'StrafeLeft', 'walk', 'Walk'],
  strafeRight: ['strafeRight', 'StrafeRight', 'walk', 'Walk'],
  Backdashing: ['backdash', 'Backdash', 'backDash', 'BackDash', 'walkBack', 'WalkBack', 'walkBackward', 'WalkBackward', 'walk', 'Walk'],
  light: ['light', 'Light', 'punch', 'Punch', 'attack', 'Attack', 'jab', 'Jab', 'lightAttack', 'LightAttack'],
  lightAttack: ['lightAttack', 'LightAttack', 'light', 'Light', 'punch', 'Punch', 'jab', 'Jab', 'attack', 'Attack', 'hit', 'Hit', 'strike', 'Strike'],
  heavy: ['heavy', 'Heavy', 'strong', 'Strong', 'heavyAttack', 'HeavyAttack', 'cross', 'Cross'],
  heavyAttack: ['heavyAttack', 'HeavyAttack', 'heavy', 'Heavy', 'strong', 'Strong', 'cross', 'Cross', 'kick', 'Kick', 'attack', 'Attack', 'strike', 'Strike'],
  guard: ['guard', 'Guard', 'block', 'Block', 'defend', 'Defend'],
  block: ['block', 'Block', 'guard', 'Guard'],
  Blockstun: ['block', 'Block', 'guard', 'Guard'],
  hit: ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'hitstun', 'Hitstun', 'damage', 'Damage', 'react', 'React'],
  Hitstun: ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'damage', 'Damage'],
  HitStun: ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'damage', 'Damage'],
  Stunned: ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'damage', 'Damage'],
  knockdown: ['knockdown', 'Knockdown', 'ko', 'KO', 'knockout', 'Knockout', 'death', 'Death', 'fall', 'Fall', 'down', 'Down'],
  Knockdown: ['knockdown', 'Knockdown', 'ko', 'KO', 'fall', 'Fall', 'down', 'Down'],
  ko: ['ko', 'KO', 'knockout', 'Knockout', 'death', 'Death', 'fall', 'Fall', 'knockdown', 'Knockdown'],
  KO: ['ko', 'KO', 'knockout', 'Knockout', 'death', 'Death', 'fall', 'Fall', 'knockdown', 'Knockdown'],
  Crumple: ['ko', 'KO', 'knockdown', 'Knockdown', 'fall', 'Fall', 'death', 'Death'],
  Startup: ['lightAttack', 'LightAttack', 'attack', 'Attack', 'punch', 'Punch', 'jab', 'Jab'],
  Active: ['lightAttack', 'LightAttack', 'attack', 'Attack', 'punch', 'Punch', 'kick', 'Kick'],
  WakeupTechRoll: ['techRoll', 'TechRoll', 'roll', 'Roll', 'walkForward', 'WalkForward', 'walk', 'Walk'],
  WakeupBackrise: ['backrise', 'Backrise', 'getUp', 'GetUp', 'walkBackward', 'WalkBackward', 'walk', 'Walk'],
  WakeupQuickStand: ['quickStand', 'QuickStand', 'getUp', 'GetUp', 'idle', 'Idle', 'standing', 'Standing'],
  Guard: ['guard', 'Guard', 'block', 'Block', 'defend', 'Defend'],
  CommandThrow: ['heavyAttack', 'HeavyAttack', 'heavy', 'Heavy', 'grab', 'Grab', 'throw', 'Throw'],
  ThrowWhiff: ['idle', 'Idle', 'neutral', 'Neutral'],
};

const FADE_DURATIONS: Record<string, number> = {
  idle: 0.100, Neutral: 0.100, walk: 0.100, walkForward: 0.100, walkBackward: 0.100,
  Walking: 0.100, strafeLeft: 0.100, strafeRight: 0.100, Backdashing: 0.067,
  WakeupTechRoll: 0.083, WakeupBackrise: 0.083, WakeupQuickStand: 0.067,
  light: 0.050, lightAttack: 0.050, Startup: 0.050, Active: 0.033,
  heavy: 0.067, heavyAttack: 0.067, CommandThrow: 0.067,
  hit: 0.033, Hitstun: 0.033, HitStun: 0.033, Stunned: 0.033,
  knockdown: 0.067, Knockdown: 0.067, ko: 0.067, KO: 0.067, Crumple: 0.067,
  guard: 0.083, Guard: 0.083, block: 0.083, Blockstun: 0.083, ThrowWhiff: 0.083,
};
const DEFAULT_FADE = 0.083;
const LOOP_STATES = new Set(['idle', 'Neutral', 'walk', 'walkForward', 'walkBackward', 'Walking', 'strafeLeft', 'strafeRight', 'guard', 'Guard', 'block', 'Blockstun', 'Knockdown', 'WakeupTechRoll', 'WakeupBackrise', 'WakeupQuickStand', 'Backdashing']);
const ATTACK_STATES = new Set(['lightAttack', 'heavyAttack', 'light', 'heavy', 'Startup', 'Active', 'CommandThrow']);
const GROUNDED_STATES = new Set(['idle', 'Neutral', 'walk', 'walkForward', 'walkBackward', 'Walking', 'strafeLeft', 'strafeRight', 'guard', 'Guard', 'block', 'Blockstun', 'hit', 'Hitstun', 'HitStun', 'Stunned', 'Startup', 'Active', 'CommandThrow', 'ThrowWhiff', 'knockdown', 'Knockdown', 'ko', 'KO', 'Crumple']);
const VELOCITY_ANIM_THRESHOLD = 0.12;
const MIN_CROSSFADE_HOLD_S = 0.05;
const FLOOR_EPSILON = 0.008;

// Asset-level calibration, deliberately outside the bone/skeleton layer.
// Current measured cohort: canonical Bannon/Maime assets already face correctly;
// imported legacy/non-canonical assets currently arrive 180° inverted. This is
// an explicit temporary calibration rule, not a fighter-specific bone hack.
// Each model should move to an explicit measured manifest entry as QA confirms it.
function getAssetFacingCorrectionY(gltfUrl: string): number {
  const file = decodeURIComponent(gltfUrl.split('?')[0].split('/').pop() ?? '').toLowerCase();
  if (file.startsWith('bannon') || file.startsWith('maime')) return 0;
  return Math.PI;
}

function resolveClipName(key: string, availableClips: string[]): string | null {
  const aliases = ANIMATION_ALIASES[key] ?? [key];
  let found = availableClips.find(c => aliases.some(a => c.toLowerCase() === a.toLowerCase()));
  if (found) return found;
  found = availableClips.find(c => c.toLowerCase().includes(key.toLowerCase()));
  if (found) return found;
  if (ATTACK_STATES.has(key)) {
    found = availableClips.find(c => {
      const lc = c.toLowerCase();
      return lc.includes('attack') || lc.includes('punch') || lc.includes('kick') || lc.includes('hit') || lc.includes('strike') || lc.includes('jab') || lc.includes('cross');
    });
    if (found) return found;
  }
  if (key.startsWith('walk') || key.startsWith('strafe') || key === 'Walking' || key === 'Backdashing') {
    found = availableClips.find(c => {
      const lc = c.toLowerCase();
      return lc.includes('walk') || lc.includes('run') || lc.includes('move') || lc.includes('forward');
    });
    if (found) return found;
  }
  if (key === 'hit' || key === 'Hitstun' || key === 'HitStun' || key === 'Stunned') {
    found = availableClips.find(c => {
      const lc = c.toLowerCase();
      return lc.includes('hit') || lc.includes('hurt') || lc.includes('flinch') || lc.includes('damage');
    });
    if (found) return found;
  }
  if (key === 'ko' || key === 'KO' || key === 'knockdown' || key === 'Knockdown' || key === 'Crumple') {
    found = availableClips.find(c => {
      const lc = c.toLowerCase();
      return lc.includes('ko') || lc.includes('fall') || lc.includes('down') || lc.includes('death') || lc.includes('knockdown');
    });
    if (found) return found;
  }
  if (key.startsWith('Wakeup')) {
    found = availableClips.find(c => c.toLowerCase().includes('walk'));
    if (found) return found;
  }
  found = availableClips.find(c => c.toLowerCase().includes('idle'));
  return found ?? availableClips[0] ?? null;
}

function validateSkinnedBindings(root: THREE.Object3D, gltfUrl: string) {
  let skinnedMeshes = 0;
  let detachedBones = 0;
  const descendants = new Set<THREE.Object3D>();
  root.traverse(node => descendants.add(node));
  root.traverse(node => {
    const mesh = node as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    skinnedMeshes += 1;
    if (!mesh.skeleton || mesh.skeleton.bones.some(bone => !descendants.has(bone))) detachedBones += 1;
  });
  if (skinnedMeshes === 0) console.warn(`[FighterMesh] ⚠️ No SkinnedMesh found after clone for "${gltfUrl.split('/').pop()}"`);
  if (detachedBones > 0) console.error(`[FighterMesh] ❌ SkinnedMesh skeleton binding invalid for "${gltfUrl.split('/').pop()}" — detachedBones=${detachedBones}`);
  else if (skinnedMeshes > 0) console.log(`[FighterMesh] 🦴 Visible mesh binding verified — skinnedMeshes=${skinnedMeshes}, all bones belong to rendered clone`);
}

function enforceAnimatedFloorContact(scene: THREE.Object3D, state: string, gltfUrl: string) {
  if (!GROUNDED_STATES.has(state)) return;
  scene.updateMatrixWorld(true);
  const animatedBox = new THREE.Box3().setFromObject(scene);
  if (!Number.isFinite(animatedBox.min.y)) return;
  if (animatedBox.min.y < -FLOOR_EPSILON) {
    const lift = -animatedBox.min.y;
    scene.position.y += lift;
    scene.updateMatrixWorld(true);
    console.warn(`[FighterMesh] 🧱 Ground-lock lifted animated mesh by ${lift.toFixed(4)}u for "${gltfUrl.split('/').pop()}"`);
  }
}

function FighterMeshInner({
  gltfUrl, state, animation, position, facing, rotationY = 0, tint,
  showHitbox = false, hitboxGeometry = null, animationTrigger = 0,
  locomotionVelocity, hitStopActive = false, onRigDiagnostic, onBoneHitboxReady,
}: {
  gltfUrl: string; state: string; animation?: string; position: [number, number, number];
  facing: 1 | -1; rotationY?: number; tint?: string; showHitbox?: boolean;
  hitboxGeometry?: FighterMeshProps['hitboxGeometry']; animationTrigger?: number;
  locomotionVelocity?: { forward: number; strafe: number }; hitStopActive?: boolean;
  onRigDiagnostic?: (report: RigDiagnosticReport) => void;
  onBoneHitboxReady?: (system: BoneHitboxSystem) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const normalizedRef = useRef<THREE.Group | null>(null);
  const [normalizedScene, setNormalizedScene] = useState<THREE.Group | null>(null);
  const activeClipRef = useRef<string | null>(null);
  const lastCrossfadeTimeRef = useRef<number>(0);
  const committedClipRef = useRef<string | null>(null);
  const boneHitboxRef = useRef<BoneHitboxSystem>(new BoneHitboxSystem());
  const mixerTimeScaleRef = useRef<number>(1);
  const activeAttackKeyRef = useRef<string | null>(null);
  const { scene, animations } = useGLTF(gltfUrl);
  const { actions, mixer } = useAnimations(animations, groupRef);

  useEffect(() => {
    if (!scene) return;
    const cloned = SkeletonUtils.clone(scene) as THREE.Group;
    validateSkinnedBindings(cloned, gltfUrl);
    const report = AutoRigDetector.analyze(cloned, animations);
    onRigDiagnostic?.(report);
    if (!report.hasRootAtFloor) AutoRigDetector.normalizeRootToFloor(cloned);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const TARGET_HEIGHT = 1.85;
    const scale = size.y > 0.01 ? TARGET_HEIGHT / size.y : 1;
    cloned.scale.setScalar(scale);
    cloned.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(cloned);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
    cloned.position.set(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);
    cloned.rotation.set(0, 0, 0);
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
          shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
             vec4 clipPosition = projectionMatrix * mvPosition;
             float snapRes = ${DEFAULT_PSX_RENDER.renderWidth.toFixed(1)};
             vec2 ndc = clipPosition.xy / clipPosition.w;
             ndc = floor(ndc * snapRes + 0.5) / snapRes;
             clipPosition.xy = ndc * clipPosition.w;
             gl_Position = clipPosition;`);
        };
      });
    });
    cloned.updateMatrixWorld(true);
    boneHitboxRef.current.initFromSkeleton(cloned);
    onBoneHitboxReady?.(boneHitboxRef.current);
    normalizedRef.current = cloned;
    setNormalizedScene(cloned);
    console.log(`[FighterMesh] ✅ Normalized "${gltfUrl.split('/').pop()}" — rigQuality=${report.quality} convention=${report.convention} bones=${report.totalBones} rootAtFloor=${report.hasRootAtFloor} facingCorrectionY=${getAssetFacingCorrectionY(gltfUrl).toFixed(3)} clips=[${animations.map(a => a.name).join(', ')}]`);
  }, [scene, gltfUrl, animations]);

  useEffect(() => {
    if (!normalizedScene || !actions) return;
    const availableClips = Object.keys(actions);
    if (availableClips.length === 0) {
      console.warn(`[FighterMesh] ⚠️ No animation clips available for "${gltfUrl.split('/').pop()}"`);
      return;
    }
    const inputKey = animation ?? state;
    const clipName = resolveClipName(inputKey, availableClips);
    const isLocomotionState = ['walkForward', 'walkBackward', 'strafeLeft', 'strafeRight', 'Walking', 'walk'].includes(inputKey);
    if (isLocomotionState && locomotionVelocity) {
      const velMag = Math.sqrt(locomotionVelocity.forward * locomotionVelocity.forward + locomotionVelocity.strafe * locomotionVelocity.strafe);
      if (velMag < VELOCITY_ANIM_THRESHOLD) return;
    }
    const isAttack = ATTACK_STATES.has(inputKey);
    if (isAttack) {
      const profile = ATTACK_ROOT_MOTION_PROFILES[inputKey];
      if (profile?.hasRootMotion) {
        activeAttackKeyRef.current = inputKey;
        boneHitboxRef.current.activateAttack(inputKey);
      } else activeAttackKeyRef.current = null;
    } else if (activeAttackKeyRef.current) {
      boneHitboxRef.current.deactivateAll();
      activeAttackKeyRef.current = null;
    }
    console.log(`[FighterMesh] 🎬 input="${inputKey}" → clip="${clipName ?? 'NONE'}" (trigger=${animationTrigger}) vel={fwd=${locomotionVelocity?.forward?.toFixed(2) ?? '?'},str=${locomotionVelocity?.strafe?.toFixed(2) ?? '?'}}`);
    if (!clipName || !actions[clipName]) {
      console.warn(`[FighterMesh] ⚠️ No matching clip for state="${state}" animation="${animation}" on "${gltfUrl.split('/').pop()}"`);
      return;
    }
    const nextAction = actions[clipName];
    const fadeDuration = FADE_DURATIONS[inputKey] ?? DEFAULT_FADE;
    const isLoop = LOOP_STATES.has(inputKey);
    const currentAction = availableClips.map(k => actions[k]).find(a => a?.isRunning());
    const isSameClip = clipName === committedClipRef.current;
    if (isSameClip && isAttack && animationTrigger > 0) {
      nextAction.stop(); nextAction.reset(); nextAction.setLoop(THREE.LoopOnce, 1); nextAction.clampWhenFinished = true; nextAction.play();
      activeClipRef.current = clipName; committedClipRef.current = clipName; lastCrossfadeTimeRef.current = performance.now() / 1000; return;
    }
    const isUrgent = isAttack || ['hit', 'Hitstun', 'HitStun', 'Stunned', 'knockdown', 'Knockdown', 'ko', 'KO', 'Crumple'].includes(inputKey);
    const now = performance.now() / 1000;
    const timeSinceLastCrossfade = now - lastCrossfadeTimeRef.current;
    if (!isUrgent && isSameClip) return;
    if (!isUrgent && timeSinceLastCrossfade < MIN_CROSSFADE_HOLD_S) return;
    nextAction.setLoop(isLoop ? THREE.LoopRepeat : THREE.LoopOnce, isLoop ? Infinity : 1);
    nextAction.clampWhenFinished = !isLoop;
    nextAction.reset(); nextAction.setEffectiveTimeScale(1); nextAction.setEffectiveWeight(1);
    if (currentAction && currentAction !== nextAction) {
      currentAction.crossFadeTo(nextAction, fadeDuration, true); nextAction.play();
      console.log(`[FighterMesh] ↔️ Crossfade "${currentAction.getClip().name}" → "${clipName}" (${(fadeDuration * 1000).toFixed(0)}ms / ${Math.round(fadeDuration * 60)}f)`);
    } else {
      nextAction.fadeIn(fadeDuration).play();
      console.log(`[FighterMesh] ▶️ FadeIn "${clipName}" (${(fadeDuration * 1000).toFixed(0)}ms)`);
    }
    activeClipRef.current = clipName; committedClipRef.current = clipName; lastCrossfadeTimeRef.current = now;
  }, [state, animation, animationTrigger, normalizedScene, actions, gltfUrl, locomotionVelocity]);

  useEffect(() => {
    if (!normalizedScene || !actions) return;
    const availableClips = Object.keys(actions);
    if (availableClips.length === 0) return;
    const idleClip = resolveClipName('idle', availableClips);
    if (idleClip && actions[idleClip]) {
      const idleAction = actions[idleClip];
      idleAction.setLoop(THREE.LoopRepeat, Infinity); idleAction.reset().play();
      activeClipRef.current = idleClip; committedClipRef.current = idleClip; lastCrossfadeTimeRef.current = performance.now() / 1000;
      console.log(`[FighterMesh] 🟢 Auto-play idle="${idleClip}" on mount for "${gltfUrl.split('/').pop()}"`);
    }
  }, [normalizedScene]);

  useEffect(() => {
    if (!mixer) return;
    if (hitStopActive) { mixerTimeScaleRef.current = mixer.timeScale; mixer.timeScale = 0; }
    else mixer.timeScale = 1;
  }, [hitStopActive, mixer]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const attacking = state === 'Startup' || state === 'Active';
    const bob = (state === 'Neutral' || state === 'idle') ? Math.sin(performance.now() * 0.005) * 0.025 : 0;
    groupRef.current.position.set(position[0], position[1] + bob, position[2]);
    groupRef.current.rotation.y = rotationY + getAssetFacingCorrectionY(gltfUrl);
    groupRef.current.scale.setScalar(attacking ? 1.03 : 1.0);
    if (!hitStopActive && normalizedScene) enforceAnimatedFloorContact(normalizedScene, state, gltfUrl);
    if (!hitStopActive) boneHitboxRef.current.update(delta);
  });

  if (!normalizedScene) return null;
  const activeSpheres = boneHitboxRef.current.getActiveSpheres();
  return (
    <group ref={groupRef} position={position}>
      <primitive object={normalizedScene} />
      {showHitbox && hitboxGeometry && activeSpheres.length === 0 && (
        <mesh position={[hitboxGeometry.offsetX * (facing < 0 ? -1 : 1), 1.0, hitboxGeometry.offsetZ]}>
          <boxGeometry args={[hitboxGeometry.width, 1.6, hitboxGeometry.depth]} />
          <meshBasicMaterial color="#ff2222" wireframe transparent opacity={0.6} />
        </mesh>
      )}
      {showHitbox && activeSpheres.map((sphere, i) => (
        <mesh key={`bone-hitbox-${sphere.boneSlot}-${i}`} position={[sphere.worldCenter.x - position[0], sphere.worldCenter.y - position[1], sphere.worldCenter.z - position[2]]}>
          <sphereGeometry args={[sphere.radius, 8, 8]} />
          <meshBasicMaterial color={sphere.attackLevel === 'high' ? '#ff4400' : sphere.attackLevel === 'low' ? '#ffaa00' : '#ff2222'} wireframe transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
}

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

export function FighterMesh({
  modelUrl, position, facing, rotationY = 0, state, animation, tint,
  showHitbox = false, hitboxGeometry = null, animationTrigger = 0,
  locomotionVelocity, hitStopActive = false, onRigDiagnostic, onBoneHitboxReady,
}: FighterMeshProps) {
  if (!modelUrl) return <FighterPlaceholder position={position} />;
  return (
    <Suspense fallback={<FighterPlaceholder position={position} />}>
      <FighterMeshInner
        gltfUrl={modelUrl} state={state} animation={animation} position={position}
        facing={facing} rotationY={rotationY} tint={tint} showHitbox={showHitbox}
        hitboxGeometry={hitboxGeometry} animationTrigger={animationTrigger}
        locomotionVelocity={locomotionVelocity} hitStopActive={hitStopActive}
        onRigDiagnostic={onRigDiagnostic} onBoneHitboxReady={onBoneHitboxReady}
      />
    </Suspense>
  );
}
