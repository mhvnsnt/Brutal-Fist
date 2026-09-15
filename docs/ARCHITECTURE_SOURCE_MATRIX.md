# Brutal Fist Architecture Source Matrix

The project may incorporate architecture from the approved Tekken, Schwarzerblitz, Bannon, and prior BF source projects. Integration is by verified subsystem behavior, not blind source concatenation.

| Source | Pull deeply for | BF boundary |
|---|---|---|
| Schwarzerblitz | Native runtime, rendering/game-loop semantics, resources, C++ runtime structure | Native authority |
| Bannon | Fighter GLBs, rigs, animations, authored content, measured QA evidence | Content authority |
| Tekken3Recompiled | PS1-era runtime organization, fixed-step/game-state/resource techniques | Research/adaptation |
| Tek3Ex | Tekken 3 binary/resource structures and extraction/packing techniques | Research/tooling |
| Tekken_HY352 | Frame-data math and combat-state modeling | Combat contract |
| ue4-tekkengame | Large-scale fighting-game data/class/asset organization | Architecture research |
| Grok v7 | Deterministic state, modes, frame data, orientation, lifecycle architecture | Additive BF adapter |
| NightSky / Combat-RPG | Reusable gameplay/system architecture where verified | Secondary source |

## Non-negotiable boundaries

1. One BF runtime: do not create parallel combat engines.
2. Schwarzerblitz remains native runtime authority.
3. Bannon remains fighter/content authority.
4. NO GLB = NO CHARACTER.
5. UNKNOWN is never PASS.
6. Default match rules are KO-only.
7. Pins, submissions, and wrestling rules remain explicitly gated options.
8. Tekken-derived research must not introduce proprietary game assets into BF.
9. Legal/unmodified user-owned source or permitted open-source code may be studied and adapted; retail game assets remain outside the repository unless independently authorized.
10. Every imported subsystem gets a BF contract, tests, and a measurable acceptance gate before it becomes authoritative.

## Integration order

Native loop/resource boundary -> deterministic fixed-step combat -> frame-data/state machine -> collision/hitboxes -> animation lifecycle -> grapples/physical contact -> camera/orientation -> stages/audio -> menus/modes/save -> performance/disposal.
