# Brutal Fist — dev conversation

## 2026-09-18 — Tekken/Schwarzerblitz fire lock + unique kits from v9/v10

Punches were cutting mid-clip: FSM jab lock 0.44s vs Mixamo BOXING ~1.73s, then idle hard-stopped the oneshot. Pulled the Tekken 3 recompiled / Schwarzerblitz / Night Sky commit pattern: hold Attacking for max(frameData, min lock), LoopOnce + clampWhenFinished, timeScale = clip.duration / lock so every keyframe plays in a fighter-speed window (jab ~0.58s, heavy ~0.78s, kicks ~0.66–0.84s). FighterMesh ClipPlaybackGate ignores idle/walk until the oneshot finishes (hitstun/KO still interrupt). Per-character locomotion from v9 Mixamo bank (ginga/prowl/lumber/strut/box idle) and unique specials from each kit's signature/combo/extras. Continued from brutalfistgrokversionten; motion set already included v9 public/motion. Orientation/Y/scale/FX still locked. Maime is male.

## 2026-09-16 night — Mixamo colon mixer bind + per-fighter Bannon bank

GLBs have 0 embedded clips. Motion is `/public/motion` Mixamo Euler JSON. BANNON_rigged / CIPHER bones are `mixamorig:RightArm`; Three.js PropertyBinding.parseTrackName treats `:` as a path separator so the mixer "plays" with unresolved bindings and meshes barely deform. Sanitizer strips colons on the clone (skin indices are by bone object). Bank stays bind-relative. Per-fighter `defaultMoveSet` (bf_jab / bf_elbow / bf_powerbomb / bf_maime_driver / …) now owns semantic slots from the Bannon clip library. Pulled BIG_JUMP + BOXING__5_ + taunt/loco extras from mhvnsnt/Bannon. Orientation/Y/scale still locked.

## 2026-09-16 — Don't touch unrequested axes; raise fighters not FX; un-statue

Rule: if the task is facing, do not change Y/FX/select. Extra FOOT_PLANT_SINK stacked fighters into the floor. Combat fighter Y is locked at 0.22; hit FX stay at 1.2. Integrity test was stopping the mixer (statues) — skipped. Combat yaw remains P1 0 / P2 π. Continue on https://github.com/mhvnsnt/brutalfistgrokversioneight

## 2026-09-16 evening — reattach bank clips, Tekken stick, unique arenas

Living-statue: idle auto-play + attack-reset-every-frame were killing punches. Hard-cut other mixer actions on combat/locomotion; lastPlayedTriggerRef only restarts on trigger increment; auto-play idle effect removed. Bank clips still bind-relative (`q_bind * q_src(0)^-1 * q_src(t)`). Mixer indexes SEMANTIC_STATE_ALIASES + COMBAT_STATE_TO_SEMANTIC.

Tekken stick: tap up = jump (after 220ms double-tap window); double-up sidestep −Z (away); double-down +Z (toward cam); f,f dash / hold run; b,b Korean backdash; hold down crouch; air control after jump. Jump Y now actually updates the mesh (was copying the ref before comparing). Training arena locked. Other arenas unique geometry + stage-colored fog (was all `#050508`).
