# Assets & Handoffs

## Status
- **Chef sprites** (both, 4 dir, walk frames) — **wired**. Female default + male swap. From sheet `A37D9EF4`.
- **Customer cast** (8, 4 dir) — delivered, **not wired** (still procedural in-game — Roadmap #10).
- **Back-office vignette** (both chefs) — **handoff sent** (`handoffs/BACKOFFICE_HANDOFF.md`), awaiting art.
- **Punch frames (The Brawl)** — SUPERSEDED, see below. (Old salvage: from the two AI punch sheets (one frame per fighter, facing-normalized, mirrored for L/R; thin-outline pipeline). Staged in `punchdata.js`, embedded when #12 is built. Per-fighter: reggie/val/critic/nana/chefM/chefF clean picks; **marisol recolored** to canon pink; **sinclair provisional** (best frame ~navy but garment shape ≠ his suit — replace when re-rendered). Idle poses come from existing sprites.)
- **BRAWL FIGHTERS — FINAL APPROACH (no re-render needed):** customer punch frames scrapped (beyond repair). Enemies = **shadow-masked copies of the clean 4-dir masters** (dark silhouette ramp, thin outline, L/R, facing-verified, gap-bridged extraction — all connected with feet). **RAGE (red) tint** = the buffed state (Going Live / whiskey / after-hours drunk), applied at runtime. Chef punch frames **re-extracted fixed** (single connected body, feet intact). All staged in `punchdata.js` (~87KB: ENEMY set + chef PUNCH). Enemies attack by lunging — only the chef needs punch frames. **Deja + Monty re-render: CANCELLED** (masking covers everyone).
- **Brawler sprites (tank-top pair, sheet IMG_7024)** — parked as future **hired chefs / bigger bosses** art.
- **Dish sprites** (salad, karaage, lobster, whiskey-sour) — wired (8-bit in-world + 24-bit menu). 9 more dishes available on the sheet, not wired.

## Extraction pipeline (reusable — same recipe for customers)
1. Flood-fill the near-white background from the borders (keeps enclosed whites like chef hats).
2. De-fringe: grow background into light, desaturated boundary pixels (kills the white halo).
3. Erode 1px (drop the outermost fringe) → **core**.
4. Add a **1px near-black outline** ring around the core.
5. Color-bleed: push nearest core color into transparent pixels so smooth scaling won't drag white.
6. **Per-frame facing auto-correct:** detect each frame's facing (skin centroid); flip any horizontal frame that points the wrong way.
7. Quantize (~44 colors) to keep file size down.

## Anchor / draw convention
Sprites are bottom-center anchored (`drawChar(id, dir, x, feetY, scale, frame)`); feet at the character's Y, horizontally centered. Chef data is nested `{dir: {idle, walk1, walk2}}`; customer data is flat `{dir: dataURI}`.
