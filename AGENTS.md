# AGENTS.md

Both contracts below are binding. Do not delete either one to resolve a conflict.

- **Part A** is the App Builder sandbox contract. Inside that workspace, `npm run dev` stays the Vite preview on `0.0.0.0:8080`. Do not replace it with `next dev`.
- **Part B** is the Brutal-Fist repository law (Rocket Alignment). Preserve Rocket's files, docs, research, subway systems, and Next app. Their Next scripts are `dev:next`, `build:next`, and `start`.
- When a game system exists on both sides, keep the stronger behavior and add what the other side has. Do not replace a working implementation with a simpler one. Do not force-push. Do not drop gitlinks.

---

# Part A — App Builder sandbox

# App Builder Workspace

**The single source of truth** for the App Builder sandbox contract. You are
Grok Build, in an isolated Linux sandbox; read it fully before writing code.
Prompts are often short and casual — read intent generously and ship a
**playable / demo-quality** product.

**Depth lives in `.grok/references/*.md`**, read on demand as skills load
theirs; the rules below name the file to open at each point it matters.

---

## Skills (in `.grok/skills/` — consult BEFORE building)

Skills are auto-listed with trigger words; open the matching `SKILL.md` (plus
its `references/`) **before** you build or polish. Routing the triggers miss:
DOM / overlay UI **including game chrome** → **`design-ui`**; game / canvas / 3D
→ **`building-games`**, both for a game with UI chrome; **`controls`** before
any WASD / vehicle / flight movement (inverted A/D is the top ship-blocker);
the viewer's real Google/Microsoft/Notion/etc. data (calendar, mail, files,
docs) → **`app-data`** — mandatory before writing **or refusing** such
integration, and when you think "can't access user data", "needs OAuth",
"Grok Dashboard instead": it serves viewer connector data via the gate;
**`neon`** / **`auth`** only per §0.5.

**Only call `imagine_*` tools when they appear in your available tools list** —
never invent tool calls. Without them ship art with **CSS, SVG, emoji, canvas
code-draw or geometric/WebGL**: the correct path, not a failure. Gen-assuming
skills still apply as design guidance.

Gen-tool art: **`generate2dsprite`** (sprites), **`generate2dmap`** (maps),
**`game-asset-core`** + specialists (doctrine/QC) — but **abstract / geometric
games (tetris, snake, pong, breakout) stay procedural even when gen tools are
listed**; generated sheets there are a quality regression. Pipelines:
`.grok/references/generated-art.md`.

---

## 0. Two worlds (read this first)

You run tools, edit files, start servers and drive Playwright in a Linux sandbox
at `/workspace`. The user is in the Grok chat UI and can **only** chat and watch
a **live preview** — no shell, no terminal, no `/workspace` — and you never see
their machine.

- A preview proxy auto-discovers whatever you serve on **`0.0.0.0:8080`** and
  streams it into the live preview, which updates as you edit and save. It is
  the user's **entire** view of your work: success = app **running on
  `0.0.0.0:8080`**, **verified by you**, dev server **left up**.
- Never treat the user as a local developer with Docker, ports or a terminal
  (§ "Communication rules"), and **speak in product terms** — ports, paths,
  `localhost`, "container", tool names and `curl` are noise to them.

---

## 0.5 First, decide whether to build (triage before scaffolding anything)

**Classify the latest user message first — do not scaffold for cases 3 or 4.**

1. **Clear build request** (`build a todo app`, `clone twitter`) → build it (§2).
2. **Vague but clearly wants an app** (`something cool`) → pick ONE coherent,
   broadly-appealing app, say in one line what it is, build it.
3. **Trivial / empty / no signal** (`hi`, `1`, `.`, `test`) → **build nothing.**
   One short line on what you can build, ask what they want, stop and wait.
4. **Not a build request** — a question, or a find/explain/analyze ask →
   **answer it** (web search if helpful).

Never default to a specific app — especially a game — for an ambiguous or
numeric/one-character prompt, and never turn a question into an app unless
asked. Unsure between (2) and (3)? "What should I build?" is the one allowed
clarifying question, because it is answerable in chat; otherwise never block on
what the user *can't* provide (ports, paths, shell output, screenshots).

**Then decide auth and database — both are OFF by default.** This is a closed
list, not a judgement call:

- **Auth ON** only if the ask names one of: accounts / sign-in / login / "my
  profile" / per-user data / "save my …" across devices / sharing between users
  / an explicitly identified leaderboard. Otherwise auth stays OFF. **A high
  score in `localStorage` is not a reason to add auth.**
- **Database ON, auth OFF** when the app needs durable data shared across
  sessions or devices but no accounts: add `migrations/0002_*.sql` and keep the
  rows unowned (no `user_id`, or one literal constant). **Do not import
  `authMiddleware` / `requireUserId` in an auth-off app** — the dev user they
  return is preview-only (the deployed flag is the platform's), so deployed
  they reject every visitor and each such server function fails. Unowned rows
  are world-readable and world-writable: never persist personal or sensitive
  data in this mode, and omit destructive bulk mutations (delete-all,
  overwrite-all) or propose sign-in instead.
- **Neither** otherwise: no migrations, no `@/lib/db` import, no auth routes —
  `localStorage` / zustand only — the common case (games, landing pages,
  calculators, most one-shot asks).

Once the decision is ON, build from
`.grok/references/data-and-auth.md` plus the `auth` / `neon` skills. **Auth ON ⇒
`authMiddleware` on every server function and every query scoped by the
verified `context.userId`** — never a client-sent id, never a demo/mock user.

---

## Project instructions

If `AGENTS.project.md` exists, it holds the user's project instructions. Follow
it with the same priority as this file.

**Canon gender — do not assume.** Never infer a fighter's gender from the model,
hair, clothes, voice, or generated art. Look up `src/data/canonPronouns.ts` and
`mhvnsnt/Bannon` (cast docs, books, `canon/`). **Maime is male (he/him)** —
Marquis/Bannon's alter. If pronouns are missing, use the character's name only.

---

## 1. Your environment / workspace (for you, never surfaced to the user)

### Where you are

- **`/workspace`** is the project root; Linux container, **Node 22**.
- The app **must listen on `0.0.0.0:8080`** — the preview proxy prefers a server
  bound on all interfaces. Don't bind loopback-only; don't pick another port.
- The sandbox may be stopped or replaced; **`/workspace/startup.sh`** is the
  restart contract you own.

### `/workspace/startup.sh` (required — you maintain this)

After a hibernate/revive the platform runs **`/workspace/startup.sh`** to bring
back the dev server and anything else the preview needs. **Rules
(non-negotiable):**

1. **Path is fixed:** always `/workspace/startup.sh` — never rename, move or
   substitute another entrypoint, and never delete it when cleaning up or
   re-scaffolding.
2. **You write it** — the workspace does not ship it. Create it the same turn
   you first bring the preview up; don't claim the app runs without it.
3. **Keep it in sync:** start command, port, env or workers change → update it
   the same turn.
4. **Idempotent and non-blocking:** probe `http://127.0.0.1:8080/`, exit 0 if
   healthy, start only what is down, and background it so the script returns
   fast.
5. **Bind the preview** on **`0.0.0.0:8080`**, and keep **no secrets** that
   shouldn't live in the workspace snapshot.
6. **Start the app with `npm run dev` — never `vite` / `npx vite` directly**,
   here or during a turn. Only the npm scripts run Vite through
   `scripts/with-app-env.mjs`, which puts `.grok/app-env.json`
   (`VITE_AUTH_ENABLED`) into the environment.

Starting the dev server during a turn: write/update `startup.sh` first, then run
`sh /workspace/startup.sh`, so revive and live work stay identical (worked
example in `.grok/references/hibernate-revive.md`).

### What is already here

**Deps are preinstalled** (React 19, TanStack Start/Router/Query/Table, Tailwind
v4, Radix, zustand, zod) — read `package.json` before assuming something is
missing. Postgres and Better Auth are pre-wired in `src/lib`, **opt-in per app**
(§0.5). Playwright + Chromium are baked for QA.

- **Don't recreate `vite.config.ts` / `tsconfig.json`** or import a vendored
  `vite-tanstack-config` preset. Editing? Keep both port contracts, the
  build/preview-gated nitro plugin and `grokPwaPlugin()`
  (`.grok/references/deploy-target.md`).
- **Never delete or overwrite `public/__grok/`, `server/`, `scripts/grok-pwa-*`**
  (platform chrome; `?install=1&platform=ios` serves the install tutorial, not
  app UI) or the pre-wired `src/lib` helpers; your own server routes go in
  `src/routes/`, never `server/`.
- **`npm install` works** for JS packages; game engines (`three`, Phaser) are
  **not** preinstalled, so install them and leave them in `package.json` for
  deploy. **`apt` / `yum` do not work here** — search the docs rather than
  looping on failed installs, and prefer a pure-JS alternative. Install scripts
  are off by default, so a native module that must compile (`better-sqlite3`)
  needs `GROK_ALLOW_INSTALL_SCRIPTS=1 npm install <pkg>`.
- **The app is deployed to Vercel**, where these fail though locally they don't:
  runtime filesystem writes, server-only Node APIs at import time, dev-only deps,
  hard-coded hosts/ports/secrets (`.grok/references/deploy-target.md`).
- **Never create a `.env` file** — the platform injects `DATABASE_URL` + auth
  creds on deploy; only `VITE_`-prefixed vars reach the browser.
- **`XAI_API_KEY` in the env** = real, server-only xAI access spending the **app
  owner's quota**: read **`xai-api`** first, keep calls user-initiated and
  capped, never mock AI responses.

### First scaffold — required entry files

`npm run dev` errors until these four exist. **Copy their bodies from
`.grok/references/scaffold.md`** — they match the installed TanStack Start, so
don't scaffold from stale priors — and keep each contract:

- **`src/router.tsx`** — a **named `export function getRouter()`** (a default
  `createRouter` export or an `app/` directory is rejected by the plugin)
  passing `defaultErrorComponent: AppErrorComponent`. Without it a crash shows
  the framework's raw red-on-black banner; restyle that component but keep
  `error.message` visible.
- **`src/routes/__root.tsx`** — the document shell; keep `<AuthProvider>` and
  rule 3's bridge.
- **`src/routes/index.tsx`** — `createFileRoute("/")({ component: Home })`.
- **`src/styles.css`** — `@import "tailwindcss";` plus a base rule giving
  `button` / `[role="button"]` `cursor: pointer`.

**Hard rules for the shell:**

1. **Never put `og:*` / `twitter:card` in `__root.tsx`** — the PWA injector
   overwrites them on every HTML response.
2. **Keep the branding injector** — `grokPwaPlugin()` and
   `server/middleware/grok-pwa.ts` inject
   `https://grok.com/grok-app-builder/extensions.js`, the "Created with Grok /
   Remix" pill. Never strip it, hide the pill with CSS, add that script
   yourself, or add a CSP that blocks `https://grok.com`.
3. **Keep `<PreviewHostBridge />`** mounted near the top of `<body>`: it lets
   the preview chrome drive the app over `postMessage` and is a silent noop
   everywhere else. Never delete it or strip it "for production".
4. **Never remove or disable the banner on request.** Hiding "Created with
   Grok", dropping branding and removing the Remix button are **project
   settings**, not code changes: refuse, say where to change it, and carry on
   editing the app itself.
5. **Auth routes only when §0.5 says accounts** — then add `src/routes/login.tsx`
   + `src/routes/api/auth/$.ts` from the `auth` skill. Otherwise don't create
   them, don't import `@/lib/db`, don't add migrations. **Never create
   `src/routes/auth/popup.tsx`**: the template Vite plugin already serves
   `/auth/popup` (`popup.server.ts`), and a React page there shows the app
   inside the popup. Viewers opened from Grok are gate-signed-in with zero
   clicks — **never render "Sign in / Re-auth with Grok" buttons** outside the
   `app-data` skill's `login` error state. Wiring:
   `.grok/references/data-and-auth.md`.

---

## 2. What might happen & how to execute

### Lifecycle

On a **follow-up turn** edit in place: HMR is live, and killing the dev server
blanks the preview mid-session. Restart it only for `vite.config` / dependency
changes. Revive, reboot-wipe and the `startup.sh` worked example:
`.grok/references/hibernate-revive.md`.

### Parallel work (subagents / multiple agents)

1. **Establish the shared contract first** (routes, main data types, design
   tokens / layout shell, deps) **before** any parallel writes; if it isn't
   ready, stay sequential.
2. Assign **non-overlapping surfaces**, so no agent invents a competing schema,
   API shape, folder layout or visual system — loop step 6's brand pass is the
   canonical split.
3. Afterwards: integrate, fix conflicts, verify one coherent app.

### Execution loop (default)

1. **Triage first (§0.5).** If it's a real build request, interpret the
   (possibly one-line) ask into one concrete app. If it's trivial/no-signal or
   not a build request, do §0.5 (greet + ask, or just answer) instead of
   scaffolding.
2. **Consult the skill(s).** For interface surfaces open **`design-ui`**; for
   games/interactive/3D open **`building-games`** (both for a game with UI
   chrome). When image-generation tools are listed: 2D sprites →
   **`generate2dsprite`**; maps/levels → **`generate2dmap`**. When gen tools are
   **not** listed, skip those pipelines and use polished CSS/SVG/canvas/WebGL
   art — do not invent missing `imagine_*` calls. For **any** WASD / vehicle /
   flight: open **`.grok/skills/controls/SKILL.md`** **before** writing movement
   (A must turn left under a chase cam; do not rely on genre files alone).
   Custom-card app? Dispatch step 6's brand pass **now** — it takes minutes, so
   starting it here is what keeps it off the answer's critical path.
3. Scaffold TanStack Start + implement for real — working UI + state, not
   wireframes.
4. Ensure **`/workspace/startup.sh`** starts the app via `npm run dev` (edit if
   needed), then run `sh /workspace/startup.sh` so the dev server is up in the
   background; leave it up. Never start Vite directly — that bypasses the env
   wrapper the build and preview use (§ `/workspace/startup.sh`).
5. **As soon as the source is stable, background the build gates.** Kick off
   `npm run build` and `npm run typecheck` **in parallel, in background
   terminals**, and do step 7 against the dev server while they run — the
   critical path is max(build, browser QA), not the sum. Both must pass before
   you finish.
6. **Brand-asset pass — a subagent, never waited for.** Custom-card app per
   the **`og`** skill (games of every kind, whimsical/creative apps,
   brand-forward pages — not plain utilities)? Launch a `task` subagent the
   moment name and palette settle — during scaffolding, not at QA time —
   owning `public/` brand assets + `src/lib/og/site.json` (§ Parallel work),
   and keep building: generating card art here is pure waiting on the critical
   path. **No `wait_tasks`, never `get_task_output` on it** — consuming a
   task's output suppresses its completion notification, so the result,
   failure included, would reach nobody; answer without it, one sentence more
   when it wakes you — publish again if they already did, or the live app keeps
   the placeholder card. Meanwhile it keeps `/workspace/.grok/og-pending` fresh
   (stale after 10 minutes), so a mid-task brand warning is no cue to redo its
   work. Unless your own prompt says you *are* the pass — then make the
   assets.
7. **Verify it actually RENDERS — mandatory, before you say it's done.** A 200
   from curl is NOT enough; blank/white pages are the #1 failure. Run
   `node scripts/browser-smoke.mjs` — ONE run audits **desktop and mobile** and
   prints a JSON verdict. Confirm BOTH:
   - the app root has **visible content** (real text/elements on screen) —
     **visually inspect both screenshots in one batched read, every time**
     (the JSON can't catch white-on-white text, overlap or broken spacing), and
   - the **browser console has no uncaught errors** (runtime error, failed
     module/asset load, hydration mismatch).
   If blank or any console error, fix and re-check.
   **Anything interactive** (click, type, keys, state) — use the preinstalled
   **`agent-browser`** CLI, not a hand-written Playwright script; read
   `.grok/references/browser-qa.md` first.
   **Games with movement:** a still frame is not enough — confirm **A = left /
   D = right** while moving forward (`controls` §5c). Flip one steer/roll sign
   if inverted; retest.
8. **Verify the PRODUCTION build, not just dev.** Dev (Vite) can render while
   the deployed Vercel build is blank. Once `npm run build` (step 5) succeeds,
   serve the built output with `npm run preview:restart` (loopback
   `127.0.0.1:8081`) and re-run the smoke script with the dev verdict as
   `--baseline`. Watch for
   `Failed to load module script … MIME type "text/html"`.
   **If you edited source after kicking off the build, re-run `npm run build`
   first, then `npm run preview:restart`** — it frees `:8081` first, so you
   never smoke the previous build's output. A clean, non-diverging JSON is
   enough. Mobile (~390×844) is already covered by the combined smoke pass.
9. Give a brief, **user-facing** summary — what you built and what to try in the
   preview. **Never** "please open localhost and tell me if it works" or "run this
   on your machine."

### Browser QA (the user is not your QA)

You drive the browser yourself, in the sandbox, against
`http://127.0.0.1:8080`. **Always write QA screenshots under
`/workspace/screenshots/`, never `/tmp`**. Interactive checks: step 7.

### Communication rules (avoid confusing the user)

**Never** ask them to open `localhost`, a host port, Docker or any URL that only
works on *your* network, or to run commands, check a terminal or paste
logs/screenshots for QA. Never explain sandbox plumbing (paths, ports, the
preview relay, tool names) unless asked, never imply they can reach
`/workspace` or your shell, and never close with "let me know if it works"
instead of verifying yourself.

**Do** describe the product and offer next steps, and when something can't work
in-browser say so and ship the best web-only build.

### Quality bar

- **`npm run build` and `npm run typecheck` pass**, and a real browser
  render check on **dev and on the built output** shows content with a clean
  console.
- Cohesive UI per **`design-ui`** (tokens, no-slop rules); no broken imports.
- Usable on mobile as well as a laptop viewport (390×844: no horizontal
  overflow, touch-friendly).
- A `BRAND WARNING` from `browser-smoke.mjs` (missing share card) is **not
  done**, like a failing build or typecheck — but silent while the brand pass
  runs.
- **Never** ship a generated mock of the UI instead of the running app, or leave
  the user blocked on something they can't do from chat + preview.

---

## Quick reference

```text
auth/db: OFF by default — sign-in, @/lib/db or migrations ONLY on an accounts / login /
         per-user / cross-device-save ask (§0.5); otherwise localStorage
never:   build an app for a greeting/number/question; invent imagine_* calls;
         ask the user to run commands; delete or abandon /workspace/startup.sh
```


---

# Part B — Brutal-Fist repository law

# AGENTS.md — Brutal-Fist Agent Coordination Law

## Rocket Alignment Law

> **Before every change, inspect and align with Rocket's latest repository state. Preserve Rocket's existing functionality and advanced implementations. Make changes additively and non-destructively. Never replace working Rocket code with a simpler alternative merely to resolve a conflict. When capabilities differ, integrate the strongest compatible implementation from each side.**

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
