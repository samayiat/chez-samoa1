# HANDOFF — Wiring the PixelLab assets into the game

**Written 2026-07-15, end of the overnight generation session.** This is the plan + the state of every
asset + the exact IDs, so wiring can resume cold. Read `HANDOFF_CLAUDE_CODE.md` (§1–§4, still governs) and
`ASSET_CATALOG.md` first. The house rules still hold: **one task at a time, mutation-test every new
invariant, no image = not done, grep before you build.**

---

## 0. TL;DR — where we are

We generated a huge amount of art overnight. **Only the two chefs are actually wired into gameplay.**
Everything else is generated-but-not-wired. Every wiring *seam* is already coded with a non-regressive
fallback, so wiring is mostly: `ingest → assign → build → test → look`.

**The one architectural decision that gates everything: FILESIZE.** See §2.

---

## 1. Asset inventory — generated vs wired

Legend: ✅ wired & shipping · 🟡 generated, seam ready, NOT wired · 🔴 generation incomplete · ⬜ not generated

### Characters
| asset | PixelLab id | gen | wired |
|---|---|---|---|
| **Chef (her)** — dreadlocks, white hat, leopard apron, pink sleeves | `345b84b7-e5b6-4384-a37b-33ec60200b6e` | full: 8-dir + jab/cross/roundhouse/uppercut/taking-punch + run | ✅ walk/idle (CHARS.chefF, front/right/back/left) + combat (FIGHT.chefF) + sizing |
| **Chef (him)** — afro, white coat | `59ac123a-846e-4ff8-b363-2d0e4d3f2482` | same set | ✅ same (CHARS.chefM, FIGHT.chefM) |
| Tuxedo cat (skinny, big head) | `7cb837ad-1ec9-4857-be07-dc3a700ff446` | 4-dir rotations only | 🟡 game LOGIC wired (procedural `catPalette`); SPRITE not (drawOneCat is procedural). Needs cat walk/sit/sleep/groom anims (never generated) |
| Orange cat (white belly, fluffy) | `116d6bab-b86f-4c9d-9e9d-32398ac1f8ed` | 4-dir rotations only | 🟡 same |
| DJ — beautiful Black woman, huge afro | `85e47f00-d6a9-4f2f-8afd-602886a57258` | 8-dir + breathing-idle | 🟡 no draw path in club yet |
| Robot (Chef Bot, feature #17) | `work/sprites/zz_apitest/` (char `06edb52b…`) | 4-dir | 🟡 feature #17 not built |

### Customer cast (16) — all have a "dancing" animation; masters are 8-dir 136px
| name | id | name | id |
|---|---|---|---|
| Reggie | `d06f7898-b92b-46b8-9f9c-ceda9ca0697a` | Darnell | `84205acf-29bf-44e6-a44d-37ec778392c3` |
| Marisol | `916fbc28-6ec5-4b79-a717-5c770e957c9e` | Keisha | `dddcfd0c-220e-4a00-ba7e-d726ae174883` |
| Sinclair | `8c85f082-78b2-45f1-aba9-3a490020b059` | Reverend | `a742d826-5731-47d6-ac9f-a39531bf996e` |
| Val | `8e1f7200-8c5d-4073-97bc-63572c84c3fa` | Yvonne | `44251f89-969d-42a5-a7da-bb964db300dd` |
| The Critic | `061d3284-babc-4b51-9e52-1f884617a2a7` | Malik | `c712e037-5462-4e1d-bad2-b695989f98a6` |
| Nana | `aa8cf43c-9bf6-4085-b22d-42249d3089d1` | Simone | `0315e4c8-850f-4fc4-a6f1-0cea78962fee` |
| Deja | `e5868841-fd30-45ba-8b6f-37ba78baa09e` | Pops | `a711d519-bcd8-4b06-ad5f-bd69185f45c2` |
| Monty | `597cd46f-23ad-463e-b34a-3f6a4bedf147` | Tiana | `590476c4-6a4d-4108-8146-a0f583c77678` |

Status: 🟡 masters + dance anims generated; NOT wired. NB the library has DUPLICATE plain-named records from
retries — the ids above are the CANONICAL ones. (Cost note: the "beautiful … woman" lead cue is REQUIRED for
the women — afros/braids/locs render male without it.)

### Shadow enemies — evil shadow-states of the cast + one cross-punch (no combo). 🔴 partial.
Done (state + cross-punch s/e/n): Reggie `b02c0ffa-334c-4760-b382-39121fe62dd9`, Val `e3388602-3c1d-4dd0-889b-9f9b2992e271`,
Sinclair `8b811467-051f-4db6-a978-5886990b9d92`, Marisol `75821fe4-2857-4ca3-9cbe-a82b6c599489`,
The Critic `a25d681b-53ec-45c9-9ab4-1e30ed503bff`.
State done, punch partial/queued: Monty `9232acad-4188-46aa-833e-0031c5c2a97e`, Nana `5eb83ade-6b80-4a41-bbc3-622826fac35c`,
Deja `e48398e5-1133-4655-9018-f1a0ccb9b070`, Keisha `d7923ff8-b67f-4055-b740-678362908367`,
Darnell `03ef08b4-fe93-4afc-b402-2becc8aa03e2`, Reverend `07b1dc8e-93e2-42a4-b440-b45633cb28db`.
NOT STARTED: Yvonne, Malik, Simone, Pops, Tiana (source ids in the cast table). Seam `ENEMY_TEX[cast]` ready.

### Kitchen — 11 appliance/prop objects selected (tag "kitchen")
fryer:idle `5cafc7dd-868a-4701-805e-f40914e29e99`, pot:idle `a586e95e-e645-4377-b102-f04cbad95683`,
pot:boiling `3ac72982-312a-4ca6-ab2a-39b87c854fa2`, shaker:idle `8bb38843-4ad3-46ef-ba88-a6a6c9edde63`,
prep:empty `32775ffc-8759-4cb7-a239-0c5d0b3382ca`, prep:salad `9fbfcdc6-1a22-46c7-a50e-622041d7a08c`,
pot `c2c6a493-97b3-4b49-9be9-070059b3e369`, pan `0af2fe2c-1ed4-4111-833a-709efeaf73c4`,
plates `37f68b17-955d-4482-bf3e-25a7af08a7b9`, crate `a82471aa-37ab-463f-b72f-521aa9b1974b`,
shelf `2dba3a5f-f202-455b-b7ee-21b1321cb17d`. Seam `STATION_TEX["<id>:<state>"]` ready.
GAPS (regen): fryer:cooking, fryer:ready, pot:ready(lobster), icebox, shaker:shaken.

### Ingredients — 18 objects, tag "ingredient"
chicken `6890311b`, lettuce `f6eb8fcf`, tomato `76353ac7`, lobster `a31fd4fc`, whiskey `bb219f94`,
gin `66fe03aa`, bottle `267ee550`, flour `cb239586`, eggs `79288b99`, lemon `1766f348`, steak `6ff06ff7`,
potato `6a920c43`, bellpepper `a5d4bd4e`, bacon `39d171a7`, poultry `51967dcc`, groundmeat `2d6b5076`,
spicebag `af2e7c0d`, jar `76379340`. (full ids share prefix `…-…`; look up via `mcp__pixellab__list_objects tags="ingredient"`)
🟡 not wired (currently drawn as procedural `drawRawBox` crates).

### Props / world
- Bottle-service prop: review pack `d9536be3-caf7-4b03-93d8-e4bed4677247` (64 candidates, NOT selected). ⬜ pick + animate sparkle.
- Floor/wall textures: `5c3e233f`(wall), `03fd4abf`(tile), `d2c6523f`(wood) — 🔴 **WRONG** (create_map_object made discrete objects, not seamless tiles). Regenerate with `create_topdown_tileset`. Seam `TILE_TEX/WOOD_TEX/WALL_TEX` ready.
- Dishes (spr8 in-world + spr24 menu), disco ball, neon, speakers: ⬜ not generated.

---

## 2. THE architectural decision — FILESIZE (do this FIRST)

The build is **1.58MB with only the 2 chefs**. Character masters are **136px (her) / 88px (him)** native but
render **~20px in-game** — 6–8× oversampled. Wiring 16 cast × 4 dirs × 3 frames + 16 shadow enemies + dance
frames + appliances at native size pushes the build to an estimated **6–10MB**, which breaks the core
constraint: the game must stay a single self-contained HTML that *she loads inside a Claude chat*.

**Decision: add downscale-on-ingest to `docs/tools/ingest` before any mass wiring.** Pillow is installed.
Resize every sprite to ~2× its in-game render size with `LANCZOS` before base64 (a `--max <px>` flag):
- characters/enemies → **48px** (render ~20px)  · customers → **40px**  · appliances → **32px**  · ingredients/props → **24px**
This cuts filesize ~6–8× with no visible loss at 320×180. **Without it the build becomes unshippable.**
Target ceiling: keep the built HTML under ~4MB.

---

## 3. Wiring pattern (proven, low-risk per asset)

Every seam already ships with a null-fallback (game renders identically until art is assigned), so each wire
is mechanical and non-regressive:
1. `docs/tools/ingest …` (char / obj / combo / urls modes) → `art/<name>.b64` (a JS blob fragment)
2. add/replace the `/*__ART__ <name>*/` marker (or the seam's data object)
3. `docs/tools/cd test` → **must stay green** (empty→populated is non-regressive)
4. add a mutation-tested invariant for anything new (⚠️ **I wrote TWO vacuous tests tonight** — a guard that
   clamped identically with/without it, and a test that recomputed its own math instead of calling the real
   fn. Always break the code and confirm THIS test screams.)
5. render in the real game + look (`preview_*`). No image = not done.

Seams & their shapes:
- `CHARS[id]={front,right,back,left:{idle,walk1,walk2}}` — chefs (done) + cast customers
- `FIGHT[id]={move:{dir:[frames]}}` — chef combat (done, both chefs)
- `ENEMY_TEX[cast]={idle:{right,left},punch:{right,left:[frames]}}` — shadow enemies
- `STATION_TEX["<id>:<state>"]=Image` — appliances (id∈fryer/pot/…, state∈idle/cooking/ready)
- `TILE_TEX/WOOD_TEX/WALL_TEX=Image` — floor/walls (tiled)
- `DANCE_CAST=[ids]` + `CHAR_IMG[id].front.dance=[frames]` — night-club dancers
- `CUST_SPR=[{dir:{idle,w1,w2}}]` — daytime customers (index chosen at spawn)

---

## 4. Tracks, dependency-ordered

0. **Filesize tooling** — add `--max` downscale to ingest. *Prerequisite for everything below.*
1. **Chefs** — ✅ DONE (walk/idle front/right/back/left, combat frames, male-taller sizing). `CHEF_H={chefF:0.88,chefM:1.56}`.
2. **Customer cast → dining room** *(highest visible payoff)* — ingest 16 → `CUST_SPR` (downscaled), then map
   customer identity to sprite (`c.cast` → the matching CUST_SPR entry, not random) and raise `SPRITE_CHANCE`
   (1021) toward 1.0. Draw path is `drawCustomer` (2774) via `custSprite` (1027). Enemies derive from this cast.
3. **Shadow enemies** — finish generating the 11 incomplete, then `ingest` idle (mirror east→left) + cross-punch
   → `ENEMY_TEX`. Draws at line ~2118 (baseIm), preserves windup/rage/KO effects (already handled).
4. **Cats (sprites)** — generate cat walk/sit/sleep/groom anims + the requested SLEEPING states, ingest, swap
   `drawOneCat` (procedural) to blit sprites. Keep the territorial LOGIC (already tested).
5. **Kitchen** — ingest 11 appliances → `STATION_TEX`; regenerate the 5 gap states; wire ingredients (replace
   `drawRawBox`); generate + wire dishes (spr8/spr24).
6. **Night club** — ingest 16 dance anims → `DANCE_CAST`/`CHAR_IMG.*.front.dance`; place the DJ; select +
   animate the bottle-service prop; generate disco ball / neon / speakers (see ASSET_CATALOG night-club plan).
7. **Floor/walls** — regenerate via `create_topdown_tileset` (seamless), ingest → `TILE/WOOD/WALL_TEX`.
8. **Chef Bot feature (#17)** — office upgrade (`run.upgrades.chefbot`, $100k) + locked recipe onto MENU. See ROADMAP #17.

Each track: ingest → `cd test` green → mutation-test new invariants → render + look → move on. Never batch two
tracks' src edits concurrently (one file; the mutation loop corrupts-and-restores it).

---

## 5. Generation still required (for background agents)
- Shadow enemies: 11 incomplete (5 need state+punch, 6 need punch finished)
- Cat animations: walk/sit/sleep/groom for both cats + sleeping states
- Floor/wall: `create_topdown_tileset` for ceramic-tile / wood-plank / wall
- Dishes: salad/karaage/lobster/whiskey-sour/gin-sour/pancakes as spr8 + spr24
- Appliance gap states: fryer:cooking, fryer:ready, pot:ready, icebox, shaker:shaken
- Night club decor: disco ball (animated), neon bar sign, speaker stacks, DJ booth
- Bottle-service: select best candidate from pack `d9536be3…`, add sparkle animation

**Cost so far tonight:** ~670 generations used of 2000/month (≈1330 remaining). No daily cap. The 8-concurrent-
job limit + severe backend load (jobs ran 5–10× slower than ETAs) is why generation dragged. Pace agents at
2–3 concurrent.

---

## 6. Tooling built this session
- `docs/tools/ingest` — packs FINISHED PixelLab assets (by id, from the CDN) into `art/*.b64`. Modes:
  `char` (rotations→{front,right,back,left}), `obj` (1-dir object), `combo` (multi-move fighter manifest),
  `urls` (explicit key=url). **Does NOT generate** (MCP-only per Addendum 01). ADD `--max <px>` downscale next.
  Direction map: south→front, east→right, north→back; **west/left is mirrored from east** (game convention).
  CDN needs a browser User-Agent (403s Python's default).
- `docs/tools/sprite` — the pre-Addendum REST client; retire (keep only as a `balance` probe).
- `docs/tools/wire_chef_walk.py` (+ `chefM_manifest.json`, `chefF_manifest.json`) — the one-off that built
  the chef CHARS/FIGHT blobs (front/right/back + mirrored left, from rotations + running-4-frames). Template
  for the cast wiring — downscale (§2) belongs here next.
- MCP: `.mcp.json` (remote http, Bearer via `${PIXELLAB_API_KEY}` in `.claude/settings.json`). Restart Claude
  Code to reconnect. **The key is a secret — it is NOT in this zip** (`.pixellab.key`, `.claude/settings*.json` excluded).

## 7. Known bugs fixed this session (don't reintroduce)
- Facing **left** fell back to the OLD procedural chef (CHARS had no `left`) → fixed by mirroring east.
- Female chef rendered taller than male (136px vs 88px native) → fixed via `CHEF_H` native-size normalization.
- Combat showed a single frozen fist-out pose → replaced with animated jab frames (both chefs); combo
  SELECTION/cadence (which move, when) is still Task 3, deliberately untouched.

## 8. Verify current state
`docs/tools/cd test` → **570/570, ALL PHASE-A CHECKS PASSED**. `python3 docs/tools/build.py --check` →
**ROUND-TRIP IDENTICAL ✓**. Both chefs render new sprites in all 4 directions in-game (objectively confirmed:
`CHAR_IMG.chefF.left.idle` = 136×136 loaded, male on-screen 24px > female 21px).
