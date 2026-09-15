import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { FighterState } from '../types';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface FighterMeshProps {
  state: string;
  modelUrl: string | null;
}

export function FighterMesh({ state, modelUrl }: FighterMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [model, setModel] = useState<THREE.Group | null>(null);

  useEffect(() => {
    if (modelUrl) {
      const loader = new GLTFLoader();
      loader.load(modelUrl, (gltf) => {
        const clonedModel = gltf.scene.clone(true);

        clonedModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const mat = mesh.material as THREE.MeshStandardMaterial;

            // Force Nearest-Neighbor Filtering (Pixelated Textures)
            if (mat.map) {
              mat.map.minFilter = THREE.NearestFilter;
              mat.map.magFilter = THREE.NearestFilter;
              mat.map.generateMipmaps = false;
              mat.needsUpdate = true;
            }

            // Inject PSX Vertex Snapping (Jitter) Shader
            mat.onBeforeCompile = (shader) => {
              shader.vertexShader = shader.vertexShader.replace(
                '#include <project_vertex>',
                `
                vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                
                // Emulate PS1 low-precision vertex math
                float snapRes = 120.0; // Lower = more geometric wobble
                gl_Position.xyz = floor(gl_Position.xyz * snapRes) / snapRes;
                `
              );
            };
          }
        });

        // Center and scale
        clonedModel.position.set(0, 0, 0);
        clonedModel.scale.set(1, 1, 1);
        setModel(clonedModel);
      });
    }
  }, [modelUrl]);

  useFrame((stateTimer) => {
    if (groupRef.current && !model) {
      // Vertex snapping / jitter effect simulation for PSX aesthetic placeholder
      const jitterAmount = 0.02;
      groupRef.current.position.x = Math.round(Math.sin(stateTimer.clock.elapsedTime * 10) * jitterAmount * 10) / 10;
      groupRef.current.position.y = Math.round(Math.cos(stateTimer.clock.elapsedTime * 12) * jitterAmount * 10) / 10;
    }
  });

  const getColorForState = (s: string) => {
    switch (s) {
      case FighterState.Neutral: return '#88cc88';
      case FighterState.Startup: return '#ffff44';
      case FighterState.Active: return '#ff4444';
      case FighterState.Recovery: return '#4444ff';
      default: return '#cccccc';
    }
  };

  if (model) {
    return (
      <group ref={groupRef}>
        <primitive object={model} />
      </group>
    );
  }

  return (
    <group ref={groupRef}>
      {/* Torso */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[1, 1.5, 0.5]} />
        <meshBasicMaterial color={getColorForState(state)} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 2.25, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshBasicMaterial color={getColorForState(state)} />
      </mesh>
      {/* Arms */}
      <mesh position={[-0.75, 1, 0]}>
        <boxGeometry args={[0.3, 1, 0.3]} />
        <meshBasicMaterial color={getColorForState(state)} />
      </mesh>
      <mesh position={[0.75, 1, 0]}>
        <boxGeometry args={[0.3, 1, 0.3]} />
        <meshBasicMaterial color={getColorForState(state)} />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.3, 0, 0]}>
        <boxGeometry args={[0.4, 1, 0.4]} />
        <meshBasicMaterial color={getColorForState(state)} />
      </mesh>
      <mesh position={[0.3, 0, 0]}>
        <boxGeometry args={[0.4, 1, 0.4]} />
        <meshBasicMaterial color={getColorForState(state)} />
      </mesh>
    </group>
  );
}
