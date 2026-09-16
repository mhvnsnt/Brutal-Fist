/**
 * GLB Rig Inspector — Backend API Route
 *
 * Accepts a list of fighter GLB URLs, fetches each one, parses the binary
 * GLTF structure, and returns:
 *   - bone count
 *   - armature name
 *   - animation clip list (name + duration + track count)
 *   - skeleton validity (has skin, has bones, root bone present)
 *   - flags for missing bones or broken rigging
 *
 * This runs server-side so it can fetch GLBs without CORS restrictions.
 */

import { NextRequest, NextResponse } from 'next/server';

// ── GLTF binary constants ─────────────────────────────────────────────────────
const GLTF_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_TYPE_JSON = 0x4e4f534a; // 'JSON'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BoneInfo {
  name: string;
  index: number;
}

export interface ClipInfo {
  name: string;
  durationSeconds: number;
  trackCount: number;
}

export interface RigInspectionResult {
  url: string;
  fighterId: string;
  fighterName: string;
  ok: boolean;
  error?: string;
  // Skeleton
  boneCount: number;
  armatureName: string | null;
  bones: BoneInfo[];
  hasSkin: boolean;
  hasRootBone: boolean;
  skeletonValid: boolean;
  // Animations
  clips: ClipInfo[];
  clipCount: number;
  // Flags
  flags: string[];
}

// ── Required bones for a valid fighting game rig ──────────────────────────────
const REQUIRED_BONE_KEYWORDS = [
  'spine', 'hip', 'pelvis', 'root',
  'arm', 'hand', 'wrist',
  'leg', 'foot', 'ankle',
  'head', 'neck',
];

// ── Parse GLB binary → GLTF JSON ─────────────────────────────────────────────
function parseGlbJson(buffer: ArrayBuffer): Record<string, unknown> | null {
  const view = new DataView(buffer);

  // Validate magic
  const magic = view.getUint32(0, true);
  if (magic !== GLTF_MAGIC) return null;

  // Skip version (4) + length (4) = offset 12
  const chunkLength = view.getUint32(12, true);
  const chunkType = view.getUint32(16, true);

  if (chunkType !== CHUNK_TYPE_JSON) return null;

  const jsonBytes = new Uint8Array(buffer, 20, chunkLength);
  const jsonStr = new TextDecoder('utf-8').decode(jsonBytes);

  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

// ── Inspect a single GLB URL ──────────────────────────────────────────────────
async function inspectGlb(
  url: string,
  fighterId: string,
  fighterName: string,
): Promise<RigInspectionResult> {
  const base: RigInspectionResult = {
    url,
    fighterId,
    fighterName,
    ok: false,
    boneCount: 0,
    armatureName: null,
    bones: [],
    hasSkin: false,
    hasRootBone: false,
    skeletonValid: false,
    clips: [],
    clipCount: 0,
    flags: [],
  };

  // Fetch the GLB
  let buffer: ArrayBuffer;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      return { ...base, error: `HTTP ${res.status} ${res.statusText}` };
    }
    buffer = await res.arrayBuffer();
  } catch (err) {
    return { ...base, error: `Fetch failed: ${String(err)}` };
  }

  // Parse JSON chunk
  const gltf = parseGlbJson(buffer);
  if (!gltf) {
    return { ...base, error: 'Failed to parse GLB JSON chunk — file may be corrupt or not a valid GLB' };
  }

  const nodes = (gltf.nodes as Array<{ name?: string; skin?: number; children?: number[]; mesh?: number }>) ?? [];
  const skins = (gltf.skins as Array<{ name?: string; joints?: number[]; skeleton?: number }>) ?? [];
  const animations = (gltf.animations as Array<{ name?: string; channels?: unknown[]; samplers?: unknown[] }>) ?? [];

  // ── Skeleton analysis ────────────────────────────────────────────────────
  const hasSkin = skins.length > 0;
  let boneCount = 0;
  let armatureName: string | null = null;
  const bones: BoneInfo[] = [];
  let hasRootBone = false;

  if (hasSkin) {
    const skin = skins[0];
    armatureName = skin.name ?? 'Armature';
    const joints = skin.joints ?? [];
    boneCount = joints.length;

    for (const jointIdx of joints) {
      const node = nodes[jointIdx];
      if (!node) continue;
      const boneName = node.name ?? `bone_${jointIdx}`;
      bones.push({ name: boneName, index: jointIdx });

      const lc = boneName.toLowerCase();
      if (lc === 'root' || lc === 'armature' || lc.includes('root') || lc.includes('hips') || lc.includes('pelvis')) {
        hasRootBone = true;
      }
    }
  }

  // ── Animation clip analysis ───────────────────────────────────────────────
  const clips: ClipInfo[] = animations.map((anim) => {
    const samplers = (anim.samplers as Array<{ input?: number; output?: number }>) ?? [];
    const channels = (anim.channels as unknown[]) ?? [];

    // Estimate duration from accessor — we don't parse the BIN chunk here,
    // so we use channel/sampler count as a proxy for complexity
    return {
      name: anim.name ?? 'unnamed',
      durationSeconds: -1, // Cannot determine without parsing BIN chunk
      trackCount: channels.length,
    };
  });

  // ── Flags ────────────────────────────────────────────────────────────────
  const flags: string[] = [];

  if (!hasSkin) flags.push('NO_SKIN — model has no skin/armature binding');
  if (hasSkin && boneCount === 0) flags.push('EMPTY_SKELETON — skin exists but no joints');
  if (hasSkin && !hasRootBone) flags.push('MISSING_ROOT_BONE — no root/hips/pelvis bone found');
  if (clips.length === 0) flags.push('NO_ANIMATIONS — GLB contains no animation clips');

  // Check for required bone groups
  const boneNames = bones.map(b => b.name.toLowerCase());
  for (const keyword of REQUIRED_BONE_KEYWORDS) {
    const found = boneNames.some(b => b.includes(keyword));
    if (!found) {
      flags.push(`MISSING_BONE_GROUP — no bone matching "${keyword}"`);
    }
  }

  const skeletonValid = hasSkin && boneCount > 0 && hasRootBone && clips.length > 0;

  return {
    ...base,
    ok: true,
    boneCount,
    armatureName,
    bones,
    hasSkin,
    hasRootBone,
    skeletonValid,
    clips,
    clipCount: clips.length,
    flags,
  };
}

// ── Request body ──────────────────────────────────────────────────────────────
interface InspectRequest {
  fighters: Array<{ id: string; name: string; url: string }>;
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: InspectRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.fighters) || body.fighters.length === 0) {
    return NextResponse.json({ error: 'fighters array is required' }, { status: 400 });
  }

  // Limit to 20 fighters per request to avoid timeout
  const fighters = body.fighters.slice(0, 20);

  // Inspect all fighters in parallel
  const results = await Promise.all(
    fighters.map(f => inspectGlb(f.url, f.id, f.name))
  );

  const summary = {
    total: results.length,
    valid: results.filter(r => r.skeletonValid).length,
    invalid: results.filter(r => !r.skeletonValid).length,
    noAnimations: results.filter(r => r.clipCount === 0).length,
    noSkin: results.filter(r => !r.hasSkin).length,
    fetchErrors: results.filter(r => !r.ok).length,
  };

  return NextResponse.json({ summary, results });
}

// ── GET handler — health check ────────────────────────────────────────────────
export async function GET() {
  return NextResponse.json({ status: 'GLB Rig Inspector API ready', version: '1.0.0' });
}
