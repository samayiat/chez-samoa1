# Asset Generation Catalog — PixelLab

The concrete generation worklist. **Policy of record: ADDENDUM 01 (art pipeline)**, which supersedes the
handoff's §7 and the `ASSETS.md` extraction pipeline. This file is the *what to make*; the addendum is the
*rules*. Where they conflict, the addendum wins.

> Verified against the code on 2026-07-15. NB: ADDENDUM 01's line numbers run **~8 low** — Task 0 inserted
> 8 lines near the top of the src. Corrected line refs are used below.

## Access & cost — HARD RULES (from ADDENDUM 01)
- **PixelLab is an MCP server, not REST.** Use the `mcp__pixellab__*` (or bare `create_character`, …) tools.
  **Do not** use a v2 API client / curl for generation. `.mcp.json` is wired (`https://api.pixellab.ai/mcp`,
  Bearer via `${PIXELLAB_API_KEY}`) — **needs a Claude Code restart + approval to connect.** Not yet live.
- **Modes:** `v3` and `template` only. **1 generation per direction.** **Never `pro`** (20–40 gens *per
  direction*; v3 is higher quality *and* cheaper).
- **`confirm_cost`: never true on the first call.** Call → show cost to the developer → wait for explicit
  approval. A silent 320-gen burn is the same species of failure as everything in handoff §2.
- **`get_balance` before and after every batch.** Jobs are async (2–5 min); queue animations right after
  creating a character, don't block; poll with the matching `get_*`.
- Tier 1 ($12), 2000 gens/mo. Spend is a decision, not a side effect.

## Style contract — pulled from the code, not invented
Lock these across **every** generation; vary only `description`. The procedural half is the coherent half;
PixelLab matches *it*.
- `view = "low top-down"` — **confirmed by developer.** Hard param, everything inherits it.
- Fix once, never deviate: `size`, `outline`, `shading`, `detail`, `proportions`, `text_guidance_scale`.
  Caveat: outline/shading/detail are **soft guidance** — don't rely on them for coherence; rely on
  **palette + view + size**.
- Palettes to feed the generator (verified line refs):
  - `PLANT_PAL` (1469) — 6 locale palettes: 3 leaf tones + pot + glow/snow
  - `TABLE_STYLE` (3308) — 6 locale palettes + pedestal `foot`
  - `ENVS[].pool` (3123) — per-locale floor light colour
- **Do not ship a half pass.** A prior low-top-down attempt was abandoned only because the *set* was
  incomplete (no fight/cook anims, no kitchen props). The threshold is the whole set.

## The boundary — things → PixelLab, forces → code (verified)
| becomes ART (PixelLab) | line | stays CODE (procedural) | line |
|---|---|---|---|
| `genPlant` (+ wrecked variants) | 1493 | `drawVine` (length-parametric `VINE_SPOTS`) | 1590 |
| `genMonster` | 1616 | `drawMotes` (only where `buildFloor` baked light) | 3237 |
| `drawCandle` (flicker via `animate_object`) | 3359 | `drawDrunkWarp` (canvas re-blit) | — |
| `drawHang` | 1561 | `camZoom` / shake / hitstop / punch-zoom | — |
| `drawTable` | 3317 | `smashPlantsNear` (smash particles) | 278 |
| `drawPlant` wreck → `create_object_state` | 4018 | baked light pools | — |
Rule: if it *reads the scene, positions against it, or post-processes it*, it stays code. Candles ARE art
(`animate_object` v3, `frame_count` 4–16; offset the **frame index** per table, not the sine phase, so five
candles still don't pulse in unison).

## The breadth engine — `create_1_direction_object`
At effective **size ≤42px you get 64 candidate objects from ONE call** (≤85→16, ≤170→4, else 1); ~20–40 gens
total. Everything in this game is <42px (props 8–22px). Anchor with up to 8 `style_images`, name each with
`item_descriptions`. Results land in `review` → `select_object_frames(indices=[…])` keeps, `dismiss_review`
bins. **This is how kitchen assets, plants, and props get made — one call, not sixty.**

---

## WORKLIST

### A. Characters — 4-dir masters (`create_character`, v3/template)
**Constraint:** enemies are runtime shadow-masked copies of these masters (rage tint too). Scrapping the old
masters removes the enemy roster's source — **generate the new cast knowing the brawl enemies derive from it.**
Prompt seeds from `CAST` (1477). All 8 currently procedural; the whole `art/` set (824KB, 80% of the build) is scrap.

| id | who | prompt seed | gen status |
|---|---|---|---|
| reggie | Reggie | blue jacket, tan skin, dark flattop | todo |
| marisol | Marisol | pink top, long brown hair, sunglasses | todo |
| sinclair | Sinclair | navy suit, slick hair, bowtie | todo |
| val | Val | olive outfit, ball cap, deep skin | todo |
| critic | The Critic | grey-purple coat, grey combover, notepad | todo |
| nana | Nana | purple cardigan, white bun, elderly | todo |
| deja | Deja | gold/orange outfit, afro, deep skin | todo |
| monty | Monty | brown suit, grey side-part, monocle | todo |
| chefF | Chef (her) — the recipient/player | **beautiful** petite Black woman, **dreadlocks**, **white** chef hat, **leopard-print apron** (say "leopard" not "cheetah"), pink long-sleeve shirt, white shoes, gold hoops, nostril ring. ⚠️ MUST include "beautiful"/"really pretty" or dreadlocks render male. | ✅ **LOCKED** = char `345b84b7` · fighting anims generating |
| chefM | Chef (him) — the swap = the afro chef | African American man, big afro, white chef coat + hat | ✅ base `59ac123a` + full combo set (jab/cross/roundhouse/uppercut/taking-punch) done |
| **cats ×2** | **TASK 1** | `create_character(body_type="quadruped", template="cat")` — one black, one orange | **next task** |
| chefbot | Chef Bot (ROADMAP #17) | robot waiter w/ tray | **gen'd** (old REST path) → `work/sprites/zz_apitest/` — re-gen via MCP for style |

### B. Fighting animations (named templates, 1 gen/direction) — inputs to ROADMAP #16 combat
`taking-punch` (= Task 2's impact frame — the contact frame hitstop never had), `lead-jab`, `cross-punch`,
`roundhouse-kick` (= Task 3 cadence), `surprise-uppercut`, `falling-back-death`, `fight-stance-idle-8-frames`.

### C. Cooking animations (custom v3, `directions=['north']`)
The cook line is at y=40, chef stands below → she faces **NORTH (back)** for every cooking action. Custom v3
defaults to south; pass `directions=['north']`. 1 gen per animation. (per station: assemble / fry / pot / shake …)

### D. Plants, hangers, wrecked variants, tables, candles, monsters, kitchen props
Via breadth engine (props) + `genPlant`/`drawTable`/`drawCandle`/`genMonster`/`drawHang` → art. Wrecked plants
via `create_object_state(object_id, edit_description="smashed, cracked pot, spilled dirt")` so they match the
intact plant (today's wreck is 4 hardcoded fillRects). Candles animated (flicker), plants animated (sway).

### E. Kitchen assets — food, ingredients, props (the "pots pans ingredients food" batch)

**All of these are <42px on screen**, so they're the **breadth engine's** job: `create_1_direction_object` at
size ≤42 returns **64 candidates per call** (~20–40 gens). Anchor every call with the same `style_images`
(pull from the locked chef `345b84b7` + the room palettes `PLANT_PAL`/`TABLE_STYLE`/`ENVS[].pool`) and name
each with `item_descriptions`, then `select_object_frames` the keepers and `dismiss_review` the rest. Group
by category so one call yields a coherent set.

**E1 — Food / dishes** (each needs `spr8` in-world ~8-bit + `spr24` 24-bit menu portrait). From `DISHES`:
| dish | plated look | status |
|---|---|---|
| salad | garden salad, lettuce + tomato | wired (old) → re-gen |
| karaage | fried chicken pieces | wired (old) → re-gen |
| lobster | boiled lobster | wired (old) → re-gen |
| whiskey-sour / gin-sour | cocktail in a glass | wired (old) → re-gen |
| pancakes (ROADMAP #5) | stack + lemon | todo |
| egg-white fizz (#14) | foamy sour | todo |
Note: `spr8` (tiny in-world plate) and `spr24` (menu card) are two renders per dish — generate the item, then
a larger detailed version for the menu.

**E2 — Ingredients** (raw items, currently drawn as `drawRawBox` wooden crates ~line 2586). From recipes:
`chicken`, `lettuce`, `tomato`, `rawlobster`, `whiskey` (bottle), `gin` (bottle), `sourmix` (carafe), plus
`icebox` source. Future (ROADMAP #5/#14): `flour`, `eggs`, `lemon`, `milk`. → one breadth call, ~12 items.

**E3 — Kitchen equipment / props / stations.** From `STATIONS`: **fryer**, **salad** station, **ice box**
(source), **pot** (boil), **bar/shaker**. Plus the generic props: **pots, pans, plates, the pass counter,
wooden crates, glassware**. Stations are the appliances the chef stands at (y=40 cook line). → one or two
breadth calls. Consider `create_map_object` for the bigger fixed appliances.

**Sequencing:** ingredients + props first (they set the palette/scale the food plates sit on), then dishes
(the plated food references the ingredient look). Budget: each breadth call ~20–40 gens; the whole kitchen is
~3–4 calls ≈ 100–150 gens — well within the 1979 remaining, but confirm before each call per the cost rules.

---

## Two accepted costs (don't re-litigate; don't break)
1. **Per-locale stops being free.** Today `ENV+":"+seed` recasts the room for 0 bytes. Baked art makes every
   combination inventory: 6 locales × 6 plants ×~9 frames ≈ **320 sprites**. Gen cost trivial; **filesize is
   real.** The 824KB freed by scrapping `art/` is the budget — but it's a budget now.
2. **`PLANT_PAL` can't just be deleted (VERIFIED: 5 consumers).** 3 become art (genPlant 1498, drawHang 1563,
   drawPlant 4018); 2 stay code (**drawVine 1592, smashPlantsNear 286**). Fix: **extract each locale's palette
   out of the generated art and feed it to the code consumers** — code follows art, doesn't guess alongside it.
   **Pin with a test that the vine palette and the plant-art palette agree per locale** (exactly the class of
   bug tests never catch).

## Queued teardown (do NOT do now — gated behind the art work, one-task discipline)
- Delete the `ASSETS.md` 7-step extraction pipeline (void — PixelLab emits real pixel art).
- Scrap `punchdata.js`, the shadow-mask enemy trick, provisional/recoloured frames.
- Scrap all of `art/*.b64` (824KB) as the new set replaces it.

## Open reconciliation (needs a decision)
- **`docs/tools/sprite` (REST CLI) conflicts with ADDENDUM 01's "MCP only, no API client."** It works and is
  handy for `get_balance`/smoke-tests, but the real workflow (breadth engine, templates, object-states,
  animate, cost confirmation) is MCP-only and richer. **Recommend: retire the CLI** (or keep only as a balance
  probe). Awaiting the call.
