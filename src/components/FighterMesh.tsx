import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface FighterMeshProps {
  state: string;
  modelUrl: string | null;
  position: [number, number, number];
  facing: 1 | -1;
  tint?: string;
}

export function FighterMesh({ state, modelUrl, position, facing, tint }: FighterMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [model, setModel] = useState<THREE.Group | null>(null);

  useEffect(() => {
    if (!modelUrl) {
      setModel(null);
      return;
    }

    let active = true;
    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        if (!active) return;
        const cloned = gltf.scene.clone(true);
        const box = new THREE.Box3().setFromObject(cloned);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const targetHeight = 2.8;
        const scale = size.y > 0 ? targetHeight / size.y : 1;

        cloned.scale.setScalar(scale);
        cloned.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

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
                `
                vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                float snapRes = 160.0;
                gl_Position.xyz = floor(gl_Position.xyz * snapRes) / snapRes;
                `
              );
            };
          });
        });

        setModel(cloned);
      },
      undefined,
      (error) => console.error('Fighter GLB load failed:', error)
    );

    return () => {
      active = false;
    };
  }, [modelUrl]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const attacking = state === 'Startup' || state === 'Active';
    const bob = state === 'Neutral' ? Math.sin(clock.elapsedTime * 5) * 0.025 : 0;
    groupRef.current.position.y = position[1] + bob;
    groupRef.current.position.x = position[0];
    groupRef.current.position.z = position[2];
    groupRef.current.scale.x = facing * (attacking ? 1.03 : 1);
  });

  if (!model) {
    return (
      <group ref={groupRef} position={position}>
        <mesh position={[0, 1.35, 0]}>
          <capsuleGeometry args={[0.48, 1.65, 5, 8]} />
          <meshStandardMaterial color={tint ?? '#b9b9b9'} roughness={0.9} flatShading />
        </mesh>
        <mesh position={[0, 2.55, 0]}>
          <icosahedronGeometry args={[0.38, 1]} />
          <meshStandardMaterial color={tint ?? '#b9b9b9'} roughness={0.9} flatShading />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={groupRef} position={position}>
      <primitive object={model} />
    </group>
  );
}
