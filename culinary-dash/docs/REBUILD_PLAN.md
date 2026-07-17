# Rebuild Plan — one game, two intentional modes

> **Status:** APPROVED direction (2026-07-17). Phase 0 in progress.
> **Owner call:** boss fights become **3D**, the rest stays **2D**. First 3D boss is
> **Vince**. The existing 2D combat **stays live** until the 3D fight is proven.
> **Priorities driving this:** visual/art coherence and feel/UX — *not* code purity
> for its own sake.

## The diagnosis (why it reads "pieced together")

Two audits (2026-07-17) converged:

- **The 2D restaurant is already the coherent, polished thing.** The y-sorted
  "breathing" room, the ticket rail, real 4-dir customer sprites, per-locale dressing
  that recolors together, the three-input control dispatch — all signed off and
  consistent. (The docs even *undersell* it: they say customers are procedural;
  shipping code uses real sprites, `SPRITE_CHANCE=1`.)
- **The sprawl is almost entirely combat.** ~40% of the 5,752-line file (~2,300–2,450
  lines) is fight code — brawl, three boss-nights, a legacy "Brandon" boss, riots,
  drunk-vision warp, polygon monsters, silhouette enemies — in a *different art idiom*
  bolted into the same canvas, dragging the shipped file to 2 MB (the fight sprite blob
  alone is ~574 KB). Plus a whole **second game** (`culinary-dash-3d`) reimplementing
  the concept.

So the fix is not to sand down the 2D game — it's to make the split **intentional**:
the 2D game is the cozy restaurant; fights are a deliberate 3D gear-shift the player
understands as a mode, not accreted mess.

## What each side already gives us

- **3D module (`culinary-dash-3d`):** its **feel-engine is mature and reusable** — the
  impact spine (one weight → shake/hitstop/kick/sparks/sound; hitstop freezes sim, not
  camera), a deterministic fixed-step sim, solid combat math. But: **no actual boss**
  (placeholder mobs), **programmer-art primitives**, **invisible punches** (no animated
  chef), and **no launch/return API** — it's a standalone game, not a callable sub-mode.
- **2D module:** a **well-defined seam** already exists (see `SEAM_CONTRACT.md`). A fight
  consumes restaurant state and returns a delta. That contract is the API the arena
  implements.

## The one real risk

The 2D→3D jump is where "consistency" is won or lost. If the fight looks/controls like
a different game's demo, we've recreated the exact problem. Mitigations, treated as
first-class requirements, not polish:
- **Shared identity:** same chef, palette echo, toon shading that rhymes with the pixel
  look.
- **A transition that sells the shift** (a hand-off beat, not a hard cut to a foreign
  screen).
- **Phase 1 is deliberately ONE boss at a high finish** to prove the whole pipeline
  (visual coherence + the seam + feel) before we touch the working 2D combat.

---

## Phases

### Phase 0 — Foundations (no gameplay change) — *in progress*
- [x] Stop the deploy shipping the **dev build** (`culinary-dash-devtools.html`, DEV=true)
      to the public site; ship `culinary-dash.html` (DEV=false).
- [x] Remove the redundant `git .zip` self-backup from tracking (gitignored). **Keep
      `pixel lab zip 7-15.zip` — those are sprite masters, not cruft.**
- [x] Write `SEAM_CONTRACT.md` — the explicit fight interface.
- [ ] (proposed, later) Give the sprite masters a proper tracked home (`art-src/`)
      instead of a root zip.

### Phase 1 — Vince, done right (the proof; 2D combat stays live)
- [ ] Turn the 3D module into a **callable arena**:
      `mountBrawl(container, {boss:'vince', chefHp, dmg, guard, speed, spectators,
      critics, brokenStations, seed, onComplete})` — boots straight into the fight,
      tears down cleanly. Add `createBrawlState()` that doesn't drag in the service loop;
      formalize `brawlResult` into the returned payload from `SEAM_CONTRACT.md`.
- [ ] Build **Vince the wrecking-ball landlord** to a high finish:
  - an animated boss (large, silhouette-distinct, telegraphed wind-ups, HP phases —
    port the existing 2D Vince's HP-gated stages as encounter data);
  - an **animated chef with visible punches** (today the marquee action is invisible);
  - wire the already-plumbed-but-dormant `secondary` input into a **dodge**;
  - enable **shadows** (`receiveShadow` is already set, wasted today) + a **bloom/post**
    pass; a **dynamic KO camera**;
  - reuse the impact spine verbatim; extend it with the new VFX/camera channels.
- [ ] **Art-direct for 2D↔3D coherence** (shared chef, palette echo, transition beat).
- [ ] Wire into the 2D game **behind a flag**: `startBossNight('vince')` hands off to the
      arena with the IN payload, applies the OUT result through the existing
      `endBossNight` path. **The 2D Vince fight stays as fallback until approved.**

### Phase 2 — Extract 2D combat (only after Phase 1 is approved)
- [ ] Remove the ~2,300 lines of 2D combat + the fight art blob (~40% code shrink, most
      of the 2 MB gone). Port the other bosses/brawl/riot as arena encounter-configs.
- [ ] Move the after-hours **riot** to the arena using the night save/restore half of the
      seam contract.

### Phase 3 — Restaurant coherence polish
- [ ] After-hours **groups/dancers** → real sprites (they're procedural blocks today
      while day patrons are real sprites — same cast, two fidelities).
- [ ] Kill **templated dialogue** ("crispy lobster") with dish- and character-tied pools.

---

## Decisions locked for this rebuild
- **Boss fights are 3D; restaurant is 2D.** The split is the architecture, not a bug.
- **First 3D boss: Vince.** Most dramatic silhouette, most physical.
- **2D combat stays live** until the 3D replacement is proven — the game is always
  playable.
- **`pixel lab zip 7-15.zip` is sprite masters** — never delete as "cruft."
- Everything in `DECISIONS.md` still holds for the restaurant side. Combat "locked
  decisions" (impact spine, hitstop-not-camera, weighted feedback) **carry into the 3D
  arena** — they're already implemented there.
