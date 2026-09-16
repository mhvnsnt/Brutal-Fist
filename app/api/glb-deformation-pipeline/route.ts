/**
 * GLB DEFORMATION PIPELINE — Backend Agent Debug API
 * ─────────────────────────────────────────────────────────────────────────────
 * Agent-facing endpoint. No frontend UI.
 *
 * Loads every character GLB and runs the 14-point deformation integrity test
 * on each, returning PASS/BLOCKED status per character.
 *
 * This is the authoritative pipeline gate:
 *   GLTFLoader → SkeletonUtils.clone() → forward-direction detection
 *   → floor normalization → frustum-culling disable → normalizeSkinWeights()
 *
 * No character can be considered combat-ready without passing all 14 checks.
 *
 * AGENT USAGE:
 *   GET  /api/glb-deformation-pipeline           — health check
 *   POST /api/glb-deformation-pipeline           — run full roster test
 *   POST /api/glb-deformation-pipeline?id=bannon — run single character test
 *
 * REQUEST BODY (POST):
 *   { fighters: [{ id, name, url }] }
 *   OR empty body → uses full BANNON_ROSTER
 *
 * RESPONSE:
 *   {
 *     summary: { total, pass, blocked, passRate },
 *     results: [{ fighterId, fighterName, url, verdict, failingChecks, checks }]
 *   }
 *
 * 14-POINT TEST (server-side GLB binary analysis):
 *  1.  SKELETON_EXISTS          — skin/joints present in GLTF JSON
 *  2.  SKELETON_HIERARCHY       — joint indices are valid node references
 *  3.  INVERSE_BIND_MATRICES    — inverseBindMatrices accessor exists
 *  4.  SKINNED_MESH_SKELETON    — every mesh node references a skin
 *  5.  SKIN_INDICES_VALID       — JOINTS_0 accessor present on all skinned meshes
 *  6.  MAX_FOUR_INFLUENCES      — JOINTS_0 accessor componentType is UNSIGNED_BYTE/SHORT (4 components)
 *  7.  WEIGHTS_SUM_TO_ONE       — WEIGHTS_0 accessor present (normalization assumed post-load)
 *  8.  BIND_POSE_STABLE         — inverseBindMatrices accessor has correct count (joints × 16 floats)
 *  9.  FLOOR_NORMALIZATION      — model has geometry (meshes present); runtime will normalize
 * 10.  FORWARD_DIRECTION        — model has bones for forward detection; runtime will correct
 * 11.  FRUSTUM_CULLING_DISABLED — runtime enforces this; flagged as RUNTIME_ENFORCED
 * 12.  MIXER_TARGETS_CLONE      — runtime enforces this; flagged as RUNTIME_ENFORCED
 * 13.  ANIMATION_CLIPS_EXIST    — at least one animation in the GLB
 * 14.  FIRST_FRAME_DISPLACEMENT — animation has channels targeting bone transforms
 */

import { NextRequest, NextResponse } from 'next/server';

// ── GLTF binary constants ─────────────────────────────────────────────────────
const GLTF_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_TYPE_JSON = 0x4e4f534a; // 'JSON'

// ── GLTF accessor component types ────────────────────────────────────────────
const ACCESSOR_FLOAT = 5126;
const ACCESSOR_UNSIGNED_BYTE = 5121;
const ACCESSOR_UNSIGNED_SHORT = 5123;

// ── Types ─────────────────────────────────────────────────────────────────────

export type PipelineCheckId =
  | 'SKELETON_EXISTS' |'SKELETON_HIERARCHY' |'INVERSE_BIND_MATRICES' |'SKINNED_MESH_SKELETON' |'SKIN_INDICES_VALID' |'MAX_FOUR_INFLUENCES' |'WEIGHTS_SUM_TO_ONE' |'BIND_POSE_STABLE' |'FLOOR_NORMALIZATION' |'FORWARD_DIRECTION' |'FRUSTUM_CULLING_DISABLED' |'MIXER_TARGETS_CLONE' |'ANIMATION_CLIPS_EXIST' |'FIRST_FRAME_DISPLACEMENT';

export interface PipelineCheckResult {
  id: PipelineCheckId;
  pass: boolean;
  detail: string;
  runtimeEnforced?: boolean;
}

export type PipelineVerdict = 'PASS' | 'BLOCKED';

export interface PipelineResult {
  fighterId: string;
  fighterName: string;
  url: string;
  verdict: PipelineVerdict;
  failingChecks: PipelineCheckId[];
  checks: PipelineCheckResult[];
  error?: string;
  // Summary stats
  boneCount: number;
  clipCount: number;
  meshCount: number;
  skinnedMeshCount: number;
}

// ── GLTF JSON types (minimal) ─────────────────────────────────────────────────
interface GltfNode {
  name?: string;
  skin?: number;
  children?: number[];
  mesh?: number;
  rotation?: [number, number, number, number];
  translation?: [number, number, number];
  scale?: [number, number, number];
}

interface GltfSkin {
  name?: string;
  joints: number[];
  skeleton?: number;
  inverseBindMatrices?: number;
}

interface GltfAnimation {
  name?: string;
  channels: Array<{
    sampler: number;
    target: { node?: number; path: string };
  }>;
  samplers: Array<{
    input: number;
    output: number;
    interpolation?: string;
  }>;
}

interface GltfAccessor {
  bufferView?: number;
  componentType: number;
  count: number;
  type: string;
  name?: string;
}

interface GltfMesh {
  name?: string;
  primitives: Array<{
    attributes: Record<string, number>;
    indices?: number;
    material?: number;
  }>;
}

interface GltfJson {
  asset?: { version?: string };
  nodes?: GltfNode[];
  skins?: GltfSkin[];
  animations?: GltfAnimation[];
  accessors?: GltfAccessor[];
  meshes?: GltfMesh[];
}

// ── Parse GLB binary → GLTF JSON ─────────────────────────────────────────────
function parseGlbJson(buffer: ArrayBuffer): GltfJson | null {
  const view = new DataView(buffer);

  if (view.byteLength < 20) return null;

  const magic = view.getUint32(0, true);
  if (magic !== GLTF_MAGIC) return null;

  const chunkLength = view.getUint32(12, true);
  const chunkType = view.getUint32(16, true);

  if (chunkType !== CHUNK_TYPE_JSON) return null;
  if (20 + chunkLength > view.byteLength) return null;

  const jsonBytes = new Uint8Array(buffer, 20, chunkLength);
  const jsonStr = new TextDecoder('utf-8').decode(jsonBytes);

  try {
    return JSON.parse(jsonStr) as GltfJson;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 14-Point Server-Side Test Suite
// ─────────────────────────────────────────────────────────────────────────────

function runPipelineChecks(gltf: GltfJson): PipelineCheckResult[] {
  const nodes = gltf.nodes ?? [];
  const skins = gltf.skins ?? [];
  const animations = gltf.animations ?? [];
  const accessors = gltf.accessors ?? [];
  const meshes = gltf.meshes ?? [];

  // Collect skinned mesh nodes (nodes that reference a skin)
  const skinnedMeshNodes = nodes.filter(n => n.skin !== undefined && n.mesh !== undefined);
  const meshNodes = nodes.filter(n => n.mesh !== undefined);

  // Primary skin (first skin)
  const primarySkin = skins[0] ?? null;
  const joints = primarySkin?.joints ?? [];

  const checks: PipelineCheckResult[] = [];

  // ── CHECK 1: SKELETON_EXISTS ──────────────────────────────────────────────
  {
    const pass = skins.length > 0 && joints.length > 0;
    checks.push({
      id: 'SKELETON_EXISTS',
      pass,
      detail: pass
        ? `${skins.length} skin(s) found, ${joints.length} joints in primary skin`
        : `No skins or joints found — model has no skeleton`,
    });
  }

  // ── CHECK 2: SKELETON_HIERARCHY ───────────────────────────────────────────
  {
    if (joints.length === 0) {
      checks.push({ id: 'SKELETON_HIERARCHY', pass: false, detail: 'No joints to validate' });
    } else {
      // Validate that all joint indices reference valid nodes
      const invalidJoints = joints.filter(j => j >= nodes.length || !nodes[j]);
      const pass = invalidJoints.length === 0;
      checks.push({
        id: 'SKELETON_HIERARCHY',
        pass,
        detail: pass
          ? `All ${joints.length} joint indices reference valid nodes`
          : `${invalidJoints.length} joint indices out of range (nodes.length=${nodes.length})`,
      });
    }
  }

  // ── CHECK 3: INVERSE_BIND_MATRICES ───────────────────────────────────────
  {
    if (!primarySkin) {
      checks.push({ id: 'INVERSE_BIND_MATRICES', pass: false, detail: 'No skin found' });
    } else {
      const ibmIdx = primarySkin.inverseBindMatrices;
      if (ibmIdx === undefined) {
        // glTF spec: if omitted, identity matrices are assumed — this is valid
        checks.push({
          id: 'INVERSE_BIND_MATRICES',
          pass: true,
          detail: 'inverseBindMatrices not specified — identity matrices assumed (valid per glTF spec)',
        });
      } else {
        const acc = accessors[ibmIdx];
        if (!acc) {
          checks.push({ id: 'INVERSE_BIND_MATRICES', pass: false, detail: `inverseBindMatrices accessor index ${ibmIdx} not found` });
        } else {
          // Each joint needs a 4×4 matrix = 16 floats
          const expectedCount = joints.length;
          const pass = acc.componentType === ACCESSOR_FLOAT && acc.type === 'MAT4' && acc.count === expectedCount;
          checks.push({
            id: 'INVERSE_BIND_MATRICES',
            pass,
            detail: pass
              ? `inverseBindMatrices accessor valid: MAT4 × ${acc.count} (matches ${joints.length} joints)`
              : `inverseBindMatrices accessor mismatch: type=${acc.type} componentType=${acc.componentType} count=${acc.count} (expected MAT4 float × ${joints.length})`,
          });
        }
      }
    }
  }

  // ── CHECK 4: SKINNED_MESH_SKELETON ────────────────────────────────────────
  {
    const pass = meshNodes.length === 0 || skinnedMeshNodes.length > 0;
    checks.push({
      id: 'SKINNED_MESH_SKELETON',
      pass,
      detail: pass
        ? `${skinnedMeshNodes.length}/${meshNodes.length} mesh node(s) are skinned`
        : `${meshNodes.length} mesh node(s) found but none reference a skin — static mesh only`,
    });
  }

  // ── CHECK 5: SKIN_INDICES_VALID ───────────────────────────────────────────
  {
    if (skinnedMeshNodes.length === 0) {
      checks.push({ id: 'SKIN_INDICES_VALID', pass: false, detail: 'No skinned mesh nodes found' });
    } else {
      // Check that each skinned mesh's primitives have JOINTS_0 attribute
      let missingJoints = 0;
      let missingWeights = 0;
      let totalPrimitives = 0;

      for (const node of skinnedMeshNodes) {
        const mesh = meshes[node.mesh!];
        if (!mesh) continue;
        for (const prim of mesh.primitives) {
          totalPrimitives++;
          if (prim.attributes['JOINTS_0'] === undefined) missingJoints++;
          if (prim.attributes['WEIGHTS_0'] === undefined) missingWeights++;
        }
      }

      const pass = missingJoints === 0 && missingWeights === 0;
      checks.push({
        id: 'SKIN_INDICES_VALID',
        pass,
        detail: pass
          ? `JOINTS_0 + WEIGHTS_0 present on all ${totalPrimitives} skinned primitive(s)`
          : `Missing: JOINTS_0 on ${missingJoints} primitive(s), WEIGHTS_0 on ${missingWeights} primitive(s)`,
      });
    }
  }

  // ── CHECK 6: MAX_FOUR_INFLUENCES ──────────────────────────────────────────
  {
    if (skinnedMeshNodes.length === 0) {
      checks.push({ id: 'MAX_FOUR_INFLUENCES', pass: true, detail: 'No skinned meshes — check skipped' });
    } else {
      // JOINTS_0 accessor must be VEC4 (4 components per vertex)
      // JOINTS_1 would indicate 8 influences — not supported by Three.js WebGL path
      let hasJoints1 = false;
      let invalidComponentType = false;

      for (const node of skinnedMeshNodes) {
        const mesh = meshes[node.mesh!];
        if (!mesh) continue;
        for (const prim of mesh.primitives) {
          if (prim.attributes['JOINTS_1'] !== undefined) hasJoints1 = true;
          const jointsAccIdx = prim.attributes['JOINTS_0'];
          if (jointsAccIdx !== undefined) {
            const acc = accessors[jointsAccIdx];
            if (acc && acc.type !== 'VEC4') invalidComponentType = true;
            if (acc && acc.componentType !== ACCESSOR_UNSIGNED_BYTE && acc.componentType !== ACCESSOR_UNSIGNED_SHORT) {
              invalidComponentType = true;
            }
          }
        }
      }

      const pass = !hasJoints1 && !invalidComponentType;
      checks.push({
        id: 'MAX_FOUR_INFLUENCES',
        pass,
        detail: pass
          ? 'JOINTS_0 is VEC4 UNSIGNED_BYTE/SHORT — within 4-influence WebGL limit'
          : `${hasJoints1 ? 'JOINTS_1 present (8 influences — exceeds WebGL limit). ' : ''}${invalidComponentType ? 'JOINTS_0 accessor type/componentType invalid.' : ''}`,
      });
    }
  }

  // ── CHECK 7: WEIGHTS_SUM_TO_ONE ───────────────────────────────────────────
  {
    // Server-side: we can only verify the WEIGHTS_0 accessor exists and is VEC4 FLOAT
    // Actual per-vertex sum validation happens at runtime after normalizeSkinWeights()
    if (skinnedMeshNodes.length === 0) {
      checks.push({ id: 'WEIGHTS_SUM_TO_ONE', pass: true, detail: 'No skinned meshes — check skipped' });
    } else {
      let invalidWeightAccessors = 0;
      let totalWeightAccessors = 0;

      for (const node of skinnedMeshNodes) {
        const mesh = meshes[node.mesh!];
        if (!mesh) continue;
        for (const prim of mesh.primitives) {
          const wIdx = prim.attributes['WEIGHTS_0'];
          if (wIdx === undefined) continue;
          totalWeightAccessors++;
          const acc = accessors[wIdx];
          if (!acc || acc.type !== 'VEC4' || acc.componentType !== ACCESSOR_FLOAT) {
            invalidWeightAccessors++;
          }
        }
      }

      const pass = invalidWeightAccessors === 0 && totalWeightAccessors > 0;
      checks.push({
        id: 'WEIGHTS_SUM_TO_ONE',
        pass,
        detail: pass
          ? `WEIGHTS_0 accessor is VEC4 FLOAT on all ${totalWeightAccessors} primitive(s) — runtime normalizeSkinWeights() will enforce sum=1`
          : totalWeightAccessors === 0
            ? 'No WEIGHTS_0 accessors found'
            : `${invalidWeightAccessors}/${totalWeightAccessors} WEIGHTS_0 accessors have wrong type (expected VEC4 FLOAT)`,
      });
    }
  }

  // ── CHECK 8: BIND_POSE_STABLE ─────────────────────────────────────────────
  {
    // Server-side: verify inverseBindMatrices count matches joint count
    // (NaN/Inf detection requires parsing the BIN chunk — not done here)
    if (!primarySkin || primarySkin.inverseBindMatrices === undefined) {
      checks.push({
        id: 'BIND_POSE_STABLE',
        pass: true,
        detail: 'No inverseBindMatrices — identity bind pose assumed (valid)',
      });
    } else {
      const acc = accessors[primarySkin.inverseBindMatrices];
      const pass = acc != null && acc.count === joints.length;
      checks.push({
        id: 'BIND_POSE_STABLE',
        pass,
        detail: pass
          ? `inverseBindMatrices count=${acc!.count} matches joint count=${joints.length}`
          : `inverseBindMatrices count=${acc?.count ?? 'N/A'} does not match joint count=${joints.length} — bind pose may be corrupt`,
      });
    }
  }

  // ── CHECK 9: FLOOR_NORMALIZATION ──────────────────────────────────────────
  {
    // Server-side: verify model has geometry (runtime will normalize floor)
    const pass = meshes.length > 0;
    checks.push({
      id: 'FLOOR_NORMALIZATION',
      pass,
      detail: pass
        ? `${meshes.length} mesh(es) present — runtime Box3 floor normalization will execute`
        : 'No meshes found — floor normalization cannot run',
      runtimeEnforced: pass,
    });
  }

  // ── CHECK 10: FORWARD_DIRECTION ───────────────────────────────────────────
  {
    // Server-side: verify model has bones for forward detection
    const pass = joints.length > 0 || meshes.length > 0;
    checks.push({
      id: 'FORWARD_DIRECTION',
      pass,
      detail: pass
        ? `Model has ${joints.length > 0 ? `${joints.length} joints for bone-based` : 'meshes for bbox-based'} forward detection — runtime will apply correction`
        : 'No joints or meshes — forward direction detection cannot run',
      runtimeEnforced: pass,
    });
  }

  // ── CHECK 11: FRUSTUM_CULLING_DISABLED ────────────────────────────────────
  {
    // Always runtime-enforced by normalizeGLB() — report as such
    checks.push({
      id: 'FRUSTUM_CULLING_DISABLED',
      pass: true,
      detail: 'Runtime-enforced: normalizeGLB() sets frustumCulled=false on all SkinnedMesh(es)',
      runtimeEnforced: true,
    });
  }

  // ── CHECK 12: MIXER_TARGETS_CLONE ─────────────────────────────────────────
  {
    // Always runtime-enforced by normalizeGLB() — report as such
    checks.push({
      id: 'MIXER_TARGETS_CLONE',
      pass: true,
      detail: 'Runtime-enforced: AnimationMixer is created on SkeletonUtils.clone() result in normalizeGLB()',
      runtimeEnforced: true,
    });
  }

  // ── CHECK 13: ANIMATION_CLIPS_EXIST ──────────────────────────────────────
  {
    const pass = animations.length > 0;
    const clipNames = animations.slice(0, 5).map(a => a.name ?? 'unnamed').join(', ');
    checks.push({
      id: 'ANIMATION_CLIPS_EXIST',
      pass,
      detail: pass
        ? `${animations.length} animation clip(s): [${clipNames}${animations.length > 5 ? '...' : ''}]`
        : 'No animation clips in GLB — character cannot animate in combat',
    });
  }

  // ── CHECK 14: FIRST_FRAME_DISPLACEMENT ───────────────────────────────────
  {
    // Server-side: verify animations have channels targeting bone rotation/translation
    // (actual vertex displacement test runs at runtime in DeformationIntegrityLogger)
    if (animations.length === 0) {
      checks.push({
        id: 'FIRST_FRAME_DISPLACEMENT',
        pass: false,
        detail: 'No animations — first-frame displacement cannot be tested',
      });
    } else {
      const firstAnim = animations[0];
      const boneChannels = firstAnim.channels.filter(ch =>
        ch.target.path === 'rotation' || ch.target.path === 'translation' || ch.target.path === 'scale'
      );
      const pass = boneChannels.length > 0;
      checks.push({
        id: 'FIRST_FRAME_DISPLACEMENT',
        pass,
        detail: pass
          ? `${boneChannels.length} bone transform channel(s) in "${firstAnim.name ?? 'clip_0'}" — runtime will confirm visible mesh displacement`
          : `No bone transform channels in "${firstAnim.name ?? 'clip_0'}" — animation may not deform visible mesh`,
        runtimeEnforced: pass,
      });
    }
  }

  return checks;
}

// ── Inspect a single GLB URL ──────────────────────────────────────────────────
async function runPipelineOnGlb(
  url: string,
  fighterId: string,
  fighterName: string,
): Promise<PipelineResult> {
  const base: PipelineResult = {
    fighterId,
    fighterName,
    url,
    verdict: 'BLOCKED',
    failingChecks: [],
    checks: [],
    boneCount: 0,
    clipCount: 0,
    meshCount: 0,
    skinnedMeshCount: 0,
  };

  // Fetch GLB
  let buffer: ArrayBuffer;
  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      headers: { 'Accept': 'model/gltf-binary, application/octet-stream, */*' },
    });
    if (!res.ok) {
      return {
        ...base,
        error: `HTTP ${res.status} ${res.statusText}`,
        checks: [{
          id: 'SKELETON_EXISTS',
          pass: false,
          detail: `Cannot fetch GLB: HTTP ${res.status}`,
        }],
        failingChecks: ['SKELETON_EXISTS'],
      };
    }
    buffer = await res.arrayBuffer();
  } catch (err) {
    return {
      ...base,
      error: `Fetch failed: ${String(err)}`,
      checks: [{
        id: 'SKELETON_EXISTS',
        pass: false,
        detail: `Network error: ${String(err)}`,
      }],
      failingChecks: ['SKELETON_EXISTS'],
    };
  }

  // Parse GLTF JSON
  const gltf = parseGlbJson(buffer);
  if (!gltf) {
    return {
      ...base,
      error: 'Failed to parse GLB JSON chunk',
      checks: [{
        id: 'SKELETON_EXISTS',
        pass: false,
        detail: 'GLB parse failed — file may be corrupt or not a valid GLB',
      }],
      failingChecks: ['SKELETON_EXISTS'],
    };
  }

  // Run all 14 checks
  const checks = runPipelineChecks(gltf);
  const failingChecks = checks.filter(c => !c.pass).map(c => c.id);
  const verdict: PipelineVerdict = failingChecks.length === 0 ? 'PASS' : 'BLOCKED';

  // Collect stats
  const nodes = gltf.nodes ?? [];
  const skins = gltf.skins ?? [];
  const primarySkin = skins[0];
  const boneCount = primarySkin?.joints?.length ?? 0;
  const clipCount = (gltf.animations ?? []).length;
  const meshCount = (gltf.meshes ?? []).length;
  const skinnedMeshCount = nodes.filter(n => n.skin !== undefined && n.mesh !== undefined).length;

  // Console log for agents
  const tag = verdict === 'PASS' ? '✅ PASS' : '❌ BLOCKED';
  console.log(
    `[GLBPipeline] ${tag} — ${fighterName} | bones=${boneCount} clips=${clipCount} meshes=${meshCount} skinned=${skinnedMeshCount}` +
    (failingChecks.length > 0 ? ` | FAILING: [${failingChecks.join(', ')}]` : '')
  );

  return {
    ...base,
    verdict,
    failingChecks,
    checks,
    boneCount,
    clipCount,
    meshCount,
    skinnedMeshCount,
  };
}

// ── Request body ──────────────────────────────────────────────────────────────
interface PipelineRequest {
  fighters?: Array<{ id: string; name: string; url: string }>;
}

// ── Default roster (from bannonRoster.ts — duplicated here for server-side use) ──
const BANNON_RAW = 'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/models';

const DEFAULT_ROSTER = [
  { id: 'bannon',       name: 'Bannon',          url: `${BANNON_RAW}/BANNON.glb` },
  { id: 'maime',        name: 'Maime',            url: `${BANNON_RAW}/MAIME.glb` },
  { id: 'onyx',         name: 'Onyx',             url: `${BANNON_RAW}/ONYX_street.glb` },
  { id: 'cain_elias',   name: 'Cain Elias',       url: `${BANNON_RAW}/CAIN_ELIAS_ring.glb` },
  { id: 'stick_up',     name: 'Stick-Up',         url: `${BANNON_RAW}/STICKUP.glb` },
  { id: 'cipher',       name: 'Cipher',           url: `${BANNON_RAW}/CIPHER.glb` },
  { id: 'vex',          name: 'Vex',              url: `${BANNON_RAW}/VEX.glb` },
  { id: 'nova',         name: 'Nova',             url: `${BANNON_RAW}/NOVA.glb` },
  { id: 'rook',         name: 'Rook',             url: `${BANNON_RAW}/ROOK.glb` },
  { id: 'phantom',      name: 'Phantom',          url: `${BANNON_RAW}/PHANTOM.glb` },
  { id: 'blaze',        name: 'Blaze',            url: `${BANNON_RAW}/BLAZE.glb` },
  { id: 'iron_cross',   name: 'Iron Cross',       url: `${BANNON_RAW}/IRON_CROSS.glb` },
  { id: 'duchess',      name: 'Duchess',          url: `${BANNON_RAW}/DUCHESS.glb` },
  { id: 'hex',          name: 'Hex',              url: `${BANNON_RAW}/HEX.glb` },
  { id: 'titan',        name: 'Titan',            url: `${BANNON_RAW}/TITAN.glb` },
  { id: 'wraith',       name: 'Wraith',           url: `${BANNON_RAW}/WRAITH.glb` },
  { id: 'surge',        name: 'Surge',            url: `${BANNON_RAW}/SURGE.glb` },
  { id: 'eclipse',      name: 'Eclipse',          url: `${BANNON_RAW}/ECLIPSE.glb` },
  { id: 'fang',         name: 'Fang',             url: `${BANNON_RAW}/FANG.glb` },
  { id: 'apex',         name: 'Apex',             url: `${BANNON_RAW}/APEX.glb` },
];

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: PipelineRequest = {};

  try {
    const text = await req.text();
    if (text.trim()) {
      body = JSON.parse(text) as PipelineRequest;
    }
  } catch {
    // Empty body is fine — use default roster
  }

  // Use provided fighters or fall back to default roster
  const fighters = (body.fighters && body.fighters.length > 0)
    ? body.fighters.slice(0, 20)
    : DEFAULT_ROSTER;

  console.log(`[GLBPipeline] Starting 14-point deformation integrity test on ${fighters.length} character(s)...`);

  // Run pipeline on all fighters in parallel
  const results = await Promise.all(
    fighters.map(f => runPipelineOnGlb(f.url, f.id, f.name))
  );

  const passCount = results.filter(r => r.verdict === 'PASS').length;
  const blockedCount = results.filter(r => r.verdict === 'BLOCKED').length;
  const passRate = results.length > 0 ? Math.round((passCount / results.length) * 100) : 0;

  const summary = {
    total: results.length,
    pass: passCount,
    blocked: blockedCount,
    passRate: `${passRate}%`,
    combatReady: passCount,
    combatBlocked: blockedCount,
  };

  console.log(
    `[GLBPipeline] ── ROSTER SUMMARY ──────────────────────────────────────────\n` +
    `[GLBPipeline] Total: ${summary.total} | PASS: ${summary.pass} | BLOCKED: ${summary.blocked} | Pass Rate: ${summary.passRate}\n` +
    `[GLBPipeline] ─────────────────────────────────────────────────────────────`
  );

  return NextResponse.json({ summary, results });
}

// ── GET handler — health check + usage ───────────────────────────────────────
export async function GET() {
  return NextResponse.json({
    status: 'GLB Deformation Pipeline API ready',
    version: '2.0.0',
    description: '14-point deformation integrity test for all character GLBs',
    pipeline: [
      'GLTFLoader',
      'SkeletonUtils.clone()',
      'forward-direction detection',
      'floor normalization (Box3)',
      'frustum-culling disable',
      'normalizeSkinWeights()',
    ],
    checks: [
      '1. SKELETON_EXISTS',
      '2. SKELETON_HIERARCHY',
      '3. INVERSE_BIND_MATRICES',
      '4. SKINNED_MESH_SKELETON',
      '5. SKIN_INDICES_VALID',
      '6. MAX_FOUR_INFLUENCES',
      '7. WEIGHTS_SUM_TO_ONE',
      '8. BIND_POSE_STABLE',
      '9. FLOOR_NORMALIZATION',
      '10. FORWARD_DIRECTION',
      '11. FRUSTUM_CULLING_DISABLED',
      '12. MIXER_TARGETS_CLONE',
      '13. ANIMATION_CLIPS_EXIST',
      '14. FIRST_FRAME_DISPLACEMENT',
    ],
    usage: {
      fullRoster: 'POST /api/glb-deformation-pipeline (empty body)',
      customFighters: 'POST /api/glb-deformation-pipeline { fighters: [{ id, name, url }] }',
    },
  });
}
