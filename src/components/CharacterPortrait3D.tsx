'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

interface CharacterPortrait3DProps {
  modelUrl: string;
  factionColor: string;
  /** 'bust' = tight head/chest crop (portrait panels), 'full' = full body (roster slots) */
  mode?: 'bust' | 'full';
  /** Whether to apply a hit-stop brightness flash */
  flash?: boolean;
  /** Flip horizontally for P2 side — rotates 180° on Y so character faces toward P1 */
  flip?: boolean;
}

/**
 * NORMALIZATION CONTRACT (v7 — Universal Root Bone Offset + 3-Point Lighting + Idle Anim):
 *
 * Global Y-offset strategy:
 *   Bannon and Maime are the reference baseline (root bones at pelvis/waist) → 0 extra offset.
 *   ALL other characters have floor-level root bones → receive a universal +1.15 Y offset.
 *   Detection is by explicit allowlist: only "bannon" and "maime" substrings get 0.
 *   Every other character — known or unknown — gets +1.15 automatically.
 *
 * 3-Point Lighting:
 *   Key light:  strong warm-white from upper-right front — primary illumination
 *   Fill light: soft cool from upper-left front — lifts shadows, faction-tinted
 *   Rim light:  narrow bright from behind-upper — separates character from background
 *
 * Idle Animation:
 *   Mixer is created on the cloned scene. Clips from gltf.animations are retargeted
 *   to the cloned scene's bone hierarchy by name. Idle clip is selected by keyword
 *   priority: idle > stand > neutral > walk > any first clip.
 *
 * Camera positions (fixed, never change):
 *   - Bust mode:  position=(0, 1.6, 3.2), lookAt=(0, 1.4, 0), FOV=28
 *   - Full mode:  position=(0, 1.0, 4.5), lookAt=(0, 1.0, 0), FOV=40
 */

/**
 * Returns the Y nudge for a character.
 * ONLY Bannon and Maime (the reference baseline) get 0.
 * Every other character — including all floor-rooted fighters — gets +1.15.
 * This is the normalized-space equivalent of +100–120 cm on a 180–190 cm character.
 */
function getYNudge(modelUrl: string): number {
  const lower = modelUrl.toLowerCase();
  // Only the two reference characters are exempt from the universal offset
  if (lower.includes('bannon') || lower.includes('maime')) return 0;
  // Universal correction for ALL other roster members
  return 1.15;
}

/**
 * Retarget animation clips from the original GLTF scene to a cloned scene.
 * Three.js AnimationClip tracks reference bones by name, so clips work on
 * clones as long as the bone hierarchy names match — which they do for clone(true).
 * We explicitly retarget by remapping track paths to the cloned root UUID.
 */
function retargetClips(
  clips: THREE.AnimationClip[],
  sourceRoot: THREE.Object3D,
  targetRoot: THREE.Object3D
): THREE.AnimationClip[] {
  // Build a name→UUID map for the target scene
  const targetMap = new Map<string, string>();
  targetRoot.traverse((obj) => targetMap.set(obj.name, obj.uuid));

  return clips.map((clip) => {
    const retargeted = clip.clone();
    retargeted.tracks = clip.tracks.map((track) => {
      // Track name format: "boneName.property" or "boneName[uuid].property"
      const dotIdx = track.name.indexOf('.');
      if (dotIdx === -1) return track.clone();
      const boneName = track.name.slice(0, dotIdx);
      const property = track.name.slice(dotIdx);
      const targetUUID = targetMap.get(boneName);
      const newTrack = track.clone();
      newTrack.name = targetUUID ? `${boneName}${property}` : track.name;
      return newTrack;
    });
    return retargeted;
  });
}

/** Select the best idle animation clip from available clips */
function selectIdleClip(clips: THREE.AnimationClip[]): THREE.AnimationClip {
  const idleKeywords = ['idle', 'stand', 'neutral', 'ready', 'wait', 'rest', 'bind', 'tpose', 't-pose'];
  for (const keyword of idleKeywords) {
    const found = clips.find((a) => a.name.toLowerCase().includes(keyword));
    if (found) return found;
  }
  return clips[0];
}

/** Set up the fixed camera once on mount — never changes after that */
function FixedCamera({ mode }: { mode: 'bust' | 'full' }) {
  const { camera } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (mode === 'bust') {
      cam.fov = 28;
      cam.position.set(0, 1.6, 3.2);
      cam.lookAt(0, 1.4, 0);
    } else {
      cam.fov = 40;
      cam.position.set(0, 1.0, 4.5);
      cam.lookAt(0, 1.0, 0);
    }
    cam.updateProjectionMatrix();
  }, [mode, camera]);
  return null;
}

/**
 * 3-Point Portrait Lighting
 * Key:  strong warm-white from upper-right front (primary illumination)
 * Fill: soft cool-tinted from upper-left front (lifts shadows, faction color)
 * Rim:  bright narrow from upper-rear (separates character from background)
 */
function PortraitLighting({ factionColor }: { factionColor: string }) {
  return (
    <>
      {/* Ambient base — very low so 3-point lights do the work */}
      <ambientLight intensity={0.25} color="#e8eaf0" />

      {/* KEY LIGHT — primary illumination, warm-white, upper-right front */}
      <directionalLight
        position={[2.5, 3.5, 3.0]}
        intensity={2.2}
        color="#fff5e8"
        castShadow={false}
      />

      {/* FILL LIGHT — soft, faction-tinted, upper-left front, lifts shadow side */}
      <directionalLight
        position={[-2.0, 2.0, 2.5]}
        intensity={0.75}
        color={factionColor}
        castShadow={false}
      />

      {/* RIM LIGHT — bright, cool-white, from upper-rear, separates from background */}
      <directionalLight
        position={[0.5, 4.0, -3.5]}
        intensity={1.4}
        color="#c8d8ff"
        castShadow={false}
      />

      {/* Subtle faction atmosphere point light near character chest */}
      <pointLight
        position={[0, 1.3, 1.8]}
        intensity={0.3}
        color={factionColor}
        distance={4}
        decay={2}
      />
    </>
  );
}

function PortraitModel({
  modelUrl,
  factionColor,
  mode = 'bust',
  flash = false,
  flip = false,
}: CharacterPortrait3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const [model, setModel] = useState<{ scene: THREE.Group; nudgeY: number } | null>(null);

  useEffect(() => {
    let active = true;
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      modelUrl,
      (gltf) => {
        if (!active) return;
        const cloned = gltf.scene.clone(true);

        // ── Step 1: Measure raw bounding box (pre-scale) ──────────────────────
        const rawBox = new THREE.Box3().setFromObject(cloned);
        const rawSize = rawBox.getSize(new THREE.Vector3());

        // ── Step 2: Compute scale to make model exactly 2.0 units tall ────────
        const scale = rawSize.y > 0 ? 2.0 / rawSize.y : 1;
        cloned.scale.setScalar(scale);

        // ── Step 3: Force matrix world update so Box3 sees post-scale coords ──
        cloned.updateMatrixWorld(true);

        // ── Step 4: Re-measure bounding box in post-scale world space ─────────
        const scaledBox = new THREE.Box3().setFromObject(cloned);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

        // ── Step 5: Center the mesh horizontally and vertically at Y=0 ────────
        // The child scene stays at Y=0 so the animation mixer never fights us.
        // X and Z centering is applied directly to the cloned scene.
        cloned.position.set(-scaledCenter.x, 1.0 - scaledCenter.y, -scaledCenter.z);

        // ── Step 6: Reset source rotation on root AND all top-level children ──
        cloned.rotation.set(0, 0, 0);
        cloned.children.forEach((child) => {
          child.rotation.set(0, 0, 0);
        });

        // ── Step 7: Apply faction color tint ──────────────────────────────────
        const color = new THREE.Color(factionColor);
        cloned.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh) return;
          const mesh = child as THREE.Mesh;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((mat) => {
            const m = mat as THREE.MeshStandardMaterial;
            if (m.isMeshStandardMaterial) {
              m.emissive = color;
              m.emissiveIntensity = 0.06;
              m.needsUpdate = true;
            }
          });
        });

        // ── Step 8: Idle animation ─────────────────────────────────────────────
        // Mixer is created on the cloned scene. The mixer runs at Y=0 inside
        // the parent group — it cannot override the parent group's Y offset.
        if (gltf.animations && gltf.animations.length > 0) {
          const retargeted = retargetClips(gltf.animations, gltf.scene, cloned);
          mixerRef.current = new THREE.AnimationMixer(cloned);
          const idleClip = selectIdleClip(retargeted);
          const action = mixerRef.current.clipAction(idleClip);
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.fadeIn(0.3);
          action.play();
        }

        // ── Step 9: Compute the Y nudge for the PARENT group ──────────────────
        // getYNudge returns 0 ONLY for Bannon and Maime (reference baseline).
        // ALL other characters get +1.15 universally.
        // This offset is applied to the parent THREE.Group, NOT to the cloned
        // scene, so the animation mixer running on the child at Y=0 can never
        // override it. This is the correct structural fix.
        const nudgeY = getYNudge(modelUrl);

        setModel({ scene: cloned, nudgeY });
      },
      undefined,
      (err) => console.warn('Portrait GLB load failed:', modelUrl, err)
    );
    return () => {
      active = false;
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
    };
  }, [modelUrl, factionColor]);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
  });

  if (!model) return null;

  return (
    // OUTER GROUP: holds the UI layout offset (nudgeY) — never touched by the animation mixer
    <group
      ref={groupRef}
      position={[0, model.nudgeY, 0]}
      // P2 side: rotate 180° on Y-axis so the character faces toward P1.
      rotation={[0, flip ? Math.PI : 0, 0]}
    >
      {/* INNER SCENE: animation mixer runs here at Y=0, cannot override parent offset */}
      <primitive object={model.scene} />
    </group>
  );
}

export default function CharacterPortrait3D({
  modelUrl,
  factionColor,
  mode = 'bust',
  flash = false,
  flip = false,
}: CharacterPortrait3DProps) {
  return (
    <div className="relative w-full h-full">
      {/* Faction color atmosphere glow behind canvas */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 80%, ${factionColor}22 0%, transparent 70%)`,
        }}
      />
      <Canvas
        gl={{ antialias: false, alpha: true }}
        style={{
          width: '100%',
          height: '100%',
          filter: flash ? 'brightness(1.8)' : undefined,
          transition: 'filter 0.05s',
        }}
      >
        {/* Fixed camera — set once, never recomputed */}
        <FixedCamera mode={mode} />

        {/* 3-Point Portrait Lighting: key + fill + rim */}
        <PortraitLighting factionColor={factionColor} />

        <Suspense fallback={null}>
          <PortraitModel
            modelUrl={modelUrl}
            factionColor={factionColor}
            mode={mode}
            flash={flash}
            flip={flip}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
