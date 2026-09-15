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

/**
 * FighterMesh — Dynamic bounding-box normalization for ALL roster models.
 * - Every loaded GLB is normalized to 2.8 units tall regardless of export scale.
 * - Root placed at Y=0 (floor), centered on X/Z.
 * - P1 (facing=1): rotationY=0 — faces +Z (toward camera), correct for left-side fighter.
 * - P2 (facing=-1): rotationY=Math.PI — faces -Z (toward P1), correct for right-side fighter.
 * - AnimationMixer is updated inside useFrame every frame so animations play on all models.
 * - Default idle clip plays on mount via reset().play().
 */
export function FighterMesh({ state, animation, modelUrl, position, facing, rotationY = 0, tint }: FighterMeshProps) {
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
      // Recompute after clone to get accurate world-space bounds
      const box = new THREE.Box3().setFromObject(cloned);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // Normalize every fighter to 2.8 units tall (arena scale)
      // This handles models exported at any unit scale (cm, m, unscaled)
      const targetHeight = 2.8;
      const scale = size.y > 0.01 ? targetHeight / size.y : 1;
      cloned.scale.setScalar(scale);

      // Re-center: align X/Z to origin, align bottom of bounding box to Y=0 (floor)
      cloned.position.set(
        -center.x * scale,
        -box.min.y * scale,
        -center.z * scale,
      );

      // Clear any rotation baked into the root — facing is controlled by parent group
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

      // ── AnimationMixer setup — required for skeletal animations ──
      const mixer = new THREE.AnimationMixer(cloned);
      mixerRef.current = mixer;
      actionsRef.current = {};

      for (const clip of gltf.animations) {
        actionsRef.current[clip.name] = mixer.clipAction(clip);
      }

      // ── Auto-play idle on mount ──
      // Find the best idle clip and start it immediately
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

  // ── Animation state transitions ──────────────────────────────────────────
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
    activeActionRef.current?.fadeOut(0.08);
    if (next) {
      const isLoop = key === 'idle' || key === 'walk';
      next.setLoop(isLoop ? THREE.LoopRepeat : THREE.LoopOnce, isLoop ? Infinity : 1);
      next.reset().fadeIn(0.08).play();
    }
    activeActionRef.current = next;
  }, [animation, state, model]);

  // ── AnimationMixer update — MUST run inside useFrame for animations to play ──
  useFrame(({ clock }, delta) => {
    // Update mixer every frame — this is what drives skeletal animation playback
    mixerRef.current?.update(delta);

    if (!groupRef.current) return;
    const attacking = state === 'Startup' || state === 'Active';
    const bob = state === 'Neutral' ? Math.sin(clock.elapsedTime * 5) * 0.025 : 0;
    groupRef.current.position.set(position[0], position[1] + bob, position[2]);
    // rotationY from parent controls facing direction
    // P1: rotationY=0 (faces +Z toward camera, left side)
    // P2: rotationY=Math.PI (faces -Z toward P1, right side)
    groupRef.current.rotation.y = rotationY;
    groupRef.current.scale.x = Math.abs(groupRef.current.scale.x) * (facing < 0 ? -1 : 1) * (attacking ? 1.03 : 1);
  });

  if (!model) return null;
  return (
    <group ref={groupRef} position={position}>
      <primitive object={model} />
    </group>
  );
}
