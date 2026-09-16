# AGENTS.md — Brutal-Fist Agent Coordination Law

## Rocket Alignment Law

> **Before every change, inspect and align with Rocket's latest repository state. Preserve Rocket's existing functionality and advanced implementations. Make changes additively and non-destructively. Never replace working Rocket code with a simpler alternative merely to resolve a conflict. When capabilities differ, integrate the strongest compatible implementation from each side.**

---

## ═══════════════════════════════════════════════════════════════════
## USER-BUILT FEATURE PRESERVATION LAW — ABSOLUTE RULE
## ═══════════════════════════════════════════════════════════════════

> **NEVER destroy, replace, or degrade a feature the user explicitly built or requested unless the user explicitly asks for it to be removed.**

This law exists because agents have repeatedly replaced user-designed systems (e.g., per-character bloom hit effects) with inferior alternatives (text labels, damage numbers, "BLOCKED" overlays) without being asked to.

### Specific Protections

| Feature | Status | Rule |
|---|---|---|
| Per-character color bloom hit effects | **PROTECTED** | Never replace with text overlays, damage numbers, or labels |
| Character-specific aura/color identity | **PROTECTED** | Never invent new colors or replace existing ones |
| Hit effect VFX (bloom, sparks, point lights) | **PROTECTED** | Never remove or downgrade to text-only feedback |
| Text hit labels (BLOCKED, HEAVY, COUNTER, damage numbers) | **TRAINING ONLY** | Only show when `isPracticeMode === true` — never in real fights |

### The Rule in Plain Language

1. **If the user built it, it stays.** Do not replace a working visual system with a "simpler" alternative.
2. **Text hit indicators (BLOCKED, HEAVY, LIGHT, damage numbers) are training-mode-only.** They are ugly during real fights and the user did not ask for them there. Gate them behind `isPracticeMode`.
3. **Bloom effects are the canonical hit feedback for fights.** The `spawnHitEffect` call in `CombatArena3D.tsx` on every `damageEvent` is the correct system. Do not remove it.
4. **Before adding any new HUD element or hit feedback**, ask: "Did the user ask for this?" If no, do not add it.
5. **If you are unsure whether a feature was user-requested**, preserve it and ask rather than removing it.

---

## Operating Rules (Binding on All Agents)

1. **Every turn/work session**: Check the current GitHub state and what Rocket has done.
2. **Always align with Rocket's latest work** before changing anything.
3. **Never overwrite Rocket's advanced implementation** just because another version is easier or conflicts.
4. **Build non-destructively on top of it** — extend, integrate, repair, or add missing capabilities.
5. **If Rocket can do something you can't**, preserve Rocket's implementation.
6. **If you can do something Rocket can't**, add that capability around/on top of Rocket's work, without replacing working pieces.
7. **Resolve conflicts by integration**, not "pick ours/pick theirs" wholesale.
8. **Keep main, rocket-update, and the working state synchronized** so both agents are operating from the same reality.
9. **Before any substantial change**, inspect the relevant existing implementation, tests, commits, and dependencies.
10. **No destructive rollback/replacement** unless the user explicitly instructs it.
11. **When Rocket pushes new work**, that work becomes part of the baseline you must account for on the next turn.
12. **The goal is one progressively stronger Brutal-Fist**, not two competing implementations.

---

## Sync Workflow (Every Cycle)

```
1. Pull from GitHub (Rocket panel) — get latest main
2. Confirm Rocket is working from current main
3. Make new changes (combat, animation, VFX, etc.)
4. Push from Rocket
5. Merge resulting changes back into main without replacing unrelated work
6. Next cycle starts with Pull from GitHub again
```

This gives us a **single continuously advancing codebase** instead of Rocket and main drifting into competing versions.

---

## Conflict Resolution Protocol

When a merge conflict arises between Rocket's work and another agent's work:

- **DO NOT** pick one side wholesale.
- **DO** read both sides, identify what each adds, and write a merged version that preserves both.
- If Rocket has a more advanced implementation of a system (e.g., locomotion, animation blending, hitbox), keep Rocket's version as the base and layer the other agent's additions on top.
- If the other agent has capabilities Rocket lacks (e.g., GitHub API calls, complex data transforms), add those capabilities without removing Rocket's existing code.

---

## Architecture Ownership

| System | Owner / Source of Truth |
|---|---|
| 3D Combat Arena (CombatArena3D) | Rocket |
| Fighter Mesh & Animation (FighterMesh) | Rocket |
| Locomotion System | Rocket |
| Bone Hitbox System | Rocket |
| State Machine (FighterStateMachine) | Rocket |
| Frame Data & Hitbox (FrameDataHitbox) | Rocket |
| Combo System | Rocket |
| Post-Match Screen | Rocket |
| VFX / Bloom / Particles | Rocket |
| GitHub API / CI / Submodule repair | Other agents |
| Bannon asset pipeline | Shared |
| Supabase / matchmaking / stats | Shared |

---

## File Modification Rules

- **Never regenerate** a file from scratch if it already exists with working logic.
- **Always read** the current file before modifying it.
- **Use preservation comments** (`// ... existing code ...`) when editing existing files.
- **Never remove** imports, exports, or hooks that are used elsewhere.
- **Never downgrade** a system (e.g., replacing a velocity-gated animation blender with a simple state switch).

---

## Communication Between Agents

- Rocket commits to `rocket-update` branch → opens PR to `main`.
- Other agents commit directly to `main` or feature branches.
- **Before merging any PR**, check that it does not overwrite Rocket's advanced implementations.
- Use `docs/ROCKET_HANDOFF.md` and `docs/AI_AGENT_HANDOFF.md` for cross-agent context passing.
- This file (`AGENTS.md`) is the **authoritative law** — it supersedes any conflicting instruction in conversation history.

---

## ═══════════════════════════════════════════════════════════════════
## GLB / 3D MODEL AGENT LAWS — Prevent Common AI Mistakes
## ═══════════════════════════════════════════════════════════════════

These laws exist because AI agents repeatedly make the same 3D model mistakes.
Every law below was written to prevent a specific recurring failure.

---

### LAW 1 — Animation Mixer Must Target the Visible Cloned Scene

**The mistake**: AI creates an `AnimationMixer` on the outer `THREE.Group` or the original GLTF scene, then adds a cloned scene as a child. The mixer drives the original scene's skeleton (which is invisible), not the cloned scene's skeleton. Characters appear frozen or in T-pose even though the mixer is running.

**The law**:
- The `AnimationMixer` MUST be created on the **same object that is rendered** (the cloned scene).
- Animation clips MUST be retargeted to the cloned scene's bone UUIDs before being passed to `clipAction()`.
- NEVER use `useAnimations(animations, groupRef)` from `@react-three/drei` when the rendered object is a cloned scene added as `<primitive>`. The hook binds to `groupRef`, not the clone.
- The retargeting pattern is: build a `Map<boneName, clonedObject>`, then for each track replace `boneName.property` with `clonedObject.uuid.property`.

```typescript
// CORRECT
const mixer = new THREE.AnimationMixer(clonedScene);
const cloneMap = new Map<string, THREE.Object3D>();
clonedScene.traverse(obj => { if (obj.name) cloneMap.set(obj.name, obj); });
for (const clip of animations) {
  const retargetedTracks = clip.tracks.map(track => {
    const dot = track.name.indexOf('.');
    if (dot === -1) return track.clone();
    const boneName = track.name.slice(0, dot);
    const prop = track.name.slice(dot);
    const obj = cloneMap.get(boneName);
    const t = track.clone();
    if (obj) t.name = `${obj.uuid}${prop}`;
    return t;
  });
  const retargeted = new THREE.AnimationClip(clip.name, clip.duration, retargetedTracks);
  actions[clip.name] = mixer.clipAction(retargeted);
}
// WRONG — mixer targets outer group, not the visible clone
const { actions, mixer } = useAnimations(animations, groupRef);
```

---

### LAW 2 — Universal Box3 Floor Normalization (No Per-Character Offsets)

**The mistake**: AI hardcodes per-character Y offsets like `position.y = -0.3` for one character and `position.y = -0.8` for another. This breaks every time a new model is added and causes characters to sink into or float above the floor.

**The law**:
- ALL characters use the same Box3 normalization pipeline.
- After scaling, compute `scaledBox.min.y` and set `cloned.position.y = -scaledBox.min.y`.
- This places the bottom of the bounding box exactly at Y=0 for every model, regardless of where the geometry origin is.
- NEVER add a per-character `nudgeY` or manual Y offset.
- NEVER use `scene.position.y = someHardcodedValue`.

```typescript
// CORRECT — works for every model
cloned.scale.setScalar(scale);
cloned.updateMatrixWorld(true);
const scaledBox = new THREE.Box3().setFromObject(cloned);
const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
cloned.position.set(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);

// WRONG — breaks other characters
cloned.position.y = -0.3; // hardcoded for one model
```

---

### LAW 3 — Universal Forward-Direction Detection (No Per-Character Rotation Hardcoding)

**The mistake**: AI hardcodes rotation corrections like `if (characterId === 'onyx') rotation.y = Math.PI` for specific characters. This fails for every new character and is never applied consistently.

**The law**:
- Forward direction MUST be detected automatically from bone positions.
- Detection: if `headBone.worldZ > hipsBone.worldZ` by more than 0.05 units, the model faces +Z (Blender default) and needs a 180° Y correction.
- The correction is applied to an **inner group** wrapping the normalized scene, SEPARATE from the outer group's `rotationY` (which is set by the parent for P1/P2 orientation).
- NEVER hardcode `rotation.y = Math.PI` for specific character IDs.
- The outer group's `rotationY` is set by `CombatArena3D` (P1=0, P2=Math.PI) and MUST NOT be modified by `FighterMesh`.

```typescript
// CORRECT — auto-detected, applied to inner group
function detectForwardCorrection(scene): number {
  const headBone = findBone(scene, 'head');
  const hipsBone = findBone(scene, 'hips');
  if (!headBone || !hipsBone) return 0;
  const headZ = getWorldZ(headBone);
  const hipsZ = getWorldZ(hipsBone);
  return (headZ - hipsZ > 0.05) ? Math.PI : 0;
}
// In JSX:
<group rotation={[0, rotationY, 0]}>           // outer: P1/P2 orientation
  <group rotation={[0, forwardCorrectionY, 0]}> // inner: forward fix
    <primitive object={normalizedScene} />
  </group>
</group>

// WRONG — hardcoded per character
if (id === 'onyx') scene.rotation.y = Math.PI;
```

---

### LAW 4 — Root Bone Normalization Before Box3

**The mistake**: AI runs Box3 normalization first, then tries to fix the root bone. The root bone offset is already baked into the Box3 result, so the correction is applied twice or not at all.

**The law**:
- Run `AutoRigDetector.normalizeRootToFloor(cloned)` BEFORE computing the Box3.
- This ensures the skeleton is at the correct position before the bounding box is measured.
- Order: (1) clone scene, (2) normalize root bone, (3) compute Box3, (4) scale, (5) recompute Box3, (6) set position.

---

### LAW 5 — Never Reset Child Rotations

**The mistake**: AI calls `scene.traverse(child => child.rotation.set(0,0,0))` to "fix" orientation. This destroys the bone orientations of the rig, causing the model to collapse into a pile of disconnected bones.

**The law**:
- ONLY reset the root scene node's rotation: `cloned.rotation.set(0, 0, 0)`.
- NEVER reset rotations on child objects, bones, or meshes.
- If a model appears rotated, use the forward-detection method (LAW 3) to apply a correction to a wrapper group.

---

### LAW 6 — Mixer Must Be Advanced Manually When Not Using useAnimations

**The mistake**: AI creates a manual `AnimationMixer` but forgets to call `mixer.update(delta)` in the render loop. Animations are created and started but never advance — characters stay frozen in the first frame.

**The law**:
- When using a manually-created `AnimationMixer` (not `useAnimations`), ALWAYS call `mixer.update(delta)` inside `useFrame`.
- The mixer update must happen on the same mixer that was used to create the actions.
- Hit-stop: set `mixer.timeScale = 0` to freeze, `mixer.timeScale = 1` to resume. Do NOT skip `mixer.update()` — just set timeScale to 0.

```typescript
// CORRECT
useFrame((_, delta) => {
  if (!hitStopActive) mixer.update(delta);
  // or: mixer.update(hitStopActive ? 0 : delta);
});

// WRONG — mixer never advances
useEffect(() => { action.play(); }, []);
// (no useFrame update)
```

---

### LAW 7 — Animation Timing Must Use Clip Duration, Not Hardcoded Frames

**The mistake**: AI hardcodes animation durations like `setTimeout(() => setState('idle'), 500)` instead of using the actual clip duration. This causes animations to cut off early or transition too late.

**The law**:
- Use `action.getClip().duration` to get the actual clip length.
- For one-shot animations (attacks, knockdowns), listen to the `finished` event on the mixer.
- NEVER hardcode frame counts or millisecond delays for animation transitions.

```typescript
// CORRECT
mixer.addEventListener('finished', (e) => {
  if (e.action === attackAction) transitionToIdle();
});

// WRONG
setTimeout(() => transitionToIdle(), 500); // hardcoded
```

---

### LAW 8 — GLB Roster: No Attire-Count Cap, One Slot Per Character

**The mistake**: AI limits characters to one GLB per slot or creates separate character slots for each attire. This bloats the roster and breaks the Tekken-style select screen.

**The law**:
- One character slot per unique `id` in `bannonGlbRoster.ts`.
- Multiple attires for the same character share the same `id`.
- The character select screen deduplicates by `id` and shows attires as a secondary selection.
- There is no cap on the number of attires per character.

---

### LAW 9 — Drive GLBs: Use Direct Download URL

**The mistake**: AI uses the Google Drive share URL (`/view?usp=sharing`) as the GLB source. Three.js cannot load this — it returns an HTML page, not binary data.

**The law**:
- Always convert Drive share URLs to direct download URLs:
  - Share URL: `https://drive.google.com/file/d/FILE_ID/view?usp=sharing`
  - Direct URL: `https://drive.google.com/uc?export=download&id=FILE_ID`
- Store the direct URL in `overrideUrl` in `bannonGlbRoster.ts`.
- The `getCharacterAttires()` function in `CharacterSelect.tsx` uses `overrideUrl` when present.

---

### LAW 10 — Bannon Naming Canon

**The mistake**: AI mislabels GLBs based on filename assumptions.

**The law** (canonical, permanent):
- `BANNON.glb` = Bannon **default / muscular** body (the canonical playable Bannon)
- `BANNON_fat.glb` = Bannon **fat alt** (previously mislabeled as "muscular" — this is wrong)
- Never reverse this. The filename `BANNON_fat.glb` is the fat version, full stop.

---

### LAW 11 — playableGate Must Default to PASS for New Characters

**The mistake**: AI adds new characters with `playableGate: "BLOCKED_QA"` as a "safe default". This hides them from the character select screen and requires a separate unlock step.

**The law**:
- New characters added with confirmed GLB URLs get `playableGate: "PASS"`.
- `BLOCKED_QA` is only for characters whose GLB has known rig failures that prevent combat.
- `BLOCKED_RIG` is only for characters whose GLB has no skeleton at all.
- When in doubt, use `PASS` with `rigStatus: "qa-weak"` — the engine handles weak rigs gracefully.

---

### LAW 12 — Never Bind Hitboxes to the Outer Group

**The mistake**: AI initializes `BoneHitboxSystem` on the outer `THREE.Group` instead of the normalized cloned scene. The outer group has no bones, so all hitbox positions are at the world origin.

**The law**:
- Always call `boneHitboxRef.current.initFromSkeleton(normalizedScene)` after normalization.
- The normalized scene is the object that contains the actual skeleton.
- Update hitboxes with `boneHitboxRef.current.update(delta)` inside `useFrame`.

---

### LAW 13 — Synthetic Rig for Bone-Less Models

**The mistake**: AI skips bone-less models entirely or crashes when `report.quality === 'none'`. This leaves characters invisible or broken in the arena.

**The law**:
- When `AutoRigDetector.analyze()` returns `quality === 'none'` or `totalBones === 0`, call `AutoRigDetector.buildSyntheticRig(clonedScene)` to generate a procedural Mixamo-compatible skeleton from the mesh AABB.
- The synthetic rig uses standard humanoid proportions (hips at 52% height, head at 90%, etc.) and Mixamo bone names so animation clips can be retargeted.
- After building the synthetic rig, register the new bones in the clone map so UUID-based mixer binding works.
- The synthetic rig provides AABB-level hitboxes and basic animation support. For full bone-parented hitboxes, the model should be re-rigged with Mixamo.
- NEVER skip normalization or mixer creation for bone-less models — always run the full pipeline.

```typescript
// CORRECT
if (report.quality === 'none' || report.totalBones === 0) {
  const syntheticResult = AutoRigDetector.buildSyntheticRig(cloned);
  // Register synthetic bones in clone map for UUID binding
  cloned.traverse(obj => {
    if ((obj as THREE.Bone).isBone && obj.name.startsWith('mixamorig')) {
      cloneMap.set(obj.name, obj);
    }
  });
}

// WRONG — skipping bone-less models
if (report.quality === 'none') return null; // ❌ breaks combat
```

---

### LAW 14 — Animation Alias Coverage Must Include All Source Repos

**The mistake**: AI only maps generic clip names (idle, walk, attack) and misses clips from Schwarzerblitz, Tekken, Bannon, and Mixamo repos. Characters with source-specific clip names appear frozen.

**The law**:
- `ANIMATION_ALIASES` in `FighterMesh.tsx` MUST include aliases for all four sources:
  - Schwarzerblitz: `SBW_idle`, `SBW_walk_fwd`, `SBW_lightAttack`, etc.
  - Tekken: `T_1`, `T_2`, `T_3`, `T_4`, `T_jab`, `T_cross`, `T_1_3`, `T_2_4`, etc.
  - Bannon: `bf_jab`, `bf_cross`, `bf_elbow`, `bf_walk_fwd`, etc.
  - Mixamo: `Jab`, `Cross`, `Hook`, `Uppercut`, `Walking`, `Punching`, `Kicking`, etc.
- `AnimationStateMap.ts` MUST have the same coverage.
- `MoveLibrary.ts` MUST have separate alias maps for each source (`SBW_ALIASES`, `TEKKEN_ALIASES`, `BANNON_ALIASES`, `MIXAMO_ALIASES`).
- When adding a new clip source, add it to ALL THREE files simultaneously.

---

### LAW 15 — All Combat States Must Have Frame Data

**The mistake**: AI adds new `FighterMotionState` values but forgets to add them to `DEFAULT_FRAME_DATA` in `MoveLibrary.ts`. This causes TypeScript errors and missing hitbox timing.

**The law**:
- Every value in the `FighterMotionState` union type MUST have a corresponding entry in `DEFAULT_FRAME_DATA`.
- When adding a new state, add it to: (1) the union type in `AnimationController.ts`, (2) `DEFAULT_FRAME_DATA` in `MoveLibrary.ts`, (3) `ANIMATION_ALIASES` in `FighterMesh.tsx`, (4) `aliases` in `AnimationStateMap.ts`.
- States without hitboxes (locomotion, post-match) use `hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0`.

---

### LAW 16 — Loop vs One-Shot Animation Modes Must Be Set Correctly

**The mistake**: AI sets all animations to `LoopRepeat` or all to `LoopOnce`. Attacks that loop never return to idle; locomotion that plays once freezes after one cycle.

**The law**:
- **Loop states** (`LoopRepeat, Infinity`): idle, walk, run, crouch, guard, strafe, sidestep, backdash, knockdown (ground hold)
- **One-shot states** (`LoopOnce, 1` + `clampWhenFinished = true`): all attacks, hit reactions, knockdown fall, wakeup, victory, defeat, taunt, intro, throws
- Set the loop mode on `nextAction` BEFORE calling `crossFadeTo()` or `play()`.
- For one-shot attacks, listen to the mixer's `finished` event to transition back to idle.

---

### LAW 17 — Announcer System Must Be Wired to Match State, Not Timers

**The mistake**: AI fires announcer lines on arbitrary timers or in useEffect cleanup functions, causing double-fires, missed calls, or calls during wrong game phases.

**The law**:
- `AnnouncerSystem` (`src/engine/announcer/AnnouncerSystem.ts`) is the single source of truth for all voice lines.
- Every announcer line MUST be fired from a specific game state transition, not a generic timer:
  - `getReady` → pre-match mount (200ms after component mounts)
  - `round1/2/3` → SWEEP_DURATION_MS + 300ms (intro cinematic start)
  - `fight` → SWEEP_DURATION_MS + INTRO_DURATION_MS + 600ms (player control unlocked)
  - `ko` / `doubleKo` → exact frame `engine.isMatchOver()` returns true
  - `perfect` / `great` → 800ms after KO, based on winner HP percentage
  - `timeUp` → exact frame `roundTimer` hits 0
  - `draw` → 1200ms after timeUp or doubleKo
  - `p1Wins` / `p2Wins` → 2200ms after KO (during victory cinematic)
  - `kiCharge` → exact frame `isKiChargeInput()` returns true
- Use `announcerFiredRef` to prevent double-firing per round.
- Reset `announcerFiredRef` on every new match/rematch.

---

### LAW 18 — Ki Charge Blocks Blocking and Consumes on First Hit

**The mistake**: AI implements Ki Charge as a pure buff without the blocking penalty, or forgets to consume the charge when the attack lands.

**The law**:
- Ki Charge (`KiChargeSystem.ts`) is triggered by `lp && rp && lk && rk` simultaneously (1+2+3+4).
- While active: `blockingDisabled = true` — the fighter CANNOT block. Guard input is ignored.
- On hit: `nextAttackIsCounter = true` — apply `applyKiChargeCounterHit()` (1.25x damage).
- On blocked hit: apply `chipDamageMultiplier` (15%) instead of full guard reduction.
- Charge is consumed (reset to `createKiChargeState()`) the moment the first attack lands.
- Charge expires after 120 frames (2 seconds) if no attack lands.
- `p2IsBlocking` check in `GameBattleArena.tsx` MUST check `!p2KiChargeRef.current.blockingDisabled`.

---

### LAW 19 — Combat State Tick Must Be Decoupled from R3F Render Loop

**The mistake**: AI puts hit math, health updates, and position calculations inside `useFrame()` or the R3F Canvas render loop. Frame drops on mobile break combat math.

**The law**:
- `CombatStateTick.ts` contains the pure combat state machine (health, stun, airborne, Ki Charge).
- `tickCombatState()` is a pure function — no Three.js references, no side effects.
- The R3F Canvas (`CombatArena3D.tsx`) ONLY reads state from refs — it NEVER writes to combat state.
- `GameBattleArena.tsx` runs the combat tick in `requestAnimationFrame` at fixed 60fps, separate from R3F.
- Juggle gravity uses exponential fall acceleration (`JUGGLE_GRAVITY_EXPONENT = 1.08`) — not linear.
- Z-axis sidestep whiff: if `|attackerZ - defenderZ| >= SIDESTEP_WHIFF_THRESHOLD (0.6)`, linear attacks miss.
- Block stun is shorter than hit stun — defender recovers before attacker on most normals.

---

*Last updated: Brutal-Fist v9 — Announcer system + Ki Charge + decoupled combat tick + juggle gravity + sidestep whiff.*
*These laws are derived from real recurring failures observed across multiple AI agent sessions.*
