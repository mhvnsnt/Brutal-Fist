'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { isPluginBindPose, determineForwardCorrection, measureVisibleGeometryBox } from '../engine/pipeline/CharacterPipeline';
import { restoreAuthoredTextures } from '../engine/pipeline/restoreAuthoredTextures';
import { FOOT_PLANT_SINK, selectYaw } from '../engine/V7OrientationContract';
import { sanitizeMotionClip } from '../engine/retarget/neutralizeRootMotion';
import { loadGLTF } from '../engine/pipeline/glbCache';
import { rosterHeightScale } from '../engine/pipeline/rosterHeightScale';
import { applyFighterLook } from '../engine/render/applyPartPaint';
import type { GearAddon, PartPaint } from '../engine/render/paintMath';

interface CharacterPortrait3DProps {
  modelUrl: string;
  factionColor: string;
  mode?: 'bust' | 'full';
  flash?: boolean;
  flip?: boolean;
  rotationY?: number;
  side?: 1 | -1;
  paint?: PartPaint;
  addon?: GearAddon;
}

function selectIdleClip(clips: THREE.AnimationClip[]): THREE.AnimationClip {
  const idleKeywords = ['idle', 'stand', 'neutral', 'ready', 'wait', 'rest', 'bind', 'tpose', 't-pose'];
  for (const keyword of idleKeywords) {
    const found = clips.find((a) => a.name.toLowerCase().includes(keyword));
    if (found) return found;
  }
  return clips[0];
}

function FixedCamera({ mode }: { mode: 'bust' | 'full' }) {
  const { camera } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (mode === 'bust') {
      cam.fov = 28;
      cam.position.set(0, 1.55, 3.15);
      cam.lookAt(0, 1.38, 0);
    } else {
      cam.fov = 40;
      cam.position.set(0, 1.0, 4.5);
      cam.lookAt(0, 1.0, 0);
    }
    cam.updateProjectionMatrix();
  }, [mode, camera]);
  return null;
}

function PortraitLighting({ factionColor }: { factionColor: string }) {
  return (
    <>
      <ambientLight intensity={0.25} color="#e8eaf0" />
      <directionalLight position={[2.5, 3.5, 3.0]} intensity={2.2} color="#fff5e8" castShadow={false} />
      <directionalLight position={[-2.0, 2.0, 2.5]} intensity={0.75} color={factionColor} castShadow={false} />
      <directionalLight position={[0.5, 4.0, -3.5]} intensity={1.4} color="#c8d8ff" />
      <pointLight position={[0, 1.3, 1.8]} intensity={0.3} color={factionColor} distance={4} decay={2} />
    </>
  );
}

function PortraitModel({
  modelUrl,
  factionColor,
  mode = 'bust',
  flash = false,
  flip = false,
  rotationY,
  side,
  paint,
  addon,
}: CharacterPortrait3DProps) {
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const [model, setModel] = useState<{ scene: THREE.Group; pluginBindPose: boolean } | null>(null);
  const paintKey = JSON.stringify(paint ?? {});

  useEffect(() => {
    let active = true;
    loadGLTF(modelUrl)
      .then((gltf) => {
        if (!active) return;
        const cloned = SkeletonUtils.clone(gltf.scene) as THREE.Group;
        restoreAuthoredTextures(cloned, modelUrl);

        cloned.traverse((child) => {
          if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
            (child as THREE.SkinnedMesh).frustumCulled = false;
          }
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) {
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((mat) => {
              const m = mat as THREE.MeshStandardMaterial;
              if (m?.map) {
                m.map.colorSpace = THREE.SRGBColorSpace;
                m.map.flipY = false;
                m.map.needsUpdate = true;
              }
              if (m && 'skinning' in m) {
                (m as THREE.MeshStandardMaterial & { skinning: boolean }).skinning = true;
              }
            });
          }
        });

        cloned.rotation.set(0, 0, 0);
        cloned.position.set(0, 0, 0);
        cloned.scale.set(1, 1, 1);
        cloned.updateMatrixWorld(true);
        const rawBox = measureVisibleGeometryBox(cloned);
        const rawSize = rawBox.getSize(new THREE.Vector3());

        const scale = rawSize.y > 0.01
          ? (2.0 / rawSize.y) * rosterHeightScale(modelUrl)
          : 1;
        cloned.scale.setScalar(scale);
        cloned.updateMatrixWorld(true);

        const scaledBox = measureVisibleGeometryBox(cloned);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
        cloned.position.set(-scaledCenter.x, -scaledBox.min.y - FOOT_PLANT_SINK, -scaledCenter.z);
        cloned.updateMatrixWorld(true);

        const pluginBindPose = isPluginBindPose(cloned);
        const restYaw = pluginBindPose ? 0 : determineForwardCorrection(cloned);
        cloned.rotation.y = restYaw;
        cloned.updateMatrixWorld(true);
        const restBox = measureVisibleGeometryBox(cloned);
        const restCenter = restBox.getCenter(new THREE.Vector3());
        cloned.position.x -= restCenter.x;
        cloned.position.z -= restCenter.z;
        cloned.updateMatrixWorld(true);

        const color = new THREE.Color(factionColor);
        cloned.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh) return;
          const mesh = child as THREE.Mesh;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((mat) => {
            const m = mat as THREE.MeshStandardMaterial;
            if (m.isMeshStandardMaterial && !m.map) {
              m.emissive = color;
              m.emissiveIntensity = 0.04;
              m.needsUpdate = true;
            }
          });
        });

        if (gltf.animations && gltf.animations.length > 0) {
          mixerRef.current = new THREE.AnimationMixer(cloned);
          try {
            const idleClip = sanitizeMotionClip(selectIdleClip(gltf.animations).clone());
            const action = mixerRef.current.clipAction(idleClip, cloned);
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.fadeIn(0.3);
            action.play();
          } catch (err) {
            console.warn('[Portrait] idle clip failed', modelUrl, err);
          }
        }

        setModel({ scene: cloned, pluginBindPose });
      })
      .catch((err) => console.warn('[Portrait] GLB load failed:', modelUrl, err));
    return () => {
      active = false;
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
    };
  }, [modelUrl, factionColor]);

  useEffect(() => {
    if (!model) return;
    applyFighterLook(model.scene, paint, addon);
  }, [model, paintKey, addon, paint]);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
  });

  if (!model) return null;

  const portraitRotY = side === 1 || side === -1
    ? selectYaw(side, model.pluginBindPose)
    : (rotationY ?? 0);
  void flip;
  void mode;
  void flash;

  return (
    <group rotation={[0, portraitRotY, 0]}>
      <primitive object={model.scene} />
    </group>
  );
}

function PortraitScene({
  modelUrl,
  factionColor,
  mode = 'bust',
  flash = false,
  flip = false,
  rotationY,
  side,
  paint,
  addon,
}: CharacterPortrait3DProps) {
  return (
    <>
      <FixedCamera mode={mode} />
      <PortraitLighting factionColor={factionColor} />
      <Suspense fallback={null}>
        <PortraitModel
          modelUrl={modelUrl}
          factionColor={factionColor}
          mode={mode}
          flash={flash}
          flip={flip}
          rotationY={rotationY}
          side={side}
          paint={paint}
          addon={addon}
        />
      </Suspense>
    </>
  );
}

export default function CharacterPortrait3D({
  modelUrl,
  factionColor,
  mode = 'bust',
  flash = false,
  flip = false,
  rotationY,
  side,
  paint,
  addon,
}: CharacterPortrait3DProps) {
  return (
    <div className="relative w-full h-full">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 80%, ${factionColor}22 0%, transparent 70%)`,
        }}
      />
      <Canvas
        gl={{ antialias: false, alpha: true, premultipliedAlpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
        style={{
          width: '100%',
          height: '100%',
          background: 'transparent',
          filter: flash ? 'brightness(1.8)' : undefined,
          transition: 'filter 0.05s',
        }}
      >
        <PortraitScene
          modelUrl={modelUrl}
          factionColor={factionColor}
          mode={mode}
          flash={flash}
          flip={flip}
          rotationY={rotationY}
          side={side}
          paint={paint}
          addon={addon}
        />
      </Canvas>
    </div>
  );
}
