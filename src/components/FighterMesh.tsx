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
}

const animationAliases: Record<string, string[]> = {
  idle: ['idle', 'Idle', 'neutral', 'Neutral', 'standing', 'Standing', 'bind', 'T-pose', 'TPose', 'tpose', 'rest', 'Rest'],
  walk: ['walk', 'Walk', 'walking', 'Walking', 'run', 'Run'],
  light: ['light', 'Light', 'punch', 'Punch', 'attack', 'Attack', 'jab', 'Jab'],
  heavy: ['heavy', 'Heavy', 'strong', 'Strong', 'heavy_attack', 'HeavyAttack', 'cross', 'Cross'],
  guard: ['guard', 'Guard', 'block', 'Block'],
  hit: ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'hitstun', 'Hitstun'],
  block: ['block', 'Block', 'guard', 'Guard'],
  ko: ['ko', 'KO', 'knockout', 'Knockout', 'death', 'Death', 'fall', 'Fall'],
};

// ── Crossfade durations per animation key ────────────────────────────────────
const FADE_DURATIONS: Record<string, number> = {
  idle: 0.15,
  walk: 0.12,
  light: 0.06,
  heavy: 0.08,
  hit: 0.05,
  ko: 0.08,
  guard: 0.10,
  block: 0.10,
};
const DEFAULT_FADE = 0.10;

/**
 * FighterMesh — Dynamic bounding-box normalization for ALL roster models.
 * - Every loaded GLB is normalized to 2.8 units tall regardless of export scale.
 * - Root placed at Y=0 (floor), centered on X/Z.
 * - P1 (facing=1): rotationY=0 — faces +Z (toward camera), correct for left-side fighter.
 * - P2 (facing=-1): rotationY=Math.PI — faces -Z (toward P1), correct for right-side fighter.
 * - AnimationMixer is updated inside useFrame every frame so animations play on all models.
 * - Default idle clip plays on mount via reset().play().
 * - Crossfading via crossFadeTo() for smooth state transitions.
 */
export function FighterMesh({
  state, animation, modelUrl, position, facing, rotationY = 0, tint,
  showHitbox = false, hitboxGeometry = null,
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
  useEffect(() => {
    if (!model) return;
    const key = animation ?? state.toLowerCase();
    const aliases = animationAliases[key] ?? [key];
    const name = Object.keys(actionsRef.current).find(
      (candidate) => aliases.some((alias) => candidate.toLowerCase() === alias.toLowerCase())
    ) ?? Object.keys(actionsRef.current).find(
      (candidate) => candidate.toLowerCase().includes(key.toLowerCase())
    );
    const next = name ? actionsRef.current[name] : null;
    if (next === activeActionRef.current) return;

    const fadeDuration = FADE_DURATIONS[key] ?? DEFAULT_FADE;
    const isLoop = key === 'idle' || key === 'walk';

    if (next) {
      next.setLoop(isLoop ? THREE.LoopRepeat : THREE.LoopOnce, isLoop ? Infinity : 1);
      next.reset();
      next.setEffectiveTimeScale(1);
      next.setEffectiveWeight(1);

      if (activeActionRef.current) {
        // Crossfade: blend out old, blend in new
        activeActionRef.current.crossFadeTo(next, fadeDuration, true);
        next.play();
      } else {
        next.fadeIn(fadeDuration).play();
      }
    } else if (activeActionRef.current) {
      activeActionRef.current.fadeOut(fadeDuration);
    }

    activeActionRef.current = next;
  }, [animation, state, model]);

  // ── AnimationMixer update — MUST run inside useFrame for animations to play ──
  useFrame(({ clock }, delta) => {
    mixerRef.current?.update(delta);

    if (!groupRef.current) return;
    const attacking = state === 'Startup' || state === 'Active';
    const bob = state === 'Neutral' ? Math.sin(clock.elapsedTime * 5) * 0.025 : 0;
    groupRef.current.position.set(position[0], position[1] + bob, position[2]);
    groupRef.current.rotation.y = rotationY;
    groupRef.current.scale.x = Math.abs(groupRef.current.scale.x) * (facing < 0 ? -1 : 1) * (attacking ? 1.03 : 1);
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
