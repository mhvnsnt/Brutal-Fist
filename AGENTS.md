# Brutal-Fist Agent Operating Rules

## Rocket Alignment Law

This repository is developed collaboratively with Rocket and other agents. The repository is one synchronized game codebase, not competing implementations.

1. **Inspect first, every turn.** Before making substantive changes, check the current `main`, `rocket-update`, recent commits, open PRs, and the relevant existing implementation.
2. **Align with Rocket's latest work.** Treat Rocket's latest committed implementation as part of the current baseline. Do not assume an older snapshot is authoritative.
3. **Preserve advanced work.** Never replace Rocket's working or more advanced implementation with a simpler version merely to resolve a conflict.
4. **Add non-destructively.** Extend, integrate, repair, or wrap existing systems. Prefer additive changes over rewrites.
5. **Integrate capability differences.** If Rocket provides functionality this agent cannot reproduce, preserve it. If this agent can provide a capability Rocket cannot, add it around/on top of Rocket's implementation without removing existing behavior.
6. **No wholesale conflict selection.** Do not resolve conflicts by blindly choosing `ours` or `theirs` for whole files. Compare the implementations and retain useful behavior from both sides.
7. **No destructive rollback.** Do not reset, force-replace, or discard another agent's work unless the user explicitly requests it.
8. **Synchronize before continuing.** When Rocket has committed to `main`, synchronize the Rocket working copy from GitHub before making new changes there. When this agent changes the repository, keep the shared branch/PR workflow synchronized as well.
9. **Keep one game.** The objective is one progressively stronger, playable Brutal-Fist build. Branches and PRs are integration mechanisms, not separate competing versions of the game.
10. **Verify before claiming.** Inspect diffs, refs, relevant files, and CI/status results when available. Distinguish verified repository state from assumptions.

## Combat/Animation Priority

Combat and animation work should make the game genuinely playable. Preserve and build upon Rocket's existing locomotion, state-machine, hitbox, hit-stop, animation blending, rig inspection, character normalization, practice-mode, replay, and combat-flow systems rather than replacing them with diagnostic-only scaffolding.

## Git Safety

- Use targeted commits.
- Compare before merging.
- Preserve working behavior on both sides.
- After integration, ensure the shared branches point to a known synchronized state before the next agent session.
