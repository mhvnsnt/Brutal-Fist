'use client';

import React from 'react';

const FLOOR_WIDTH = 24;
const FLOOR_DEPTH = 10;
const P1_X = -1.8;
const P2_X = 1.8;

interface TrainingStageProps {
  p1Color: string;
  p2Color: string;
}

export function TrainingStage({ p1Color, p2Color }: TrainingStageProps) {
  return (
    <group>
      {/* Floor plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[FLOOR_WIDTH, FLOOR_DEPTH]} />
        <meshStandardMaterial color="#2a2a2e" roughness={0.85} metalness={0.15} />
      </mesh>
      {/* Floor grid */}
      <gridHelper args={[FLOOR_WIDTH, 24, '#222222', '#1a1a1a']} position={[0, 0.002, 0]} />
      {/* Center line */}
      <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.04, FLOOR_DEPTH]} />
        <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.4} />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, 3, -FLOOR_DEPTH / 2]} receiveShadow>
        <planeGeometry args={[FLOOR_WIDTH, 8]} />
        <meshStandardMaterial color="#0a0a0a" roughness={1} />
      </mesh>
      {/* Side walls */}
      <mesh position={[-FLOOR_WIDTH / 2, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[FLOOR_DEPTH, 8]} />
        <meshStandardMaterial color="#080808" roughness={1} />
      </mesh>
      <mesh position={[FLOOR_WIDTH / 2, 3, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[FLOOR_DEPTH, 8]} />
        <meshStandardMaterial color="#080808" roughness={1} />
      </mesh>
      {/* Faction floor glows */}
      <pointLight position={[P1_X, 0.5, 0]} intensity={1.2} color={p1Color} distance={4} decay={2} />
      <pointLight position={[P2_X, 0.5, 0]} intensity={1.2} color={p2Color} distance={4} decay={2} />
      <pointLight position={[0, 6, -4]} intensity={0.6} color="#1a1a2e" distance={20} decay={1} />
    </group>
  );
}
