import { useMemo, useRef } from "react";
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

const INDOOR = new Set(["dojo", "wrestling_ring", "mma_octagon", "steel_cage", "subway"]);
const UNIQUE_OUTDOOR = new Set(["industrial", "ghetto_streets", "junkyard", "sky_crane", "spike_pit", "acid_pit", "grinder_pit", "gang_brawl"]);

export function ProceduralStage({ stageId, p1Color, p2Color, seed }: ProceduralStageProps) {
  const cfg = resolveStageConfig(stageId);
  const resolvedId = cfg.id;
  const rng = useMemo(() => mulberry32(xmur3(`${seed ?? "brutal"}:${resolvedId}`)()), [seed, resolvedId]);
  const noise2D = useMemo(() => createNoise2D(rng), [rng]);

  const halfW = Number.isFinite(cfg.boundaryX) ? cfg.boundaryX : 8;
  const halfD = Number.isFinite(cfg.boundaryZ) ? cfg.boundaryZ : 6;
  const floorW = Math.min(28, Math.max(10, halfW * 2.4));
  const floorD = Math.min(18, Math.max(8, halfD * 2.2));
  const indoor = INDOOR.has(resolvedId);
  const uniqueOutdoor = UNIQUE_OUTDOOR.has(resolvedId);
  const hideGeneric = indoor || uniqueOutdoor;
  const accent = cfg.accentColor;

  const ground = useMemo(() => {
    const geo = new THREE.PlaneGeometry(floorW, floorD, indoor ? 8 : 32, indoor ? 6 : 20);
    geo.rotateX(-Math.PI / 2);
    if (!indoor) {
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const ring = Math.max(Math.abs(x) / (floorW * 0.18), Math.abs(z) / (floorD * 0.22));
        if (ring < 1) continue;
        const n = noise2D(x * 0.12, z * 0.12) * 0.18 + noise2D(x * 0.35, z * 0.35) * 0.07;
        pos.setY(i, n * Math.min(1, (ring - 1) * 1.4));
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    }
    return geo;
  }, [floorW, floorD, noise2D, indoor]);

  const buildings = useMemo(() => {
    if (hideGeneric) return [] as Array<{ pos: [number, number, number]; scale: [number, number, number]; rot: number; windows: boolean }>;
    const items: Array<{ pos: [number, number, number]; scale: [number, number, number]; rot: number; windows: boolean }> = [];
    const count = 10 + Math.floor(rng() * 8);
    for (let i = 0; i < count; i++) {
      const side = rng() < 0.5 ? -1 : 1;
      items.push({
        pos: [side * (floorW * 0.42 + rng() * 4.2), (2.4 + rng() * 7.5) / 2, (rng() - 0.5) * floorD * 0.95],
        scale: [1.1 + rng() * 2.2, 2.4 + rng() * 7.5, 1.1 + rng() * 2.2],
        rot: rng() * 0.2,
        windows: rng() > 0.35,
      });
    }
    return items;
  }, [rng, floorW, floorD, hideGeneric]);

  return (
    <group>
      <ambientLight intensity={cfg.ambientIntensity} color={cfg.ambientColor} />
      <directionalLight position={[6, 10, 4]} intensity={1.35} color={cfg.primaryLightColor} />
      <directionalLight position={[-5, 6, -3]} intensity={0.45} color={cfg.fillLightColor} />
      <pointLight position={[0, 4.2, 0]} intensity={0.8} color={accent} distance={18} />
      <pointLight position={[-4, 2.4, 3]} intensity={0.55} color={p1Color} distance={10} />
      <pointLight position={[4, 2.4, 3]} intensity={0.55} color={p2Color} distance={10} />

      {!indoor && (
        <mesh geometry={ground} receiveShadow>
          <meshStandardMaterial color={cfg.bgColor} roughness={0.92} metalness={0.08} />
        </mesh>
      )}

      <mesh position={[0, 18, 0]}>
        <sphereGeometry args={[42, 16, 12]} />
        <meshBasicMaterial color={cfg.ambientColor} side={THREE.BackSide} />
      </mesh>

      {resolvedId === "dojo" && <DojoHall accent={accent} />}
      {resolvedId === "wrestling_ring" && <WrestlingRing accent={accent} />}
      {resolvedId === "mma_octagon" && <OctagonCage accent={accent} />}
      {resolvedId === "steel_cage" && <SteelCage accent={accent} />}
      {resolvedId === "subway" && <SubwayStation accent={accent} />}
      {resolvedId === "sky_crane" && <SkyCrane accent={accent} />}
      {resolvedId === "ghetto_streets" && <GhettoStreet accent={accent} />}
      {resolvedId === "industrial" && <IndustrialFloor accent={accent} />}
      {resolvedId === "junkyard" && <Junkyard accent={accent} />}
      {resolvedId === "spike_pit" && <SpikePit accent={accent} />}
      {resolvedId === "acid_pit" && <AcidPit accent={accent} />}
      {resolvedId === "grinder_pit" && <GrinderPit accent={accent} />}
      {resolvedId === "gang_brawl" && <GangBrawl accent={accent} />}

      {buildings.map((p, i) => (
        <group key={`b${i}`} position={p.pos} rotation={[0, p.rot, 0]}>
          <mesh>
            <boxGeometry args={p.scale} />
            <meshStandardMaterial
              color={i % 2 === 0 ? "#1b1b20" : "#101014"}
              roughness={0.85}
              metalness={0.12}
              emissive={p.windows ? accent : "#000000"}
              emissiveIntensity={p.windows ? 0.12 : 0}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Box({
  p, s, c, r = 0.9, m = 0.1, e, ei = 0, rot,
}: {
  p: [number, number, number];
  s: [number, number, number];
  c: string;
  r?: number;
  m?: number;
  e?: string;
  ei?: number;
  rot?: [number, number, number];
}) {
  return (
    <mesh position={p} rotation={rot}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={r} metalness={m} emissive={e ?? "#000"} emissiveIntensity={ei} />
    </mesh>
  );
}

function Cyl({
  p, args, c, r = 0.6, m = 0.4, e, ei = 0, rot,
}: {
  p: [number, number, number];
  args: [number, number, number, number?];
  c: string;
  r?: number;
  m?: number;
  e?: string;
  ei?: number;
  rot?: [number, number, number];
}) {
  return (
    <mesh position={p} rotation={rot}>
      <cylinderGeometry args={[args[0], args[1], args[2], args[3] ?? 8]} />
      <meshStandardMaterial color={c} roughness={r} metalness={m} emissive={e ?? "#000"} emissiveIntensity={ei} />
    </mesh>
  );
}

function DojoHall({ accent }: { accent: string }) {
  const mats = [];
  for (let x = -3; x <= 3; x++) {
    for (let z = -2; z <= 2; z++) {
      mats.push(
        <Box key={`${x}${z}`} p={[x * 1.15, 0.02, z * 1.15]} s={[1.08, 0.04, 1.08]} c={(x + z) % 2 === 0 ? "#6b3a1f" : "#5a3018"} r={0.95} />,
      );
    }
  }
  return (
    <group>
      <Box p={[0, 0, 0]} s={[10, 0.06, 8]} c="#3a2414" r={0.95} />
      {mats}
      {[-4.4, 4.4].map((x) => (
        <group key={x}>
          <Box p={[x, 2.1, 0]} s={[0.18, 4.2, 8]} c="#2a1a10" r={0.9} />
          {[-2.4, 0, 2.4].map((z) => (
            <Box key={z} p={[x, 1.7, z]} s={[0.06, 3.2, 1.6]} c="#d8c9a4" r={0.7} e="#fff4d6" ei={0.12} />
          ))}
        </group>
      ))}
      <Box p={[0, 2.1, -3.9]} s={[10, 4.2, 0.18]} c="#2a1a10" />
      {[-3, -1, 1, 3].map((x) => (
        <Cyl key={x} p={[x, 2.1, -3.7]} args={[0.16, 0.18, 4.2, 8]} c="#4a3018" r={0.85} m={0.05} />
      ))}
      <Box p={[0, 4.3, 0]} s={[10.4, 0.16, 8.4]} c="#1a1008" />
      {[-2, 0, 2].map((z) => (
        <Box key={z} p={[0, 4.15, z]} s={[10, 0.12, 0.18]} c="#3a2814" />
      ))}
      {[-2.6, 2.6].map((x) => (
        <group key={x}>
          <Cyl p={[x, 3.55, -2.2]} args={[0.12, 0.12, 0.18, 8]} c="#1a1008" />
          <mesh position={[x, 3.35, -2.2]}>
            <sphereGeometry args={[0.22, 10, 10]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.6} />
          </mesh>
          <pointLight position={[x, 3.2, -2.2]} intensity={0.7} color={accent} distance={7} />
        </group>
      ))}
      <Box p={[0, 2.4, -3.72]} s={[1.4, 1.1, 0.08]} c="#1a0800" e={accent} ei={0.25} />
      <Box p={[0, 3.15, -3.72]} s={[2.2, 0.08, 0.28]} c="#5a3820" />
      <Box p={[-3.6, 1.1, -3.55]} s={[1.6, 2.0, 0.12]} c="#3a2414" />
      {[-0.35, 0, 0.35].map((y, i) => (
        <Box key={i} p={[-3.6, 0.7 + y, -3.42]} s={[1.35, 0.04, 0.04]} c="#c4b48a" m={0.6} />
      ))}
      {[-1.6, 1.6].map((x) => (
        <Box key={x} p={[x, 0.08, 2.4]} s={[0.7, 0.08, 0.7]} c="#8a2a2a" r={0.95} />
      ))}
    </group>
  );
}

function WrestlingRing({ accent }: { accent: string }) {
  const w = 8;
  const d = 8;
  return (
    <group>
      <Box p={[0, -0.35, 0]} s={[w + 1.6, 0.7, d + 1.6]} c="#1a1a1e" m={0.3} />
      <Box p={[0, 0.04, 0]} s={[w, 0.08, d]} c="#c4c4cc" r={0.7} />
      <mesh position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.55, 1.7, 32]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} />
      </mesh>
      {[0.42, 0.82, 1.22].map((y, i) => (
        <group key={y}>
          {[-1, 1].map((s) => (
            <Box key={`z${s}`} p={[0, y, (d / 2) * s]} s={[w, 0.045, 0.045]} c={i === 1 ? "#f4f4f8" : accent} e={accent} ei={0.25} />
          ))}
          {[-1, 1].map((s) => (
            <Box key={`x${s}`} p={[(w / 2) * s, y, 0]} s={[0.045, 0.045, d]} c={i === 1 ? "#f4f4f8" : accent} e={accent} ei={0.25} />
          ))}
        </group>
      ))}
      {[-1, 1].map((x) =>
        [-1, 1].map((z) => (
          <group key={`${x}${z}`}>
            <Cyl p={[(w / 2) * x, 0.75, (d / 2) * z]} args={[0.11, 0.14, 1.5, 8]} c="#d0d0d4" m={0.75} r={0.25} />
            <Box p={[(w / 2) * x, 1.42, (d / 2) * z]} s={[0.32, 0.22, 0.32]} c="#111114" />
          </group>
        )),
      )}
      {Array.from({ length: 18 }).map((_, i) => {
        const side = i < 9 ? -1 : 1;
        const t = (i % 9) / 8;
        return (
          <mesh key={i} position={[side * (w / 2 + 1.35), 0.85, -d / 2 + 0.4 + t * (d - 0.8)]}>
            <capsuleGeometry args={[0.16, 0.7, 4, 6]} />
            <meshStandardMaterial color={i % 3 === 0 ? "#2a1010" : "#121214"} roughness={1} />
          </mesh>
        );
      })}
      {[-2.4, 0, 2.4].map((x) => (
        <mesh key={x} position={[x, 6.4, 0]}>
          <boxGeometry args={[1.8, 0.08, 1.2]} />
          <meshStandardMaterial color="#f4f4f0" emissive="#fff8e8" emissiveIntensity={1.4} />
        </mesh>
      ))}
      <Box p={[-5.4, 0.15, 0]} s={[1.4, 0.12, 0.55]} c="#3a3a40" />
      <Box p={[-5.4, 0.45, 0]} s={[0.12, 0.7, 0.55]} c="#2a2a30" />
    </group>
  );
}

function OctagonCage({ accent }: { accent: string }) {
  const radius = 5.6;
  const sides = 8;
  return (
    <group>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius - 0.15, 8]} />
        <meshStandardMaterial color="#2a2a24" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.4, 1.55, 32]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.4} />
      </mesh>
      {Array.from({ length: sides }).map((_, i) => {
        const a = (i / sides) * Math.PI * 2 + Math.PI / sides;
        const x = Math.cos(a) * radius;
        const z = Math.sin(a) * radius;
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, -a, 0]}>
            <Box p={[0, 1.55, 0]} s={[radius * 0.82, 3.1, 0.06]} c="#111114" m={0.55} r={0.35} e={accent} ei={0.04} />
            {Array.from({ length: 7 }).map((_, r) => (
              <Box key={r} p={[0, 0.35 + r * 0.4, 0.02]} s={[radius * 0.8, 0.02, 0.02]} c="#8a8a90" m={0.8} />
            ))}
            <Cyl p={[radius * 0.4, 1.55, 0]} args={[0.09, 0.11, 3.1, 6]} c="#c4c4c8" m={0.7} />
          </group>
        );
      })}
      <mesh position={[0, 3.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.2, radius, 8]} />
        <meshStandardMaterial color="#2a2a30" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

function SteelCage({ accent }: { accent: string }) {
  const size = 7.4;
  const bars = 16;
  return (
    <group>
      <Box p={[0, 0.02, 0]} s={[size, 0.06, size]} c="#1a1a1e" m={0.4} />
      {[-1, 1].map((s) => (
        <group key={s}>
          {Array.from({ length: bars }).map((_, i) => (
            <Cyl key={`z${i}`} p={[(-size / 2 + 0.25) + (i / (bars - 1)) * (size - 0.5), 1.9, (size / 2) * s]} args={[0.035, 0.035, 3.8, 5]} c="#9aa0a8" m={0.85} r={0.2} />
          ))}
          {Array.from({ length: bars }).map((_, i) => (
            <Cyl key={`x${i}`} p={[(size / 2) * s, 1.9, (-size / 2 + 0.25) + (i / (bars - 1)) * (size - 0.5)]} args={[0.035, 0.035, 3.8, 5]} c="#9aa0a8" m={0.85} r={0.2} />
          ))}
        </group>
      ))}
      {[-1, 1].map((x) =>
        [-1, 1].map((z) => (
          <Cyl key={`${x}${z}`} p={[(size / 2) * x, 2.0, (size / 2) * z]} args={[0.12, 0.14, 4.0, 6]} c="#c8ccd0" m={0.8} />
        )),
      )}
      {Array.from({ length: 10 }).map((_, i) =>
        Array.from({ length: 10 }).map((_, j) => (
          <Box key={`${i}-${j}`} p={[-size / 2 + 0.4 + i * ((size - 0.8) / 9), 3.85, -size / 2 + 0.4 + j * ((size - 0.8) / 9)]} s={[0.04, 0.04, (size - 0.8) / 9]} c="#7a8088" m={0.8} />
        )),
      )}
      <pointLight position={[0, 4.2, 0]} intensity={1.1} color={accent} distance={12} />
    </group>
  );
}

function SubwayStation({ accent }: { accent: string }) {
  return (
    <group>
      <Box p={[0, 0.02, 0]} s={[14, 0.08, 7]} c="#2a2a28" r={0.8} />
      {Array.from({ length: 18 }).map((_, i) => (
        <Box key={i} p={[-6.4 + i * 0.75, 0.06, 0]} s={[0.08, 0.02, 7]} c="#3a3a36" />
      ))}
      <Box p={[0, 0.07, 1.55]} s={[14, 0.04, 0.18]} c={accent} e={accent} ei={0.9} />
      <Box p={[0, 0.07, -1.55]} s={[14, 0.04, 0.18]} c={accent} e={accent} ei={0.9} />
      {[-1.85, 1.85].map((z) => (
        <Box key={z} p={[0, -0.55, z]} s={[16, 0.08, 0.14]} c="#8a8a90" m={0.9} r={0.15} />
      ))}
      {Array.from({ length: 12 }).map((_, i) => (
        <Box key={i} p={[-7 + i * 1.3, -0.62, 0]} s={[0.12, 0.06, 4.1]} c="#3a3020" />
      ))}
      {[-5.2, -1.7, 1.7, 5.2].map((x) => (
        <Cyl key={x} p={[x, 2.2, -3.15]} args={[0.28, 0.32, 4.4, 10]} c="#4a4a48" r={0.7} />
      ))}
      <Box p={[0, 2.4, -3.4]} s={[14, 4.8, 0.2]} c="#1c1c1a" />
      {[-4, 0, 4].map((x) => (
        <Box key={x} p={[x, 2.3, -3.28]} s={[2.4, 1.3, 0.04]} c="#0a0a0c" e={accent} ei={0.15} />
      ))}
      {[-3.4, 3.4].map((x) => (
        <Box key={x} p={[x, 0.45, -2.4]} s={[1.6, 0.08, 0.45]} c="#3a3a32" />
      ))}
      {[-6, -2, 2, 6].map((x) => (
        <mesh key={x} position={[x, 3.7, 0]}>
          <boxGeometry args={[1.4, 0.08, 0.5]} />
          <meshStandardMaterial color="#f0e8c0" emissive="#fff4cc" emissiveIntensity={1.2} />
        </mesh>
      ))}
      <group position={[3.4, -0.15, 2.35]}>
        <Box p={[0, 0.7, 0]} s={[6.4, 1.4, 1.1]} c="#2a2418" m={0.35} />
        <Box p={[3.1, 0.55, 0]} s={[0.4, 1.1, 1.05]} c="#1a1814" />
        {[-2.2, -0.6, 1.0].map((x) => (
          <Box key={x} p={[x, 0.85, 0.56]} s={[1.1, 0.55, 0.04]} c="#0a0a08" e={accent} ei={0.08} />
        ))}
        <Cyl p={[-2.4, 0.18, 0.45]} args={[0.18, 0.18, 0.22, 10]} c="#3a3a38" m={0.7} rot={[Math.PI / 2, 0, 0]} />
        <Cyl p={[2.2, 0.18, 0.45]} args={[0.18, 0.18, 0.22, 10]} c="#3a3a38" m={0.7} rot={[Math.PI / 2, 0, 0]} />
      </group>
    </group>
  );
}

function SkyCrane({ accent }: { accent: string }) {
  return (
    <group>
      <Box p={[0, 0.04, 0]} s={[8.5, 0.08, 6.2]} c="#3a3a38" m={0.55} />
      {Array.from({ length: 9 }).map((_, i) =>
        Array.from({ length: 7 }).map((_, j) => (
          <Box key={`${i}${j}`} p={[-3.6 + i * 0.9, 0.08, -2.4 + j * 0.8]} s={[0.82, 0.03, 0.72]} c="#2a2a28" m={0.6} />
        )),
      )}
      {[-4.1, 4.1].map((x) => (
        <Box key={x} p={[x, 0.55, 0]} s={[0.12, 1.1, 6.2]} c={accent} e={accent} ei={0.2} />
      ))}
      <Box p={[0, 7.2, -1.4]} s={[18, 0.28, 0.28]} c="#c4b48a" m={0.65} />
      <Box p={[-6.5, 3.6, -1.4]} s={[0.28, 7.2, 0.28]} c="#c4b48a" m={0.65} />
      <Box p={[6.5, 3.6, -1.4]} s={[0.28, 7.2, 0.28]} c="#c4b48a" m={0.65} />
      <Cyl p={[0, 7.55, -1.4]} args={[0.35, 0.4, 0.5, 8]} c="#8a8070" m={0.7} />
      {Array.from({ length: 8 }).map((_, i) => (
        <Box key={i} p={[-10 + i * 3.2, -8, -14]} s={[2.2, 6 + (i % 3) * 2.4, 2.2]} c="#0a1824" />
      ))}
      {Array.from({ length: 6 }).map((_, i) => (
        <Box key={`w${i}`} p={[-3.2 + i * 1.1, 0.1, 2.85]} s={[0.7, 0.03, 0.18]} c={i % 2 === 0 ? accent : "#111108"} e={i % 2 === 0 ? accent : "#000"} ei={i % 2 === 0 ? 0.4 : 0} />
      ))}
      <Cyl p={[2.4, 5.2, -1.4]} args={[0.04, 0.04, 4.0, 6]} c="#8a8070" m={0.7} />
      <Box p={[2.4, 3.15, -1.4]} s={[0.35, 0.45, 0.18]} c="#3a3a32" m={0.6} />
    </group>
  );
}

function GhettoStreet({ accent }: { accent: string }) {
  return (
    <group>
      <Box p={[0, 0.03, 0]} s={[4.2, 0.04, 16]} c="#16161a" r={0.75} />
      {[-2.15, 2.15].map((x) => (
        <Box key={x} p={[x, 0.05, 0]} s={[0.08, 0.02, 16]} c={accent} e={accent} ei={0.55} />
      ))}
      {[-4, 0, 4].map((z) => (
        <Box key={z} p={[0, 0.05, z]} s={[0.35, 0.02, 1.1]} c="#c8b84a" e="#c8b84a" ei={0.3} />
      ))}
      <Box p={[-5.4, 0.7, -2.2]} s={[1.5, 1.4, 0.9]} c="#1a3a22" r={0.95} />
      <Box p={[-5.4, 1.45, -2.2]} s={[1.55, 0.08, 0.95]} c="#111114" />
      <Box p={[6.2, 0.55, 1.6]} s={[2.8, 1.1, 1.3]} c="#1a1a22" m={0.35} />
      <Cyl p={[5.1, 0.35, 1.6]} args={[0.32, 0.32, 0.7, 10]} c="#222" m={0.2} rot={[0, 0, Math.PI / 2]} />
      <Cyl p={[7.3, 0.35, 1.6]} args={[0.32, 0.32, 0.7, 10]} c="#222" m={0.2} rot={[0, 0, Math.PI / 2]} />
      <Box p={[6.2, 0.95, 1.2]} s={[2.4, 0.08, 0.9]} c="#0c0c10" />
      {[-6, 6].map((x) => (
        <group key={x}>
          <Cyl p={[x, 1.6, -4.5]} args={[0.06, 0.08, 3.2, 6]} c="#2a2a30" m={0.6} />
          <mesh position={[x, 3.15, -4.5]}>
            <sphereGeometry args={[0.16, 8, 8]} />
            <meshStandardMaterial color="#f0d080" emissive="#f0d080" emissiveIntensity={2} />
          </mesh>
          <pointLight position={[x, 3.0, -4.5]} intensity={0.7} color="#f0d080" distance={8} />
        </group>
      ))}
      <Box p={[-6.4, 2.2, 3.2]} s={[0.08, 3.4, 4.2]} c="#1a1210" />
      {[[-1, 1.6, 3.2], [0.4, 2.4, 3.2], [-0.6, 2.9, 3.2]].map((p, i) => (
        <Box key={i} p={p as [number, number, number]} s={[1.4, 0.7, 0.04]} c={i === 1 ? accent : "#2a0a14"} e={accent} ei={0.2} />
      ))}
      <Cyl p={[4.8, 0.45, -3.2]} args={[0.28, 0.32, 0.9, 8]} c="#3a2a18" />
      <mesh position={[4.8, 0.95, -3.2]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#ff6a20" emissive="#ff6a20" emissiveIntensity={1.4} />
      </mesh>
    </group>
  );
}

function IndustrialFloor({ accent }: { accent: string }) {
  return (
    <group>
      <Box p={[0, 0.02, 0]} s={[12, 0.08, 8]} c="#2a2418" m={0.35} />
      {Array.from({ length: 6 }).map((_, i) => (
        <Box key={i} p={[-5 + i * 2, 0.07, 0]} s={[0.7, 0.04, 8]} c={i % 2 === 0 ? accent : "#111108"} e={i % 2 === 0 ? accent : "#000"} ei={i % 2 === 0 ? 0.35 : 0} />
      ))}
      {[-1, 1].map((s) => (
        <Box key={s} p={[0, 1.1, 3.6 * s]} s={[12, 0.08, 0.08]} c="#c4b48a" m={0.6} />
      ))}
      <Box p={[-5.6, 3.1, -1]} s={[8, 0.28, 0.28]} c="#4a4038" m={0.7} rot={[0, 0, Math.PI / 2]} />
      <Box p={[5.4, 2.5, 1.2]} s={[6, 0.22, 0.22]} c="#3a3834" m={0.75} rot={[0, 0, Math.PI / 2]} />
      <Cyl p={[-4.2, 0.55, 2.4]} args={[0.45, 0.5, 1.1, 10]} c="#3a3028" m={0.5} />
      <Cyl p={[4.6, 0.7, -2.2]} args={[0.55, 0.6, 1.4, 10]} c="#2a2824" m={0.55} />
      {[-3, 3].map((x) => (
        <mesh key={x} position={[x, 4.6, 0]}>
          <boxGeometry args={[0.8, 0.12, 0.8]} />
          <meshStandardMaterial color="#ffcc66" emissive="#ffaa22" emissiveIntensity={1.5} />
        </mesh>
      ))}
    </group>
  );
}

function Junkyard({ accent }: { accent: string }) {
  const cars: Array<{ p: [number, number, number]; rot: number; c: string }> = [
    { p: [-6.2, 0.55, -2.2], rot: 0.4, c: "#3a2018" },
    { p: [-5.8, 1.5, -2.0], rot: -0.2, c: "#2a2a22" },
    { p: [6.4, 0.5, 1.6], rot: 0.7, c: "#1a2a1a" },
    { p: [6.1, 1.4, 1.8], rot: 0.15, c: "#3a3a28" },
    { p: [-5.2, 0.45, 2.6], rot: -0.5, c: "#2a1818" },
  ];
  return (
    <group>
      {cars.map((car, i) => (
        <group key={i} position={car.p} rotation={[0.05, car.rot, 0.08]}>
          <Box p={[0, 0, 0]} s={[2.4, 0.7, 1.2]} c={car.c} r={0.9} />
          <Box p={[0, 0.5, 0]} s={[1.5, 0.5, 1.15]} c={car.c} r={0.9} />
          <Cyl p={[-0.8, -0.25, 0.55]} args={[0.28, 0.28, 0.18, 8]} c="#111" rot={[Math.PI / 2, 0, 0]} />
          <Cyl p={[0.8, -0.25, 0.55]} args={[0.28, 0.28, 0.18, 8]} c="#111" rot={[Math.PI / 2, 0, 0]} />
        </group>
      ))}
      {[[-6.8, 0.5, 0.4], [7.0, 0.6, -2.4], [5.2, 0.35, 3.2]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation={[0.2, i, 0.1]}>
          <dodecahedronGeometry args={[0.7 + i * 0.15, 0]} />
          <meshStandardMaterial color="#2a241c" roughness={0.95} />
        </mesh>
      ))}
      <Cyl p={[0, 4.2, -4]} args={[0.18, 0.18, 8.4, 6]} c="#8a8070" m={0.6} />
      <mesh position={[0, 7.8, -4]}>
        <sphereGeometry args={[0.7, 8, 8]} />
        <meshStandardMaterial color={accent} metalness={0.7} roughness={0.35} />
      </mesh>
    </group>
  );
}

function SpikePit({ accent }: { accent: string }) {
  return (
    <group>
      <Box p={[0, 0.04, -2.6]} s={[10, 0.08, 3.2]} c="#2a1a1a" />
      <Box p={[0, 0.04, 2.6]} s={[10, 0.08, 3.2]} c="#2a1a1a" />
      <Box p={[-4.6, 0.04, 0]} s={[1.4, 0.08, 8]} c="#2a1a1a" />
      <Box p={[4.6, 0.04, 0]} s={[1.4, 0.08, 8]} c="#2a1a1a" />
      <mesh position={[0, -1.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 4.4]} />
        <meshStandardMaterial color="#1a0000" emissive={accent} emissiveIntensity={0.15} />
      </mesh>
      {Array.from({ length: 28 }).map((_, i) => {
        const x = ((i % 7) - 3) * 0.85;
        const z = (Math.floor(i / 7) - 1.5) * 0.9;
        return <Cyl key={i} p={[x, -0.85, z]} args={[0.04, 0.16, 1.5, 5]} c="#c8c8d0" m={0.7} r={0.25} />;
      })}
    </group>
  );
}

function AcidPit({ accent }: { accent: string }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (mat.current) mat.current.emissiveIntensity = 0.45 + Math.sin(clock.elapsedTime * 2.2) * 0.2;
  });
  return (
    <group>
      <Box p={[0, 0.06, 0]} s={[3.2, 0.12, 8]} c="#3a3a32" m={0.5} />
      {[-1.7, 1.7].map((x) => (
        <Box key={x} p={[x, 0.45, 0]} s={[0.1, 0.9, 8]} c="#5a5a50" m={0.55} />
      ))}
      <mesh position={[0, -1.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.8, 24]} />
        <meshStandardMaterial ref={mat} color={accent} emissive={accent} emissiveIntensity={0.55} roughness={0.25} metalness={0.2} />
      </mesh>
      <Cyl p={[-4.4, 1.6, -2]} args={[0.16, 0.16, 3.2, 8]} c="#4a5a38" m={0.5} />
      <Cyl p={[4.2, 1.2, 1.6]} args={[0.12, 0.12, 2.4, 8]} c="#3a4a30" m={0.5} />
    </group>
  );
}

function GrinderPit({ accent }: { accent: string }) {
  const g1 = useRef<THREE.Group>(null);
  const g2 = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g1.current) g1.current.rotation.z += dt * 1.6;
    if (g2.current) g2.current.rotation.z -= dt * 1.2;
  });
  return (
    <group>
      <Box p={[0, 0.05, 0]} s={[3.4, 0.1, 8]} c="#2a2018" m={0.45} />
      {[-1.8, 1.8].map((x) => (
        <Box key={x} p={[x, 0.5, 0]} s={[0.12, 1.0, 8]} c="#c4b48a" m={0.6} />
      ))}
      <group ref={g1} position={[-1.2, -1.6, 0]}>
        <Cyl p={[0, 0, 0]} args={[1.3, 1.3, 0.35, 16]} c="#4a4038" m={0.7} rot={[Math.PI / 2, 0, 0]} />
        {Array.from({ length: 8 }).map((_, i) => (
          <Box key={i} p={[Math.cos((i / 8) * Math.PI * 2) * 1.15, Math.sin((i / 8) * Math.PI * 2) * 1.15, 0]} s={[0.18, 0.55, 0.28]} c={accent} e={accent} ei={0.3} rot={[0, 0, (i / 8) * Math.PI * 2]} />
        ))}
      </group>
      <group ref={g2} position={[1.2, -1.6, 0]}>
        <Cyl p={[0, 0, 0]} args={[1.1, 1.1, 0.35, 16]} c="#3a3834" m={0.7} rot={[Math.PI / 2, 0, 0]} />
        {Array.from({ length: 8 }).map((_, i) => (
          <Box key={i} p={[Math.cos((i / 8) * Math.PI * 2) * 0.95, Math.sin((i / 8) * Math.PI * 2) * 0.95, 0]} s={[0.16, 0.45, 0.26]} c="#c4b48a" rot={[0, 0, (i / 8) * Math.PI * 2]} />
        ))}
      </group>
    </group>
  );
}

function GangBrawl({ accent }: { accent: string }) {
  return (
    <group>
      <Box p={[0, 0.03, 0]} s={[18, 0.06, 14]} c="#121014" r={0.9} />
      <Box p={[0, 0.05, 0]} s={[3.6, 0.04, 14]} c="#1a1a16" />
      {[-1.9, 1.9].map((x) => (
        <Box key={x} p={[x, 0.07, 0]} s={[0.08, 0.02, 14]} c={accent} e={accent} ei={0.7} />
      ))}
      {[-5, -1.5, 2, 5.5].map((z) => (
        <Box key={z} p={[0, 0.07, z]} s={[0.28, 0.02, 0.9]} c="#c8b84a" e="#c8b84a" ei={0.25} />
      ))}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box p={[s * 7.2, 1.2, 0]} s={[0.06, 2.4, 12]} c="#1a1a1e" m={0.55} r={0.4} e={accent} ei={0.05} />
          {Array.from({ length: 9 }).map((_, i) => (
            <Cyl key={i} p={[s * 7.2, 1.2, -5.2 + i * 1.3]} args={[0.05, 0.06, 2.4, 6]} c="#8a8a90" m={0.75} />
          ))}
        </group>
      ))}
      {[[-4.2, 3.6], [5.1, -3.2], [-5.4, -2.4]].map(([x, z], i) => (
        <group key={i}>
          <Cyl p={[x, 0.5, z]} args={[0.32, 0.36, 1.0, 10]} c="#2a1a10" />
          <mesh position={[x, 1.08, z]}>
            <sphereGeometry args={[0.2 + i * 0.03, 8, 8]} />
            <meshStandardMaterial color="#ff4a10" emissive="#ff6a20" emissiveIntensity={1.8} />
          </mesh>
          <pointLight position={[x, 1.15, z]} intensity={0.85} color="#ff6a20" distance={6} />
        </group>
      ))}
      <Box p={[6.4, 1.4, 3.2]} s={[0.12, 2.8, 4.4]} c="#140810" e={accent} ei={0.22} />
      <Box p={[-6.6, 1.6, 2.8]} s={[0.1, 3.2, 3.6]} c="#1a1214" />
      {[[-6.55, 1.8, 2.2], [-6.55, 2.6, 3.4]].map((p, i) => (
        <Box key={i} p={p as [number, number, number]} s={[0.06, 0.7, 1.3]} c={i === 0 ? accent : "#2a0a14"} e={accent} ei={0.28} />
      ))}
      <Box p={[5.8, 0.55, -1.2]} s={[2.2, 1.1, 1.1]} c="#1a1a22" m={0.3} />
    </group>
  );
}

export default ProceduralStage;
