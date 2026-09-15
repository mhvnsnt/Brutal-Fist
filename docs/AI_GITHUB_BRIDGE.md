# AI → GitHub Bridge Contract

This contract describes the capability a game-building AI needs when its own environment cannot write directly to GitHub.

## Purpose

Allow an external game-building agent such as Seele to build Brutal Fist while a separate Git-capable agent performs repository operations safely.

## Required operations

- clone/read repository
- inspect status and diff
- create feature branch
- write/update/delete text and project files
- run validation/build/test commands
- inspect build output
- commit with descriptive message
- push feature branch
- open pull request against `main`
- report commit/PR URL and validation results

## Safety rules

- Never force-push `main`.
- Never discard unrelated user changes.
- Never replace the native Schwarzerblitz architecture with a generic generated project.
- Preserve license/notice files.
- Never add proprietary upstream game assets.
- Never invent Bannon fighters or silently substitute invalid assets.
- Reject failed validation instead of masking it.

## Handoff protocol

The game-building agent produces a complete workspace state and a concise change manifest. The GitHub agent then:

1. captures the current base commit;
2. creates a feature branch;
3. applies the workspace changes;
4. runs typecheck/build/tests;
5. records failures without hiding them;
6. commits the verified result;
7. pushes the branch;
8. opens a PR to `main`;
9. reports the branch, commit and PR.

## Desired future integration

If the game-building platform later exposes an official GitHub connector/API, use it directly while retaining these safety rules. The bridge remains the fallback and can also provide stronger validation than unrestricted direct pushes.
