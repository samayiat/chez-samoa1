# Culinary Dash — Docs

> # ⚠️ THE FILE LAYOUT CHANGED — READ THIS FIRST
>
> The game is no longer one giant file you edit. Art is split out:
>
> | file | what it is | rule |
> |---|---|---|
> | `culinary-dash.src.html` | **the game code, ~204KB, no blobs** | **← you edit this. Safe to grep/read.** |
> | `art/*.b64` | 22 sprite blobs, ~803KB | **never read these** |
> | `culinary-dash.html` | built artifact, ~1MB, ships to her | never hand-edit — it's generated |
>
> `src` and the built file have **identical line numbers** (each blob = one marker line), so any line ref works in both.
>
> **Workflow:**
> ```bash
> docs/tools/cd grep 'recipe:'   # safe grep of the src
> docs/tools/cd show 118 130     # print a line range
> # ...edit culinary-dash.src.html with str_replace...
> docs/tools/cd test             # build + run harness  -> ALL PHASE-A CHECKS PASSED
> docs/tools/cd map              # size budget
> ```
> `cd test` rebuilds `culinary-dash.html` from src + art. **Always ship the built file.**
>
> **Why this exists:** ~800KB of sprite base64 used to sit on 22 lines of the working file (worst line: 133,113 chars ≈ 33k tokens). A bare `grep 'left'` dumped ~196k tokens and `cat` dumped ~251k — instantly exhausting the context window. That is what produced *"response incomplete"* and *"making room for more conversation"*, and it was misread as a bad commit and rolled back. The game was never broken. The split makes it structural: **art can grow forever without growing what a session must read.**

Documentation & commit bundle for **Culinary Dash**, a self-contained HTML5 cooking/time-management game (Diner-Dash × Papa's feel). A charming gift for one person. Reference aesthetic: **Habbo Hotel**.

## What's here
| File | Purpose |
|---|---|
| `CHANGELOG.md` | Commit history — newest first. Add an entry every commit. |
| `ROADMAP.md` | Patch queue (planned work + status). |
| `DECISIONS.md` | Locked calls. Don't relitigate. |
| `PARKED.md` | Long-term / not-now ideas (host-app route, etc.). |
| `SYSTEMS.md` | What's already built. |
| `ASSETS.md` | Art pipeline + handoff status. |
| `handoffs/` | Specs sent to the sprite session. |
| `tools/cd` | **Working-file tools.** grep/show/build/test/map — see the warning above. |
| `tools/build.py` | src + `art/` → the single-file `culinary-dash.html`. Round-trip verified. |
| `tools/split_art.py` | One-shot splitter that created this layout (kept for reference). |
| `harness.js` | Headless test harness. `node docs/harness.js` → expect `ALL PHASE-A CHECKS PASSED`. |

## Companion artifacts (not in this bundle)
- **Working file:** `culinary-dash.src.html` + `art/` → built to `culinary-dash.html` (single file, art embedded, no network).
- **Dev Brain:** `Culinary_Dash_DevBrain.xlsx` — the same info as a color-coded dashboard.
- **Culinary Brain** (separate): the taste-decomposition DB — source of truth for **menu / dish / flavor** authenticity. This bundle only *points* to it; game-dev content never goes in there.


## DEV: the pause dev menu
`culinary-dash-devtools.html` is a **dev build**. Pause (top-centre) and the overlay gains:

| row | what it does |
|---|---|
| `Waves  [-] n [+]` | 1..9. Overrides `WAVE_COUNT`. |
| `Enemies/wave  [-] n [+]` | 1..24. Overrides the rep-scaled size **literally** — no `brawlSizeMult()` scaling, no `Math.max(3,..)` floor. |
| `Start drinks  [-] n [+]` | 0..9. Overrides `START_DRINKS`. **Note: `START_DRINKS=5` currently ships** — the chef starts every brawl permanently buffed and WASTED. Set 0 here for a sober fight. |
| `START BRAWL NOW` | seeds a full house (5 patrons incl. The Critic, so spectators / GO-LIVE / critic stakes all fire) and drops you straight into the fight, using the numbers above. |

Untouched, the overrides are `null` and the game behaves exactly as shipped. Set one and it's literal — a dev menu that quietly clamps "1 enemy" to 3 would have you tuning against numbers the game is ignoring.

The build is one flag flipped in the **built** file, so it's otherwise byte-identical:
```
const DEV=false;   /*__DEVFLAG__*/     <- src always ships FALSE
```
`docs/tools/cd build`, then flip -> the dev file. **Never ship the dev build to her.** The menu is *inert* rather than merely hidden in her build: the rects are only assigned inside `drawDevMenu()`, which only runs when `DEV`, so they stay `null` and a tap can't hit one. Tests pin `DEV===false` in source and that the shipped pause screen leaves the rects null.

## Commit workflow
A "commit" = a batch of applied patches, delivered as: (1) the **built** `culinary-dash.html` (from `cd test`), (2) a fresh copy of this docs ZIP, (3) a new `CHANGELOG.md` entry. Code gets commented as it's written. Patches are batched from a manifest, not applied one-off.

## Delivery model
Runs **inside the Claude chat** — Claude is the backend. She plays via her Claude, which serves & updates the file.
