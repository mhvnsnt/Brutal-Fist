# Rocket pickup status

## Goal

`main` is now a real Next.js + TypeScript application while preserving the existing Brutal Fist game code and native Schwarzerblitz boundary.

## Rocket-facing entry point

- Next.js App Router: `app/`
- Live game entry: `app/page.tsx`
- Existing game runtime: `src/`
- Existing Vite preview is retained as `preview:vite`
- Native Schwarzerblitz remains under the vendor boundary

## What Rocket should see

The root project now has:

- `next` dependency
- Next.js `dev`, `build`, and `start` scripts
- TypeScript configuration compatible with Next
- App Router layout/page
- Tailwind/PostCSS configuration
- 3D game preview routed through the existing React/Three.js runtime
- existing Bannon/retarget/native documentation and contracts

Rocket's documented GitHub pickup currently requires Next.js + TypeScript and provides live preview plus two-way GitHub sync for that project type. Do not create a second unrelated app or replace the native game architecture.

## Before declaring the handoff green

The remaining verification gate is an actual successful `bun install && bun run build` in CI/Rocket's environment. The repository has been switched from a frozen Bun lockfile install because the package graph was intentionally changed to add Next.js.

Once the build is green, Rocket can be connected to `main` and should use `ROCKET_PROMPT.md` as its first instruction.
