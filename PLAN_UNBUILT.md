# Culinary Dash — Plan for Unbuilt / Phased Work

Written 2026-07-16 from the docs bundle + a read of `culinary-dash_src.html`. This is a **planning
manifest**, not applied work — nothing here is built. It exists so work can be batched one task at a
time, the house way.

## How this plan obeys the house rules (from HANDOFF_CLAUDE_CODE.md + DECISIONS.md)

- **One task at a time.** One file, one harness, one global test count — two agents editing
  `culinary-dash.src.html` at once clobber each other (the mutation loop corrupts-and-restores the file).
  Every item below is a standalone task with its own build → test → look.
- **A pure decision function + a mutation-tested invariant** for anything new. Break the code, confirm
  the new test screams. Green-on-first-try is suspicious here.
- **No image = not done** for anything visual. Rebuild, render a PNG, look. Tests never caught a real
  visual bug in this codebase.
- **Grep before you build; don't relitigate locked calls.** Each item lists the traps already paid for.

---

## 0. STALE ROADMAP ROWS — already built, just close them out

The roadmap **table** still marks these `queued`; the source and CHANGELOG show them shipped. **Action:
verify against intent, update the table, do NOT rebuild.**

| # | Item | Evidence in source |
|---|---|---|
| 1 | Chef heights (male taller) | `CHEF_H={chefF:1.0, chefM:2.50}` (src ~1348); comment "#1: per-chef height (male taller)". Was `{0.88,1.56}`, retuned. |
| 6 | Speed-based tips | `SPEED_TIP_MAX=0.5, SPEED_TIP_WINDOW=12` (~1271); `c.orderT` set on order-taken (~1006); `speedMult` applied (~689); live tip meter shipped (CHANGELOG "the smoking gun"). |
| 7 | Per-dish / per-character dialogue | Dish adjective pools (~158-161), per-orderer voice, `advanceDialogue` (~1003). "crisp gin sour" cross-leak fixed + test-guarded (CHANGELOG). |

If any of the three doesn't match what you actually want (e.g. male height ratio, tip window feel), that's
a **tuning task**, not a build — flag the number and I'll adjust the one constant.

---

## 1. Combat / brawl — the finish line

The combat track was `#18 → #21 → #19` (all done). Two roadmap items and two production phases remain.

### #20 — Going Live cinematic  *(queued; next on the combat track)*
**What exists to hook:** `SPECTATE_CHANCE=0.55`, `LIVE_DELAY_MIN/MAX` (~1646), phones-up + REC blink +
LIVE badge (~1244/~2220), `devSeedBrawl()` seeds a full house so GO-LIVE fires, and **`camMatrix()`
already exists** (~880, built for #21's lean) — a focal camera is the same machinery.
**Plan:** on the GOING-LIVE event, freeze the sim, focal-zoom to the streamer, hold ~1s, pan back, resume.
1. Add a cinematic clock that runs on `performance.now()`, **not** the sim clock.
2. Feed a focal point (streamer x,y) into `camMatrix()` instead of centre.
3. Ease zoom in → hold → ease out; resume sim on completion.
**Traps (locked):**
- **Hitstop freezes the sim, which would freeze your camera too.** The camera must run on real time while
  the sim is frozen, or you get a frozen frame that never zooms (drunk afterimages already inherit this).
- The safety invariant generalises: `(z−1)·min(camX, W−camX) ≥ |sx|` — the binding term is distance from
  the focal point to the nearest edge, so a **gentle** zoom is more edge-constrained than an aggressive
  one. Never let focal zoom and a shake spike coexist unclamped (shake should be 0 during the freeze).
**Verify:** `cam_raster.py` render at the focal frame (the plain rasterizer is blind to the camera — use
the cam-aware one); mutation-test that deleting the focal term reverts to centre and the test screams.
**Depends:** #21 (done). **Effort:** M. **Risk:** M (camera-edge math).

### P4 — The Riot  *(After Hours; phase machine has no `riot` state yet)*
**What exists:** phase machine `title→play→over→brawl→boss→night→office→gameover` (no `riot`); P1 brawl
combat is complete and reusable; night mode (P3) shipped; whiskey-buff (faster+stronger) exists as a
runtime state.
**Plan:** per served bottle, a chance the group's chugger downs the whole thing → **RIOT**: pause night,
run 2 waves of **drunk-baseline** enemies (whiskey buff pre-applied) through the existing brawl combat,
then resume night if you win.
1. Riot trigger off bottle service (per-bottle chance).
2. Reuse P1 combat; spawn waves with the whiskey buff applied at spawn (drunk baseline).
3. Night pause/resume around the riot; equipment damage carries into the rest of the night (bar wrecked =
   dead night, already modelled).
**Traps:** stacking — mid-fight chugging stacks *on top of* the drunk baseline (flagged assumption, confirm
with the developer). Reuse `updateBrawl`, don't fork it. Broken-bar carryover already kills night revenue —
don't double-apply.
**Verify:** headless — riot triggers, fights, resolves; night resumes. Play checkpoint (you fight a riot).
**Depends:** brawl (#12, done), night (#13 P3, done). **Effort:** M. **Risk:** M.

### P5 — Polish / balance / results-v2 / commit
**Plan (the closing pass for the fight+night arc):**
- **SFX pass:** punch hits, KO thud, bottle pop, register cha-ching, riot alarm.
- **Results screen v2:** day tips + night sales − damage, fight record, rating change on one screen.
- **Balance pass** on every flagged number (chef/enemy HP, $750 economy vs repair cost, critic penalty −3,
  KO destruction = random half, night frequency).
- **Full regression harness + commit** (built file + docs zip + CHANGELOG entry).
**Traps:** balance numbers need *your* play feedback — this phase is a set of dials, not new systems. Don't
tune combat feel headless; it needs the Retroid (every feel number before #35 was tuned on the wrong input).
**Depends:** P4. **Effort:** M (mostly tuning + one new screen). **Risk:** L.

---

## 2. Content — new dishes

### #5 — Pancakes (3-step recipe)  *(queued; biggest content lift)*
**What exists:** `DISHES` (src ~129) with `make:` types `assemble` / `timing` and `kind:"source"` stations;
explicit `recipe:[ids]`; `MENU=Object.keys(DISHES)`.
**Plan:** a true multi-stage dish — flour + eggs + lemon → **mix** (slow, longest) → **cook** (fast).
1. Introduce **eggs**, **flour**, **lemon** ingredients (art ids already generated — see §4).
2. Add a new multi-stage `make` type (or chain two stations): a slow MIX step then a fast COOK step, with
   an intermediate "batter" item carried between stations.
3. Wire `recipe`, `spr8`/`spr24`, a station, points, dialogue pool (adjective pool per #7 pattern).
**Traps:** the fetch/carry loop is the point (locked) — keep it, don't shortcut the multi-stage into one
tap. Add the adjective pool so it doesn't inherit a wrong-dish descriptor (#7's whole reason).
**Verify:** headless recipe/stage-gating test; play the dish end-to-end; render the in-world + menu sprites.
**Depends:** ingredient art wiring (§4) for eggs/flour/lemon. **Effort:** L. **Risk:** M (new station flow).

### #14 — Egg-white sours (dry shake)  *(queued; depends on #5)*
**What exists:** shared-shaker recipe model (spirit picks the drink, `recipe` explicit).
**Plan:** once **eggs** exist (from #5), the sours gain an **optional** egg white → a **dry-shake** step at
the shaker: costs more time, pays a higher Beli bump + bigger tip. Upgrade the dish (`gin-sour` →
`gin-sour-fizz`) or flag `c.eggwhite`.
**Traps:** it's opt-in per drink, not the default (locked). Reuse the shared-shaker branch model.
**Verify:** headless — egg-white branch adds time + raises reward; base drink unchanged. **Depends:** #5.
**Effort:** M. **Risk:** L.

---

## 3. Art wiring backlog  *(HANDOFF_ASSET_WIRING.md — "everything but the 2 chefs is generated-but-not-wired")*

Every seam already ships a null-fallback, so each wire is mechanical: `ingest → assign → build → test →
look`. **But one thing gates all of it:**

### 3.0 — Filesize downscale-on-ingest  *(PREREQUISITE — do first)*
The build is ~1.58MB with only 2 chefs. Masters are 136/88px but render ~20px in game (6–8× oversampled).
Wiring 16 cast + 16 shadow enemies + appliances at native size → est. **6–10MB**, which breaks the
self-contained-single-file constraint. **Add `--max <px>` LANCZOS downscale to `docs/tools/ingest`** (Pillow
is installed): characters/enemies → 48px, customers → 40px, appliances → 32px, ingredients/props → 24px.
Cuts filesize ~6–8× with no visible loss at 320×180. Target: keep the built HTML under ~4MB.
**Effort:** S. **Risk:** L. **Blocks:** everything in §3.

### #10 — Customer cast sprites  *(queued; highest visible payoff)*
**What exists:** the seam is **live** — `CUST_SPR` (~1266), `custSprite()` (~1270), `SPRITE_CHANCE=0.22`
(~1264), `drawCustomer` path. A random 22% of patrons already show sprites.
**Plan:** ingest the 16 cast (ids in the handoff) downscaled (§3.0) → `CUST_SPR`; map **customer identity**
`c.cast` → the matching sprite (not random); raise `SPRITE_CHANCE` toward 1.0.
**Traps:** the "beautiful … woman" gen cue is required or afros/locs render male; library has duplicate
plain-named records — use the canonical ids. **Verify:** render the room, every named customer looks right.
**Depends:** §3.0. **Effort:** M. **Risk:** L (non-regressive seam).

### Shadow enemies (brawl visuals)
Finish the 11 incomplete generations (5 need state+punch, 6 need punch), ingest idle (mirror east→left) +
cross-punch → `ENEMY_TEX[cast]`. Draw path ~2118 preserves windup/rage/KO effects. **Depends:** §3.0 + the
cast (enemies derive from the same masters). **Effort:** M (+ generation time). **Risk:** L.

### Kitchen — appliances / remaining ingredients / dish sprites
11 appliances → `STATION_TEX["<id>:<state>"]`; regenerate 5 gap states (fryer:cooking/ready, pot:ready,
icebox, shaker:shaken); wire remaining ingredients (replace `drawRawBox`; #25 already did lettuce/tomato/
rawlobster/chicken — note raw lobster needs the **205° hue rotation**, locked, blue=raw tell); generate +
wire dish sprites (spr8/spr24). **Depends:** §3.0. **Effort:** L. **Risk:** L.

### Night club — DJ + dancers + decor
Ingest 16 dance anims → `DANCE_CAST`; place the DJ (id in handoff); select + animate the bottle-service
prop from pack `d9536be3…`; generate disco ball / neon / speakers. **Depends:** §3.0, night mode (done).
**Effort:** L. **Risk:** L.

### Floor / wall tilesets  *(needs regeneration first)*
Current floor/wall gens are **wrong** — `create_map_object` made discrete objects, not seamless tiles.
Regenerate with `create_topdown_tileset`, ingest → `TILE_TEX/WOOD_TEX/WALL_TEX`. **Effort:** M. **Risk:** M
(seamlessness is easy to get wrong; render a tiled expanse and look).

### Cat sleep/groom + 4-way rotations  *(leftover from #23)*
#23 wired cats **east/west only** (`cat.dir` is ±1); sleep/groom stay procedural (no art). Only needed if
`cat.dir` ever becomes 4-way — parked unless you want it. **Effort:** M. **Risk:** L.

---

## 4. Economy & meta

### #8 — Save code (end-of-day)
**What exists:** `run` object, office/day progression, `phase==="over"` → office.
**Plan:** a Save button (day-over only) copies a compact code (money + day + unlocks + version + checksum)
to clipboard; she pastes to Claude, Claude returns a loaded build. **No in-game load box, no self-hosting**
(locked). **Note (Retroid):** once the game runs from local storage on the device (the PWA kit), real
`localStorage` saves become possible and the paste-code flow becomes optional/for-sharing (see PARKED).
**Verify:** round-trip a code headlessly (encode→decode→identical state). **Effort:** M. **Risk:** L.

### #11 — Money-spend shop  *(design-later; infra partly exists)*
**What exists:** the **office already buys** — `phase==="office"`, `UPGRADES` (~1535), `officeRows()`
(~4516), `officeBuy()`, `ownsUp()`, `run.upgrades`. Repairs + upgrades render there.
**Plan:** expand the office into a real spend loop — station/prep-speed/table/decor upgrades persisted on
`run`. Claude can improvise items per request. **Depends:** #8 (persistence) for cross-run. **Effort:** M.
**Risk:** L. **Note:** buy-back/repair for broken stations (P4/brawl) rides this — interim is menu-removal.

### #17 — Chef Bot recipe-teacher  *(queued; Low)*
**What exists:** office/`UPGRADES`/`officeBuy` pattern; robot master already generated (`work/sprites/
zz_apitest/`, 4-dir). `MENU=Object.keys(DISHES)` today = **all dishes always orderable**.
**Plan:** a $100k office upgrade (`run.upgrades.chefbot`) that unlocks a **locked dish** onto the menu.
Needs a `locked`/`unlockedBy` flag on the dish + a `MENU` filter (the ordering path ~866 reads `MENU`); the
new dish needs `spr8/spr24` + station + `recipe`. Add a robot NPC in the back office.
**Traps:** deliberately absurd price (a late-game sink). Pairs with a dish-art gen + the #11 shop pattern.
**Depends:** #11 pattern, a new dish (like #5). **Effort:** M. **Risk:** L.

### #9 — Back-office partner vignette  *(handoff-sent; awaiting art)*
The unpicked chef typing at a desk behind paper stacks taller than them; occasional water sip;
non-interactive. **Blocked on art** (handoff already sent). **Effort:** S once art lands. **Risk:** L.

### #2 — Chef walk speed  *(queued; small)*
Bump the chef's base move speed a bit — fetch/carry stays the point, just brisker. One constant + a feel
check on the Retroid. **Effort:** S. **Risk:** L. *(No evidence in CHANGELOG that this shipped — treat as
open, unlike #1/#6/#7.)*

---

## 5. Co-op — lockstep multiplayer  *(long horizon; explicitly phased, all queued)*

Design is locked as **lockstep, not host-authoritative** (two identical Retroids → floats agree → send
inputs, both simulate). The determinism probe (`docs/tools/determinism.js`, #31 done) proved 1800 frames
byte-identical with Math.random seeded. Three phases remain, in order:

### #32 — Step 1: seeded rnd
Replace the **63 sim-side** `Math.random()` calls with a seeded `rnd()`; the 9 draw-side ones (particles,
shake) stay random (they never touch state). Seed exchanged at connect. **Acceptance:** the determinism
probe passes **without** `--seeded`. **Effort:** M. **Risk:** M (miss one sim-side call and it desyncs).

### #33 — Step 2: fixed step
`loop()` is `dt=min((now-last)/1000, 0.05)` (wall-clock) — needs an accumulator stepping `update(1/60)`.
**Worth doing alone:** the game currently plays differently at 30fps than 60. **Effort:** M. **Risk:** M.

### #34 — Step 3: transport + mate
`{frame, input}` over Tailscale, ~2–4 frames input delay; checksum the world every 60 frames to catch
desync early. `mate` = the remote chef — `brawl.partner` already proves the entity, `officeIntro`/`ODOOR`
already animate a join. **Depends:** #32, #33. **Effort:** L. **Risk:** H (netcode).

---

## 6. Recommended batch order

Sequenced for dependencies + fastest visible payoff, one task at a time:

1. **Close the stale rows** (§0) — verify #1/#6/#7 match intent, update the table. ~zero build.
2. **Filesize tooling** (§3.0) — unblocks all art wiring. Small, do it before any mass wire.
3. **#10 customer sprites** — highest visible payoff, non-regressive seam.
4. **#20 Going Live cinematic** — finishes the combat track; camera machinery already exists.
5. **P4 riot → P5 polish** — closes the fight+night arc (balance needs Retroid play).
6. **#5 pancakes → #14 egg-white sours** — the content lift (egg white needs eggs from #5).
7. **Shadow enemies / kitchen / night-club / tiles** — the rest of the art backlog, as appetite allows.
8. **#8 save → #11 shop → #17 chef bot** — the economy/meta loop (persistence first).
9. **#9 vignette** — whenever the art lands.
10. **Co-op #32 → #33 → #34** — the long horizon; #33 is worth doing alone for the 30/60fps fix.

**Parallelism:** only §3 art **generation** (PixelLab, 2–3 concurrent) and read-only scouting truly
parallelize. Source edits do not — one file, one harness. Never batch two tracks' `src` edits at once.
