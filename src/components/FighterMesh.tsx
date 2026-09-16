import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DEFAULT_PSX_RENDER } from '../render/psx';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

interface FighterMeshProps {
  state: string;
  animation?: string;
  modelUrl: string | null;
  position: [number, number, number];
  facing: 1 | -1;
  rotationY?: number;
  tint?: string;
  /** When true, renders a wireframe hitbox helper for debugging */
  showHitbox?: boolean;
  /** Hitbox geometry for debug visualization */
  hitboxGeometry?: {
    offsetX: number; offsetZ: number; width: number; depth: number;
  } | null;
  /**
   * Monotonically-increasing counter that forces animation re-trigger even when
   * the animation key string hasn't changed (e.g. two consecutive lightAttacks).
   * Increment this in GameBattleArena whenever a new attack begins.
   */
  animationTrigger?: number;
}

const animationAliases: Record<string, string[]> = {
  idle: ['idle', 'Idle', 'neutral', 'Neutral', 'standing', 'Standing', 'bind', 'T-pose', 'TPose', 'tpose', 'rest', 'Rest'],
  walk: ['walk', 'Walk', 'walking', 'Walking', 'run', 'Run'],
  walkForward: ['walk', 'Walk', 'walking', 'Walking', 'run', 'Run', 'walkForward', 'WalkForward', 'forward', 'Forward'],
  walkBackward: ['walkBack', 'WalkBack', 'walkBackward', 'WalkBackward', 'walk', 'Walk', 'walking', 'Walking', 'backward', 'Backward'],
  strafeLeft: ['strafeLeft', 'StrafeLeft', 'walk', 'Walk'],
  strafeRight: ['strafeRight', 'StrafeRight', 'walk', 'Walk'],
  light: ['light', 'Light', 'punch', 'Punch', 'attack', 'Attack', 'jab', 'Jab', 'lightAttack', 'LightAttack'],
  lightAttack: ['lightAttack', 'LightAttack', 'light', 'Light', 'punch', 'Punch', 'jab', 'Jab', 'attack', 'Attack', 'hit', 'Hit', 'strike', 'Strike'],
  heavy: ['heavy', 'Heavy', 'strong', 'Strong', 'heavy_attack', 'HeavyAttack', 'cross', 'Cross', 'heavyAttack'],
  heavyAttack: ['heavyAttack', 'HeavyAttack', 'heavy', 'Heavy', 'strong', 'Strong', 'cross', 'Cross', 'kick', 'Kick', 'attack', 'Attack', 'strike', 'Strike'],
  guard: ['guard', 'Guard', 'block', 'Block', 'defend', 'Defend'],
  hit: ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'hitstun', 'Hitstun', 'damage', 'Damage', 'react', 'React'],
  knockdown: ['knockdown', 'Knockdown', 'ko', 'KO', 'knockout', 'Knockout', 'death', 'Death', 'fall', 'Fall', 'down', 'Down'],
  block: ['block', 'Block', 'guard', 'Guard'],
  ko: ['ko', 'KO', 'knockout', 'Knockout', 'death', 'Death', 'fall', 'Fall', 'knockdown', 'Knockdown'],
  // State machine states mapped to animation keys
  Startup: ['lightAttack', 'LightAttack', 'attack', 'Attack', 'punch', 'Punch', 'jab', 'Jab', 'hit', 'Hit'],
  Active: ['lightAttack', 'LightAttack', 'attack', 'Attack', 'punch', 'Punch', 'kick', 'Kick'],
  Hitstun: ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'damage', 'Damage'],
  Blockstun: ['block', 'Block', 'guard', 'Guard'],
  Neutral: ['idle', 'Idle', 'neutral', 'Neutral', 'standing', 'Standing'],
  Walking: ['walk', 'Walk', 'walking', 'Walking', 'run', 'Run'],
  KO: ['ko', 'KO', 'knockout', 'Knockout', 'death', 'Death', 'fall', 'Fall', 'knockdown', 'Knockdown'],
};

// ── Crossfade durations per animation key ────────────────────────────────────
const FADE_DURATIONS: Record<string, number> = {
  idle: 0.15,
  Neutral: 0.15,
  walk: 0.12,
  walkForward: 0.12,
  walkBackward: 0.12,
  Walking: 0.12,
  strafeLeft: 0.12,
  strafeRight: 0.12,
  light: 0.06,
  lightAttack: 0.06,
  Startup: 0.06,
  Active: 0.04,
  heavy: 0.08,
  heavyAttack: 0.08,
  hit: 0.05,
  Hitstun: 0.05,
  knockdown: 0.08,
  ko: 0.08,
  KO: 0.08,
  guard: 0.10,
  block: 0.10,
  Blockstun: 0.10,
};
const DEFAULT_FADE = 0.10;

const LOOP_STATES = new Set([
  'idle', 'Neutral', 'walk', 'walkForward', 'walkBackward', 'Walking',
  'strafeLeft', 'strafeRight', 'guard', 'block', 'Blockstun',
]);

/**
 * FighterMesh — Dynamic bounding-box normalization for ALL roster models.
 * - Every loaded GLB is normalized to 2.8 units tall regardless of export scale.
 * - Root placed at Y=0 (floor), centered on X/Z.
 * - P1 (facing=1): rotationY=0 — faces +Z (toward camera), correct for left-side fighter.
 * - P2 (facing=-1): rotationY=Math.PI — faces -Z (toward P1), correct for right-side fighter.
 * - AnimationMixer is updated inside useFrame every frame so animations play on all models.
 * - Default idle clip plays on mount via reset().play().
 * - Crossfading via crossFadeTo() for smooth state transitions.
 * - animationTrigger prop forces re-trigger even when animation key string is unchanged.
 *
 * ORIENTATION CONTRACT:
 *   rotationY is set by CombatArena3D: 0 for P1, Math.PI for P2.
 *   This is COMPLETELY INDEPENDENT of CharacterPortrait3D portrait rotationY.
 *   Every character — Bannon, Maime, or any other — uses the same rotationY values.
 */
export function FighterMesh({
  state, animation, modelUrl, position, facing, rotationY = 0, tint,
  showHitbox = false, hitboxGeometry = null, animationTrigger = 0,
}: FighterMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);
  const [model, setModel] = useState<THREE.Group | null>(null);

  useEffect(() => {
    if (!modelUrl) { setModel(null); return; }
    let active = true;
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(modelUrl, (gltf) => {
      if (!active) return;
      const cloned = gltf.scene.clone(true);

      // ── Dynamic bounding-box normalization — works for ALL roster models ──
      const box = new THREE.Box3().setFromObject(cloned);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      const targetHeight = 2.8;
      const scale = size.y > 0.01 ? targetHeight / size.y : 1;
      cloned.scale.setScalar(scale);

      cloned.position.set(
        -center.x * scale,
        -box.min.y * scale,
        -center.z * scale,
      );

      cloned.rotation.set(0, 0, 0);

      // Apply PSX vertex snapping + optional tint to all meshes
      cloned.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return;
        const mesh = child as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => {
          const mat = material as THREE.MeshStandardMaterial;
          if (mat.map) {
            mat.map.minFilter = THREE.NearestFilter;
            mat.map.magFilter = THREE.NearestFilter;
            mat.map.generateMipmaps = false;
            mat.needsUpdate = true;
          }
          mat.onBeforeCompile = (shader) => {
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

      // ── AnimationMixer setup ──────────────────────────────────────────────
      const mixer = new THREE.AnimationMixer(cloned);
      mixerRef.current = mixer;
      actionsRef.current = {};

      for (const clip of gltf.animations) {
        actionsRef.current[clip.name] = mixer.clipAction(clip);
      }

      // ── Auto-play idle on mount ──────────────────────────────────────────
      const idleAliases = animationAliases['idle'];
      const idleClipName = Object.keys(actionsRef.current).find(
        (name) => idleAliases.some((alias) => name.toLowerCase() === alias.toLowerCase())
      ) ?? Object.keys(actionsRef.current).find(
        (name) => name.toLowerCase().includes('idle')
      ) ?? Object.keys(actionsRef.current)[0];

      if (idleClipName && actionsRef.current[idleClipName]) {
        const idleAction = actionsRef.current[idleClipName];
        idleAction.setLoop(THREE.LoopRepeat, Infinity);
        idleAction.reset().play();
        activeActionRef.current = idleAction;
      }

      setModel(cloned);
    }, undefined, (error) => console.error('Fighter GLB load failed:', modelUrl, error));

    return () => {
      active = false;
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
      actionsRef.current = {};
      activeActionRef.current = null;
    };
  }, [modelUrl]);

  // ── Animation state transitions with crossfading ─────────────────────────
  // animationTrigger is included so repeated same-key attacks still re-trigger
  useEffect(() => {
    if (!model) return;
    const key = animation ?? state.toLowerCase();
    const aliases = animationAliases[key] ?? animationAliases[animation ?? ''] ?? [key];

    // 1. Exact alias match (case-insensitive)
    let name = Object.keys(actionsRef.current).find(
      (candidate) => aliases.some((alias) => candidate.toLowerCase() === alias.toLowerCase())
    );
    // 2. Partial substring match on key
    if (!name) {
      name = Object.keys(actionsRef.current).find(
        (candidate) => candidate.toLowerCase().includes(key.toLowerCase())
      );
    }
    // 3. For attack states, try any clip with 'attack' or 'punch' or 'kick' or 'strike'
    if (!name && (
      key === 'lightAttack' || key === 'heavyAttack' || key === 'light' || key === 'heavy' ||
      key === 'Startup' || key === 'Active'
    )) {
      name = Object.keys(actionsRef.current).find(
        (candidate) => {
          const c = candidate.toLowerCase();
          return c.includes('attack') || c.includes('punch') || c.includes('kick') ||
                 c.includes('hit') || c.includes('strike') || c.includes('jab') || c.includes('cross');
        }
      );
    }
    // 4. For walk/movement states, try any clip with 'walk' or 'run' or 'move'
    if (!name && (key.startsWith('walk') || key.startsWith('strafe') || key === 'Walking')) {
      name = Object.keys(actionsRef.current).find(
        (candidate) => {
          const c = candidate.toLowerCase();
          return c.includes('walk') || c.includes('run') || c.includes('move') || c.includes('forward');
        }
      );
    }
    // 5. For hit/stun states
    if (!name && (key === 'hit' || key === 'Hitstun' || key === 'Stunned')) {
      name = Object.keys(actionsRef.current).find(
        (candidate) => {
          const c = candidate.toLowerCase();
          return c.includes('hit') || c.includes('hurt') || c.includes('flinch') || c.includes('damage');
        }
      );
    }
    // 6. For KO/knockdown states
    if (!name && (key === 'ko' || key === 'KO' || key === 'knockdown' || key === 'Crumple')) {
      name = Object.keys(actionsRef.current).find(
        (candidate) => {
          const c = candidate.toLowerCase();
          return c.includes('ko') || c.includes('fall') || c.includes('down') || c.includes('death') || c.includes('knockdown');
        }
      );
    }
    // 7. Fallback: use idle or first available clip
    if (!name) {
      name = Object.keys(actionsRef.current).find(c => c.toLowerCase().includes('idle'))
        ?? Object.keys(actionsRef.current)[0];
    }

    const next = name ? actionsRef.current[name] : null;

    // For animationTrigger changes (repeated same attack), always re-trigger even if same action
    const isSameAction = next === activeActionRef.current;
    const isAttackRetrigger = animationTrigger > 0 && (
      key === 'lightAttack' || key === 'heavyAttack' || key === 'Startup' || key === 'Active'
    );

    if (isSameAction && !isAttackRetrigger) return;

    const fadeDuration = FADE_DURATIONS[key] ?? DEFAULT_FADE;
    const isLoop = LOOP_STATES.has(key);

    if (next) {
      next.setLoop(isLoop ? THREE.LoopRepeat : THREE.LoopOnce, isLoop ? Infinity : 1);
      next.clampWhenFinished = !isLoop;
      next.reset();
      next.setEffectiveTimeScale(1);
      next.setEffectiveWeight(1);

      if (activeActionRef.current && activeActionRef.current !== next) {
        activeActionRef.current.crossFadeTo(next, fadeDuration, true);
        next.play();
      } else if (activeActionRef.current === next && isAttackRetrigger) {
        // Re-trigger same clip from beginning for chained attacks
        next.stop();
        next.reset().play();
      } else {
        next.fadeIn(fadeDuration).play();
      }
    } else if (activeActionRef.current) {
      activeActionRef.current.fadeOut(fadeDuration);
    }

    activeActionRef.current = next;
  }, [animation, state, model, animationTrigger]);

  // ── AnimationMixer update — MUST run inside useFrame for animations to play ──
  useFrame(({ clock }, delta) => {
    mixerRef.current?.update(delta);

    if (!groupRef.current) return;
    const attacking = state === 'Startup' || state === 'Active';
    const bob = state === 'Neutral' ? Math.sin(clock.elapsedTime * 5) * 0.025 : 0;
    groupRef.current.position.set(position[0], position[1] + bob, position[2]);
    // ── Orientation: rotationY prop is the single source of truth for facing ──
    // P1 (facing=1):  rotationY=0       → faces +Z (toward camera, left side)
    // P2 (facing=-1): rotationY=Math.PI → faces -Z (toward P1, right side)
    // This is COMPLETELY INDEPENDENT of CharacterPortrait3D portrait rotationY.
    // Every character uses the same rotationY values — Bannon, Maime, or any other.
    groupRef.current.rotation.y = rotationY;
    // Attack pulse: uniform scale on all axes, no mirroring
    const attackScale = attacking ? 1.03 : 1.0;
    groupRef.current.scale.set(attackScale, attackScale, attackScale);
  });

  if (!model) return null;
  return (
    <group ref={groupRef} position={position}>
      <primitive object={model} />
      {/* ── Hitbox debug wireframe ── */}
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
