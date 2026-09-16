'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { DEFAULT_PSX_RENDER } from '../render/psx';

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
}

// ─────────────────────────────────────────────────────────────────────────────
// Animation alias table — maps FighterStateMachine states → GLB clip names
// ─────────────────────────────────────────────────────────────────────────────
const ANIMATION_ALIASES: Record<string, string[]> = {
  idle:         ['idle', 'Idle', 'neutral', 'Neutral', 'standing', 'Standing', 'bind', 'T-pose', 'TPose', 'tpose', 'rest', 'Rest'],
  Neutral:      ['idle', 'Idle', 'neutral', 'Neutral', 'standing', 'Standing'],
  walk:         ['walk', 'Walk', 'walking', 'Walking', 'run', 'Run'],
  Walking:      ['walk', 'Walk', 'walking', 'Walking', 'run', 'Run'],
  walkForward:  ['walk', 'Walk', 'walking', 'Walking', 'walkForward', 'WalkForward', 'forward', 'Forward', 'run', 'Run'],
  walkBackward: ['walkBack', 'WalkBack', 'walkBackward', 'WalkBackward', 'walk', 'Walk', 'backward', 'Backward'],
  strafeLeft:   ['strafeLeft', 'StrafeLeft', 'walk', 'Walk'],
  strafeRight:  ['strafeRight', 'StrafeRight', 'walk', 'Walk'],
  light:        ['light', 'Light', 'punch', 'Punch', 'attack', 'Attack', 'jab', 'Jab', 'lightAttack', 'LightAttack'],
  lightAttack:  ['lightAttack', 'LightAttack', 'light', 'Light', 'punch', 'Punch', 'jab', 'Jab', 'attack', 'Attack', 'hit', 'Hit', 'strike', 'Strike'],
  heavy:        ['heavy', 'Heavy', 'strong', 'Strong', 'heavyAttack', 'HeavyAttack', 'cross', 'Cross'],
  heavyAttack:  ['heavyAttack', 'HeavyAttack', 'heavy', 'Heavy', 'strong', 'Strong', 'cross', 'Cross', 'kick', 'Kick', 'attack', 'Attack', 'strike', 'Strike'],
  guard:        ['guard', 'Guard', 'block', 'Block', 'defend', 'Defend'],
  block:        ['block', 'Block', 'guard', 'Guard'],
  Blockstun:    ['block', 'Block', 'guard', 'Guard'],
  hit:          ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'hitstun', 'Hitstun', 'damage', 'Damage', 'react', 'React'],
  Hitstun:      ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'damage', 'Damage'],
  Stunned:      ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'damage', 'Damage'],
  knockdown:    ['knockdown', 'Knockdown', 'ko', 'KO', 'knockout', 'Knockout', 'death', 'Death', 'fall', 'Fall', 'down', 'Down'],
  ko:           ['ko', 'KO', 'knockout', 'Knockout', 'death', 'Death', 'fall', 'Fall', 'knockdown', 'Knockdown'],
  KO:           ['ko', 'KO', 'knockout', 'Knockout', 'death', 'Death', 'fall', 'Fall', 'knockdown', 'Knockdown'],
  Crumple:      ['ko', 'KO', 'knockdown', 'Knockdown', 'fall', 'Fall', 'death', 'Death'],
  Startup:      ['lightAttack', 'LightAttack', 'attack', 'Attack', 'punch', 'Punch', 'jab', 'Jab'],
  Active:       ['lightAttack', 'LightAttack', 'attack', 'Attack', 'punch', 'Punch', 'kick', 'Kick'],
};

// Crossfade durations per state key
const FADE_DURATIONS: Record<string, number> = {
  idle: 0.15, Neutral: 0.15,
  walk: 0.12, walkForward: 0.12, walkBackward: 0.12, Walking: 0.12,
  strafeLeft: 0.12, strafeRight: 0.12,
  light: 0.06, lightAttack: 0.06, Startup: 0.06, Active: 0.04,
  heavy: 0.08, heavyAttack: 0.08,
  hit: 0.05, Hitstun: 0.05, Stunned: 0.05,
  knockdown: 0.08, ko: 0.08, KO: 0.08, Crumple: 0.08,
  guard: 0.10, block: 0.10, Blockstun: 0.10,
};
const DEFAULT_FADE = 0.10;

const LOOP_STATES = new Set([
  'idle', 'Neutral', 'walk', 'walkForward', 'walkBackward', 'Walking',
  'strafeLeft', 'strafeRight', 'guard', 'block', 'Blockstun',
  'Knockdown', 'WakeupTechRoll', 'WakeupBackrise', 'WakeupQuickStand',
  'Backdashing',
]);

const ATTACK_STATES = new Set(['lightAttack', 'heavyAttack', 'light', 'heavy', 'Startup', 'Active']);

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
  if (key.startsWith('walk') || key.startsWith('strafe') || key === 'Walking') {
    found = availableClips.find(c => {
      const lc = c.toLowerCase();
      return lc.includes('walk') || lc.includes('run') || lc.includes('move') || lc.includes('forward');
    });
    if (found) return found;
  }

  // 5. Hit/stun fallback
  if (key === 'hit' || key === 'Hitstun' || key === 'Stunned') {
    found = availableClips.find(c => {
      const lc = c.toLowerCase();
      return lc.includes('hit') || lc.includes('hurt') || lc.includes('flinch') || lc.includes('damage');
    });
    if (found) return found;
  }

  // 6. KO/knockdown fallback
  if (key === 'ko' || key === 'KO' || key === 'knockdown' || key === 'Crumple') {
    found = availableClips.find(c => {
      const lc = c.toLowerCase();
      return lc.includes('ko') || lc.includes('fall') || lc.includes('down') || lc.includes('death') || lc.includes('knockdown');
    });
    if (found) return found;
  }

  // 7. Idle fallback → first available clip
  found = availableClips.find(c => c.toLowerCase().includes('idle'));
  if (found) return found;

  return availableClips[0] ?? null;
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
}) {
  const groupRef = useRef<THREE.Group>(null);
  const normalizedRef = useRef<THREE.Group | null>(null);
  const [normalizedScene, setNormalizedScene] = useState<THREE.Group | null>(null);

  // useGLTF caches the result — safe to call per-fighter
  const { scene, animations } = useGLTF(gltfUrl);

  // useAnimations from @react-three/drei — handles mixer + useFrame update automatically
  const { actions, mixer } = useAnimations(animations, groupRef);

  // ── Universal Box3 normalization — applies to EVERY character, no exceptions ──
  useEffect(() => {
    if (!scene) return;

    const cloned = scene.clone(true);

    // Compute bounding box on the raw clone
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());

    // Scale uniformly so total Y height = 1.85 units
    const TARGET_HEIGHT = 1.85;
    const scale = size.y > 0.01 ? TARGET_HEIGHT / size.y : 1;
    cloned.scale.setScalar(scale);

    // Recompute box AFTER scaling — this gives accurate world-space bounds
    cloned.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(cloned);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

    // Offset so bottom of bounding box sits exactly at Y=0
    // Use scaledBox.min.y so ALL characters stand on the floor regardless of root bone position.
    // Use scaledCenter.x/z (post-scale) for horizontal centering — NOT pre-scale center * scale.
    cloned.position.set(
      -scaledCenter.x,
      -scaledBox.min.y,
      -scaledCenter.z,
    );

    // Clear ONLY the root scene rotation — do NOT reset children.
    // Resetting children breaks models whose root bone is oriented away from camera.
    cloned.rotation.set(0, 0, 0);

    // Apply PSX vertex snapping to all meshes
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

    normalizedRef.current = cloned;
    setNormalizedScene(cloned);

    console.log(
      `[FighterMesh] ✅ Normalized "${gltfUrl.split('/').pop()}" — ` +
      `originalHeight=${size.y.toFixed(3)} scale=${scale.toFixed(4)} ` +
      `clips=[${animations.map(a => a.name).join(', ')}]`
    );
  }, [scene, gltfUrl, animations]);

  // ── Bind FighterStateMachine state → AnimationMixer playback ─────────────
  // Fires on EVERY state change and on animationTrigger increment
  useEffect(() => {
    if (!normalizedScene || !actions) return;

    const availableClips = Object.keys(actions);
    if (availableClips.length === 0) {
      console.warn(`[FighterMesh] ⚠️ No animation clips available for "${gltfUrl.split('/').pop()}"`);
      return;
    }

    // Resolve the target animation key
    const inputKey = animation ?? state;
    const clipName = resolveClipName(inputKey, availableClips);

    // ── CONSOLE TRACE: input → state → clip ──────────────────────────────────
    console.log(
      `[FighterMesh] 🎬 input="${inputKey}" → state="${state}" → clip="${clipName ?? 'NONE'}" ` +
      `(trigger=${animationTrigger}) available=[${availableClips.join(', ')}]`
    );

    if (!clipName || !actions[clipName]) {
      console.warn(`[FighterMesh] ⚠️ No matching clip for state="${state}" animation="${animation}" on "${gltfUrl.split('/').pop()}"`);
      return;
    }

    const nextAction = actions[clipName];
    const fadeDuration = FADE_DURATIONS[inputKey] ?? DEFAULT_FADE;
    const isLoop = LOOP_STATES.has(inputKey);
    const isAttack = ATTACK_STATES.has(inputKey);

    // Find currently playing action
    const currentAction = availableClips
      .map(k => actions[k])
      .find(a => a?.isRunning());

    const isSameAction = currentAction === nextAction;

    // For attack re-triggers (same clip, new trigger count) — restart from beginning
    if (isSameAction && isAttack && animationTrigger > 0) {
      console.log(`[FighterMesh] 🔁 Re-triggering attack clip "${clipName}" from start`);
      nextAction.stop();
      nextAction.reset();
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.play();
      return;
    }

    if (isSameAction) return;

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
      console.log(`[FighterMesh] ↔️ Crossfade "${currentAction.getClip().name}" → "${clipName}" (${fadeDuration}s)`);
    } else {
      nextAction.fadeIn(fadeDuration).play();
      console.log(`[FighterMesh] ▶️ FadeIn "${clipName}" (${fadeDuration}s)`);
    }
  }, [state, animation, animationTrigger, normalizedScene, actions, gltfUrl]);

  // ── Auto-play idle on mount once scene is normalized ─────────────────────
  useEffect(() => {
    if (!normalizedScene || !actions) return;
    const availableClips = Object.keys(actions);
    if (availableClips.length === 0) return;

    const idleClip = resolveClipName('idle', availableClips);
    if (idleClip && actions[idleClip]) {
      const idleAction = actions[idleClip];
      idleAction.setLoop(THREE.LoopRepeat, Infinity);
      idleAction.reset().play();
      console.log(`[FighterMesh] 🟢 Auto-play idle="${idleClip}" on mount for "${gltfUrl.split('/').pop()}"`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedScene]);

  // ── useFrame: position + rotation + attack pulse ──────────────────────────
  // NOTE: useAnimations from @react-three/drei already calls mixer.update(delta)
  // internally — we do NOT call it again here to avoid double-stepping.
  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const attacking = state === 'Startup' || state === 'Active';
    const bob = (state === 'Neutral' || state === 'idle')
      ? Math.sin(clock.elapsedTime * 5) * 0.025
      : 0;

    // Position — driven entirely by props from parent screen
    groupRef.current.position.set(position[0], position[1] + bob, position[2]);

    // Rotation — driven entirely by rotationY prop from parent screen
    // FighterMesh is DUMB about rotation — it just applies what it receives.
    // CharacterSelect passes 0 for both (face camera)
    // CombatArena3D passes 0 for P1, Math.PI for P2
    groupRef.current.rotation.y = rotationY;

    // Attack pulse — uniform scale, no mirroring
    const attackScale = attacking ? 1.03 : 1.0;
    groupRef.current.scale.set(attackScale, attackScale, attackScale);
  });

  if (!normalizedScene) return null;

  return (
    <group ref={groupRef} position={position}>
      <primitive object={normalizedScene} />
      {showHitbox && hitboxGeometry && (
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
      />
    </Suspense>
  );
}
