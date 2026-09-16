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

const TARGET_FIGHTER_HEIGHT = 1.85;
const CROSSFADE_SECONDS = 0.15;

type FighterAnimationState = 'idle' | 'walk' | 'light' | 'heavy' | 'guard' | 'hit' | 'block' | 'ko';

const animationAliases: Record<FighterAnimationState, string[]> = {
  idle: ['idle', 'Idle', 'neutral', 'Neutral', 'standing', 'Standing'],
  walk: ['walk', 'Walk', 'walking', 'Walking', 'run', 'Run'],
  light: ['light', 'Light', 'punch', 'Punch', 'attack', 'Attack'],
  heavy: ['heavy', 'Heavy', 'strong', 'Strong', 'heavy_attack', 'HeavyAttack'],
  guard: ['guard', 'Guard', 'block', 'Block'],
  hit: ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch'],
  block: ['block', 'Block', 'guard', 'Guard'],
  ko: ['ko', 'KO', 'knockout', 'Knockout', 'death', 'Death']
};

function resolveAnimationKey(state: string): FighterAnimationState {
  const key = state.trim().toLowerCase();
  if (key === 'startup' || key === 'active') return 'light';
  if (key === 'neutral') return 'idle';
  if (key === 'guarding') return 'guard';
  if (key === 'hitstun' || key === 'crumple') return 'hit';
  if (key === 'walk_fwd' || key === 'walk_bwd') return 'walk';
  if (key === 'attack_l') return 'light';
  if (key === 'attack_h') return 'heavy';
  return (Object.prototype.hasOwnProperty.call(animationAliases, key) ? key : 'idle') as FighterAnimationState;
}

export function FighterMesh({ state, animation, modelUrl, position, facing, rotationY = 0, tint }: FighterMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);
  const [model, setModel] = useState<THREE.Group | null>(null);

  useEffect(() => {
    if (!modelUrl) {
      setModel(null);
      return;
    }

    let active = true;
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.load(modelUrl, (gltf) => {
      if (!active) return;

      const normalized = gltf.scene.clone(true);
      const rawBox = new THREE.Box3().setFromObject(normalized);
      const rawSize = rawBox.getSize(new THREE.Vector3());

      // Normalize every real Bannon GLB from measured bounds. No fighter-specific offsets.
      const scale = rawSize.y > Number.EPSILON ? TARGET_FIGHTER_HEIGHT / rawSize.y : 1;
      normalized.scale.setScalar(scale);
      normalized.position.set(
        -rawBox.getCenter(new THREE.Vector3()).x * scale,
        -rawBox.min.y * scale,
        -rawBox.getCenter(new THREE.Vector3()).z * scale
      );

      normalized.traverse((child) => {
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
              `vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0); vec4 clipPosition = projectionMatrix * mvPosition; float snapRes = ${DEFAULT_PSX_RENDER.renderWidth.toFixed(1)}; vec2 ndc = clipPosition.xy / clipPosition.w; ndc = floor(ndc * snapRes + 0.5) / snapRes; clipPosition.xy = ndc * clipPosition.w; gl_Position = clipPosition;`
            );
          };
        });
      });

      const mixer = new THREE.AnimationMixer(normalized);
      mixerRef.current = mixer;
      actionsRef.current = {};
      for (const clip of gltf.animations) actionsRef.current[clip.name] = mixer.clipAction(clip);

      setModel(normalized);
    }, undefined, (error) => {
      if (active) console.error('Fighter GLB load failed:', error);
    });

    return () => {
      active = false;
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
      activeActionRef.current = null;
      actionsRef.current = {};
    };
  }, [modelUrl]);

  useEffect(() => {
    if (!model) return;

    const key = resolveAnimationKey(animation ?? state);
    const aliases = animationAliases[key];
    const names = Object.keys(actionsRef.current);
    const exact = names.find((candidate) => aliases.some((alias) => candidate.toLowerCase() === alias.toLowerCase()));
    const partial = names.find((candidate) => candidate.toLowerCase().includes(key));
    const next = exact ? actionsRef.current[exact] : partial ? actionsRef.current[partial] : null;

    if (next === activeActionRef.current) return;

    activeActionRef.current?.fadeOut(CROSSFADE_SECONDS);
    if (next) {
      const looping = key === 'idle' || key === 'walk' || key === 'guard' || key === 'block';
      next.reset().fadeIn(CROSSFADE_SECONDS).play();
      next.setLoop(looping ? THREE.LoopRepeat : THREE.LoopOnce, looping ? Infinity : 1);
      next.clampWhenFinished = !looping;
    }
    activeActionRef.current = next;
  }, [animation, state, model]);

  useFrame(({ clock }, delta) => {
    mixerRef.current?.update(delta);
    if (!groupRef.current) return;

    const attacking = state === 'Startup' || state === 'Active';
    const bob = state === 'Neutral' ? Math.sin(clock.elapsedTime * 5) * 0.025 : 0;
    groupRef.current.position.set(position[0], position[1] + bob, position[2]);
    groupRef.current.rotation.y = rotationY;
    groupRef.current.scale.x = facing * (attacking ? 1.03 : 1);
  });

  if (!model) return null;
  return (
    <group ref={groupRef} position={position}>
      <primitive object={model} />
    </group>
  );
}
