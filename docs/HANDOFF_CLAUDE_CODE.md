# HANDOFF → Claude Code

**Read this whole file before touching anything. Then do Task 0 and Task 1 only, and stop.**

---

## Where this came from

This project was built across long sessions with Claude on claude.ai (chat, not Claude Code). You have
not seen it. The developer has, and knows it well — he is the one you're talking to. The game is a gift
for a specific person; throughout the docs, **"her"** means the recipient, who is also the player.

**Culinary Dash** is a single-file HTML game: a restaurant service sim that erupts into a beat-em-up
brawl at night. ~4300 lines of source, 541 tests green, ~1MB built (824KB of that is art).

Development is on **Mac**, using **Claude Code Desktop** (not the CLI) — see Task 0 for why.

---

## 1. How this project is laid out

| file | what it is |
|---|---|
| `culinary-dash.src.html` | **THE editable source.** Edit this. Only this. |
| `culinary-dash.html` | BUILT artifact — art blobs inlined. Ships to her. **Never hand-edit.** |
| `culinary-dash-devtools.html` | Built file with `DEV=true`. Byte-identical otherwise. |
| `art/*.b64` | 22 sprite blobs, 824KB. **NEVER read or grep these — it will kill your context.** |
| `docs/tools/cd` | The house tool. `cd grep <pat>` (no -i), `cd show <a> <b>`, `cd build`, `cd test`, `cd script`, `cd map`. src and built share line numbers. |
| `docs/tools/build.py` | src + art → built. `--check` round-trip verifies; expect `ROUND-TRIP IDENTICAL ✓`. |
| `docs/harness.js` | Headless test harness. `docs/tools/cd test` runs it. |
| `work/` | Scratch probes and the render tooling (see §3). |

**Docs to keep current** (house style: findings-driven — name the bug, cite the fix, say what it cost):
`CHANGELOG.md`, `DECISIONS.md`, `SYSTEMS.md`, `ROADMAP.md`, `README.md`, `PARKED.md`, `ASSETS.md`.

**Delivery** is four files: devtools build, ship build (`DEV=false`), docs zip, src. Ship build must have
zero `const DEV=true;` and zero `__ART__` markers, and `build.py --check` must round-trip identical.

---

## 2. The rules that exist because they were learned the hard way

### Never trust a green test. Mutation-test every new invariant.
Re-introduce the bug you just fixed, run the suite, and **confirm its own test fails**. Two conditions
or it proves nothing: the mutation must stay **syntactically valid**, and the run must print `syntax OK`
— a syntax error means no test ran at all, and a grep for `✗` shows nothing and looks like "not caught."

### Tests that pass for the wrong reason are the dominant failure mode here.
Four in one session. Every one was **the assertion never reaching the code it claimed to check**:

- A cap (`GHOST_MAX`) that was never binding, so the test passed without the cap existing.
- A generic params bag whose *unused* fields kept varying, masking a frozen shape (six identical trees).
- Hitstop tests that ran from the menu, where the multiplier under test was always 1.
- **A spy that never installed.** The harness `X` is a **Proxy that discards writes**, so
  `X.fillRect = spy` silently does nothing. The test counted zero calls of nothing and passed. It would
  have passed no matter what the code did.

**The fix, every time: extract the decision into a pure function and test that.** `plantParams()`,
`moteDrift()`, `glassKind()`, `tableStyle()`, `driftAt()`, `wastedAmt()`, `tipHeat()` all exist for this
reason. If you find yourself spying or reaching into draw code to assert something — stop, extract.

Pair every "X doesn't happen" test with a "...and the check isn't vacuous" guard. That guard is the only
thing that caught the Proxy trap.

### Sprite art does not decode headless.
`drawChar`/`drawImage` record zero ops in the harness. Verify sprite-dependent behaviour by **spying the
draw path** (count calls/alphas), not by rendering. Procedural canvas art (fillRect) *does* render — see §3.

### "It already exists" — check before you build.
This bit the previous session four times: `ENVS[].pool` was already a per-locale light colour; the window
light already pooled onto the floor; **Going Live already exists** (`spectators, GOING LIVE, whiskey buff`
~line 1244); and `sfx()` is a switch **with no default**, so a misspelled sound name is a *silent no-op
that never throws*. Grep first. Always.

### Look at it. Tests will not catch the things that matter.
Every real visual bug was caught by rendering, never by a test — all green throughout:
- Six **identical** AURORA conifers (only the height was random).
- A hanging basket that drew its rope and lost **every tendril** behind the bar cabinet (`drawBarBack`
  paints after the wall layer).
- A candle halo that was a 14×13 **square** of 6% orange — a box with corners, not glow.
- 22 motes rendering **5 visible pixels**, because they were scattered and only lit if they drifted through light.

---

## 3. Tooling you have that isn't obvious

- `work/roomshot.js` + `work/room_raster.py` — render the **real room**. Records **per-canvas** op
  streams and composites `drawImage`, so the baked `FLOOR_CV` (which reaches the screen as a blit)
  rasterises instead of vanishing. Usage: `node roomshot.js <scenario> <ENV> <ms>` → `python3 room_raster.py out.png`.
  Scenarios: `day`, `bare`, `nocat`, `nomotes`, `nodrift`, `noglass`, `notables`, `wrecked`.
- **The technique that works:** diff a full render against a render with one system disabled, *at the same
  locale*. That isolates exactly that system's pixels. Diffing against a different locale silently counts
  the window view as your feature (this happened).
- `work/final5.js` — a roaming brawl sim. **Simulate real play, not idealised probes.** A NaN-knockback bug
  that made enemies invisible and unkillable survived every force-kill probe and was only found by actually
  fighting. Ditto: plants were never wrecked in a real fight despite a passing unit test, because the test
  hit them point-blank and the fight never goes near the walls.

Note: `cd script > work/game_script.js` after editing src, or `work/` probes run against stale code.

---

## 4. Your working agreement with the developer

**This is the part he cares about most. Read it twice.**

### You are doing ONE task. Stop when it's done.
§7 contains the rest of the plan. It is **context so you understand the system — not a queue.** Do not
start task 2 because task 1 finished. Finish, report, stop. He will hand you the next one.

### Definition of done for anything visual: a PNG and a URL.
Not "tests pass." Rebuild, render, put the image somewhere he can click it, and say what you see. Every
real bug in this codebase was found by looking. **No image, not done.**

### Stop and surface immediately — mid-task — if:
- **It already exists.** Don't quietly redesign around it.
- **A measurement contradicts the plan.** (e.g. knockback turned out to be ~5px, which invalidated an assumption.)
- **A new invariant's test goes green on the first try.** Suspicious by default here.
- **You're about to touch anything outside the current task.**

### Don't improve things you weren't asked to.
This file is dense with load-bearing decisions that look like cruft. `ZOOM_SAFETY`, `CANDLE_DX`,
`PLANT_R` distance-from-floor-edge, the pass gaps — each one is a bug someone already paid for. If
something looks wrong, say so; don't fix it.

---

## 5. TASK 0 — the Mac dev loop (blocking, do first)

**The bug.** `culinary-dash.src.html` ~line 46:

```js
portrait = vh > vw;
CV.style.transform = "translate(-50%,-50%) rotate(" + (portrait ? 90 : 0) + "deg)";
```

Orientation is inferred **purely from aspect ratio**. Any viewport taller than it is wide gets rotated 90°.
That's correct for a phone held upright and wrong for a desktop — and specifically wrong for **Claude Code
Desktop's preview pane**, which is narrow when docked beside the chat. It renders the game sideways.

**The fix.** A desktop should letterbox, never rotate. Gate the rotation on an actual touch device —
`matchMedia("(pointer: coarse)")` — not on shape. Keep the existing supersample/`SS` logic intact; it's
what keeps text sharp, and all drawing stays in logical 320×180 units. Test on a narrow window.

**The serve.** Claude Code Desktop's preview pane runs an embedded browser and can open static HTML
directly. Add `.claude/launch.json` with a static server for the repo root:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "culinary-dash", "runtimeExecutable": "npx",
      "runtimeArgs": ["-y", "serve", "-l", "3000", "."], "port": 3000, "autoPort": true }
  ]
}
```

Then `culinary-dash-devtools.html` is one click from chat. **Leave `autoVerify` on** (it's the default) —
it screenshots after every edit. Caveat: it inspects the DOM, and this is a `<canvas>` game, so it will
catch a blank canvas or a JS error, not a subtly wrong halo. The taste calls stay with the developer.

---

## 6. TASK 1 — two cats

There is one cat today (`resetCat`/`updateCat`/`drawCat`, ~line 3480). Make it two: **one black, one
orange.** This is deliberately a small, low-risk task — it's where you learn the house rules on something
that cannot break the game.

- `cat` → `cats[]`, palette per cat. Keep them **not solid** and with **no effect on any system**.
- Follow the house pattern: a **pure decision function** for the per-cat palette/behaviour, tested directly.
- They must **not pick the same perch** (`CAT_PERCHES`), and should acknowledge each other when adjacent —
  one grooms, or one gets up and leaves. Cats are territorial.
- Both bolt at `phase==="brawl"`; both back at `startDay()`.
- `updateCat` is ticked from the **top of `update()`**, before it early-returns on brawl/night — bolting is
  the one thing that must still happen when the room goes to hell. Don't move it.

**Context that is now load-bearing:** since the tables recast per locale, the cat is the **only fixed point
left in the building** (see DECISIONS). Doubling her doubles that anchor. That's intended.

Mutation-test at minimum: both cats sharing a perch, a frozen cat, a cat that stays for the riot, a cat that
never returns, a cat wandering onto the cook line. Existing cat tests already cover the single-cat versions —
generalise them, don't delete them.

**Then stop.** Render it, serve it, report.

---

## 7. The rest of the plan — CONTEXT ONLY. DO NOT IMPLEMENT.

**Task 2 — combat weight.** The fight feels floaty. Measured, not guessed: `BRAWL_KNOCK` (= `KNOCKBACK*12`
= 60) moves a body **~5px**. Bodies barely move when hit. In dependency order: (a) knockback distance,
(b) **root + lunge** — lock player steering for the active punch frames and drive a small forward impulse
(rooting alone reads as a mannequin; movement *toward* the target reads as force), (c) an **impact frame /
orange flash at contact** — `impact(w,dx,dy,x,y)` already carries the contact point and all ten call sites
pass coords, so this drops in with zero plumbing. Note: hitstop's whole job is to hold a contact frame, and
there **isn't one** — it currently freezes a generic "fist out" pose for 43–90ms. Hitstop and the contact
frame are the same feature; neither works alone.

**Task 3 — combo cadence.** jab-jab-hook: repeatable, not metronomic. **Define the gaps in post-hitstop
time.** `stopMult()` scales hitstop with state (drunk ×2.13, buffed ×1.25), so a cadence defined in raw time
silently changes rhythm by state — you'd tune it sober and it would feel wrong drunk, and it would be
miserable to diagnose. Input buffers rather than resets, so mashing can't outrun the rhythm.

**Task 4 — combat zoom + UI strip.** `camZoom(sx,sy)` (~line 724) currently **derives zoom purely from
shake** — it exists as a *safety* function, because the baked floor is exactly W×H with no bleed and shake
would tear a black band off the edge. Make it authored with a safety floor: `z = max(COMBAT_ZOOM, 1+safety)`.
Bonus: a base zoom means the safety term rarely binds, so `SHAKE_MAX` can go up without tearing — it pairs
with Task 2. HUD off in brawl; **HP is the one thing you can't just delete** — it wants to become diegetic
(stagger/tint; the rage tint already exists as a channel). **No special brawl UI** — the monsters already
recast per locale, so the locale is on screen throwing punches; it doesn't need a frame too. The zoom crops
the border and therefore the greenery; that's accepted and intended (the fight tightens onto her and whatever
the sky sent in).

**Task 5 — Going Live cinematic.** Freeze, focal-zoom to the streamer, hold, pan back. It already exists to
hook: `SPECTATE_CHANCE=0.55`, phones up, blinking REC, LIVE badge (~line 1244, ~2220), and `devSeedBrawl()`
seeds a full house specifically so GO-LIVE fires.
- **THE TRAP: hitstop freezes the sim, which would freeze your camera too.** The drunk afterimages already
  inherit this deliberately. If you implement "freeze everything" via `hitstopT`, you get a frozen frame that
  never zooms and it'll look like the cinematic didn't fire. **The camera must run on real time
  (`performance.now()`) while the sim is frozen.**
- **Focal zoom is one line** — the transform zooms about the centre: `(sx-(z-1)*W/2, sy-(z-1)*H/2)`, so
  `W/2 → camX`. **But the safety invariant generalises to `(z−1)·min(camX, W−camX) ≥ |sx|`** — the binding
  term becomes distance from the focal point to the nearest edge. Centering on a streamer near a wall with
  shake active forces a large zoom or the room detaches. Counterintuitively a *gentle* zoom is more
  edge-constrained than an aggressive one, because the crop margin scales with (z−1). During a frozen
  cinematic shake should be 0, so it's safe — just never let focal zoom and a shake spike coexist unclamped.

**Track B — sprites (after 2–4, by the developer's call).** So he judges new art against combat that already
feels right. Enemies are **shadow-masked copies of the 4-dir masters applied at runtime** (rage tint too), so
redoing the masters brings the whole enemy roster for free. `ASSETS.md` has the 7-step extraction pipeline —
most of which exists to repair AI-generated non-pixel art and should largely delete if masters come from a
real pixel-art tool.

---

## 8. Where agents help — and where they don't

**This plan barely parallelizes, and that's structural.** One file, one harness, one global test count. Two
agents editing `culinary-dash.src.html` concurrently clobber each other — worse than usual, because the
mutation loop **deliberately corrupts the file and restores it** (`cp` → mutate → test → `cp` back). A second
agent touching the tree mid-mutation gets garbage. And the tasks chain: knockback changes shake headroom,
which the zoom budgets against; the cinematic needs the zoom's camera; cadence tunes against knockback's feel.

Three roles that *do* work:

1. **Scout (read-only, parallel, high value).** Before each task, fan out: "does X already exist, who consumes
   it, what would it collide with." This codebase ambushes you with things that already exist. Zero write risk.
2. **Red team (own tree copy, parallel — the killer app).** An agent that writes a test *and* reports it green
   is grading its own homework, which is exactly this codebase's dominant failure mode. Split the roles: one
   writes the invariant, **a different agent's only job is to break it** and confirm the test screams.
3. **Sprite track (genuinely parallel).** Touches `art/`, `punchdata.js`, the pipeline. Doesn't touch combat code.

**Keep agents away from the taste calls.** An agent cannot tell you the punch feels right, and it will
confidently say it does.

---

## 9. Open questions only the developer can answer

- **`START_DRINKS=5`** is a shipping test-cheat: every brawl starts the chef permanently buffed **and** wasted,
  which guts the drink mechanic and hands her the 2.13× drunk hitstop every fight. Flagged, exposed in the dev
  menu, deliberately unchanged. Needs his decision — don't touch it.
- **The customer cast** (8 characters, 4-dir) is delivered but **unwired** — still procedural in game (Roadmap #10).

---

## 10. A correction to the record

Earlier docs flagged the plants, drunk warp, afterimages, motes, drifter, glass weather, cat and tables as
"nobody has seen these on a phone." **That was wrong and those flags are removed.** The assistant writing them
could not see its own renders and kept converting *"I can't see it"* into *"nobody has looked."* The developer
has seen all of it on a phone; it looks as intended. It's approved. **Don't reopen it.**

Which is itself the lesson this whole file is about: state what you actually checked, not what you'd like to
have checked.
