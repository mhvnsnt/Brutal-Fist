/**
 * Offline measure: Bannon Euler motion bank → BANNON_rigged.glb skeleton bind + bone travel.
 */
globalThis.self = globalThis;
globalThis.window = globalThis;
globalThis.document = {
  createElementNS: () => ({ style: {} }),
  createElement: () => ({ style: {} }),
};
globalThis.HTMLImageElement = class {};
globalThis.Image = class {
  constructor() {
    this.onload = null;
    this.onerror = null;
  }
  set src(_v) {
    Promise.resolve().then(() => this.onload && this.onload());
  }
};
if (!globalThis.URL) {
  globalThis.URL = class {
    static createObjectURL() { return "blob:fake"; }
    static revokeObjectURL() {}
  };
}

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { register } from "tsx/esm/api";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const unregister = register();

const {
  coerceToBannonEulerClipJson,
  convertBannonEulerClip,
  bindClipTracksToTargetBones,
} = await import(pathToFileURL(join(ROOT, "src/engine/retarget/BannonEulerMotionAdapter.ts")).href);

const PREFERRED = {
  idle: "IDLE.json",
  walk_forward: "GINGA_FORWARD.json",
  walk_back: "GINGA_BACKWARD.json",
  strafe_left: "GINGA_SIDEWAYS_2.json",
  strafe_right: "CROUCH_TORCH_WALK_RIGHT.json",
  attack_1: "BODY_JAB_CROSS.json",
  attack_2: "COMBO_PUNCH.json",
  block: "CENTER_BLOCK.json",
  hit_reaction: "HIT_REACTION.json",
  knockdown: "FALLING_FLAT_IMPACT.json",
  getup: "KIP_UP.json",
};

const buf = readFileSync(join(ROOT, "public/models/BANNON_rigged.glb"));
const loader = new GLTFLoader();
if (MeshoptDecoder.ready) await MeshoptDecoder.ready;
loader.setMeshoptDecoder(MeshoptDecoder);
const gltf = await new Promise((resolve, reject) => {
  loader.parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    "",
    resolve,
    reject,
  );
});

const scene = gltf.scene;
let boneCount = 0;
let skinned = 0;
const boneNames = [];
scene.traverse((o) => {
  if (o.isBone) {
    boneCount++;
    boneNames.push(o.name);
  }
  if (o.isSkinnedMesh) {
    skinned++;
    if (o.skeleton?.bones) {
      for (const b of o.skeleton.bones) {
        if (!boneNames.includes(b.name)) boneNames.push(b.name);
      }
      boneCount = Math.max(boneCount, o.skeleton.bones.length);
    }
  }
});
console.log("GLB bones:", boneCount, "SkinnedMeshes:", skinned);
console.log("Sample bone names:", boneNames.slice(0, 30).join(", "));
console.log("Embedded animations:", gltf.animations?.length ?? 0);

const clips = new Map();
let converted = 0;
let totalBound = 0;
let totalUnbound = 0;
const missing = [];
const allUnbound = new Set();

for (const [state, file] of Object.entries(PREFERRED)) {
  const json = JSON.parse(readFileSync(join(ROOT, "public/assets/moves/clips", file), "utf8"));
  const coerced = coerceToBannonEulerClipJson(json, state, state);
  if (!coerced) {
    missing.push(state);
    console.log("FAIL coerce", state);
    continue;
  }
  const adapted = convertBannonEulerClip(coerced, state);
  adapted.clip.name = state;
  const bind = bindClipTracksToTargetBones(adapted.clip, scene);
  clips.set(state, bind.clip);
  converted++;
  totalBound += bind.boundTracks;
  totalUnbound += bind.unboundTracks;
  for (const u of bind.unboundTargets) allUnbound.add(u);
  console.log(
    `${state}: srcTracks=${adapted.clip.tracks.length} bound=${bind.boundTracks} unbound=${bind.unboundTracks} travel=${adapted.totalAngularTravel ?? bind.clip.userData?.totalAngularTravel}`,
  );
}

const clip = clips.get("attack_1");
const mixer = new THREE.AnimationMixer(scene);
const action = mixer.clipAction(clip, scene);
action.setLoop(THREE.LoopOnce, 1).reset().play();
const bones = [];
scene.traverse((o) => {
  if (o.isBone) bones.push(o);
});
scene.traverse((o) => {
  if (o.isSkinnedMesh && o.skeleton?.bones) {
    for (const b of o.skeleton.bones) {
      if (!bones.includes(b)) bones.push(b);
    }
  }
});
const before = bones.map((b) => ({
  b,
  q: b.quaternion.clone(),
  wp: b.getWorldPosition(new THREE.Vector3()).clone(),
  wq: b.getWorldQuaternion(new THREE.Quaternion()).clone(),
}));
for (let i = 0; i < 15; i++) mixer.update(1 / 30);
scene.updateMatrixWorld(true);
let maxTravel = 0;
let maxRot = 0;
let maxLocalRot = 0;
let deformingBones = 0;
for (const s of before) {
  const wp = s.b.getWorldPosition(new THREE.Vector3());
  const wq = s.b.getWorldQuaternion(new THREE.Quaternion());
  const d = wp.distanceTo(s.wp);
  const a = (s.wq.angleTo(wq) * 180) / Math.PI;
  const la = (s.q.angleTo(s.b.quaternion) * 180) / Math.PI;
  if (d > 1e-5 || a > 0.1 || la > 0.1) deformingBones++;
  maxTravel = Math.max(maxTravel, d);
  maxRot = Math.max(maxRot, a);
  maxLocalRot = Math.max(maxLocalRot, la);
}

console.log("--- SUMMARY ---");
console.log(JSON.stringify({
  converted,
  preferred: Object.keys(PREFERRED).length,
  missing,
  totalBound,
  totalUnbound,
  uniqueUnboundBones: [...allUnbound],
  targetBones: boneCount,
  skinnedMeshes: skinned,
  maxBoneTravel_m: Number(maxTravel.toFixed(6)),
  maxBoneRot_deg: Number(maxRot.toFixed(3)),
  maxLocalRot_deg: Number(maxLocalRot.toFixed(3)),
  deformingBones,
  boneCountSampled: bones.length,
  deformationPass: maxTravel > 0 || maxRot > 0.5 || maxLocalRot > 0.5,
}, null, 2));

unregister();
