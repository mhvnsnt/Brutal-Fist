/**
 * Mixamo-named skeletal motion bank — TEST_ONLY / PLACEHOLDER_TEST_CLIP fill.
 *
 * PURPOSE: procedural Mixamo-named quaternion tracks for pipeline/debug fill when
 * an authored Bannon Euler clip is missing. Track names stay Mixamo
 * (`mixamorigHips` …) so AnimationRetargeter can bind onto live roster skeletons.
 *
 * LAWS:
 *   - clipSourceType is always PLACEHOLDER_TEST_CLIP (never AUTHORED / RETARGETED_AUTHORED).
 *   - isProcedural === true — AnimationBridge treats non-idle placeholders as MISSING_CLIP.
 *   - MUST NEVER unlock FIGHT via PreCombatRosterGate (placeholders fail the gate).
 *   - MUST NEVER be counted as authored PASS / RETARGETED_AUTHORED_CLIP evidence.
 *   - MISSING_CLIP stays MISSING_CLIP — this bank is fill for TEST_ONLY surfaces only.
 */
import * as THREE from "three";

type EulerXYZ = [number, number, number];
type Pose = Record<string, EulerXYZ>;

const BONES = [
  "mixamorigHips",
  "mixamorigSpine",
  "mixamorigSpine1",
  "mixamorigSpine2",
  "mixamorigNeck",
  "mixamorigHead",
  "mixamorigLeftShoulder",
  "mixamorigLeftArm",
  "mixamorigLeftForeArm",
  "mixamorigLeftHand",
  "mixamorigRightShoulder",
  "mixamorigRightArm",
  "mixamorigRightForeArm",
  "mixamorigRightHand",
  "mixamorigLeftUpLeg",
  "mixamorigLeftLeg",
  "mixamorigLeftFoot",
  "mixamorigRightUpLeg",
  "mixamorigRightLeg",
  "mixamorigRightFoot",
] as const;

const GUARD: Pose = {
  mixamorigHips: [0.04, 0, 0],
  mixamorigSpine: [0.08, 0.05, 0],
  mixamorigSpine1: [0.06, 0.04, 0],
  mixamorigSpine2: [0.04, 0.02, 0],
  mixamorigNeck: [0.05, 0, 0],
  mixamorigHead: [-0.04, 0.08, 0],
  mixamorigLeftShoulder: [0.1, 0.15, -0.2],
  mixamorigLeftArm: [-0.55, 0.1, 1.15],
  mixamorigLeftForeArm: [0, 0.15, 1.35],
  mixamorigLeftHand: [0.1, 0, 0.2],
  mixamorigRightShoulder: [0.1, -0.15, 0.2],
  mixamorigRightArm: [-0.55, -0.1, -1.15],
  mixamorigRightForeArm: [0, -0.15, -1.35],
  mixamorigRightHand: [0.1, 0, -0.2],
  mixamorigLeftUpLeg: [0.12, 0.04, 0.08],
  mixamorigLeftLeg: [0.18, 0, 0],
  mixamorigLeftFoot: [-0.22, 0, 0],
  mixamorigRightUpLeg: [0.08, -0.04, -0.08],
  mixamorigRightLeg: [0.22, 0, 0],
  mixamorigRightFoot: [-0.2, 0, 0],
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function mixPose(a: Pose, b: Pose, t: number): Pose {
  const out: Pose = {};
  for (const bone of BONES) {
    const A = a[bone] ?? [0, 0, 0];
    const B = b[bone] ?? A;
    out[bone] = [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)];
  }
  return out;
}

function addPose(base: Pose, delta: Pose): Pose {
  const out: Pose = { ...base };
  for (const [bone, d] of Object.entries(delta)) {
    const b = out[bone] ?? [0, 0, 0];
    out[bone] = [b[0] + d[0], b[1] + d[1], b[2] + d[2]];
  }
  return out;
}

function clipFromKeys(
  name: string,
  semanticState: string,
  duration: number,
  keys: Array<{ t: number; pose: Pose }>,
  loop = true,
): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  for (const bone of BONES) {
    const times: number[] = [];
    const values: number[] = [];
    for (const key of keys) {
      const e = key.pose[bone] ?? [0, 0, 0];
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0], e[1], e[2], "XYZ"));
      times.push(key.t);
      values.push(q.x, q.y, q.z, q.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
  }
  const clip = new THREE.AnimationClip(name, duration, tracks);
  (clip as THREE.AnimationClip & { userData: Record<string, unknown> }).userData = {
    semanticState,
    clipSourceType: "PLACEHOLDER_TEST_CLIP",
    isProcedural: true,
    source: "MixamoFightingMotionBank",
    loop,
  };
  return clip;
}

function breathe(base: Pose, amount = 0.035): THREE.AnimationClip {
  const up = addPose(base, {
    mixamorigSpine: [amount, 0, 0],
    mixamorigSpine1: [amount * 0.7, 0, 0],
    mixamorigHead: [-amount * 0.4, 0, 0],
  });
  return clipFromKeys("idle", "idle", 2.2, [
    { t: 0, pose: base },
    { t: 1.1, pose: up },
    { t: 2.2, pose: base },
  ]);
}

function walk(name: string, semantic: string, dir: 1 | -1): THREE.AnimationClip {
  const a = addPose(GUARD, {
    mixamorigLeftUpLeg: [0.55 * dir, 0, 0],
    mixamorigRightUpLeg: [-0.45 * dir, 0, 0],
    mixamorigLeftLeg: [0.35, 0, 0],
    mixamorigRightLeg: [0.1, 0, 0],
    mixamorigLeftArm: [0.25 * dir, 0, 0],
    mixamorigRightArm: [-0.25 * dir, 0, 0],
    mixamorigHips: [0.02, 0.08 * dir, 0],
  });
  const b = addPose(GUARD, {
    mixamorigLeftUpLeg: [-0.45 * dir, 0, 0],
    mixamorigRightUpLeg: [0.55 * dir, 0, 0],
    mixamorigLeftLeg: [0.1, 0, 0],
    mixamorigRightLeg: [0.35, 0, 0],
    mixamorigLeftArm: [-0.25 * dir, 0, 0],
    mixamorigRightArm: [0.25 * dir, 0, 0],
    mixamorigHips: [0.02, -0.08 * dir, 0],
  });
  return clipFromKeys(name, semantic, 0.7, [
    { t: 0, pose: a },
    { t: 0.35, pose: b },
    { t: 0.7, pose: a },
  ]);
}

function jab(): THREE.AnimationClip {
  const wind = addPose(GUARD, {
    mixamorigRightArm: [0.2, 0.1, 0.15],
    mixamorigSpine2: [0, 0.08, 0],
  });
  const hit = addPose(GUARD, {
    mixamorigRightArm: [-1.35, -0.15, -0.35],
    mixamorigRightForeArm: [-0.15, 0, -0.2],
    mixamorigSpine2: [0.08, -0.22, 0],
    mixamorigHips: [0, -0.12, 0],
    mixamorigRightShoulder: [0.2, -0.2, 0.15],
  });
  return clipFromKeys("lightAttack", "attack_1", 0.38, [
    { t: 0, pose: GUARD },
    { t: 0.06, pose: wind },
    { t: 0.16, pose: hit },
    { t: 0.38, pose: GUARD },
  ], false);
}

function cross(): THREE.AnimationClip {
  const wind = addPose(GUARD, {
    mixamorigLeftArm: [0.15, 0, 0.1],
    mixamorigRightArm: [0.35, 0.2, 0.2],
    mixamorigHips: [0, 0.2, 0],
  });
  const hit = addPose(GUARD, {
    mixamorigRightArm: [-1.55, 0.25, -0.45],
    mixamorigRightForeArm: [0.1, 0, -0.15],
    mixamorigSpine: [0.12, -0.4, 0.08],
    mixamorigHips: [0, -0.28, 0],
    mixamorigRightUpLeg: [0.15, 0, 0],
  });
  return clipFromKeys("heavyAttack", "attack_2", 0.55, [
    { t: 0, pose: GUARD },
    { t: 0.12, pose: wind },
    { t: 0.26, pose: hit },
    { t: 0.55, pose: GUARD },
  ], false);
}

function kick(high: boolean): THREE.AnimationClip {
  const chamber = addPose(GUARD, {
    mixamorigRightUpLeg: [-1.1, 0.15, 0],
    mixamorigRightLeg: [1.4, 0, 0],
    mixamorigHips: [0.1, -0.2, 0],
    mixamorigLeftArm: [0.2, 0, 0.2],
  });
  const ext = addPose(GUARD, {
    mixamorigRightUpLeg: high ? [-0.35, 0.4, -0.15] : [0.55, 0.2, -0.1],
    mixamorigRightLeg: high ? [0.15, 0, 0] : [0.05, 0, 0],
    mixamorigRightFoot: high ? [0.4, 0, 0] : [0.2, 0, 0],
    mixamorigHips: [0.05, -0.35, 0],
    mixamorigSpine: [high ? -0.15 : 0.2, -0.25, 0],
  });
  const name = high ? "highKick" : "lowKick";
  return clipFromKeys(name, "attack_2", 0.52, [
    { t: 0, pose: GUARD },
    { t: 0.12, pose: chamber },
    { t: 0.24, pose: ext },
    { t: 0.52, pose: GUARD },
  ], false);
}

function hit(): THREE.AnimationClip {
  const snap = addPose(GUARD, {
    mixamorigSpine: [-0.18, 0.22, 0.1],
    mixamorigHead: [-0.35, 0.3, 0.15],
    mixamorigLeftArm: [0.4, 0.2, 0.2],
    mixamorigRightArm: [0.35, -0.15, -0.2],
    mixamorigHips: [-0.08, 0.18, 0],
  });
  return clipFromKeys("hit_reaction", "hit_reaction", 0.32, [
    { t: 0, pose: GUARD },
    { t: 0.08, pose: snap },
    { t: 0.32, pose: GUARD },
  ], false);
}

function knockdown(): THREE.AnimationClip {
  const fold = addPose(GUARD, {
    mixamorigHips: [1.1, 0, 0],
    mixamorigSpine: [0.6, 0, 0],
    mixamorigHead: [0.4, 0, 0],
    mixamorigLeftUpLeg: [0.8, 0.2, 0],
    mixamorigRightUpLeg: [0.7, -0.2, 0],
    mixamorigLeftArm: [0.8, 0.4, 0.4],
    mixamorigRightArm: [0.8, -0.4, -0.4],
  });
  return clipFromKeys("knockdown", "knockdown", 0.7, [
    { t: 0, pose: GUARD },
    { t: 0.28, pose: fold },
    { t: 0.7, pose: fold },
  ], false);
}

function getup(): THREE.AnimationClip {
  const down: Pose = {
    ...GUARD,
    mixamorigHips: [1.1, 0, 0],
    mixamorigSpine: [0.5, 0, 0],
  };
  return clipFromKeys("getup", "getup", 0.7, [
    { t: 0, pose: down },
    { t: 0.35, pose: addPose(GUARD, { mixamorigHips: [0.4, 0, 0], mixamorigSpine: [0.3, 0, 0] }) },
    { t: 0.7, pose: GUARD },
  ], false);
}

function block(): THREE.AnimationClip {
  const high = addPose(GUARD, {
    mixamorigLeftForeArm: [0.2, 0.3, 0.25],
    mixamorigRightForeArm: [0.2, -0.3, -0.25],
    mixamorigLeftArm: [-0.15, 0.1, 0.15],
    mixamorigRightArm: [-0.15, -0.1, -0.15],
    mixamorigSpine: [0.12, 0, 0],
  });
  return clipFromKeys("block", "block", 1.0, [
    { t: 0, pose: high },
    { t: 0.5, pose: mixPose(high, GUARD, 0.12) },
    { t: 1.0, pose: high },
  ]);
}

function crouch(): THREE.AnimationClip {
  const low = addPose(GUARD, {
    mixamorigHips: [0.35, 0, 0],
    mixamorigLeftUpLeg: [0.85, 0.1, 0.15],
    mixamorigRightUpLeg: [0.85, -0.1, -0.15],
    mixamorigLeftLeg: [1.1, 0, 0],
    mixamorigRightLeg: [1.1, 0, 0],
    mixamorigSpine: [0.15, 0, 0],
  });
  return clipFromKeys("crouch", "crouch", 1.4, [
    { t: 0, pose: low },
    { t: 0.7, pose: addPose(low, { mixamorigSpine: [0.04, 0, 0] }) },
    { t: 1.4, pose: low },
  ]);
}

function grapple(): THREE.AnimationClip {
  const clinch = addPose(GUARD, {
    mixamorigLeftArm: [-0.9, 0.4, 0.5],
    mixamorigRightArm: [-0.9, -0.4, -0.5],
    mixamorigSpine: [0.25, 0, 0],
    mixamorigHips: [0.12, 0, 0],
  });
  return clipFromKeys("grapple", "grapple", 0.8, [
    { t: 0, pose: GUARD },
    { t: 0.25, pose: clinch },
    { t: 0.8, pose: clinch },
  ], false);
}

function victory(): THREE.AnimationClip {
  const up = addPose(GUARD, {
    mixamorigRightArm: [-2.4, 0, -0.2],
    mixamorigLeftArm: [-0.2, 0, 0.4],
    mixamorigSpine: [-0.12, 0, 0],
    mixamorigHead: [-0.15, 0.1, 0],
  });
  return clipFromKeys("victory", "victory", 1.6, [
    { t: 0, pose: GUARD },
    { t: 0.4, pose: up },
    { t: 1.6, pose: up },
  ]);
}

function strafe(dir: 1 | -1): THREE.AnimationClip {
  const a = addPose(GUARD, {
    mixamorigLeftUpLeg: [0.2, 0.25 * dir, 0.3 * dir],
    mixamorigRightUpLeg: [0.15, 0.25 * dir, 0.3 * dir],
    mixamorigHips: [0, 0, 0.12 * dir],
  });
  const b = addPose(GUARD, {
    mixamorigLeftUpLeg: [0.15, -0.2 * dir, -0.2 * dir],
    mixamorigRightUpLeg: [0.25, -0.2 * dir, -0.2 * dir],
    mixamorigHips: [0, 0, -0.12 * dir],
  });
  const semantic = dir < 0 ? "strafe_left" : "strafe_right";
  return clipFromKeys(semantic, semantic, 0.55, [
    { t: 0, pose: a },
    { t: 0.275, pose: b },
    { t: 0.55, pose: a },
  ]);
}

let cached: Map<string, THREE.AnimationClip> | null = null;

/** TEST_ONLY: never feeds PreCombatRosterGate fightAuthorized. */
export function buildMixamoFightingMotionBank(): Map<string, THREE.AnimationClip> {
  if (cached) return cached;
  const clips = new Map<string, THREE.AnimationClip>();
  const list = [
    breathe(GUARD),
    walk("walk_forward", "walk_forward", 1),
    walk("walk_back", "walk_back", -1),
    strafe(-1),
    strafe(1),
    jab(),
    cross(),
    kick(false),
    kick(true),
    block(),
    hit(),
    knockdown(),
    getup(),
    crouch(),
    grapple(),
    victory(),
  ];
  // extras mapped to additional semantic names used by FighterMesh
  const dash = walk("run", "run", 1);
  dash.duration = 0.45;
  list.push(dash);
  const backdash = walk("backdash", "backdash", -1);
  list.push(backdash);
  const defeat = knockdown();
  (defeat as { name: string }).name = "defeat";
  (defeat as { userData: Record<string, unknown> }).userData.semanticState = "defeat";
  list.push(defeat);

  for (const clip of list) {
    const semantic = String((clip as { userData?: { semanticState?: string } }).userData?.semanticState ?? clip.name);
    if (!clips.has(semantic)) clips.set(semantic, clip);
    if (!clips.has(clip.name)) clips.set(clip.name, clip);
  }
  cached = clips;
  return clips;
}
