# Brutal Fist — Resumable AI Agent Handoff

Brutal Fist must never depend on one AI session finishing the entire game. Agents are interchangeable workers; GitHub is the durable state.

## Rules

1. Work only from `main` or a short-lived task branch.
2. One task = one bounded implementation goal.
3. Commit working increments; never leave important progress only in chat/context.
4. Never force-push `main`.
5. Never replace a real Bannon asset with generated/procedural placeholder content.
6. Never claim native Schwarzerblitz behavior when only the browser compatibility layer has been changed.
7. Fail closed on missing/invalid fighter assets, skeletons, animation manifests, or provenance.
8. Run the narrowest relevant validation before handing off. Record failures honestly.
9. A replacement agent must be able to continue from the issue number + latest commit without reconstructing hidden context.

## Current execution order

- #1 Bannon roster snapshot
- #2 Bannon stats into 60 Hz match runtime
- #3 Grapple/control/throw/pin runtime integration
- #4 Poise + deterministic hit-stop + native ragdoll handoff
- #5 Schwarzerblitz native bridge acceptance

## Source authority

- `mhvnsnt/Bannon`: fighter identity, roster data, combat/physics contracts, real GLB/animation source.
- `mhvnsnt/SchwarzerblitzEngine`: native game-engine authority and resource semantics.
- `mhvnsnt/brutalfistgrokversion*`: historical implementation evidence; compare all versions and preserve useful deltas.
- `mhvnsnt/NightSkyEngine`: Unreal Control Rig/animation reference only.
- `mhvnsnt/Combat-RPG-prototype-`: development/build orchestration reference only.

## Agent stop condition

If an agent runs out of credits, context, time, or tool budget, it stops after committing the last coherent increment. The next agent starts at the next open issue. No task is considered complete merely because an agent ran out of budget.

## Definition of done

A task is done only when its code is committed, its acceptance criteria are recorded, and relevant validation has actually run. Documentation-only declarations do not substitute for runtime integration.
