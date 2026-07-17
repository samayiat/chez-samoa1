# Culinary Dash 3D

A 3D browser-game reimagining of **Culinary Dash** (the 2D `<canvas>` game in
`../culinary-dash/`). Same two signature verbs — a restaurant **service loop**
and a **beat-'em-up** brawl — rebuilt on Three.js with a fixed-perspective
"diorama" camera.

This is a **separate project**; the original 2D game is left untouched.

## Why a rewrite, not a port

The 2D game is ~200KB of coordinate- and canvas-coupled logic. What ports
cleanly is the *architecture* (the "impact spine", the recipe/station data
model, deterministic fixed-step sim); what doesn't is anything tied to the flat
renderer (the 4-direction facing system, the hand-tuned camera-crop math, the
sprite pipeline). Those are rebuilt in 3D. See
`/root/.claude/plans/clone-repo-and-propose-graceful-treasure.md` for the plan.

## Stack

- **Three.js** — rendering
- **Vite** — dev server + static build
- Vanilla JS ES modules (matches the original's house style)
- **Vitest** — headless sim unit tests
- **Playwright** — real WebGL end-to-end render checks

## Run

```bash
npm install
npm run dev        # dev server with HMR
npm run build      # -> dist/ (static, deployable)
npm run preview    # serve the build
node e2e/smoke.mjs # headless smoke check (needs `npm run preview` running)
```

Controls: **WASD / arrows / left-stick** to move, **E / A-button** to interact.

## Layout

```
src/
  main.js            bootstrap: renderer, scene, camera, loop
  engine/            loop (fixed step), input (kb+gamepad), camera (fixed diorama)
  sim/               deterministic sim — data, rng, state (NO wall clock)
  render/            sim state -> Three.js meshes
  fx/impact.js       the impact spine: one weight -> every feedback channel
```

## Status

- [x] Phase 1 — scaffold: room, stations, tables, walking chef, collision
- [ ] Phase 2 — service loop (orders, cook, serve, tips)
- [ ] Phase 3 — combat + impact spine (punch, knockback, hitstop, enemies)
- [ ] Phase 4 — day→brawl transition
- [ ] Phase 5 — verification harness + feel pass
