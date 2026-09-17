import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "public/models");
const files = readdirSync(dir).filter((f) => f.endsWith(".glb"));

function inspect(path) {
  const buf = readFileSync(path);
  if (buf.toString("ascii", 0, 4) !== "glTF") return { error: "not glb" };
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
  let triangles = 0;
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const mode = prim.mode ?? 4;
      if (mode !== 4) continue;
      const indices = prim.indices;
      if (indices != null && json.accessors?.[indices]) {
        triangles += Math.floor((json.accessors[indices].count ?? 0) / 3);
      } else {
        const pos = prim.attributes?.POSITION;
        if (pos != null && json.accessors?.[pos]) {
          triangles += Math.floor((json.accessors[pos].count ?? 0) / 3);
        }
      }
    }
  }
  const joints = (json.nodes ?? []).filter((n) => Array.isArray(n.children) || n.skin != null).length;
  const skins = json.skins?.length ?? 0;
  const textures = json.textures?.length ?? 0;
  const images = json.images?.length ?? 0;
  const materials = json.materials?.length ?? 0;
  const hasBaseColor = (json.materials ?? []).some((m) => m.pbrMetallicRoughness?.baseColorTexture);
  return {
    triangles,
    skins,
    textures,
    images,
    materials,
    hasBaseColor,
    animations: json.animations?.length ?? 0,
    joints0: (json.meshes ?? []).reduce(
      (n, mesh) => n + (mesh.primitives ?? []).filter((p) => p.attributes?.JOINTS_0 != null).length,
      0,
    ),
    nodes: json.nodes?.length ?? 0,
    joints,
  };
}

const rows = files.map((f) => ({ file: f, ...inspect(join(dir, f)) }));
rows.sort((a, b) => (a.triangles ?? 0) - (b.triangles ?? 0));
console.table(rows);
writeFileSync("/tmp/glb-inspect.json", JSON.stringify(rows, null, 2));
const maime = rows.filter((r) => /MAIME/i.test(r.file));
const bannon = rows.filter((r) => /BANNON/i.test(r.file));
console.log("MAIME", maime);
console.log("BANNON", bannon);
