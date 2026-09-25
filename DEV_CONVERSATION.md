# Brutal Fist — dev conversation

## 2026-09-24 — paint, metal, and bone add-ons

The select `tint` prop was a stub: faction color was passed into the mesh and never applied. Applying it would dye a one-texture body, skin included. culori now builds an OKLCH multiply. Maime’s named parts (legs, torso, head, arms, boots) tint per chunk. Every other fighter is one atlas: cloth tints dark saturated pixels, metal tints gray mask and chains. Visor, mouth plate, and wrist tape are extra boxes on the head and hand bones, not new GLBs. Titan Unmasked and Jager Beard stay attires. Ledger: `OPEN_SOURCE.md`.

## 2026-09-24 — rig audit + every playable attire is on the picker

Bannon `assets/models` (75 character GLBs) matches this game. The only extras on disk are the two offline skinned Maime files, and those are the ones that can actually animate. `MAIME.glb` and `MAIME_tattered.glb` have 0 skins, so they are not costumes. Canon is two Maime meshes: jeans (white facepaint, hoodie, chains) and tattered. The old "studded Maime" file is Onyx's corset. Select was hiding the strip when a fighter had one attire, and Maime's jeans button said DEFAULT, so both looked missing.

`@gltf-transform` + `meshoptimizer` now decode every GLB (`npm run audit:rigs`). 65 skinned, 12 unskinned, 0 weight sums off by more than 0.02 — nothing to rewrite. Maime jeans is 22 joints / 15 skinned pieces; tattered is 22 / 14. Mixamo fighters are 58. Edwin's raw unchained file is 46 joints; the playable one stays the 58-joint rig. Duplicate intermediates (rig28, xbot, wrestler base, cipher_rigged) stay off the roster.

`npm run audit:motion` measures hip yaw the same way playback does. Hurricane kick's first and last pose match, and the sanitizer still treats the yaw channel as a spin so the kick is not zeroed into a flop. Weights are not rewritten at runtime.

Maime is male. Lined-up combat yaw, Y, and Cipher feral scale are unchanged.

## 2026-09-24 — hurricane kick was in the clip the whole time

HURRICANE_KICK.json (1.83s, already in the bank from the older versions) spins on the hips: yaw walks a full turn and back, legs stay planted. `neutralizeHipYaw` was setting every hip yaw to 0, so the spin was deleted and the leftover hip pitch looked like a broken flop. Stance clips still lose constant facing bias. A clip whose unwrapped hip yaw travels past ~0.85 rad keeps the spin relative to frame 0. Right kick plays that clip near authored speed (not crushed into a 0.84s jab window). Capoeira, au, and drop kick get the same treatment.

## 2026-09-24 — merged Claude's branch playback with this one's full-clip gate

Claude (`brutalfistgrokversionten` branch `claude/brutalfistgrokversionten-dev-amh49o`) keeps the attack *state* (lock, hitbox, root motion) and plays a different *clip* per command (`attackClip`). This tree already holds a oneshot until the Mixamo clip finishes and binds clips bind-relative so plugin rigs deform. Combined:

- Specials and directional punches/kicks stamp a bank clip (`BOXING` vs `BIG_BODY_BLOW` vs `HURRICANE_KICK`, seeded per fighter) while the state stays lightAttack/heavyKick. Oneshot hold + timeScale still play the whole clip.
- Sidestep plays GINGA_SIDEWAYS / ESQUIVA / corkscrew instead of a walk slide, and the step arcs toward the opponent (tangent + inward) instead of a straight Z rail. Yaw stays the locked 0/π when lined up; a sidestep turns at most ~28° so they keep targeting.
- Hip tracks are a Y delta from the first key (crouch drops, jump rises) instead of being deleted or applied as absolute Mixamo height. XZ root stays with locomotion. t=0 is still planted.
- Each fighter's idle/walk/guard/crouch prefers a different local bank clip.
- Main menu and the fight HUD sit inside the phone safe area (notch, home indicator, side insets).

Maime is male. Combat rest yaw, Y, and Cipher feral scale are unchanged when fighters are lined up.

## 2026-09-18 — Tekken/Schwarzerblitz fire lock + unique kits from v9/v10

Punches were cutting mid-clip: FSM jab lock 0.44s vs Mixamo BOXING ~1.73s, then idle hard-stopped the oneshot. Pulled the Tekken 3 recompiled / Schwarzerblitz / Night Sky commit pattern: hold Attacking for max(frameData, min lock), LoopOnce + clampWhenFinished, timeScale = clip.duration / lock so every keyframe plays in a fighter-speed window (jab ~0.58s, heavy ~0.78s, kicks ~0.66–0.84s). FighterMesh ClipPlaybackGate ignores idle/walk until the oneshot finishes (hitstun/KO still interrupt). Per-character locomotion from v9 Mixamo bank (ginga/prowl/lumber/strut/box idle) and unique specials from each kit's signature/combo/extras. Continued from brutalfistgrokversionten; motion set already included v9 public/motion. Orientation/Y/scale/FX still locked. Maime is male.

## 2026-09-16 night — Mixamo colon mixer bind + per-fighter Bannon bank

GLBs have 0 embedded clips. Motion is `/public/motion` Mixamo Euler JSON. BANNON_rigged / CIPHER bones are `mixamorig:RightArm`; Three.js PropertyBinding.parseTrackName treats `:` as a path separator so the mixer "plays" with unresolved bindings and meshes barely deform. Sanitizer strips colons on the clone (skin indices are by bone object). Bank stays bind-relative. Per-fighter `defaultMoveSet` (bf_jab / bf_elbow / bf_powerbomb / bf_maime_driver / …) now owns semantic slots from the Bannon clip library. Pulled BIG_JUMP + BOXING__5_ + taunt/loco extras from mhvnsnt/Bannon. Orientation/Y/scale still locked.

## 2026-09-16 — Don't touch unrequested axes; raise fighters not FX; un-statue

Rule: if the task is facing, do not change Y/FX/select. Extra FOOT_PLANT_SINK stacked fighters into the floor. Combat fighter Y is locked at 0.22; hit FX stay at 1.2. Integrity test was stopping the mixer (statues) — skipped. Combat yaw remains P1 0 / P2 π. Continue on https://github.com/mhvnsnt/brutalfistgrokversioneight

## 2026-09-16 evening — reattach bank clips, Tekken stick, unique arenas

Living-statue: idle auto-play + attack-reset-every-frame were killing punches. Hard-cut other mixer actions on combat/locomotion; lastPlayedTriggerRef only restarts on trigger increment; auto-play idle effect removed. Bank clips still bind-relative (`q_bind * q_src(0)^-1 * q_src(t)`). Mixer indexes SEMANTIC_STATE_ALIASES + COMBAT_STATE_TO_SEMANTIC.

Tekken stick: tap up = jump (after 220ms double-tap window); double-up sidestep −Z (away); double-down +Z (toward cam); f,f dash / hold run; b,b Korean backdash; hold down crouch; air control after jump. Jump Y now actually updates the mesh (was copying the ref before comparing). Training arena locked. Other arenas unique geometry + stage-colored fog (was all `#050508`).
