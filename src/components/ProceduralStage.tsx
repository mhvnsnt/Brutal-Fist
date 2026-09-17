import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import { resolveStageConfig, type StageId } from "../engine/combat/StageConfig";

function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ProceduralStageProps {
  stageId: StageId;
  p1Color: string;
  p2Color: string;
  seed?: string;
}

export function ProceduralStage({ stageId, p1Color, p2Color, seed }: ProceduralStageProps) {
  const cfg = resolveStageConfig(stageId);
  const resolvedId = cfg.id;
  const rng = useMemo(() => mulberry32(xmur3(`${seed ?? "brutal"}:${resolvedId}`)()), [seed, resolvedId]);
  const noise2D = useMemo(() => createNoise2D(rng), [rng]);

  const halfW = Number.isFinite(cfg.boundaryX) ? cfg.boundaryX : 8;
  const halfD = Number.isFinite(cfg.boundaryZ) ? cfg.boundaryZ : 6;
  const floorW = Math.min(28, Math.max(10, halfW * 2.4));
  const floorD = Math.min(18, Math.max(8, halfD * 2.2));

  const ground = useMemo(() => {
    const geo = new THREE.PlaneGeometry(floorW, floorD, 32, 20);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const ring = Math.max(Math.abs(x) / (floorW * 0.18), Math.abs(z) / (floorD * 0.22));
      if (ring < 1) continue;
      const n =
        noise2D(x * 0.12, z * 0.12) * 0.18 +
        noise2D(x * 0.35, z * 0.35) * 0.07;
      pos.setY(i, n * Math.min(1, (ring - 1) * 1.4));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [floorW, floorD, noise2D]);

  const buildings = useMemo(() => {
    const items: Array<{ pos: [number, number, number]; scale: [number, number, number]; rot: number; windows: boolean }> = [];
    const count = 10 + Math.floor(rng() * 8);
    for (let i = 0; i < count; i++) {
      const side = rng() < 0.5 ? -1 : 1;
      const x = side * (floorW * 0.42 + rng() * 4.2);
      const z = (rng() - 0.5) * floorD * 0.95;
      const h = 2.4 + rng() * 7.5;
      items.push({
        pos: [x, h / 2, z],
        scale: [1.1 + rng() * 2.2, h, 1.1 + rng() * 2.2],
        rot: rng() * 0.2,
        windows: rng() > 0.35,
      });
    }
    return items;
  }, [rng, floorW, floorD]);

  const lamps = useMemo(() => {
    const items: Array<[number, number, number]> = [];
    const n = 4 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      items.push([Math.cos(t) * floorW * 0.32, 2.4, Math.sin(t) * floorD * 0.28]);
    }
    return items;
  }, [rng, floorW, floorD]);

  const crowd = useMemo(() => {
    const items: Array<[number, number, number, number]> = [];
    for (let i = 0; i < 14; i++) {
      const side = rng() < 0.5 ? -1 : 1;
      items.push([
        side * (floorW * 0.36 + rng() * 1.2),
        0.85,
        (rng() - 0.5) * floorD * 0.7,
        1.4 + rng() * 0.5,
      ]);
    }
    return items;
  }, [rng, floorW, floorD]);

  const groundColor = cfg.bgColor;
  const accent = cfg.accentColor;

  return (
    <group>
      <ambientLight intensity={cfg.ambientIntensity} color={cfg.ambientColor} />
      <directionalLight
        position={[6, 10, 4]}
        intensity={1.35}
        color={cfg.primaryLightColor}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, 6, -3]} intensity={0.45} color={cfg.fillLightColor} />
      <pointLight position={[0, 4.2, 0]} intensity={0.8} color={accent} distance={18} />
      <pointLight position={[-4, 2.4, 3]} intensity={0.55} color={p1Color} distance={10} />
      <pointLight position={[4, 2.4, 3]} intensity={0.55} color={p2Color} distance={10} />

      <mesh geometry={ground} receiveShadow>
        <meshStandardMaterial color={groundColor} roughness={0.92} metalness={0.08} />
      </mesh>

      <mesh position={[0, 18, 0]}>
        <sphereGeometry args={[42, 16, 12]} />
        <meshBasicMaterial color={cfg.ambientColor} side={THREE.BackSide} />
      </mesh>

      <gridHelper args={[Math.max(floorW, floorD), 16, accent, "#1c1c22"]} position={[0, 0.02, 0]} />

      {resolvedId === "wrestling_ring" && <RingRopes width={8} depth={8} color={accent} />}
      {resolvedId === "mma_octagon" && <OctagonFence radius={6.4} color={accent} />}
      {resolvedId === "steel_cage" && <CageWalls size={7.2} />}
      {resolvedId === "dojo" && <DojoHall width={floorW} depth={floorD} accent={accent} />}
      {resolvedId === "subway" && <SubwayRails />}
      {resolvedId === "sky_crane" && <CraneBeams />}
      {resolvedId === "ghetto_streets" && <StreetSet width={floorW} depth={floorD} accent={accent} />}
      {resolvedId === "industrial" && <IndustrialPipes />}
      {resolvedId === "junkyard" && <JunkPiles />}
      {(resolvedId === "spike_pit" || resolvedId === "acid_pit" || resolvedId === "grinder_pit") && (
        <HazardPit color={accent} />
      )}

      {buildings.map((p, i) => (
        <group key={`b${i}`} position={p.pos} rotation={[0, p.rot, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={p.scale} />
            <meshStandardMaterial
              color={i % 2 === 0 ? "#1b1b20" : "#101014"}
              roughness={0.85}
              metalness={resolvedId.includes("steel") || resolvedId === "industrial" ? 0.55 : 0.12}
              emissive={p.windows ? accent : "#000000"}
              emissiveIntensity={p.windows ? 0.12 : 0}
            />
          </mesh>
        </group>
      ))}

      {lamps.map((pos, i) => (
        <group key={`l${i}`} position={pos}>
          <mesh>
            <cylinderGeometry args={[0.05, 0.08, 2.4, 6]} />
            <meshStandardMaterial color="#2a2a30" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 1.3, 0]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={2.2} />
          </mesh>
          <pointLight position={[0, 1.2, 0]} intensity={0.55} color={accent} distance={8} />
        </group>
      ))}

      {crowd.map((c, i) => (
        <mesh key={`c${i}`} position={[c[0], c[3] / 2, c[2]]}>
          <capsuleGeometry args={[0.18, c[3] * 0.45, 4, 8]} />
          <meshStandardMaterial color="#0c0c10" roughness={1} />
        </mesh>
      ))}

      <NeonTrim width={floorW} depth={floorD} color={accent} noise={noise2D} />
    </group>
  );
}

function NeonTrim({
  width, depth, color, noise,
}: { width: number; depth: number; color: string; noise: (x: number, y: number) => number }) {
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    void noise(t * 0.1, 0);
  });
  const y = 0.04;
  return (
    <group>
      <mesh position={[0, y, -depth / 2]}>
        <boxGeometry args={[width, 0.05, 0.05]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} />
      </mesh>
      <mesh position={[0, y, depth / 2]}>
        <boxGeometry args={[width, 0.05, 0.05]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}

function RingRopes({ width, depth, color }: { width: number; depth: number; color: string }) {
  const ys = [0.45, 0.85, 1.25];
  return (
    <group>
      {ys.map((y) => (
        <group key={y}>
          {[-1, 1].map((s) => (
            <mesh key={`x${s}`} position={[0, y, (depth / 2) * s]}>
              <boxGeometry args={[width, 0.05, 0.05]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={`z${s}`} position={[(width / 2) * s, y, 0]}>
              <boxGeometry args={[0.05, 0.05, depth]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
            </mesh>
          ))}
        </group>
      ))}
      {[-1, 1].map((x) =>
        [-1, 1].map((z) => (
          <mesh key={`${x}${z}`} position={[(width / 2) * x, 0.75, (depth / 2) * z]}>
            <cylinderGeometry args={[0.12, 0.16, 1.5, 8]} />
            <meshStandardMaterial color="#c4c4c8" metalness={0.7} roughness={0.3} />
          </mesh>
        )),
      )}
    </group>
  );
}

function OctagonFence({ radius, color }: { radius: number; color: string }) {
  const sides = 8;
  return (
    <group>
      {Array.from({ length: sides }).map((_, i) => {
        const a = (i / sides) * Math.PI * 2 + Math.PI / sides;
        const x = Math.cos(a) * radius;
        const z = Math.sin(a) * radius;
        return (
          <mesh key={i} position={[x, 1.4, z]} rotation={[0, -a, 0]}>
            <boxGeometry args={[radius * 0.85, 2.8, 0.08]} />
            <meshStandardMaterial color="#111114" metalness={0.5} roughness={0.4} transparent opacity={0.55} emissive={color} emissiveIntensity={0.08} />
          </mesh>
        );
      })}
    </group>
  );
}

function CageWalls({ size }: { size: number }) {
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={`z${s}`} position={[0, 1.8, (size / 2) * s]}>
          <boxGeometry args={[size, 3.6, 0.08]} />
          <meshStandardMaterial color="#2a2a30" metalness={0.8} roughness={0.25} wireframe={false} transparent opacity={0.45} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`x${s}`} position={[(size / 2) * s, 1.8, 0]}>
          <boxGeometry args={[0.08, 3.6, size]} />
          <meshStandardMaterial color="#2a2a30" metalness={0.8} roughness={0.25} transparent opacity={0.45} />
        </mesh>
      ))}
    </group>
  );
}

function DojoHall({ width, depth, accent }: { width: number; depth: number; accent: string }) {
  return (
    <group>
      <mesh position={[0, 2.6, -depth / 2 + 0.2]}>
        <boxGeometry args={[width * 0.7, 0.08, 0.08]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.8} />
      </mesh>
      {[-width / 3, width / 3].map((x) => (
        <mesh key={x} position={[x, 1.6, -depth / 2 + 0.4]}>
          <boxGeometry args={[1.6, 3.2, 0.12]} />
          <meshStandardMaterial color="#1c140e" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function SubwayRails() {
  return (
    <group>
      {[-1.6, 1.6].map((z) => (
        <mesh key={z} position={[0, 0.04, z]} rotation={[0, 0, 0]}>
          <boxGeometry args={[18, 0.06, 0.12]} />
          <meshStandardMaterial color="#8a8a90" metalness={0.85} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function CraneBeams() {
  return (
    <group>
      <mesh position={[0, 6.5, -2]}>
        <boxGeometry args={[16, 0.25, 0.25]} />
        <meshStandardMaterial color="#c4b48a" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[-5, 3.2, -2]}>
        <boxGeometry args={[0.25, 6.4, 0.25]} />
        <meshStandardMaterial color="#c4b48a" metalness={0.6} roughness={0.35} />
      </mesh>
    </group>
  );
}

function HazardPit({ color }: { color: string }) {
  return (
    <mesh position={[0, -1.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[3.4, 24]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} roughness={0.4} />
    </mesh>
  );
}

function StreetSet({ width, depth, accent }: { width: number; depth: number; accent: string }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, depth]} />
        <meshStandardMaterial color="#16161a" roughness={0.7} />
      </mesh>
      {[-1.7, 1.7].map((x) => (
        <mesh key={x} position={[x, 0.04, 0]}>
          <boxGeometry args={[0.08, 0.02, depth]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function IndustrialPipes() {
  return (
    <group>
      <mesh position={[-5.4, 3.2, -1]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 8, 8]} />
        <meshStandardMaterial color="#4a4038" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[5.2, 2.6, 1.4]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.14, 0.14, 6, 8]} />
        <meshStandardMaterial color="#3a3834" metalness={0.75} roughness={0.3} />
      </mesh>
    </group>
  );
}

function JunkPiles() {
  return (
    <group>
      {[[-6, 0.6, -2], [6.2, 0.5, 1.4], [-5.5, 0.4, 2.2]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation={[0.2, i, 0.1]}>
          <dodecahedronGeometry args={[0.9 + i * 0.15, 0]} />
          <meshStandardMaterial color="#2a241c" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

export default ProceduralStage;
