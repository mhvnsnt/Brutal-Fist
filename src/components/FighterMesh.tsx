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
  idle: ['idle', 'Idle', 'neutral', 'Neutral', 'standing', 'Standing', 'bind', 'T-pose', 'TPose'],
  walk: ['walk', 'Walk', 'walking', 'Walking', 'run', 'Run'],
  light: ['light', 'Light', 'punch', 'Punch', 'attack', 'Attack'],
  heavy: ['heavy', 'Heavy', 'strong', 'Strong', 'heavy_attack', 'HeavyAttack'],
  guard: ['guard', 'Guard', 'block', 'Block'],
  hit: ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch'],
  block: ['block', 'Block', 'guard', 'Guard'],
  ko: ['ko', 'KO', 'knockout', 'Knockout', 'death', 'Death']
};

/**
 * FighterMesh — Bannon-reference orientation contract:
 * - Normalize to 2.8 units tall (arena scale)
 * - Root placed at Y=0 (floor), centered on X/Z
 * - No additional Y rotation applied — Bannon faces +Z (toward camera)
 * - P2 facing is handled by the parent via rotationY = Math.PI (180°)
 *   so P2 faces -Z (toward P1 who is at -Z side)
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

      // ── Bannon-reference normalization ──────────────────────────────────
      const box = new THREE.Box3().setFromObject(cloned);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // Normalize to 2.8 units tall (arena scale, matches Bannon)
      const scale = size.y > 0 ? 2.8 / size.y : 1;
      cloned.scale.setScalar(scale);

      // Center X/Z, root at Y=0 (floor placement)
      cloned.position.set(
        -center.x * scale,
        -box.min.y * scale,
        -center.z * scale
      );

      // No additional rotation — Bannon faces +Z, all models must match
      cloned.rotation.set(0, 0, 0);

      // Apply PSX vertex snapping + optional tint
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
          // PSX vertex snapping shader
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

      mixerRef.current = new THREE.AnimationMixer(cloned);
      actionsRef.current = {};
      for (const clip of gltf.animations) {
        actionsRef.current[clip.name] = mixerRef.current.clipAction(clip);
      }
      setModel(cloned);
    }, undefined, (error) => console.error('Fighter GLB load failed:', error));

    return () => {
      active = false;
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
      actionsRef.current = {};
    };
  }, [modelUrl]);

  useEffect(() => {
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
      next.reset().fadeIn(0.08).play();
      next.setLoop(
        key === 'idle' || key === 'walk' ? THREE.LoopRepeat : THREE.LoopOnce,
        key === 'idle' || key === 'walk' ? Infinity : 1
      );
    }
    activeActionRef.current = next;
  }, [animation, state, model]);

  useFrame(({ clock }, delta) => {
    mixerRef.current?.update(delta);
    if (!groupRef.current) return;
    const attacking = state === 'Startup' || state === 'Active';
    const bob = state === 'Neutral' ? Math.sin(clock.elapsedTime * 5) * 0.025 : 0;
    groupRef.current.position.set(position[0], position[1] + bob, position[2]);
    // rotationY from parent controls facing direction (Bannon-reference: 0 = faces camera)
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
