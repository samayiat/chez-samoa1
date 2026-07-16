# === COMMIT culinary-dash-commit-2026-07-14-legible (world & flavor era) ===

# Changelog

Commit history, newest first. Each entry: `## YYYY-MM-DD — title` + bullets of what changed.
(Entries before the changelog existed are reconstructed milestones, grouped.)

---

## 2026-07-16 (d) — Triple Vince's moveset: 2 attacks -> 6 (Roadmap #40, slice C)

Per request: more variety in the boss fight, on the condition the strike window never disappears — the
player must always be able to fight back. Vince goes from **charge + ground pound** to **six** distinct
recurrent attacks.

### The new four
- **paper** (eviction notice) — a ranged, dead-straight projectile throw. The only non-melee attack in his
  kit, so pure backpedaling stops being a universal answer.
- **grab** — REACTIVE, not scheduled: if she's standing inside `grabR` of him when his windup resolves, it
  preempts whatever the rotation had queued and grabs-and-flings her across the room instead. Punishes
  hugging him to dodge the ranged/AOE attacks.
- **stomp** (shockwave) — a faster, smaller AOE centred on his *current* position (unlike ground pound,
  which remembers where he stood at the windup) — so standing still near him is never safe for long, even
  between his bigger attacks.
- **dcharge** (double charge) — two lunges back-to-back, each re-aimed at her position, landing as a real
  2-hit combo rather than one bigger single hit.

### How the selection works
`BOSSES[0].rotation = ["charge","pound","paper","stomp","dcharge"]` cycles deterministically off
`bossFight.cycle` (kept deterministic on purpose — this project's own lesson, DECISIONS.md, is that a
mutation deleting a randomized branch can slip past a green suite; a rotation index is directly assertable).
`grab` sits outside the rotation as a proximity override. **Every one of the six resolves into `"recover"`**
— the exposed strike window is structurally guaranteed, not just usually true. A new harness test walks
all 11 intermediate states (charge, slamtele, slam, paperaim, paperfly, grabtele, grabhit, stomptele,
stomphit, dcharge1, dcharge2) and proves each one reaches `"recover"` within 600 simulated frames.

Procedural rendering only for all four new attacks (a telegraph ring, an aim line, a flying paper rect) —
same no-new-art approach as the rest of this system.

### Tests
+10 checks (**816 total**): the roster is provably 6 distinct attacks, each of the four new ones actually
launches/connects/damages when it should, the double-charge's second leg genuinely re-aims and can connect
independently, and — the one that matters most — every attack, without exception, still leads back to a
window where she can land a hit.

## 2026-07-16 (c) — Boss night: the goal, and the real stake (Roadmap #40, slice B)

Second slice of the boss/shop/stakes patch. Locked design: **1a** full wipe on a loss, **2a** a real fight
where bought stats are the lever, **3a** telegraphed a day ahead. Full spec in `BOSS_SHOP_SPEC.md`.

### A separate system from Brandon, on purpose
Brandon (the random daytime pistol scuffle) already existed and is heavily tested — his loss just ends the
day (rating hit, no wipe), which is right for a mid-service random event but wrong for the new high-stakes
boss. Rather than bend his 30+ pinned tests to a second meaning, **boss night is entirely new and additive**:
new `phase="bossnight"`, a new `bossFight` state object, new functions throughout. Brandon's own code is
byte-for-byte unchanged — a test now pins his flat `-1` strike and his exact starting HP to prove it.

### The loop
    results (day D) --> OFFICE shows "⚔ CHALLENGER TOMORROW" if one's queued
         |                                     (a whole shopping day to buy stats)
         v
    day D+1 plays out --> at CLOSE, the queued boss fires (ahead of the normal brawl roll)
         |
         +-- WIN  --> big coin reward, bossesBeaten++, back to service/night
         +-- LOSE --> phase="gameover" --> tap --> FULL WIPE (bank/week/stats/upgrades, everything)

`finishDay()` rolls for the next telegraph (`BOSS_NIGHT_CHANCE=0.25`, cooldown >=2 days since the last one
resolved so they never stack). The **existing generic** `gameover -> startCampaign()` tap (already used for
eviction) is what delivers the wipe — no new reset code, just a new reason to hit it. `drawGameOver()` now
tells a boss loss ("WIPED OUT") apart from an eviction, reading `run.bossWipe`.

### Vince "The Landlord" — the first roster boss
A charger with two distinct recurrent attacks (a `BOSSES[]` table, easy to extend — the next one drops in
with zero new plumbing):
- **Charge** — telegraphed windup, then a lunge along her position at the moment of the windup; connects =
  damage. The strike window (his exposed "recover" beat) is the same rhythm as Brandon's reload.
- **Ground pound** (every 3rd cycle) — a growing danger ring at his feet; still standing in it when it
  lands costs more than the charge. Two attacks, so the pattern doesn't read as one move on a timer.

Procedural rendering only (a body, a telegraph ring, a danger circle) — no new art, matching the game's own
practice for the phone/LIVE-badge/red-X/robber layer.

### Stats are the lever (2a), wired for real
`chefMaxHP()` sets boss-night chef HP (Iron Gut matters here too), `guardMult()` cuts every hit Vince lands,
`punchDmg()` (Heavy Hands) scales every strike back. All three are now proven with a **before/after damage
comparison**, not just "the multiplier exists" — a test fights the same opening frame at two stat levels and
asserts the damage actually moved.

### Tests
+16 checks (**806 total**): Brandon's untouched, the roster resolves, the telegraph fires at close and
clears itself, boss-night HP starts at the stat-scaled max, a win pays the reward and returns to service, a
loss reaches gameover with the boss's name recorded, tapping it is a **provable full wipe** (bank, week,
stats, upgrades, bossesBeaten all reset), both of Vince's attacks damage on contact, and guard/power visibly
move the numbers in a real exchange.

### Next (slice C)
Balance pass — every number here (`BOSS_NIGHT_CHANCE`, Vince's HP/damage, the stat costs, the reward) is a
flagged first guess. Needs her hands on the Retroid to tune the actual feel and pacing.

## 2026-07-16 (b) — Stats + a real shop: the grind gets a point (Roadmap #40, slice A)

"There's not enough goal." First slice of the boss/shop/stakes patch (full design in **BOSS_SHOP_SPEC.md**,
locked with her 1a/2a/3a). This slice is the **spend side** — what the bosses will gate.

### Combat stats — the lever (2a)
`run.stats = {hp,pow,guard,feet}`, leveled 0..5, persisted like `run.upgrades`. Every helper returns the
BASE value at level 0, so nothing changes until she buys — the whole 772 suite stayed green on the wiring
alone.

    Iron Gut         +5 max HP / lvl     -> chefMaxHP()      (brawl chefHP + heal cap + HP bar)
    Heavy Hands      +12% punch / lvl    -> punchDmg()/powMult()  (every player hit incl. the special)
    Bouncer's Build  -8% dmg taken / lvl -> guardMult()      (enemy hits, floored 0.5x)
    Quick Feet       +6% fight speed/lvl -> fightSpeedMult() (brawl move speed)

All wired on the existing sites; `statSum()` is the "readiness" number the bosses will check.

### A pretty long shop, and it scrolls now
`UPGRADES` grew (Neon Sign, Security Camera, Top-Shelf Liquor — each a single legible lever: spawn rate,
robbery odds, bottle price) and the four stats slot in between repairs and one-shots. The office hard-capped
at ~6 rows, so a long list fell off the bottom — added **pagination**: a `MORE ▸ page x/y` button (tap),
d-pad left/right on the Retroid, arrow keys on desktop. `OFF_VIS=6`.

### Tests
+18 checks (**790 total**): base = no free power, buying levels + deducts, the four stats scale their
channels monotonically, cost climbs with level, the cap holds, `statSum` totals, upgrade-row count is
invariant to the stat rows, pagination wraps, and the three new one-shots each move their system.

### Next (slice B)
The bosses themselves: `BOSSES[]` with telegraphed recurrent attack patterns, the day-ahead warning (3a),
a big coin reward on a win, and the **full wipe** on a loss (1a). Balance pass (slice C) needs her hands
on the device.

## 2026-07-16 (a) — Less camera, more motor: rebalance the "solid hit"

The brawl was shaking the whole screen to sell contact — a workaround from before the motor carried its
weight. On the Retroid (vibration motor confirmed present, PARKED.md) the **haptics** sell the solidness;
the camera doesn't need to shout over them. So: dial the fight shake DOWN and crank the vibration UP.
Both moves stay ON THE IMPACT SPINE — one ranked weight still drives every channel, nothing hand-tuned at
a call site (the locked rule that keeps the ranking honest).

### Screen shake down
`SHAKE_PER_W` **9.0 -> 5.5** (the fight channel only — `impact()`). Day/kitchen `addShake()` literals
(perfect serve, wave-off, thief) are untouched; they don't ride `SHAKE_PER_W`.

    blow      shake was -> now
    scuff     2.7 -> 1.6
    jab       4.5 -> 2.8
    hurt      6.8 -> 4.1
    heavy     7.6 -> 4.7
    stumble  10.8 -> 6.6

`SHAKE_MAX` stays **15** on purpose: a HIT_MAX blow now peaks at ~8.8, so the cap never binds — every
camera/zoom/pan invariant that references `SHAKE_MAX` (COMBAT_ZOOM coverage, the pan-pinch at off~14.7,
the lean clamp) is byte-for-byte unchanged. Turning shake down here can only loosen those, never tighten.

### Vibration up (compensating)
`HAPTIC_MAX_MS` **180 -> 230**, `HAPTIC_CEIL_MS` **250 -> 280** (so a drunk KO still clears a sober max hit
with headroom). The whole curve above the 45ms floor lifts with it:

    blow      buzz was -> now
    jab        87 -> 103 ms
    hurt      108 -> 132 ms
    heavy     117 -> 143 ms
    stumble   146 -> 184 ms   (thump-THUMP, second beat)
    jab KO    ~140 -> 161 ms   ·  drunk jab KO up to 257 ms

The `HAPTIC_MIN_MS=45` floor is untouched — a measured hardware fact, not a taste knob. The day NOTIFY
channel is still provably weaker (by peak pulse) than the lightest blow; the rebalance only widened that gap.

**Harness: 772/772 green** — shake reduction loosens the camera invariants; the haptic bump stays inside
every pinned bound (peak of a max hit == `HAPTIC_MAX_MS`, ceiling clamp, notify < lightest hit, drunk KO
is the hardest thing in the game).

## 2026-07-15 (q) — Push it harder, and let the day tap you on the shoulder

### Harder
`HAPTIC_MAX_MS` 110 -> **180**, plus `HAPTIC_CEIL_MS` 250 as a hard cap after multipliers. The motor takes
far more than the first two passes assumed.

### The drink hits the motor, mirroring stopMult()
`hapticMult()` = `1 + (HAPTIC_WASTED_MULT-1)*wastedAmt()`, **x1.60 at full depth**, fight-only — the drink
doesn't make a customer's arrival hit harder. Same shape and same reason as `STOP_WASTED_MULT`: the drink
already smears TIME on impact, so it should reach the motor too. Kept OUT of `hapticFor` so the curve
stays pure; the caller passes it in. A test pins the two multipliers to the same shape — one drink, every
channel.

    SOBER                          WASTED (x1.60)
     jab            [87]            jab            [140]
     roundhouse     [106]           roundhouse     [169]
     jab KO         [45,28,129]     jab KO         [45,28,207]
     stumble (you)  [45,28,146]     stumble (you)  [45,28,234]
     +3 bodies KO   [45,28,180]     +3 bodies KO   [45,28,250]  <- the ceiling

A drunk KO is the hardest thing in the game, pinned by a test at >=90% of the hard cap.

### The day channel: NOTIFY
    arrive [45]   ready [45,40,45]   taken [45]   served [52]
Four moments: someone comes through the door, they sit down ready to order, the order goes in, the plate
lands. `ready` is a **double tap** — it's the one you must not miss. All at/near the floor, because the
brief is "the bulk is the fight; the day is a tap on the shoulder."

**That rule is enforced, not hoped for**: every NOTIFY pattern must be weaker than the LIGHTEST thing the
spine can produce. If a day tap ever out-buzzes the weakest hit, the fight stopped being the loud part.

### Total duration is not intensity
The rule first measured TOTAL ms, and `ready` [45,40,45] = 90 failed against scuff's 70. But two 45ms taps
with a gap are felt as *two taps*, not one 90ms buzz — which is the entire point of using texture. The
invariant is on **peak pulse**: a day tap may never hit HARDER than the lightest blow. It may tap twice.

### notify("arrive") was in the wrong function
I anchored it on `c.stool=s; c.tx=s.x; ...` — which lives in **`seatWaiting()`**, not `spawnCustomer()`.
So "someone came in" fired when a benched patron changed seats. Found because the bench test failed: with
a free stool, `seatWaiting()` instantly yanked the benched customer to a table. The test was right and the
wiring was wrong. Moved to the door, both paths, and both directions now pinned.

### Three more test-side lessons
- `drinks == WASTED_AT` is only *entering* wasted (depth 0.25, x1.15). `wastedAmt()` is `depth*fade` — full
  depth needs the whole ladder. I asserted `> 1.3` against a state I hadn't built.
- `type` on a customer is an **index into CAST**, not a name. `type:"nana"` made `CAST[c.type]` undefined,
  and `startBrawl` read `.id` off it — crashing three tests downstream from the malformed object.
- `notify("served")` and `notify("taken")` had **no tests**; deleting them passed all 770. Both pinned now.

**772/772.** Mutation-tested: drunk multiplier removed, drunk leaking into the day, the hard ceiling
dropped, a day tap out-buzzing the fight, `ready` firing at the bench, `arrive` back in seatWaiting, the
door going silent, serving going silent, taking the order going silent — all caught.

---

## 2026-07-15 (p) — The haptics were never felt. #29 was a no-op.

### The floor is physics and I invented it out of nothing
Measured on the target device by a person holding it: **single pulses at 20ms and 38ms were NOT FELT AT
ALL.** Only a multi-pulse pattern registered. The motor is an ERM — a rotating mass needs ~30-50ms just
to spin up before it produces anything perceptible.

**#29's curve was 8ms -> 38ms. Entirely below the floor.** Every buzz it shipped was current with no
feeling. And its tests were green, because they counted calls to `navigator.vibrate` and read back the
durations — which was never the question. The question was whether a human feels it, and nothing
headless can answer that. It took someone with the device in their hands, and it took him telling me the
third button was the only one that worked.

### What it is now
`HAPTIC_MIN_MS` **45** (measured floor, not chosen), ceiling 110, and `hapticFor(w)` returns a PATTERN:

    scuff           w=0.30   [57]
    jab             w=0.50   [65]
    cross           w=0.60   [69]
    roundhouse      w=0.72   [74]
    jab KO          w=1.00   [45,28,86]
    stumble (you)   w=1.20   [45,28,94]
    roundhouse KO   w=1.22   [45,28,95]
    +3 bodies       w=1.60   [45,28,110]

Still one weight, still the same spine as shake/hitstop/kick — but a heavy blow now differs in TEXTURE,
not just length. `HAPTIC_DOUBLE_AT` sits between the heaviest normal blow (the special, t=.53) and the
lightest KO (t=.625), so thump-THUMP means *someone went down*, not *that was big*.

### The floor test immediately caught me doing it again
First draft made the leading beat `HAPTIC_MIN_MS*0.8` = **36ms** — under the floor. thump-THUMP would
have been felt as plain THUMP with the first beat silently missing. Same bug as #29, four lines later,
in the very function written to fix it. The floor is a hardware fact; nothing dips under it "a little".

**751/751.** Mutation-tested: the floor back under the threshold, the first beat dipping under, no double
beat at all, and everything doubling — all caught.

---

## 2026-07-15 (o) — Fullscreen

Chrome on Android parks its URL bar and the system nav over the canvas. `goFullscreen()` now rides the
**first touch** — because `requestFullscreen` needs user activation and Chrome does **not** count gamepad
input as activation (the Gamepad API is polling; there's no event carrying a gesture). So: one tap, then
the pad takes over. Same gesture `initAudio()` already needed. Landscape locks only after the promise
resolves, since the spec requires fullscreen first.

**It asks once.** If she exits fullscreen deliberately, dragging her back on the next tap would be the
game arguing with the player. `computeLayout` already runs on resize, so the re-fit was free.

`document.documentElement` **did not exist in the harness sandbox** — nothing had noticed, because the
only code that touches it runs from a real tap. The first test to call it crashed the suite. Added, along
with `fullscreenElement`.

**745/745.** Mutation-tested: asking on every tap — caught.

---

## 2026-07-15 (n) — The gamepad. It was never wired.

### The device has hall-effect sticks. The game was handing it a virtual thumbstick.
An on-device probe (the target is a **Retroid Pocket G2**, not the RP5 the docs claimed) reported
`Xbox Wireless Controller (Vendor: 2022 Product: 3002)` — **standard mapping**, the easiest case there
is. And `grep getGamepads` returned **0**. Every feel change shipped today — the four-direction punches,
the whole-swing root, the ±30 lateral band, the input buffer — was tuned through an input device that
isn't the one being held.

### Why it could never have worked, even if someone had tried
The phase dispatch lived INSIDE `keyAction`, behind `if(!keyboardControls) return`. And
`keyboardControls = (pointer:fine) && !("ontouchstart" in window)` — **false on every touchscreen**. A
handheld with real sticks is a touchscreen. Extracted to `primaryAction()` / `secondaryAction(id)`, which
touch, keys and pad now share instead of keeping three copies.

### The pad
`padVec(axes, buttons)` and `padEdges(now, prev)` are pure and tested; `padGet`/`pollPad` touch navigator
and the loop and stay thin. Sticks + d-pad into the same `joy`, applied after the keyboard so a live
stick wins and an idle one leaves touch alone. **Deadzone on the MAGNITUDE, not per-axis** — per-axis
makes a diagonal need a bigger push than a cardinal and walking diagonally goes sticky (a mutation to
per-axis is caught). Diagonals normalised so they aren't faster than cardinals.

### Polled BEFORE the hitstop gate
`update()` is skipped during the held frame, so polling inside it would eat any press landing in a
hitstop — which is exactly when you're mashing. #19's buffer then holds it until the gate opens.

### B is deliberately unmapped
Android routes B to system BACK; on the reporter's device it **exited the host app**. The Gamepad API is
polling, not events — there is no press to `preventDefault`. Code cannot fix this: it needs a fullscreen
browser or PWA, which is what PARKED already says. A test pins B as unbound so nobody helpfully maps it.

### The Claude chat can't host this
The artifact iframe never gets the pad — input goes to the Android UI. Confirmed on device, not guessed.

**742/742.** Mutation-tested: per-axis deadzone, no deadzone, level-triggered instead of edge, B mapped,
and diagonals unnormalised — all caught.

---

## 2026-07-15 (m) — Determinism probe: is lockstep multiplayer possible?

### The instrument
`docs/tools/determinism.js` boots the built game **twice**, in two isolated VM contexts, with **two
different clocks** (device B starts 9.13s later and runs 1.7% fast — two machines, booted at different
times). Feeds both identical scripted input at a fixed 60Hz step, snapshots the sim state every frame,
and names the first frame and field where they disagree.

    node docs/tools/determinism.js [frames] [--seeded] [--verbose]

`--seeded` hands both devices the same seeded LCG for Math.random — it simulates the world where the
obvious fix is already done, so whatever still diverges is the work nobody would have found by reading.
Floats are compared EXACTLY, on purpose: desync starts as one ulp and compounds.

### The answer: yes, and the list is one item long
- **as-is:** diverges at frame 71 — `spawnT` / customer `type`. Math.random picking the patron.
- **--seeded, day only:** 900 frames identical.
- **--seeded, walking the BRAWL drunk:** diverges at frame 378 — `chef.x`, **261.50329466090255 vs
  261.5045820561468**. A thousandth of a pixel.
- **--seeded, after the fix below:** **1800 frames identical** across day + drunk brawl + punching.

So: seed the 63 sim-side Math.random calls, put the loop on a fixed step, and two devices run the same
game. No state serialization, no host authority, no interpolation.

### The bug it found
`updateBrawl` steered the drunk-drift off **wall-clock**:
`Math.sin(performance.now()/450 + B.driftPh)` — feeding `chef.x`. That's a real bug single-player too:
frame-rate dependent and unreproducible. Now on `B.driftT`, a sim clock (`*2.2222` keeps the old rate —
the original read ms, this reads seconds). 64 performance.now() calls in the file and this was the only
one touching sim state; the rest are animation frame-pickers.

### The day-only run was a lie, and the probe said so
900 frames "identical" — because the scripted player never entered a brawl, so never touched the drift.
The probe's own caveat ("evidence, not proof: only what the scripted input walked") is the honest part.
Widened to seed a brawl and chug to WASTED, it found the bug immediately.

### And the harness test for it was vacuous twice over
First version ran the drift twice and compared — but `performance.now()` is `() => T`, a controllable
clock, so both runs saw the same instant and the mutation restoring the wall clock left all **729
green**. A determinism test that never moves the clock cannot fail. Fixed by advancing T between runs
(9130ms, same trick as the probe) — which then needed `__advanceClock` exposed to the sandbox, because
T lives in the harness module and the tests run inside the VM.

**729/729.** Mutation-tested: the wall clock restored, and driftT frozen — both caught.

---

## 2026-07-15 (l) — The stand-in fist is gone

`drawChefFist` drew a 3px glove blob — her purple `#8a5aa0`, his red `#c8452e` — plus trailing motion
lines, over the chef on every punch. It was a #12 stand-in from when there was no punch art and the swing
was a single frozen pose. Real art has shipped for a while (jab 3 frames, cross 6, roundhouse 7, uppercut
7), so the blob has been riding on top of animation that already shows the punch.

It was also hardcoded `side = dir==="right" ? 1 : -1`, so #28's four-direction punching would have had it
throwing a fist sideways during a north swing. One call site, one function, nothing else referenced it.

Verified gone via the recording ctx (`work/fistprobe.js`): zero glove rects and zero outline rects in a
mid-punch frame, facing right and facing up. **726/726** — unchanged, which is itself the note: nothing
ever tested it. A stand-in nobody pinned, drawn over the thing that replaced it.

---

## 2026-07-15 (k) — Combo cadence: the game stops eating your presses

### Half the spec was already satisfied — by construction
The handoff warns: define the gaps in POST-HITSTOP time, because `stopMult()` scales hitstop by state
(drunk x2.13, buffed x1.25), so a raw-time cadence silently changes rhythm per state. Checked before
building: the loop is `if(!paused && !tickHitstop(dt)){ update(dt); ... }` — **update() is skipped
entirely while frozen**, so punchT, comboT and the new buffer are all already sim time. Nothing to fix.
A test now pins it rather than leaving it to luck.

### The other half was real: a press mid-swing was thrown away
`if(brawl.punchT > (buffed?0.05:0.08)) return;` — the input just vanished. Mash and most of your presses
did nothing; the combo only advanced if you happened to tap inside the tail window. You played to the
animation, not the rhythm. Now an early press is **remembered** (`PUNCH_BUFFER` 0.16s) and spends itself
the moment the gate opens.

### It buffers; it does not accelerate
The gate is untouched, so the cadence still comes from the ART (3-frame jab fast, 7-frame roundhouse
slow). Measured: **3 swings from 30 presses vs 3 swings from 4 presses** over the same 0.5s. Mashing
gains nothing — it just stops losing what you already pressed.

### Two clears masked a real bug
`updateBrawl` cleared `bufT` right before calling `chefPunch()`, which also clears it. Redundant state,
and it hid the mutation: deleting chefPunch's clear changed nothing on the buffered path, but left a
press landing exactly ON the gate still armed — one press, two swings. One clear now, in the function
that owns it (a press is spent when it becomes a swing).

### A test that could only ever confirm the bug
The first mash counter scored a swing whenever `punchT` differed from last frame — which is every frame,
since it decays continuously. It reported **30 swings from 30 presses**: exactly the failure it was
written to detect, from a counter that couldn't return anything else. A new swing is punchT jumping UP.

**726/726.** Mutation-tested: back to discarding the press, the buffer removing the gate, the buffer
never expiring, and the buffer left armed after firing — all caught.

---

## 2026-07-15 (j) — The device buzzes

### The last channel off the spine
`impact(w,dx,dy,x,y)` already ranked one weight into shake, hitstop, camera kick, sparks and sfx. The
motor is just another consumer of the same number, so a jab and a KO can't buzz the same — for exactly
the reason they don't shake the same:

    jab             w=0.50  ->  17ms    shake+4.50
    cross           w=0.60  ->  19ms    shake+5.40
    roundhouse      w=0.72  ->  22ms    shake+6.48
    jab KO          w=1.00  ->  27ms    shake+9.00
    roundhouse KO   w=1.22  ->  31ms    shake+10.98
    +3 bodies       w=1.60  ->  38ms    shake+14.40

`HAPTIC_MIN_MS` 8 to `HAPTIC_MAX_MS` 38, clamped both ends (weight space has headroom above HIT_MAX by
design, so the curve must not run off with it). ONE buzz per blow, never one per body — the spine already
collapses a multi-body swing into a single impact() call, and haptics inherits that for free.

### Where it will and won't be felt
`navigator.vibrate` is **Android-only** — iOS Safari has never supported it. Target is the RP5 (Android
13, PARKED.md), so it should land there **as a PWA**; inside the Claude chat's artifact iframe it may be
blocked by permissions policy and simply do nothing. Unverified from here: whether the RP5 has a motor at
all. Guarded three ways (no navigator / no vibrate / the call throws) so every one of those cases is a
silent no-op, never a broken fight.

### For once, a feel channel that IS testable
Every other one is a colour or a pixel and needs the recording ctx. This is an API call: stub
`navigator.vibrate`, count the calls, read the durations. So it gets behaviour tests, not constant
checks.

### The harness needed a motor
The sandbox's `navigator` was `{userAgent:"node"}` — no vibrate, i.e. an iOS device. Strip the guard from
buzz() and the FIRST impact() anywhere in the suite throws, long before the haptics tests run: the
harness crashed instead of failing, printing no cross, reading as "not caught". The sandbox now models a
device WITH a motor and one test deletes vibrate explicitly to cover iOS. Same species as the tint test
that threw earlier today, and the documented iflashes[0].w trap.

**714/714.** Mutation-tested: a flat buzz for every blow, the clamp dropped, the guard dropped, and
haptics off the spine entirely — all caught.

---

## 2026-07-15 (i) — She can punch north and south

### The art was always there. Nothing could reach it.
Both chefs have had front/right/back for jab/cross/roundhouse/uppercut/takingpunch since generation —
decoded into FIGHT_IMG on every single launch. **No code path could ask for front or back.** Three places
collapsed the facing to left/right, and one of them OVERWROTE `chef.dir`: face north, throw a punch, and
you were silently turned sideways toward the nearest enemy. The north/south frames had never been on
screen. This is a **code-only** change — no new art, no new bytes.

### The punch is a vector now, not a sign
Everything hung off one horizontal `s = +/-1`: the hit test (`rel=(e.x-chef.x)*s`), knockback
(`e.kbx=s*K, e.kby=0`), the camera kick (`impact(w, s, 0, ...)`), the spark spray, and the lunge (`s2`
was literally **0** when facing up/down — no drive at all). All now ride `PUNCH_AXIS[chef.dir]`, and the
box ROTATES onto the facing: PUNCH_REACH along it, PUNCH_YBAND across it.

### Same numbers all four ways
A north punch reaching 24px of DEPTH sounds long — y is foreshortened. But PUNCH_YBAND already makes
**30px of y** punchable laterally, so 24 along that axis is strictly less than what it already allows.
The foreshortening was priced in the moment the lateral band went to 30. One rule, not four.

### Resolution, verified per facing
up->back and down->front, with real frames for every move (jab 3, cross 6, roundhouse 7, uppercut 7,
takingpunch 6). left->right + mirror, as designed. The one real hole stays covered by fightDir's
fallback: chefF has no takingpunch/right, which resolves to front.

### The draw was the third place, and the tests couldn't see it
`drawBrawl` computed its own `dir` inline and collapsed it the same way. drawBrawl can't run headless, so
a mutation putting the collapse back **passed all 702 tests** while the north/south art went unused
again — the exact bug, invisible. Hoisted to `chefFightDir()`, which the draw and the tests both call.
**Third time in one day** (camMatrix vs loop, catSprKey vs catSprite): if it can't run headless, the
logic can't live inside it.

### The backtick trap, again
A comment in the new tests contained backticks. The test block is a template literal, so it terminated
early: SyntaxError, no PASS line, whole suite dead. It is in the house rules, it killed the session that
wrote iflashes, and it caught me too.

**705/705.** Mutation-tested: the facing collapsed again, the box not rotating, knockback flat, the lunge
losing its vertical drive, and the draw collapsing — all caught.

---

## 2026-07-15 (h) — The punch gets its lateral reach

### "I can only hit people directly in front of me"
The punch box was `Math.abs(e.y-chef.y)<14 && rel>-5 && rel<24` — three magic numbers inline in
chefPunch. Measured shape (chef facing right): **dx [-4,+22], dy [-13,+13]**. So the lateral band was
half the forward reach: you had to line up on depth to connect. **PUNCH_YBAND 14 -> 30.** New shape:
dy [-29,+29], wider to the sides than it reaches in front, which is the point.

### Square corners, on purpose
NOT a radius. A circle tapers the lateral reach as forward distance grows — it would pinch exactly where
the complaint was, so you'd still only really hit what's dead ahead. The corners stay: full lateral reach
at full extension. A test pins it (the corner sits outside any circle through the same band).

### Named, and the test stops keeping its own copy
`PUNCH_REACH` 24, `PUNCH_BACK` 5, `PUNCH_YBAND` 30. The one test that touched the arc had
`const ARC = 24;  // rel<24 in chefPunch's hit test` — **its own copy**, so retuning the code would leave
it asserting the old value. It reads `PUNCH_REACH` now.

### Reading the constant creates the OPPOSITE false green
With every assertion re-derived from `PUNCH_YBAND`, a mutation narrowing it back to 14 **passed all 681**
— the tests moved with it. Copies drift; references move. Both hide a change. So one test pins the value,
and pins it to a REASON rather than a number: **the lateral reach must exceed the forward reach**, and the
band must be at least a body wide (~30px characters). At 14 vs 24 both fail; at a sneaky 25, the second
still fails.

### Two corrections made along the way
The enemy's `hypot(...) < 13` looked like the depth bug next to the chef's box. It isn't: a circle r=13
already limits them to ~±13 laterally, the same as the chef's old ±14 — and swapping it for a box would
have made their reach **1.37x BIGGER** (531px^2 -> 728px^2, +40 cells of diagonal, minus nothing). Nearly
shipped that as a "fix". The real asymmetry is REAR reach: the punch goes 5px behind her, their circle
reaches ~12px behind — that's "they hit me from anywhere", and it's untouched.

**683/683.** Mutation-tested: the band back to 14, the band at a sneaky 25, made circular, the band
ignored, and facing ignored — all caught.

---

## 2026-07-15 (g) — The chef actually commits to a punch now

### It was rooted for 45% of the swing, and the other 55% was yours
`updateBrawl` rooted her with `if(B.punchT > B.punchDur*(1-LUNGE_WINDOW))` — the OPENING 45%. The
recovery is the **longer half**: a 270ms jab was 121ms committed and **149ms steerable**, a 630ms
roundhouse 283/347. Hold the stick and you walked through every punch you threw. That was the floatiness.
The original comment argued steering had to return "so it never feels like a stun" — but the commitment
IS the weight, and it's a swing, not a stun.

### One constant was doing two jobs, which is why it couldn't just be widened
`LUNGE_WINDOW` gated the root AND the forward drive. Setting it to 1.0 to root the whole swing would have
driven her for the whole swing too — a roundhouse dash of **29px**. Split: **the root is the whole
swing**, `LUNGE_WINDOW` is now ONLY the drive window. Measured travel per swing, unchanged from before:
jab 6.1px, jab 6.1px, cross 11.5px, roundhouse 13.8px. Steering returns the frame the swing ends.

### Three green tests were watching this the whole time and saw nothing
`"the lunge actually carries her forward"` was literally `LUNGE_SPEED > 0`. `"the punch commits before it
recovers"` was `LUNGE_WINDOW > 0 && < 0.6`. `"the lunge is a step, not a dash"` was `LUNGE_SPEED < 84`.
**All three assert on constants**, so they pass no matter what `updateBrawl` does with them — which is
exactly how the chef shipped steerable through half of every punch under a green suite. Replaced with
tests that hold the stick through a real swing and measure where she ends up. The travel one matters
most: the constant version stayed green with the drive running the whole swing (a 29px roundhouse dash).

**672/672.** Mutation-tested: the old 45% root restored, no root at all, rooted-but-no-drive, the drive
running the whole swing, and LUNGE_SPEED doubled — all caught. None of them were caught by the old tests.

---

## 2026-07-15 (f) — Four ingredients get sprites

### Picked from the 64 candidates
`f1`=lettuce, `f2`=tomato, `f3`=rawlobster, `f27`=chicken. **whiskey / gin / sourmix have no candidate
in the batch** — no bottles were generated — so they keep their procedural glasses. The null-fallback
makes that free: a missing key just draws as before, so the table is allowed to be partial.

### The raw lobster is red art and raw lobster must be BLUE
`drawRawLobHeld` is `#3a4f7a` with the comment "raw (blue) lobster", and the cooked dish is red — the
**blue->red shift IS the raw/cooked tell**. Red raw art reads as a finished dish sitting in the ice box.
Fixed at ingest with a **205deg hue rotation** (`rawlobster@205=f3.png`). Packed result: median hue
**204deg**, mean RGB **[24,83,131]** — against the procedural `#3a4f7a` = [58,79,122].

### Why NOT the runtime tinted()
That was the first attempt and it produced **purple**. `tinted()` hardcodes `globalAlpha=0.5`, so it
blends *halfway* to the target: 50% blue over a red lobster measured out at RGB **(90,54,91)**. Red->blue
is too far for a half blend. A hue rotation moves the colour and leaves the shading alone, so it still
reads as the same object lit the same way — and baked at ingest it costs no runtime and no tint cache.
`tinted()` stays right for small nudges (the angry-customer red flash); it is not a recolour tool.

### New: `ingest local … key@hueDeg=path`
Per-key hue rotation at pack time, alongside `--height` / `--snap`. Whole batch: **1306 chars**.

### A test that CRASHED instead of failing — the documented trap, again
The tint test read `ING_TINT.rawlobster.slice(...)`. Drop the key and that THROWS: the harness aborts,
prints no cross, and a grep for ✗ reads it as "not caught". Exactly the `iflashes[0].w` species from
2026-07-15a. Index defensively. (The tint is gone now, but the lesson isn't.)

**666/666.** Mutation-tested: the tint dropped, tinted the wrong way, and the `artReady` guard dropped —
all caught once the test stopped throwing.

### Honest limit
The blue is verified by measuring the packed pixels, not by a test — decoding a PNG inside the harness is
out of scope, so the test pins only a weak proxy. Re-check with: read `art/0852_ingredients.b64`, decode
`rawlobster`, median hue should be ~204.

---

## 2026-07-15 (e) — The DRINK button stops lying

### Dim means "you can't use this". It was dimming while it worked.
`drawBrawlButtons` dimmed DRINK to `rgba(90,50,44,.6)` whenever `brawl.drinking`. On a tap that read as
"wait a sec". On an **8-second hold** it says *disabled for the entire time you're holding it* — the
feedback inverted the moment the input changed. And the button right above it settles the grammar: the
SPECIAL dims **only on cooldown**, i.e. only when it genuinely can't be used. DRINK now stays bright.
She isn't blocked, she's swallowing.

### The ring, borrowed from the SPECIAL
`chugFrac()` 0..1 sweeps a ring around the button, same visual grammar as the SPECIAL's cooldown arc (a
sweep = a thing completing). It's not a readout — it's the state of an action you're taking and can act
on (keep holding, or let go), which is the test the UI strip applies. **And it makes the acceleration
visible for the first time:** `nextChugTime()` shortens every rung (2.2 → 1.9 → 1.6 → 1.3 → 1.0), so
each gulp's ring sweeps faster than the last. The ladder, drawn. Label goes `...` -> `GULP`.

### Verified where the harness can't reach
The fix IS a colour, and the harness ctx is a Proxy that discards writes — so no test can see it. Checked
with the recording ctx instead (`work/btnprobe.js`): DRINK's fill is `rgba(224,103,78,.9)` both idle and
mid-chug, identical, with `chugFrac`=0.409 at 0.9s into a 2.2s gulp. NB `final5.js`'s recorder captures
`arc()` with its style; `roomshot.js`'s no-ops it — which is why buttons never appeared in a roomshot.

### Two tests that passed for the wrong reason
Both mutations initially slipped. `drinkTarget=0` with `drinkT=0.5` gives **Infinity**, not NaN — the
clamp turns it into a full ring and a test accepting 1 never notices the guard is gone; 0/0 is the real
NaN case. And with `drinkT=0` the divide gives 0 whether or not the `drinking` check exists, so "no ring
when idle" passed with the state check deleted — only a **stale** drinkT can see it. Then the fixed test
asserted the mutant's answer (1) instead of the real one (0.5/CHEF_DRINK). Pick the input that can tell
the two apart, then check the expectation against the code rather than the guess.

**659/659.** Mutation-tested: the ring always full, the clamp dropped, the divide guard dropped, and the
state check dropped — all caught.

---

## 2026-07-15 (d) — The cats get their sprites (sit/walk only)

### What was actually wired
The v3 rotations, **east/west only**, for both cats. `cat.dir` is `+1/-1` — the cat logic has no
north/south facing at all, so the front/back rotations have nowhere to plug in and aren't packed.
**SLEEP and GROOM stay procedural**: there is no art for them (never generated), and a static sprite
would have the cat sleeping standing up. The hand-drawn loaf and paw-up survive. `catSprKey` routes;
`artReady` gates; no art -> the procedural cat, byte-identical to before.

### Pre-scaled at ingest, not at draw
`ingest local <n> <key=path> --height 9 --snap` — a new mode: pack sprites from DISK, trim to the opaque
bbox, downscale to an exact height. Both cats cost **~1.4KB** against a ~4MB ceiling. Three reasons it
happens at ingest: the masters are a ~45px cat inside 92px of mostly padding; that padding is **20-29px
below the feet and VARIES per direction**, which is exactly what had the chef rendering at 12px and
bobbing (see 2026-07-15a); and the game flips `imageSmoothingEnabled=true` for detailed art (~1194), so
a 5:1 downscale at draw time would BLUR it.

### --snap: keep the palette, keep the coverage
A plain LANCZOS 5:1 turns a 7-colour cat into **73 shades of grey**. Nearest keeps 5 colours but drops
thin features. `--snap` resamples smoothly then forces every pixel back to a colour that existed in the
SOURCE: 3 colours for the tuxedo, 11 for the orange, at 10x9 and 11x9.

### The size panic was wrong
This was nearly not wired at all, on the grounds that the art couldn't survive 9px. That came from
measuring `tux3_south` — 23x45, which downscales to **5x9** — and concluding the cats needed to be
bigger. `south` is a view **the game cannot display** (`cat.dir` is +/-1). The views it uses are
east/west: **10x9 and 11x9**, i.e. exactly the procedural cat's footprint. The "mush" was LANCZOS, not
the art. Two wrong objections from one unchecked worst-case number.

### The third headless false green today
`catSprite()` was one function: state routing + `artReady()` lookup. Headless, every Image is undecoded,
so it returns null for EVERYTHING — a mutation letting **sleep take a sprite passed all 646 tests**.
Split into `catSprKey()` (pure routing) + `catSprPos()` (pure anchor, takes w/h because naturalWidth is
0 headless) + the lookup. Same lesson as `camMatrix` vs `loop()`, third time in one day: **if a thing
can't run headless, the logic must not live inside it.**

### Line parity, caught by its own test
The first blob carried a trailing newline. A blob replaces a ONE-line marker, so that shifts every line
after it — the exact drift that once moved chefM+1/chefF+1/fight_chefM+2 with nothing failing. Existing
blobs end with `,` and contain zero newlines; `ingest local` now matches. (`cmd_char`'s format string
still emits one — it predates the check.)

**651/651.** Mutation-tested: sleep taking a sprite, the anchor on the canvas instead of the feet, no
centring, facing ignored, the `artReady` guard dropped, and a wrong palette key — all caught. One
mutation failed to APPLY and said so rather than passing quietly.

---

## 2026-07-15 (c) — Sober start, and the drink button is a HOLD

### START_DRINKS 5 -> 0. The open balance call is closed.
The test setting stops shipping. She starts sober, and the ladder is something she climbs mid-fight
instead of a state she's handed. At 5 she began permanently buffed AND instantly WASTED, which made the
entire drink mechanic — and the `stopMult()` x2.13 drunk hitstop #18 tuned around — unreachable in the
build she'd actually play. `devDrinks` still sets any start, so both ends stay feelable.

### Hold to chug
Tapping once per drink made the ladder a typing exercise: five discrete presses for a decision you'd
already made. Now the button chains while held — `chugHeld` + an id-matched release, so a second finger
can't end your chug. **Release only stops the NEXT chug; the one in her mouth still lands, so a tap is
still exactly one drink** — the old behaviour is the degenerate case of the new one.

### The acceleration was already there, and it's the joke
`nextChugTime()` = `max(0.45, 2.2 - 0.3*drinks)` — it was written to make each drink quicker than the
last, which on a TAP you could barely feel. On a hold it runs away from you: 2.2s -> 1.9 -> 1.6 -> 1.3
-> 1.0, so **sober -> WASTED is an 8.0s hold** in a fight lasting 20-30s. The cost is that you're stood
at the bar not swinging, and that cost IS the mechanic. Nothing was retuned; the input just exposed it.

### It reads without a counter, which is why the UI strip was right
There's no drink readout — #18 stripped it. It doesn't need one: the rungs announce themselves
diegetically (the screen warps, control drifts, afterimages smear). That's the exact test the strip
applied — HP survived because it had no diegetic tell, and the drink count went because it had four.

### Fixed on the way past
The button's hit test was gated on `!brawl.drinking`. `BTN_DRINK` sits at x=220, right of the `W*0.5`
punch/move split — so a press landing mid-chug fell **through** to `chefPunch()`. You'd swing at the bar.
The gate was redundant anyway: `chefDrink()` already no-ops mid-chug.

### A test helper that failed 7 tests describing working code
`holdFor` cleared `brawl.enemies` each frame to keep the fight quiet — which WINS it: `outcome="cleared"`,
`updateBrawl` returns early, and the chug silently stalls at `drinkT=0.07`. The code was right the whole
time. Don't sterilise a sim by removing the thing that keeps it running.

**637/637.** Mutation-tested: the chain never starting, the release latching, `START_DRINKS` back to 5,
the hold outliving its brawl, and the chain skipping its `atBar` re-check — all caught, all verified as
applying first.

---

## 2026-07-15 (b) — The camera leans with her

### "Moving should move the camera with me" — mostly it can't, and the reason is the zoom
The floor is baked at exactly WxH with no bleed, so the only thing keeping black off the screen edge is
the crop `COMBAT_ZOOM` buys: **35.2px**. Shake+kick already spend up to 31.2 of it (`SHAKE_MAX` 15 +
`HIT_MAX*KICK_PER_W` 15.2 + 1). **Camera travel and shake are the same 35.2px, spent twice.** That caps
the pan at ~±28px against her 300px walk band — 19%. A real follow needs z≈2.13 (a 150×84 room). So this
is a LEAN: `LEAN_K=0.35` of her offset from centre, eased at `LEAN_EASE`, hard-clamped.

### The clamp is the feature; LEAN_K only decides how the travel is SPREAD
The clamp hands the camera ~28px no matter what `LEAN_K` is. K=1 (a true 1:1 follow) spends it inside
56px of her band and pins to the rail for 81% of the room; K=0.35 spreads it over ~160px. Raising K
doesn't follow harder — it pins sooner. The first test of this ("the lean never reaches her") was a
**false green**: it passed at K=1, because the *clamp* guarantees that whatever K is. It was measuring
the clamp.

### The budget is not monotone, and the obvious story was wrong
Asserted first, and the tests killed it: "it gets loud, the budget collapses, the camera locks" is
**false**. `camZoom` maxes over both axes and **H is the tight one**, so once the safety binds it
over-crops X — a heavy blow BUYS horizontal pan. ±28.0px at rest → **minimum ±16.8px at off≈14.7**
(exactly where COMBAT_ZOOM hands over to the safety) → **widest ±29.8px under the heaviest blow.**

### The loop is untestable, so the camera moved out of it
With the math inline in `loop()`, a mutation reverting the transform to the old centred form **passed
all 618 tests** — the camera could be deleted and the suite stayed green, because `loop()` never runs
headless and the harness was modelling its arithmetic by hand. Now in `camMatrix()`, called by both.
The first fix *still* passed the mutation: every test read `camX` (correct under it) while the loop
draws with `e`. **Test the output, not the input.**

### The rasterizer has been blind to the camera this whole time
`roomshot.js` recorded `setTransform: () => ops.push(["ident"])` and `room_raster.py` tracked only
translate — **the camera matrix was discarded**, so every render showed the room at 1:1, no zoom, no pan.
Every "I looked at it" for a camera-dependent change was worthless, including #18's COMBAT_ZOOM pass.
`work/cam_raster.py` keeps the matrix and is unit-checked against a known transform. (It also emerged
that the recorder discards `fillText` — so "no text ops" proves nothing about a HUD, and no render has
ever shown text.) Related: don't measure a pan by correlating renders — walls are a tile grid, floors
are planks, and the correlation aliases by exactly one plank. Test whether the PREDICTED shift explains
the image instead.

**623/623.** Mutation-tested: no clamp, `LEAN_K`=0, `LEAN_K`=1, the transform ignoring the pan, the
vertical dropped, the sign flipped, the clamp reading the raw `sx` (the strobe trap), the clamp ignoring
the zoom, and the lean removed from `update()` — all caught, all verified as applying first.

---

## 2026-07-15 (a) — Combat weight: the fight stops being floaty

### The chef was 12px and floating
`drawFighter` anchors at `feetY - canvasHeight`, and the canvases carried **20-23px of transparent padding
below the feet** — so he rendered at 12px (not the intended 24) and hovered ~6px off the floor. chefF's
padding *varied* 13-28px per frame, so she bobbed vertically as she walked.
All chef/fight frames are **bottom-trimmed to 0px below the feet**. `CHEF_SCALE` now targets ~30px of
CHARACTER, not canvas. Art got *smaller* doing it (1.58MB -> 1.54MB).

### Knockback: the 5px was load-bearing, and raising it flatly would have been a bug
`BRAWL_KNOCK = KNOCKBACK*12` settles at **~5px of travel** — measured, and the reason knocked bodies never
reached the wall plants (30px closest, 16 needed). It reads as floaty: you hit someone and they don't move.
**But the punch arc is 29px wide and holds combo range** — launch a body 15px and it leaves the arc, so a
flat raise trades the float for a broken combo. A test caught exactly that.
Per-move instead: **`MOVE_KNOCK` — the jab HOLDS them (5px), the finisher SENDS them (17px).**

### Root + lunge
For the opening `LUNGE_WINDOW` (45%) of a swing you don't steer, you commit — and the punch drives her
forward at `LUNGE_SPEED`. Rooting alone reads as a mannequin; movement *toward* the target at contact is
what reads as force. Steering returns for the recovery so it never feels like a stun.

### Impact flash
`iflashes` — a weight-scaled white-hot cross at the contact point, 85ms. Everything the spine did before
(shake, kick, hitstop) was global; **nothing said HERE.** It lives on the spine, so all 10 call sites got
it free. (`flashes`/`flash()` already existed and are the floating TEXT pops — third name collision this
session, after COMBO_WINDOW and this.)

### The brawl UI is stripped
In service the HUD earns its bar — money, day, rating, orders. In a fight it was a black band across a
180px room reporting things you can't act on mid-punch. **Gone: wave count, enemies-left, round timer,
drink counter, the opaque band.** Kept: HP (the one thing with no diegetic tell — it pulses under 25%) and
the GO-LIVE banner, which is an event, not a readout. No special locale frame: the monsters already recast
per locale, so the locale is on screen throwing punches at you.

### Combat zoom + more hitstop
`camZoom` is now AUTHORED with the safety as a floor: `max(COMBAT_ZOOM, safety)`. `COMBAT_ZOOM=1.22`
already covers max shake on its own, so the safety term stops binding.
`STOP_PER_W` .085 -> .11, `STOP_MAX` .30 -> .42. **Paid for by dragging the combo out** (`FIGHT_FRAME_MS`
52 -> 90: jab 270ms, roundhouse 630ms). Those are the same budget — duty = stop/(cooldown+stop) — so a
faster combo and a heavier freeze are drawing on one account. The 52ms jab was *faster* than the old fixed
220ms swing and blew the budget; a test caught it.

### A test that crashed instead of failing
The flash test read `iflashes[0].w` on an empty array, so the mutation made the harness **throw**, not
fail — printing no cross and reading as "not caught". Same species as the syntax-error trap: no test ran
at all. Index defensively. (Also re-learned: no backticks in probe comments, the probe is a template
literal. It's in the house rules. I did it anyway.)

**607/607.** Mutation-tested: a jab that launches them out of combo range, a finisher that doesn't send
them, no flash at contact, a lunge that becomes a dash, and unbounded flashes — all fail their own tests.

## 2026-07-15 — The fight animations were wired and unreachable

161 frames generated overnight, loaded into `FIGHT_IMG`, reachable by `pickFightFrame` — and **the draw
called `pickFightFrame(chefSet,"jab",...)` with the move hardcoded.** 33 of 40 frames could never render.
`cross`, `roundhouse`, `uppercut` and `takingpunch` all existed and nothing ever asked for them.

Not a mistake by the previous session: ADDENDUM 01 put move selection in Task 3, and the handoff says one
task then stop. It wired the art and stopped, exactly as told. The ordering was mine.

### What changed
- **`FIGHT_COMBO = ["jab","jab","cross","roundhouse"]`** — advances per swing, resets after
  `FIGHT_COMBO_WINDOW` (0.62s). Named FIGHT_* because `COMBO_WINDOW`/`combo`/`comboTimer` already exist
  and are the **service tip chain** (2.2s) — nothing to do with fighting. Nearly collided.
- **The cadence IS the frame counts.** jab 3 frames, cross 6, roundhouse 7, at `FIGHT_FRAME_MS=52` ->
  156/156/312/364ms. Repeatable but not regular, and it can't drift from the art because it's derived
  from it. `moveDur()` falls back to the old fixed 0.22s for any move with no art.
- **`takingpunch` finally plays.** Driven by the `hurtFlash` that a hit already sets (line ~2092) — no new
  state. `HURT_DUR` is pinned by a test to match it, because two constants that must agree and live 1000
  lines apart will drift.
- **`drawFighter` learned to mirror.** The FIGHT art is front/right/back only; nothing in this codebase
  mirrored a sprite before (the walk cycle has real `left` art). Left = flipped right.
- `MOVE_DMG`/`MOVE_W`: the finisher lands heavier and hits the impact spine harder.
- **`uppercut` is generated and deliberately left OUT** — it wants to be the special, which is a gameplay
  decision, not art wiring. Pinned by a test so it reads as a choice, not an oversight.

### Two false-greens, caught by mutation, same shape as always
- **"left stops mirroring" wasn't caught.** `fightDir`'s fallback loop resolves left->right on its own, so
  the test passed whether the mirror line existed or not. Extracted `shouldMirror()` — the decision the
  draw actually makes — and tested that instead.
- **"combo never resets" wasn't caught.** `FIGHT_COMBO[0]` and `[1]` are BOTH `"jab"`, so asserting
  `move === FIGHT_COMBO[0]` compared jab to jab and passed either way. Now asserts `comboStep === 0`.

### Verified by fighting, not by testing
The suite cannot see any of this: images never decode headless, so `pickFightFrame` always returns null and
every draw-path test proves nothing. A roaming brawl sim with the **real cooldown respected** (forcing
`punchT=0` each frame makes the chef a blender that kills everything before it can hit back — that's how
`takingpunch` read as dead):
`{jab:625, cross:612, roundhouse:714, takingpunch:31}`, uppercut 0 by design.
Spawns are random, so `takingpunch` is fight-dependent — 0 in one run, 31 in the next. Same lesson as the
plant collateral: a single simulated fight proves very little.

### Line parity had silently broken — src and built were 4 lines apart
`src=4510, built=4514`. The whole point of the `__ART__` marker design is that src and built share line
numbers ("line refs stay valid forever"), and **every line ref in every doc depends on it**. The asset
ingest wrote blobs with trailing newlines — chefM +1, chefF +1, fight_chefM +2 — and each one shifts every
line after it. Round-trip still passed. Nothing failed. Docs written against those refs were quietly wrong.
Blobs flattened; **two tests now pin it** (line parity, and no blob may contain a newline), mutation-tested
by putting a newline back. Not caused by this session's edits — the previous commit was 4309/4309.

**593/593.** Mutation-tested: hardcoded jab, one fixed duration for every move, a fast finisher, no
mirroring, a combo that never resets, and HURT_DUR drifting — all fail their own tests.

### Still open
`chefPunch()` picks the move; **nothing else about cadence changed.** Gaps in the art are real and handled
by `fightDir` (chefM has no `uppercut/front`, chefF no `takingpunch/right`, no `left` anywhere).
**`CHEF_H={chefF:0.88, chefM:1.56}` is still a 1.77x fudge** existing only because chefF was generated at
136px and chefM at 88px. Regenerate chefF at 88 and that constant deletes.

## 2026-07-14 — TABLES: the dining set is cast by the locale, and every table gets a candle

Five tables, six sets. Alien pod-stems in NEBULA, rattan in OCEAN SUNSET, chrome with a pink underglow
in NEON CITY, branching coral UNDERWATER, timber trestles in AURORA PEAKS, and a hovering hard-light
slab in WARP SPEED. `tableStyle(env)` is the pure decision; the pedestal shape is a per-style branch.

**Tables MATCH within a locale** — one style, five tables. A restaurant has a *set*; jittering each table
procedurally would read as junk-shop furniture rather than her dining room. The variation is across
locales, not across the room.

### This overrides a design read, on purpose
Her call, recorded so it can be revisited: the previous position was "one restaurant parked in front of
six skies" — her furniture stays hers, only the light changes. Full recast means **the room itself
travels**, not just the view. Consequence: the cat is now the *only* fixed point in the building, so she
carries that whole job alone. (See DECISIONS.)

### The lighting inconsistency that prompted this
`buildFloor` already pools the locale's colour onto the tile and the wood — the nebula genuinely lights
her floor. Then it stopped dead at the furniture: tables were hardcoded `#6b4a2e` in every locale. The
room was lit by the sky and the tables never got the memo. Recasting fixes that by construction.

### Candles
Every table gets one, and the candle is **hers, not the locale's** — same warm flame in a nebula as
underwater. Flicker is two out-of-phase sines so it never ticks in a visible rhythm, and the phase is
offset per table (`s.x*0.37`) so five candles don't pulse in unison.
- **Found by rendering:** the halo was two nested rects — a 14x13 square of 6% orange, dwarfing a 16x8
  table. At 320x180 that reads as a faint *box with corners*, not glow. It's now a stepped diamond
  (widths 3-7-9-9-7-3) for the same six fillRects.
- `CANDLE_DX=5` keeps it clear of the plate zone (the dish draws at s.x-4..s.x+4 while eating), pinned by
  a test and mutation-tested at 0.

### Constraint worth remembering
The table draws at `s.y+6`, **in front of** the seated customer — it's what hides their legs, which is why
there are no chairs. Any future table must stay ~16 wide and must never grow up over a face.

Verified by isolating tables+candles against a table-less render of the same locale: 725-885px each,
**all six sets render differently**, collision unchanged (still exactly `TABLE_R` in every locale).

**548/548.** Mutation-tested: one style everywhere, and a candle on the plate, both fail their own tests.

## 2026-07-14 — The room is alive: motes, drifters, weather, and a cat

Four ambient systems, same rule as the plants: hug the architecture, read per-locale, need no collision.

### Motes in the light
The window spill and the two warm pools were **already baked into FLOOR_CV** — static light reads as
texture, not as light. Motes live *only* where that light already is, so they make the existing lighting
look deliberate instead of competing with it. Nothing floats in the dark.
Per-locale motion via `moteDrift(env)`: OCEAN embers rise, AURORA sinks like snow, UNDERWATER plankton
barely climbs, the rest just hangs.
- **Found by rendering:** the first cut scattered motes across the whole canvas and lit whichever
  happened to drift through a pool. 22 motes produced **5 visible pixels**. They're now *born* in the
  light and each wraps inside its own lit band, so none can wander into the dark and switch off. 5px -> 24px.

### Something drifts past the window
A jellyfish (UNDERWATER), a freighter with lit windows (NEON CITY), a bird (OCEAN/AURORA), a comet
(NEBULA/WARP). `driftAt(t)` is pure — the clock is the only input — and ONE world x is shared by every
window, so it passes *behind* the frames as a single continuous thing rather than four sprites.
**12s crossing every 38s: the sky is empty ~68% of the time.** Rarity is the whole effect. The first cut
was 13-in-26 — on screen half the time — and the test caught the comment disagreeing with the constant.

### Weather on the glass
`glassKind(env)`: frost creeping the corners (AURORA), rain running down (OCEAN **and NEON CITY** — a
neon city without rain was an open goal), condensation (UNDERWATER). **NEBULA and WARP get nothing:
vacuum doesn't rain**, and leaving their panes clean is what makes the others read as *somewhere*
rather than as a filter over everything.

### The cat
Everything else in this room is native to the sky outside. The cat is just the cat — same tabby under
every locale, the one fixed point in a restaurant parked in front of six different skies.
Sleeps (a loaf, tail wrapped), wanders, sits, grooms, blinks, works her tail. Not solid: you can walk
through a cat, and a cat will not tolerate being walked around. She has **no effect on any system** —
she's the room being alive, not a mechanic. She bolts for the door when the riot starts, because a cat
would, and she's back on a stool in the morning, because a cat would.
Ticked from the top of `update()`, before it early-returns on brawl/night — bolting is the one thing she
must still do when the room goes to hell.

### Two false-greens, same shape as always
- **A vacuous test.** I spied on `X.fillRect` to prove the vacuum locales draw nothing. The harness `X`
  is a **Proxy that discards writes**, so the spy never installed and the assertion counted zero of
  nothing — it would have passed no matter what `drawGlass` did. Only its paired "...or the check above
  is vacuous" guard exposed it. Fixed by extracting `glassKind()` as a pure decision, like `plantParams`
  and `moteDrift`. **Every pure-decision function in this codebase exists because a test lied first.**
- **A test measuring the wrong object.** "The cat is not solid" checked her at her spawn — which is a
  *perch on a stool*, and stools are solid. It was measuring the stool. Now checked on open floor, with a
  guard asserting the spot really is open.

Mutation-tested: motes in the dark, uniform drift, a never-empty sky, a frozen cat, a cat that stays for
the riot, a cat that never returns, a cat that wanders onto the cook line, and rain in space — all fail
their own tests. **541/541.**

## 2026-07-14 — PLANTS, take 2: off the floor and onto the architecture
> "they're just pots in the middle of the floor"

Fair. The first pass placed plants by *collision safety* — which meant open floor, which reads as
obstacles someone left out rather than a room that's been planted. Greenery lives on architecture.
Three families now, ~1000px of it, **100% on the border** (measured, see below):

| family | where | solid? |
|---|---|---|
| `floor` | 2 pots ONLY, tucked 6px off a wall | yes |
| `hang` | 4 ceiling baskets, tendrils falling across the window band | no |
| `vine` | 4 runners down the side margins + 2 creepers on the bottom edge | no |

- **Ceiling baskets drape over the locale view.** Tendrils fall past the windows and drift on their own
  phase, so the greenery is silhouetted against the nebula/ocean/aurora. That ties the plants to the sky
  they came from, which is the whole conceit.
- **The side margins were free real estate.** `x<FLOOR.x0` and `x>FLOOR.x1` are drawn but unwalkable, so
  vines there cost zero play. Same for the bottom creepers below `FLOOR.y1`.
- **Only hanging/wall greenery is decor; only floor pots are solid.** Nothing in the air needs collision,
  which is why the count could go up while the gameplay risk went *down*.
- Floor pots dropped 6 -> 2. The left wall has exactly one legal slot: the office door owns y100..126 and
  the chef needs the corner, so a third pot there would have blocked the partner's exit.

### A basket rendered its rope and lost every tendril
`drawHangers()` runs inside the wall layer, but `drawBarBack()` runs **after** it, and the liquor cabinet
owns x222..304 of the north wall. The basket at x=276 painted its rope and then had every tendril
overwritten by the cabinet's back panel. Nothing threw; it just silently drew half a plant.
**Only rendering the room caught it** — no test would have. Hangers moved off the bar, and the overlap is
now pinned (`BAR_BACK_L/R`), mutation-tested by putting a basket back behind the cabinet.

### Tooling: the room is now renderable
`work/roomshot.js` + `work/room_raster.py` record **per-canvas** op streams and composite `drawImage`,
so the baked `FLOOR_CV` (which reaches the screen as a blit) rasterises instead of vanishing. Diffing the
room against a **bare room of the same locale** isolates greenery pixels exactly. That is how the 100%
border figure and the starved-tendril bug were both found. Sprite art still doesn't decode headless.

Measured per locale, greenery vs a matched bare room:
NEBULA 1003px, UNDERWATER 1037px, AURORA 897px — all **100% on the border**, all correctly themed.

**517/517.**

## 2026-07-14 — PLANTS: procedural greenery, native to the locale
Six plants in the front of house. Seeded, procedural, **a different species per locale**, solid in
service, wrecked by the riot, and back the next morning.

| locale | species |
|---|---|
| NEBULA | glowing pod-stalks |
| OCEAN SUNSET | palm, arcing fronds off a trunk |
| NEON CITY | snake plant, upright blades |
| UNDERWATER | kelp, wavy ribbons, no pot |
| AURORA PEAKS | conifer, stacked tiers + snow caps |
| WARP SPEED | crystal shards |

- **Same contract as `genMonster`:** seeded LCG, cached on `ENV+":"+seed`, so the existing View row
  regenerates the entire room's greenery for free — the locale rebake hook already existed.
- **Front of house ONLY, on purpose.** A solid object on the cook line would tax the timing game for no
  thematic gain, and nobody puts a fern next to a fryer. Every spot is a dining edge.
- **Damage comes off the impact spine, not the enemy AI.** `impact()` already knows a blow of weight w
  landed at (x,y) — that IS collateral. No raid targets, no new enemy states, nothing to keep in sync.
- **Broken = not solid**, so a fight progressively opens the room up as it ruins it. Back at `startDay()`
  (stations still carry their wrecks over; plants don't — service replaces a pot, not a fryer).

### Solid decor is the kind that can quietly wall off a station
Two tests exist for that: **clearance** (no plant within PLANT_R+TABLE_R of any station, ingredient, pass
slot, stool, bench, door, trash, bar, office door or pass gap) and a **flood-fill reachability** check that
walks the day-walkable room and asserts every anchor is still gettable. Mutation-tested with `PLANT_R=46`.

### Found by building it
- **A plant flush to the FLOOR edge traps the chef.** `resolveChefCollision` pushes her out and the FLOOR
  clamp on the very next line shoves her straight back in, so she stands inside it forever. The corner
  plant was 5px from `FLOOR.y1`. Moved, and pinned: every plant must sit >= PLANT_R inside the bounds.
- **`sfx("break")` doesn't exist.** `sfx()` is a switch with no default, so a misspelled sound is a
  **silent no-op that never throws**. Added a real "smash" sound, and a static test that every `sfx()` name
  in the source has a matching `case` — this class is now closed for good.
- **The bar was never reachable, and never was.** `BAR` sits at y=30, above `FLOOR.y0=46`: it's a wall
  cabinet used from `BAR_RADIUS`, not a floor tile. My reachability model was wrong, not the room.
- **My flood-fill only visited even coordinates** (step=2) and reported the salad station at x=123 as
  walled off. The test was broken, not the game. Distance-to-visited-set now, not a rounded grid probe.

### The feature was inert in real play, and only an end-to-end fight showed it
The unit test passed by hitting a plant point-blank — which never organically happens. A simulated fight
wrecked **0 of 6, every time**: the brawl lives mid-room, the plants line the walls, and a punch never
lands within SMASH_R of one. Two fixes came out of that:
- **Bodies take the greenery out**, not just punches (`KB_SMASH_SPEED`/`KB_SMASH_W` in the knockback
  integrator). A body flying into the ficus is the better moment anyway.
- Contact radius raised 16 -> 20 (`PLANT_SMASH_R`), which is the plant's own ~11px footprint plus a
  little. Not more: past that, pots start shattering from across the room.

**Measured, 8 simulated roaming fights: 0,0,0,2,1,0,2,0** — about 40% of fights wreck one or two. That's
deliberate collateral, not a guarantee, and it's a taste call flagged in ROADMAP: if she wants the riot to
reliably trash the room, the honest lever is *plant placement* or *knockback distance* (a blow currently
moves a body only ~5px), NOT a bigger radius.
Worth noting the earlier "0/6 every time" readings were partly **run-to-run variance** — spawns are
random, and 5 of 8 fights genuinely wreck nothing. A single simulated fight proves very little here.

### The AURORA conifer shipped as six identical trees
Its only random call was the height, so all six plants in the room were the same tree. **No test caught
this — rasterising the 6x6 grid did**, because the rect counts were 33,31,32,32,33,31 while every other
locale ranged 60-140. Now genuinely procedural (tiers, width, snow cap).
The first fix for it *also went green while proving nothing*: `plantParams` returned a generic bag of
fields, and the ones the conifer branch never reads (`stalks`, `lean`) kept varying and masked the frozen
shape. Each species now returns **only the fields it actually uses**, so the variation test has teeth.
That's the third false-green this session — the pattern is always the same: the assertion never reached
the thing it claimed to check.

**512/512.** Mutation-tested: blocking a stool, un-soliding plants, never resetting them, walling off the
room, freezing AURORA, and growing one species everywhere all fail their own tests.

## 2026-07-14 — The drink smears time (hitstop scales with chef state)
Hitstop now scales with the chef, not just the blow: `stopMult()` = buffed x drunk, applied inside
`impact()` so it can't drift per call site. Drunk reads through **`wastedAmt()`** — the same 0..1 the warp
and afterimages use — so the freeze eases out exactly as the wobble does instead of snapping when the
window closes.

| state | mult | jab | 3-clip | jab KO | heaviest | mash duty | clip duty |
|---|---|---|---|---|---|---|---|
| sober | 1.0 | 43ms | 70 | 85 | 136 | 16% | 24% |
| buffed | 1.25 | 53ms | 87 | 106 | 170 | 29% | 40% |
| WASTED (5) | 1.47 | 62ms | 102 | 125 | 200 | 32% | 44% |
| WASTED (9) | **2.13** | **90ms** | **148** | **181** | **289** | 41% | 53% |

### The budget, which is the whole design here
Hitstop freezes the **entire sim**, and `punchT` only decays while unfrozen — so the real gap between
punches is `(cooldown + stop)` and the sim's duty cycle is `stop/(cd+stop)`. The buffed cooldown is only
132ms (`0.22*BUFF_CD`), which is the tight case: get this wrong and mashing while drunk becomes a
slideshow. `STOP_DUTY_MAX=0.55` is now a named constant next to the tunables, because it's the line
between impact and lag, and it's tested across every chef state — not left as a thing someone remembers.
Worst sustained case measured: 53%.
- **`STOP_MAX` raised 0.16 -> 0.30** so nothing saturates: the heaviest drunk blow is 289ms. A binding cap
  would flatten the top of the ranking, which is the exact bug the impact spine exists to prevent.
  (0.16 was already non-binding *sober* — the multiplier is what would have made it bite.)
- **Ranking is monotonic in every state**, not just sober — tested across the whole roster x 3 states.
- **Phase-gated.** `stopMult()` returns 1 outside `phase==="brawl"`, or a stale drunk `brawl` object would
  smear the daytime scuffle hours later. Tested.
- Self-limiting, incidentally: when you mash as fast as the freeze allows, duty converges (39% sober vs
  40% drunk in a simulated fight) because a longer freeze buys fewer punches. It can't run away.

### A false green worth recording
Adding the multiplier, the suite went **477/477 green while proving nothing** — every existing hitstop test
runs from the menu, where `stopMult()` is phase-gated to 1. The feature had zero coverage and the tests
said it was fine. New tests explicitly `startBrawl()` first. Green means nothing if the test never
reaches the code.

**489/489.** Mutation-tested: reverting the feature, dropping the phase gate, blowing the duty budget,
re-binding STOP_MAX, and making the drunk freeze snap instead of ease all fail their own tests.

## 2026-07-14 — DRUNK VISION: the room breathes, the chef smears
**Finding: being wasted was mechanics-only.** `isWasted()` drove damage, speed, drift and wildcard
punches — and the screen never said a word about it, apart from one blinking HUD label. You felt it in
the controls and never saw it. Two effects, one source of truth.

- **`wastedAmt()` (0..1)** — the single pure function every drunk visual reads, same reason `tipHeat()`
  and `idleAmt()` exist: the wobble you SEE can't drift from the wobble you FEEL. Ramps in with drinks
  (`WASTED_DEPTH`), eases out over the window's last seconds (`WASTED_FADE`) so it never snaps off
  mid-frame. Clamped 0..1 — a negative amt would mean negative alpha and a negative warp amplitude.
- **Wave warp** — the world is copied and re-blitted as 45 horizontal strips on a travelling sine,
  amplitude `WARP_AMP*wastedAmt()`. A post-process, because `X` is a `const` and the world can't be
  redirected into a buffer. Runs only while wasted; **never touches the HUD** — she has to be able to
  read her own health while the room is swimming.
- **Afterimages** — up to ~9 ghosts of past chef positions, alpha `GHOST_ALPHA*fade*wastedAmt()`.
  Standing still stacks them into a woozy double image; moving drags a trail. One mechanism, both reads.

### The edge trap, again
Shifting a strip sideways leaves a gap at the screen edge — the *same* class of bug as the shake, and
**the punch-zoom cannot help**, because the warp runs after the world is already pixels. Each strip is
drawn `k` wider on both sides, where k is its largest possible excursion, so it spans `[off-k, off+w+k]`
which contains `[0,w]` for every `|off|<=k`. The ~4% stretch that buys is invisible inside a wobble.

### Two tests that passed for the wrong reason (found by mutation, not by luck)
- **`GHOST_MAX` never bound.** The steady-state trail is `GHOST_LIFE/GHOST_EVERY` (~9), so a
  steady-state count could never exercise a cap of 12 — the test was decoration. The backstop is now
  enforced every frame (not once per push, which isn't a bound at all) and tested by flooding the array
  directly. Same non-binding-cap trap as `STOP_MAX` last commit; worth watching for.
- **The isWasted/wastedAmt agreement test only checked `WASTED_AT-1`,** where the depth term is already
  zero. It sailed past a mutant that made `wastedAmt()` go negative further down. Now sweeps every drink
  count x timer combination and asserts 0..1.
- Noted: after clamping depth with `Math.max(0,..)`, the early-return guard became redundant, so
  weakening it is an **equivalent mutant** — no test should fail on it, and none does.

### Honest limitation
The ghosts are the first thing this session I could **not** put an eyeball on: sprite art doesn't decode
headless, so `drawChar` no-ops and the frame records 0 drawImage calls. Verified instead by spying the
draw path — 0 calls sober; 8 ghosts wasted at x=144.3..163.2 with alphas 0.06..0.66 ascending to the
newest; `globalAlpha` restored to 1 afterwards; the whole trail dims together as the window closes.
The warp is verified by maths only (offsets, coverage, amplitude scaling). **Both want a real look on a
phone before they're trusted.**

**477/477.** Mutation-tested: dropping the strip overdraw, making the fade snap, letting `wastedAmt` go
negative, removing the ghost backstop, and stacking ghosts on the chef each fail their own test.

## 2026-07-14 — FIX: the wave-eating NaN + the juice crank
**The second wave wasn't coming, and it was my bug.** Last commit's unified knockback set `e.kbx` on
normal enemies but left `e.kby` undefined. The integrator does `e.y + e.kby*dt` -> **`e.y` becomes NaN
on the first punch**. A NaN y fails every `Math.abs(e.y-chef.y)<14` hit test *forever*, so the enemy
becomes invisible AND unkillable, `alive` never reaches 0, the wave never clears, and wave 2 never
spawns. Found by simulating an actual fight (punch the nearest enemy, 60fps, 180s) rather than
force-killing enemies — the old probe set `state="ko"` directly and sailed straight past it.
- Fixed at the punch site (`e.kby=0`) **and** in the integrator (`const kx=e.kbx||0, ky=e.kby||0`) — the
  bug class is "half-set impulse pair", so the integrator must not be poisonable by whoever sets it next.
- Regression: 4 tests + a full simulated fight that must reach `cleared`. Fight now clears 3 waves in 14.8s.

**Juice: cranked hard, on purpose.** This is what the impact spine was for — "way more" is a handful of
constants, not 30 call sites, and the ranking stays monotonic BY CONSTRUCTION.
| | jab | heaviest blow | sparks | hitstop |
|---|---|---|---|---|
| before | 1.7 shake | 5.4 (at cap) | 11 | 26..64ms |
| now | **4.5** (the old *maximum*) | **14.4** | **59** | **43..136ms** |
- `impact(w,dx,dy,x,y)` now takes the contact point and sprays weight-scaled directional sparks from it
  (plus fast leading shards), so every blow gets them for free and they can't drift from the ranking.
- **PUNCH-ZOOM (`camZoom`).** Not decoration — a fix the crank *required*. The baked floor is exactly
  WxH drawn at (0,0) with **no bleed**, so any camera offset exposes cleared canvas at the edge. At the
  old +/-4 that was a hairline; at +/-15 it would be a black band tearing the room off the screen. Zooming
  crops the frame to cover the offset (H is the binding axis at 180). Verified by sweeping *every*
  reachable camera state: worst floor-vs-viewport margin **+1.43px**. The fix is the juice.
- Zoom is driven by the **smooth** shake magnitude, not the per-frame random `sx/sy` — zooming on those
  would strobe the room 60x/sec instead of punching in and settling.
- **`PARTICLE_MAX=520`.** Peak measured at 652 in a real fight = 652 fillRects/frame on a phone. Trimmed
  once per frame, oldest first, so the newest (the ones you just caused) always survive.
- **Verified: 456/456.** Mutation-tested: re-introducing the NaN fails 4 tests; `ZOOM_SAFETY=0.5` fails the
  coverage tests; overlapping dev rows and a START BRAWL that covers the resume text each fail their own test.
- Retired a test that pinned `STOP_MAX<=0.12`. It was pinning the wrong number — the cap was never binding
  (`HIT_MAX*STOP_PER_W`=136ms is). Now asserts what matters: a jab stays snappy (<60ms), the heaviest blow
  holds <=150ms and is a real hold, not a flicker.

**FLAGGED, NOT CHANGED — `START_DRINKS=5` is a test cheat that is shipping.** Its own comment says
"test/preview — set 0 for a sober start". It starts *every* brawl with the chef 5 drinks deep: `buffT=1e9`
(permanent buff), instantly WASTED -> sluggish, heavy control drift, wildcard punches that randomly
half-damage or instant-KO. It makes the drink mechanic (chug at the bar to buff) meaningless, because you
start maxed. This is a balance call on her game, so it's untouched — but it's now a dev-menu row
("Start drinks", 0-9) so both can be felt back to back. **Awaiting a decision.**

## 2026-07-14 — DEV: a fight menu in pause (hotspots retired)
Hotspots are undiscoverable and you have to remember them. Replaced the title-corner brawl hotspot and the boot-into-brawl flag with a real menu under **pause**, gated behind one `DEV` flag.
- **Waves (1..9)** and **Enemies/wave (1..24)**, plus **START BRAWL NOW** — which seeds a representative full house (5 patrons incl. The Critic, so spectators / GO-LIVE / critic stakes all fire) and drops straight in.
- **The overrides are LITERAL.** `spawnWave` had `Math.max(3, Math.round(WAVE_SIZE*brawlSizeMult()))` — a floor of 3 *and* rep-scaling — so a naive menu would show "1 enemy" and spawn 3, or shrink your 12 to 5 because the rep was good. `waveSize()`/`waveCount()` bypass both when set, and are `null` (shipping rules, untouched) when not.
- **Inert, not merely invisible, in her build.** The row rects are only assigned inside `drawDevMenu()`, which only runs when `DEV` — so they stay `null` and a tap can never land on one. Pinned by tests on both the flag and the null rects.
- **Input gotcha logged:** in the pause handler *any* unhandled tap resumes the game, so every dev row must `return` — including taps on the middle of a row, or nudging Waves would un-pause you.
- **Verified: 428/428.** Mutation-tested: leaking the menu into the ship build, shipping `DEV=true`, and clamping the size override to the old floor each fail their own test. Layout checked by rendering the real overlay (rows at y=103/119/135; START BRAWL bottom=150, clearing the resume text at ~150) — 320x180 has no room for guessing.
- **A mutation reported "not caught" and was lying:** replacing `if(DEV) drawDevMenu();` with `drawDevMenu();` left a dangling `else`, so the script never parsed and no test ran. A grep for failures showed none. Mutations must stay syntactically valid, and the run must be checked for `syntax OK` — not just an absence of failures.

## 2026-07-14 — JUICE: the fights get a spine (one weight, every channel)
Asked for "way more juice and impact when fighting." The fights didn't need more feedback — they needed feedback that **ranked**. Five channels (shake / sound / particles / knockback / hitstop) were hand-tuned across ~30 call sites with no shared scale, so the ordering had quietly **inverted**.
- **What was actually shipping.** The special (`SPECIAL_DMG=3.75`, the biggest move) fired `addShake(3.4)` **on the button press, before any contact test** — so hitting thin air shook harder than landing a jab (0.8) — and then added **exactly 0.0 on contact**. `addShake` capped at 4.5, so clipping 3 rioters (6.6 requested) and **STUMBLE** (the worst thing that happens to you) both rendered as 4.5 — identical. A perfect salad (2.6) out-shook a landed punch (2.2).
- **The fight had no voice.** 12 sounds in `sfx()`, **zero combat**. So it borrowed the kitchen's and lied about what happened: a landed punch played `"serve"` (the plating chime), a KO played `"cheer"` (applause for a good dish), taking one in the face played `"burnt"` (**the burnt-food sound**), every swing played `"grab"` (the pick-up-an-item blip), and striking Brandon — a man holding a gun — played `"perfect"`, **the perfect-dish arpeggio**. Same disclosure bug as the static green bar, in the audio channel.
- **The spine: `HIT` weights + `impact(w,dx,dy)`.** One ranked scalar per blow derives shake, hitstop, camera kick, sound pitch and spark direction. A heavier hit is now bigger **by construction** — verified monotonic on **every channel** across the whole roster (scuffle 1.02 → jab 1.70 → hurt 2.55 → 3-body clip 2.79 → special 2.89 → jab KO 3.40 → STUMBLE 4.08 → special KO 4.59 → special KO ×3 5.44), and **nothing is pinned to the cap** any more, so the ranking is real rather than clamping.
- **Feedback follows contact** (now a locked rule). Activation shakes are gone; a whiff is quiet, which is what makes it a whiff.
- **HITSTOP.** The genre's single strongest impact primitive was absent. The architecture already proved itself: `if(!paused) update(dt)` — freeze the sim, keep rendering. 17ms on a scuffle → 88ms on a triple-KO special. `tickHitstop()` is split out of the loop so it's testable (the loop never runs headless), and a test pins that the freeze **always ends**.
- **Kick ≠ rumble.** Shake was isotropic random jitter; nothing pointed anywhere. Blows now kick the camera along the force and settle. Sparks fly along the punch (`burst` gained `ang`/`spread`; omitting them keeps every old call site's full-circle spray, pinned by a test).
- **Both knockback models unified.** Riot enemies got a real impulse; normal ones got `e.x+=s*5`, an instant teleport with no reel — half the roster had no weight. Same impulse model now, derived as `BRAWL_KNOCK=KNOCKBACK*12` because the integrator settles at ~v0/12 — **measured, not guessed** (v0=60 → 4.73px), so the legacy 5px spacing that keeps the punch comboing is preserved exactly.
- **An existing test caught the change and was right to.** "normal enemy keeps the old instant knock" pinned the behaviour deliberately. Rather than fudge it, the test was rewritten to assert the invariant it was actually protecting — the ~5px displacement and the `rel<24` combo range — and the first rewrite **failed because the chase AI contaminated the measurement**; it now holds `reelT` open to isolate the impulse.
- **Brandon + the daytime scuffle are on the spine too.** The scuffle is deliberately the lightest blow in the game (`HIT.scuff`): the tone doc says the riot is the ceiling, not lunch. The pistol whip was a raw shake of 5.0 — above the old 4.5 cap, so raising `SHAKE_MAX` would have made it louder **by accident**; it's now exactly a STUMBLE, which is what it is.
- **1 more literal retired:** `SHAKE_DECAY` (the bare `14`, copy-pasted at **5** sites).
- **Verified: 409/409**, stable across 6 runs (several paths roll `Math.random`). **Mutation-tested:** restoring each original bug — special-contributes-nothing, shake-on-button-press, never-ending hitstop, rumble-instead-of-kick, over-tuned knockback — fails exactly its own test. **One test was caught passing for the wrong reason**: the special-KO ranking survived its mutation because the hidden activation `addShake(3.4)` was stacking into the cap; the fix added an explicit "neither is pinned to the cap" assertion. Whiff-swipe geometry verified through a recording ctx (x=157 for a chef at 150 facing right, α=0.3125 — correct side, correct fade).
- **Next:** pancakes (#5) is the last of the dish batch. If more juice is wanted, the remaining candidates are a KO slow-mo flourish and per-enemy hit-flash colour.

## 2026-07-14 — THE TICKET RAIL: memory becomes planning
The follow-on the last entry called for. She could not hold 5 orders across a 320×180 room, so she couldn't pre-cook — the best feeling in the genre was locked behind remembering. **The rail already existed** (a 4-line stub in `drawHUD`) and had the *exact* disease the bubble had: a **static green top bar** encoding nothing. Same disclosure bug, second scene.
- **The finding: heat and patience are ONE clock.** `advanceDialogue()` sets `c.orderT` and `c.hearts=3` on **adjacent lines**, so both are pure linear functions of the same age — `tipHeat` dead at **12s**, `hearts` dead at **30s**. Same number, two zooms. That settled the design by itself: **two bars would be one fact printed twice**, and a heat-only bar would sit **empty for 18 of every ticket's 30 seconds** — a meter that's blank 60% of the time is the old bug wearing a new hat.
- **One bar, two channels, no redundancy.** **Length = the whole 30s life** (it empties exactly as they walk, so it is never dead); **colour = the 12s tip burning off** (gold → grey → red under 20%); **a notch marks where the tip dies**. Because it's one clock, the notch is recoverable from length alone — hue is a *landmark*, not information, so it still reads without colour. The P-legibility double-coding rule holds.
- **The notch MOVES.** Comfy Stools slow the drain to 0.78× (life → 38.5s) but don't touch the 12s window, so the notch slides **40% → 31%**. `tipNotch()` computes it. A hardcoded `0.4` would have quietly lied to anyone who bought the upgrade — caught by a test that fails on exactly that mutation.
- **Cover is allocated one-for-one.** 3 lobster tickets + 1 lobster on the pass = **1** covered, not 3. Marking all three would make her **under-cook**, which is strictly worse than the double-cook this fixes.
- **The render caught a design bug the tests were happy with.** First pass dimmed every "handled" ticket — including one whose dish was **already plated on the pass**, i.e. the fastest money on the floor. Greying that out told her to ignore the one thing she should sprint at. **The pass is the second hand** (locked decision); a rail that hides the pass hides its own reason to exist. `inFlight()` now splits **`ready`** (plated / finished in hand → full bright + green tick, *go*) from **`cooking`** (on the heat → recedes to 0.55, hands off). Burnt is deliberately not cover: a burnt lobster is a problem, not a serve.
- **Stable by construction.** Sorted by `orderT`, which *is* hearts order (one clock) — so "most urgent first" and "never reshuffles under her hand" are the same sort. Anchored left off `STOOLS.length`, so tickets don't slide when one clears.
- **Pure functions, per the `tipHeat`/`idleAmt` precedent:** `ticketLife()` · `tipNotch()` · `inFlight()` · `railTickets()`. Decisions out of the draw code, so bar and tests can't drift.
- **2 more literals retired:** `HEARTS_MAX=3`, `PATIENCE_DRAIN=0.10` — and the walkout now reads the same constant the rail divides by, pinned by a test that drives the **real** `update()` loop.
- **Verified: 362/362** (311 prior + 51 new). **Mutation-tested, not just green:** hardcoding the notch, marking all tickets covered, counting burnt as cover, and divorcing the drain from the constant each fail exactly their own test. Harness gotcha logged: `update()` drains from `dt` but `tipHeat` reads `performance.now()` — the harness freezes the clock, so a test must advance **both** (`__tick` + `update`) or they silently diverge. Visually verified by rasterizing recorded draw ops through a **separate recording ctx** (you still cannot monkey-patch the harness ctx) across 5 lives × ready/cooking.
- **Tone held:** nothing tightened, no blinking, no nagging. The rail only *reports*. Cosy floor, ambitious ceiling.
- **Next:** wire in customer sprites (#10) or pancakes (#5). The rail makes pancakes land better — a 3-step dish is only fun if you can see the queue you're planning against.

## 2026-07-14 — LEGIBILITY: the game stops hiding what it rewards
Loop analysis, from the actual constants. The loop isn't shallow — it's **silent**. The pressure ladder is already well-tuned: **patience 30s / speed tip 12s (+50%) / combo 2.2s**. The player could see **none of it**.
- **The smoking gun.** The speed tip is the biggest per-serve lever in the game (+50%) and its only mention was `flash("FAST!")` **after the plate landed**. She learned she was fast once it was too late to be fast. A disclosure bug, not a design gap — the balance was fine, nobody told her.
- **The order bubble is now a tip meter.** That static green top bar was already there doing nothing; it now **cools gold → grey over 12s** and depletes. Every ticket on the floor visibly carries money *right now*, so triage is real: hit the gold one, Nana's went grey. **Double-coded** — the bar shrinks *and* changes colour, so it reads at 320×180 without relying on hue.
- **The chain shows the clock it's racing.** `CHAIN xN` gained a depleting 2.2s meter that **reddens under 35%**, so a chain breaks with warning instead of silently. Players can now learn chains exist.
- **`tipHeat(c)` — one source of truth.** Pure function; the bubble, and the tests all read the same answer, so the meter can't drift from the payout. (Same lesson as `idleAmt`: pull the decision out of the draw code.) `mixHex()` for the cool-down lerp.
- **`COMBO_WINDOW=2.2`** named; 2 hardcoded literals retired.
- **Deliberately NOT done: a second carry slot.** Nearly recommended it, then the numbers argued back — one hand + a 2.2s chain window means the *only* way to chain is pre-staging on the pass, which is what the 4 pass slots are for and what pass theft prices. **The pass IS the second hand, and it costs something.** Better than two hands, already built, just undiscoverable.
- **Tone held:** nothing was tightened. 30s patience stays generous — the safety net is what makes it cosy. Hustle lives in the opt-in tip. Cosy floor, ambitious ceiling.
- **Verified: 311/311** (301 prior + 10 new): heat is 1 fresh / 0.5 at half window / 0 stale / never negative, un-ordered = 0, **a hot ticket really does pay more than a cold one** (meter can't lie about money), mixHex ends + midpoint, named window, chain render. Visually checked across 5 heat levels.
- **Test integrity:** wrote one tautological assertion (`... || true`) that could never fail, caught it, cut it. A green tick that checks nothing is worse than no test.
- **Next:** the ticket rail — she still has to *remember* orders across a 320×180 room, which blocks pre-cooking (the best feeling in the genre). The rail turns memory into planning.

## 2026-07-14 — WORLD FLAVOR: the kitchen idles (steam, shimmer, wobbling plates)
First pull of the "windows" lever since the world pass. Principle: **the windows worked because they gave the room an outside; the office door works because the partner walks through it every morning.** Character = things that behave whether or not she's looking. Stations that only move when used read as furniture — so now they don't.
- **The pot breathes.** `drawSteam()` — 3 wisps that rise, spread, drift on a sine and fade. A pot on the boil is never still: **idle still steams** (gentle), cooking steams hard, burnt smoulders between.
- **The fryer shimmers.** `drawHeatShimmer()` — warm haze bands wobbling up off the oil, present even at idle (hot oil is hot). While cooking, **the oil works the basket**: bubbles rise through it.
- **Clean-plate stack on the pass** (`PLATES`, x=74, the free end of the counter next to the existing condiment bottles). It's set dressing that **reacts**: `nudgePlates()` on **set down** (0.55) and **pick up** (0.3), and a **thief swiping a plate rattles the whole stack** (1.0). Top plates sway most, bottom plate stays put; wobble decays in `update()` and settles.
- **`idleAmt(st)` — the tuning knob.** Intensity logic pulled OUT of the draw code into one pure function: burners only (the salad bar doesn't steam), and **a wrecked station is cold** — broken stations stay dead, which quietly reinforces the brawl's damage.
- **Deliberately faint** (idle steam peaks ~16% alpha) so it reads as ambience, not competition for the READY bars. Dial it in `idleAmt()`.
- **Harness bug found + fixed.** The first spy tests silently failed: the harness stubs the canvas with a **Proxy whose `set()` trap discards writes**, so `X.fillRect = spy` never takes and the spy can't fire. Not a game bug — an untestable test. Replaced with real assertions on `idleAmt()` + render smokes. Worth remembering: **you cannot monkey-patch the harness ctx.**
- **Verified: 301/301** (285 prior + 16 new): idle-pot-steams, boiling > idle, oil shimmers at idle, wrecked = cold, only-burners-idle, plate knock/settle/decay/clamp, thief rattle, render smokes. Visually checked across 4 time-steps (wisps climb, bands breathe, sway decays).

## 2026-07-14 — STRUCTURAL: art split out of the working file (size problem solved)
Follow-on to the read-safety fix. `cd` only *capped* the damage; art was going to keep growing (pancakes alone add flour/eggs/lemon/batter/mix-station/pancake sprites). This removes the problem instead of managing it.
- **New layout.** `culinary-dash.src.html` (**203,801 chars**, no blobs — you edit this) + `art/*.b64` (22 blobs, 802,863 chars — never read) → built to `culinary-dash.html` (~1MB, single self-contained file, unchanged delivery model).
- **Line-for-line split.** Each blob line becomes a one-line marker `/*__ART__ 0812_CUST_SPR_SRC*/`, so **src and built file have identical line numbers** (3262 = 3262). Every existing line ref stays valid.
- **Provably lossless.** `build.py --check` rebuilds and compares md5 against the known-good file: **`43df8c567e04ea5b80fc092f72cb575d` both sides — ROUND-TRIP IDENTICAL.** Not "looks fine" — byte-exact.
- **The actual win — src stays flat.** Dropped a 60,000-char art blob into `art/` and the working file stayed at **203,801 chars, unchanged**. Art can grow forever; the file a session must read does not. Longest src line is now **909 chars** (was 133,113), so plain `grep`/`cat` on the src are safe again.
- **Tools.** `cd grep|show|build|test|map` (`cd test` = build + harness, the new commit gate) · `build.py` · `split_art.py` (one-shot, kept for reference).
- **README rewritten** around the layout + the story of why, so no one re-diagnoses this.
- **Verified: 285/285** via `cd test`. Built artifact byte-identical to the verified `-fixes` build — **zero gameplay change**.

## 2026-07-14 — FOUND IT: why sessions keep crashing (read-safety fix)
Not a game bug — a **read-ergonomics** bug in the repo. Diagnosed by measurement. **Zero game-logic changes.**
- **Cause.** ~800KB of the ~1MB `culinary-dash.html` is base64 sprite data on just **22 lines** (**79%** of the file). Worst single line: **133,113 chars ≈ 33,000 tokens** (`CUST_SPR_SRC`, line 812). Runners-up: `chefF` 114,296 · `chefM` 88,236 (in `CHARS`).
- **The trap.** Base64 is random alphanumerics, so *ordinary* patterns match **inside** the blobs. Measured cost of a single bare command:
  | command | dumped |
  |---|---|
  | `cat culinary-dash.html` | **~251,000 tokens** |
  | `grep 'left'` | **~196,000 tokens** (hits 21 of 22 blobs) |
  | `grep 'idle'` | ~85,000 |
  | `grep 'spr'` | ~76,000 |
  | `grep 'gs8'` | ~68,000 |
  Any one exhausts the context window mid-task and the session dies. You **cannot** dodge it by choosing a careful-looking pattern — `gs8`, a sprite key from this very batch, costs 68k. Demonstrated live during diagnosis: one `grep` for a `const …SRC` pattern matched line 812 and dumped 33k tokens instantly.
- **Fix: `docs/tools/cd`** — a safe reader that hard-truncates every line, so no command can blow up:
  `cd map` (file shape + blob locations) · `cd grep <pat>` (blob hits reported as a **count**, never content) · `cd show a b` · `cd code` (whole game minus art, ~50k tok, readable) · `cd script` (extract JS for the harness).
  Measured: `grep left` **196,134 → 2,549 tokens (77×)** · `gs8` **68,340 → 109 tokens (627×)**.
- **Loud warning at the top of `README.md`** with the cost table, so the next session sees it *before* touching the file. `tools/` and `harness.js` now listed in the docs table.
- **Not a bug (checked):** `chefM`/`chefF` appear in both `CHARS` (797/798) and `PUNCH` (846/847) — **not** duplicated art. `CHARS` holds nested `{idle,w1,w2}` walk frames; `PUNCH` holds single poses. The file is big because it honestly holds ~1MB of sprites.
- **Editing was never the problem** — `str_replace` on code lines never touches a blob. *Reading* is the trap.
- **Verified: 285/285** via `cd script` → harness.
- **Next:** structural fix — **DONE in the commit above** (art split out; working file 204KB; round-trip byte-identical).

## 2026-07-14 — FIX: "crisp gin sour" + moonwalking patrons; parked egg-white sours
Two reported bugs, plus a captured design note.
- **"crisp gin sour" fixed.** The gin sour's descriptor pool had **"crisp"** — a *salad* word — so patrons ordered a "crisp gin sour," the exact cross-dish leak #7 was built to kill. Swapped to clean cocktail descriptors: **botanical / bright and dry / juniper-forward / tart and cold**. No overlap with the salad pool now (guarded by a test).
- **Moonwalking patrons fixed.** The ~78% **procedural** (block) patrons had no legs and no facing, so when they left they **slid** across the floor toward the door. Added a 2-frame **walking gait** — alternating shuffling feet on the ground line + a 1px body bob — for anyone `entering`/`leaving`. Sprite patrons (~22%) already walked; only the blocks were gliding.
- **PARKED — egg-white sours (dry shake).** New idea logged (Roadmap #14, locked in DECISIONS): once **eggs** exist (they arrive with pancakes #5), the sours get an **optional egg white** → a **dry-shake step** that takes **longer** but pays a **higher Beli bump + bigger tip**. Opt-in per drink. Builds with pancakes.
- **Verified headlessly: 285/285** (280 prior + 5 new): gin sour never says "crisp", no salad-pool collision, still has real descriptors, and leaving/entering procedural patrons render with feet (no crash). Existing #7 dialogue-integrity tests still green. Syntax pass.

## 2026-07-14 — NEW RECIPES pt.3b: ice-box ingredient source (#3)
Roadmap #3. Second of the dishes-part-3 batch. Introduces a reusable **`kind:"source"`** station.
- **ICE BOX added** — a dedicated source station (chrome fridge, frosty interior, raw lobster on the ice) sitting on the cook line between the salad bar and the pot. You **grab the raw lobster from the ice box, carry it to the pot, and boil**. This is the new-source-station-kind the roadmap asked for, reusing the existing raw-grab carry (`ing.starts` seeds the dish, `recipeOf` seeds the has-map).
- **The pot is now a pure cooker.** Its co-located raw crate is gone; it only accepts a carried raw lobster and boils it. Adds a real fetch/carry leg for the signature dish (walking is the point — locked decision).
- **Selective, no tedium.** Only the lobster uses a source. The fryer keeps its co-located **chicken crate** — the fast dish stays snappy, per the roadmap's "not every dish" note.
- **Source stations are grab points**, wired into target detection (`kind:"source"` alongside `assemble`). The pre-existing "cooked carry near a raw box doesn't crash" guard now watches the ice box.
- **Verified headlessly: 280/280** (271 prior + 9 new): ice-box-is-a-source, pot-has-no-crate, fetch raw → carry → boil → plate, empty-pot-won't-conjure, fryer-keeps-its-crate. Syntax pass.
- **Next in the batch:** pancakes (#5) — the 3-step signature. The source-station kind lays groundwork for its flour/eggs/lemon sources.

## 2026-07-14 — NEW RECIPES pt.3a: gin sour (2nd cocktail, shared shaker)
Roadmap #4. First of the dishes-part-3 batch.
- **Gin sour added** — a 5th menu item (`gin-sour`, "gin sour"): assemble at the bar, worth the same as the whiskey sour. It spawns in orders automatically (orders pull from `MENU`, which is `Object.keys(DISHES)`).
- **Shaker is now a SHARED station.** The bar went from one drink to two on the same counter. Three sources across the shaker: **gin well (left) · sour-mix carafe (mid) · whiskey shaker (right)**. The **spirit you grab picks the drink** (`ing.starts`): grab gin → gin sour, grab whiskey → whiskey sour. The sour-mix carafe is **common to both** and can't start a drink on its own — you pick a spirit first, then add mix.
- **Recipe-driven assembly.** Dishes now carry an explicit `recipe` (ingredient ids); `recipeOf()` falls back to a station's full crate list when a dish doesn't name one. `ingredientsComplete` checks the dish's recipe, not the whole counter — so a whiskey sour is "done" at whiskey + mix even though gin also sits on the shared shaker. A whiskey-sour in hand won't pick up gin (wrong recipe), and vice-versa.
- **Art.** New `gs8`/`gs24` dish sprites (pale botanical-green liquid + lime garnish) recolored from the whiskey-sour glass so the two cocktails share a look but read distinctly. New in-hand `drawGinHeld` (clear bottle, green pour). Shaker re-drawn to show all three sources, looked up by id (not index) so the layout is robust.
- **Flavor + dialogue.** Gin sour gets its own descriptors (crisp / botanical / bright and dry / juniper-forward). Per-character good/bad lines already pull dish label + adjective generically, so every orderer speaks the new drink with no per-drink wiring.
- **Verified headlessly: 271/271** (257 prior + 14 new): menu/station/recipe wiring, gin→gin-sour and whiskey→whiskey-sour on the shared counter, sour-mix can't-start guard, wrong-spirit reject, finish + serve payout. Syntax pass.
- **Next in the batch:** ice-box ingredient sources (#3), then pancakes (#5, the 3-step signature).

---

## 2026-07-14 — WORLD PASS: environments, office-as-place, locale monsters (commit)
Everything since the p6 zip (~15 builds), newest first:
- **Locale-native monsters.** `genMonster` is themed by the active view (cache per-view): NEBULA/WARP=antennaed aliens, OCEAN=crabs (claws+stalk eyes), CITY=bots (LED visor+blinking antenna), UNDERWATER=jellies (hanging tentacles), AURORA=proper snowmen (3 balls, carrot, stick arms, sometimes a top hat). Rage tint tag now per-locale.
- **Partner uses the office door.** Fights: door rolls open, partner charges out from the doorway, door shuts behind them (`doorT` decay in `updatePartner`).
- **The office is a physical place.** Roll-up "OFFICE" door on the left wall (`ODOOR`, `drawOfficeDoor`, `officeDoorOpen`), drawn in every phase. **Morning intro** each `startDay`: partner walks to the door, it opens (glimpse of lamp + paper tower), they slip in, it shuts (`officeIntro` state machine).
- **Six window environments + dev toggle.** `ENVS[]`: NEBULA (loud drifting nebula clouds + ringed planet + moon + comet), OCEAN SUNSET (sun glitter, waves, sailboat), NEON CITY (seeded skyline, blinking windows, tower beacon, plane), UNDERWATER (light shafts, bubbles, fish), AURORA PEAKS (2 sine ribbons + snowy peaks), WARP SPEED (streaking stars). Pause menu has a **View row** cycling ENV + rebaking floor light pools (per-env pool colors).
- **Space windows + brightness pass.** 4 big windows on the cook-line wall (`WINDOWS`, `drawWallAndWindows`), wall lightened to paneled indigo w/ trims, tile/wood floors brightened, window light pools + warm dining pools baked into `FLOOR_CV`.
- **Procedural 16-bit floor.** Photo backdrop removed. Seeded offscreen build (`buildFloor`): 13px ceramic tile w/ grout/bevel/cracks (kitchen), 6px staggered hardwood w/ 6%-alpha grain, knots, seams (dining); checker fallback.
- **Pass theft.** Food sitting on the pass: 10%/3.5s a shady patron runs in, swipes a plate (lose dish value, combo break, victim −1 heart, 35% they SQUARE UP), flees out the door. Reset per day.
- **Pass counter collision + openings.** Pass is solid (`PASS_SEGS`) with 3 walk-through gaps (`PASS_GAPS`) framed by posts; slots verified on solid counter. Table collision (`resolveChefCollision`, `TABLE_R`) with slide.
- **Real appliances.** Fryer/pot have raw-ingredient crates (chicken / raw blue lobster); cook flow = grab raw → carry → cook → grab dish; `ingredientsComplete` generalization; crash fix: cooked carry near a raw crate (guard on `.has`) + regression test.
- **P4 fights split.** Daytime scuffle (bad-order patrons SQUARE UP, chef fight-stance + KO punches, storm-out on timeout; SCUFFLE_*) and the after-close brawl now **Beli-gated** (`brawlChance`: <7→100%, <8.5→60%, else 25%; `brawlSizeMult` shrinks waves at high rep). Bad ledger still picks WHO returns.
- **P2 partner.** Office desk vignette (paper tower, "doing the books") + auto-fighter tagging into fights (PARTNER_*: charge nearest, punch w/ knockback, blue HP bar, can be downed w/o ending the fight, revives per fight).
- **Occasional sprite patrons.** 6 kept pixellab customers (Liam/Emma/Noah/Ava/Ethan/Sophia) at `SPRITE_CHANCE=0.22`; procedural look is default. (Dreadlocks chef sprite integrated then reverted by request; Lead_Jab parked.)
- **Brandon (day boss).** Dev trigger bottom-left during play. 20-tick bar, guaranteed instant opening shot, crosshair chase (CROSS_SPEED=70), fires/3s, 6-shot mag, reload=strike window, 8% KO chance, **pistol whip** (−50% + cross-room fling), cameras=bigger+faster, medical bills always paid, witness-scaled Beli. Real 8-dir sprite (BRANDON_IMG) facing the chef. Crash fix: boss HUD had brawl-button dependency → own control layer.
- **Keyboard controls** (WASD/arrows, J primary per phase, K special, P/Esc pause; default ON desktop; pause-menu toggle) + **pause button** (top-center, overlay menu) + supersample cap 6→8.
- **Harness now 257/257** incl. render smoke-tests for every phase + all 6 views + themed monsters (added after the Brandon draw-crash slipped logic-only tests; proven to catch reverted bugs).

## 2026-07-13 — Stacking liquor: the drunker the chef, the stronger + weirder
- **Renamed** the chug callout "LIQUID COURAGE" → **"CHEF DRANK LIQUOR!"**
- **Stacking drinks.** You can now chug repeatedly at the bar; each drink stacks a **bigger damage bonus and longer buff** (`drinkDmgMult = 1.4 + 0.25·drinks`). A `x[n]` **liquor-bottle icon sits next to the HP bar** (turns red + pulses when wasted).
- **Buzzed = permanent.** At **3+ drinks** the buff **never expires** for the rest of the fight.
- **Heal decays exponentially.** Each drink heals half the last (`50→25→12→6→3%…`) — past the first couple it's "just power and unpredictability."
- **Control drift grows** with every drink (a wandering steer + jitter on your movement), and **amplifies when wasted**.
- **Chug gets faster** the more you've had (`nextChugTime = 2.2 − 0.3·drinks`, floor 0.45s).
- **WASTED (5+ drinks).** You move **slower**, drift heavily, and your **punches go wild**: a **40% chance each hit to instantly KO *or* deal half damage** (50/50), else a big buffed hit. The wasted state is a **15s window** that refreshes each time you drink at 5+.
- **Starts at 5 drinks** (`START_DRINKS=5`) so the wasted tier is on from the jump — dial to 0 for a sober start.
- **Verified headlessly:** 24/24 (start-state, speed buzzed-up/wasted-down, drift growth, chug speedup, stacking + decaying heal + renamed flash, wildcard ≈40% [20% KO / 19% half / 60% full], no wildcard when not wasted, damage scaling). P2 32/32 + P3 22/22 regressions clean. Syntax pass.

## 2026-07-13 — BUILT: After Hours P3 — bottle-service night (verified)
- **New phase.** The run is now **DAY → (BRAWL if >4 bad orders) → NIGHT → RESULTS.** Wired the phase machine (`update`/`loop`/`onDown` all dispatch `night`); day-close and brawl-end both hand off to `startNight()`; night-end (timer out + floor empty) → results. Night runs **every** game for now (no calendar yet — tunable #5).
- **After-hours vibe.** `drawNightLights()`: room dims, three slow rotating colored light beams (magenta/cyan/gold) + an occasional strobe. HUD flips to a magenta "AFTER HOURS" bar with live **$ bottle sales** and a cyan night timer.
- **Bottle service.** Groups of **2–3 patrons** arrive together, take a table, and order a **$750 bottle** (price bubble + bottle icon + patience hearts). Chef **grabs a bottle at the bar** (new carry, reuses `drawWhiskeyHeld`) and **serves the table** → cha-ching, `+$750` banked into the run's coins; the group parties (`DRINK_LINGER`) then leaves, freeing the table. Context prompt + GRAB/SERVE button mirror the day loop. Un-served groups leave thirsty (tracked).
- **The brawl's teeth.** If the bar was **wrecked** in the brawl (`BAR.broken`), the night is **dead**: a "BAR'S WRECKED — NO BOTTLES TONIGHT" sign, no groups spawn, **$0**. Makes defending the bar in the fight matter to the wallet — exactly the P3↔brawl link from the prod plan.
- **Results v1.5.** End screen now shows the **after-hours line** ($ in bottles + count, or the wrecked-bar $0) alongside day coins / Beli / brawl outcome.
- **Verified headlessly:** 22/22 P3 checks (day→night handoff, group arrival/seating, grab+serve = +$750 banked, linger→leave→table free, timer→results, wrecked-bar dead night, full brawl-KO→night chain, all draw paths) + P2 regression 32/32. Syntax clean. File ~752KB.
- **Not yet (P4/P5):** the **riot** (bottle-chugger → drunk-baseline multi-wave brawl reusing P1) and the polish/balance/results-v2 pass.
- **Note:** the dev title-tap still rushes straight to the test brawl (→ then night). The normal **day→night** path (no brawl) is built + verified but only reachable in a real day; say the word to flip the title tap back to a normal day start.

## 2026-07-13 — BUILT: Brawl P2 (flavor) — spectators, GOING LIVE, whiskey teeth, critic stakes (verified)

## 2026-07-13 — BUILT: Brawl P2 (flavor) — spectators, GOING LIVE, whiskey teeth, critic stakes (verified)
- **Spectators/recording tables:** at brawl start, seated diners are captured as filmers — a 55% chance each (`SPECTATE_CHANCE`), and **critics always stay** (they never miss a meltdown). The rest of the room scatters; recorders are drawn at their table with a raised phone + blinking **REC** dot (procedural, no art). `drawSpectator()` added; spectators y-sort into the fight.
- **GOING LIVE:** once per brawl, `LIVE_DELAY` (6–13s) in, a random recorder shouts "I'M GOING LIVE" (LIVE badge + banner) → mob **full-heals**, renders **+20% bigger** (`MOB_SIZE`), hits **+25% harder** (`MOB_DMG`), and swaps to a **RAGE red tint**. Tint is a cached offscreen source-atop wash (`tinted()`), works on both sprites and polygon monsters; new waves after it fires spawn pre-raged.
- **Whiskey buff now has teeth:** chugged (`buffed`) enemies actually move faster (`BUFF_ESPD 1.4`) and hit harder (`BUFF_EDMG 1.5`) — was cosmetic before. A punch/special on a mid-chug enemy **interrupts** it ("SPILLED!"). An already-lit enemy that returns to the bar **smashes it** — `BAR.broken` → red-X'd cabinet, no more enemy chugging **and no chef heal/drink** (defend-the-bar dynamic; seeds P3's dead-bar economy).
- **Critic stakes:** if a critic filmed the fight — **lose (KO) → Beli −3** (`CRITIC_LOSS`, tunable #3); **win** → Beli **rises, time-scaled** (fast clear up to +4, slow clear +1, survive-the-timer +0.5). Applied via a persistent `beliAdj` folded into `beli()`; verdict shown on the results screen.
- **Dev shortcut** now seats a **full house — 5 diners, all mid-meal (food already on the table), incl. The Critic** — before the test-brawl, so spectators/GOING LIVE/critic stakes all fire from the title tap.
- **Verified headlessly:** 31/31 checks — spectator capture, all draw paths, going-live buff/heal/idempotency, whiskey speed+damage+interrupt, bar-wreck + chef-drink block, critic loss/win/survive/no-critic rating math. Full syntax pass. File ~744KB.

## 2026-07-13 — Prod plan: Fight Mode + Bottle Service
- Wrote PRODPLAN_FIGHT_BOTTLES.md: P0 foundations -> P1 brawl core -> P2 flavor (going live/whiskey/critic) -> P3 bottle-service night -> P4 riot -> P5 polish+commit. Run becomes DAY -> BRAWL -> NIGHT -> RESULTS; combat built once, riot reuses it; broken equipment guts the night. Play checkpoints after P1 and P3. Five tunables defaulted and flagged.

## 2026-07-13 — chefF label-junk artifacts removed
- User flagged floating artifacts above chefF's toque in all 12 frames: leftover "IDLE/WALK" label text from the source sheet's crop rows. Stripped every disconnected component above the body (109-258 px/frame), re-cropped, re-embedded. Her natural height corrects 139->~119 (junk was inflating the bbox) — a step toward patch #1's him-taller-than-her. Punch frame verified consistent (junk already excluded, transparent headroom harmless). Master chefs sheet regenerated.

## 2026-07-13 — Procedural 8-bit monster generator
- Added `monster_gen.py` to the docs bundle: seeded mirror-noise creatures (symmetric body, CA smoothing, shading, 1-3 eyes, 8 moody palettes, 1px outline, BIG boss variant). 24-seed preview batch generated. Trivially portable to in-game JS for zero-byte runtime monsters (After Hours waves / bosses) — decide at manifest time.

## 2026-07-13 — Master contact sheets + two finds
- Built master contact sheets (chefs, customers-pipeline, brawl kit, dishes).
- FIND 1: the master customer sheet has crossed/mirrored L/R profile columns for nearly the whole cast (13 of 16 profiles) — the upgraded facing detector (warm-skin fallback) auto-corrected all of them; the future #10 wiring must use this pipeline.
- FIND 2: embedded `salad24` was corrupt since before the first commit (game silently fell back to the procedural menu salad). Re-rendered from the original script and re-embedded; verified.

## 2026-07-13 — Nana facing: root cause found & fixed at source
- The master sheet itself has Nana's L/R columns CROSSED (left col faces right, right col faces left) — confirmed with a pale-skin-safe detector. Rebuilt her enemy slots from source with facing FORCED pre-mask, rebuilt punches, restaged. Pipeline note: facing detector now needs the warm-skin fallback for pale characters.

## 2026-07-13 — BUILT: thieves + polygon monsters + drink-heal (verified)
- Drinking now heals ~50% max HP on top of the buff (bar = health + damage station).
- THIEF enemy type live: ~22% of a wave; they skip combat, grab a generic food blob from the nearest station, then speed-walk (THIEF_SPEED, slippery) for the door. Escape with it -> lose STEAL_LOSS coins. Punch (or special) a carrying thief -> drops the food and you recover STEAL_BOUNTY coins, then it flees. Verified full lifecycle + coin math.
- POLYGON MONSTERS live: compact JS port of monster_gen (seeded mirror-noise, cached) generates creatures at runtime (zero art bytes). They mix into the mob and RAMP by wave: ~10% w1, ~50% w2, ~90% w3 (POLY_RAMP). Verified w3 came up all-polygon.
- All headless-verified; normal service regression passes.

## 2026-07-13 — Design: thieves + polygon ramp + drink heal
- Drinking at the bar now also HEALS ~50% max HP (on top of the buff). Bar = your health+damage station; protect it (losing it kills After-Hours income and your comeback ability).
- Locked thief enemy: grabs a generic food blob, speed-walks (slippery) for the door; escape loses food+coins; punch while carrying -> drops food AND coins, then flees.
- Locked polygon ramp: w1 human, w2 mixed, w3 mostly/all polygon monsters.

## 2026-07-13 — Fixes: Nana facing + fist height
- Nana's enemy sprites were facing-inverted (her pale skin dodged the facing detector's threshold) — L/R swapped and punches rebuilt from corrected bases.
- All enemy fists lowered 1.5px. Restaged.

## 2026-07-13 — Enemy punch frames from the drawn glove
- Lifted the user-drawn glove as its own layer, tinted it rage-red (shading preserved), scaled it to each enemy's height, and composited onto all 8 shadow enemies -> every enemy now has idle + punch (L/R). All verified single-component. Staged ENEMY (4 keys) + chef PUNCH in punchdata.js (~207KB).

## 2026-07-13 — User-drawn fists wired in (staged)
- Round-tripped the fist contact sheet: diff-extracted the hand-drawn gloves (his red, her purple) from the returned JPEG and composited them onto the pristine embedded sprites — base art untouched, punch height == idle height by construction (101 / 139). Mirrored for R. Single-component + feet verified. Staged in `punchdata.js` with the shadow-enemy set (~120KB). `drawChefFist` kept as motion-line/effect backup.

## 2026-07-13 — Chef punch = procedural fist (art scrapped)
- AI chef punch frames scrapped (mismatched). Punch now renders as the wired left/right chef sprite + a procedural fist: `drawChefFist(dir, ext)` added to the game (unused until Brawl #12) — outlined glove blob (her purple / his red), shine pixel, motion lines past 55% extension, reach scales with the chef. Cannot mismatch by construction. Shadow-enemy set unchanged.

## 2026-07-13 — Brawl fighters solved: shadow-mask approach
- Customer punch frames scrapped (fragmented beyond repair; AI regen degrading). Per user's call: enemies are now **shadow-masked copies of the clean 4-dir masters** — dark silhouettes with thin outline, L/R, facing-verified; **red RAGE tint** reserved for the buffed state. Chef punch frames re-extracted with gap-bridging (previous floating-legs bug fixed; all sprites verified connected with feet). Staged ~87KB in `punchdata.js`. Deja/Monty re-render cancelled — masking covers the full cast.

## 2026-07-13 — Design locked: After Hours mode (#13)
- Weekend-night after-hours mode specced (`AFTERHOURS_SPEC.md`): club lights, $750 bottle service, riot events = multi-wave drunk brawls, enemies drunk-by-default at night. Needs week calendar; builds on Brawl + economy.

## 2026-07-13 — Design: whiskey buff (Brawl)
- Brawl addition: enemies can run to the bar and drink from the whiskey bottle -> faster + stronger. Defend-the-bar dynamic; flagged as interruptible, stacks with Going Live.

## 2026-07-13 — Design locked: full Brawl combat loop
- Consolidated the complete Brawl spec into `BRAWL_SPEC.md`: chef HP (mob damage hits the chef), KO = half equipment destroyed, 90s survive-or-clear timer, red-X broken stations with angry no-pay refusals, spectator tables that stay to record, Going Live buff, and multi-critic rating stakes (lose with a critic present: −3/−4; fast win: faster rating gain).
- Flagged for tuning: random vs chosen half on KO; rating-swing size vs the Beli scale.

## 2026-07-13 — Design: "Going Live" brawl buff (+ leg QA on salvage)
- The Brawl (#12) gains a sub-mechanic: mid-fight, a troublemaker "goes live" on their phone → mob fully heals, +20% size, +25% damage. Logged with open question on what "damage" targets (equipment speed vs chef HP).
- QA on punch salvage: feet clipped / floating legs on some frames (crop window too tight + erosion snapping thin ankles). Raw frames delivered as punch-frames.zip for manual cleanup; automated re-cut on offer.

## 2026-07-13 — Punch sprite salvage (The Brawl prep)
- Audited both AI punch sheets: frame-to-frame outfit drift, facing chaos (both "facing" groups punched left), Deja/Monty missing, soft AI render.
- Salvage (simplified per direction: one punch frame per fighter, mirrored): picked each fighter's best frame, auto-corrected facing, recolored Marisol, ran the outline/quantize pipeline, mirrored for L/R. 8 fighters staged in `punchdata.js` (~147KB) — NOT yet embedded (waits for Brawl #12 build).
- Sinclair marked provisional; re-render ask reduced to: Deja + Monty, one left-facing punch frame each, outfits locked.

## 2026-07-13 — Commit: project snapshot
- First packaged commit. Bundles the game build + docs (`.md`) + DevBrain dashboard together. No behavior change since the chef-sprite build; snapshots current state: chefs wired, The Brawl (#12) designed, 12-item queue, workflow established.

## 2026-07-13 — Design locked: The Brawl (#12)
- Scoped the bad-order boss rush: >4 unsellable orders in a day → those customers return end-of-day; walk-up + mash-to-punch; they destroy stations if you're slow → buy back (money) or drop the dish. Design only, not built (awaiting punch sprites).

## 2026-07-13 — Dev workflow + docs
- Added this docs bundle (`README`, `ROADMAP`, `DECISIONS`, `PARKED`, `SYSTEMS`, `ASSETS`, handoffs) and started `CHANGELOG` as the commit history.
- Added an architecture/header comment block to the top of the game script; committing to comment code as it's written.
- Companion `Culinary_Dash_DevBrain.xlsx` dashboard created.

## 2026-07-13 — Chef sprites wired
- Both chefs (female = default/"her", male = swap on title) drawn as **real sprites**, 4 directions, with **walk animation** (idle / walk1 / walk2; steps when moving, idle when stopped).
- Extraction pipeline: flood-fill background → de-fringe white halo → erode 1px → **thin 1px black outline** → color-bleed under transparency → quantize. Fixed the earlier white-halo problem.
- **Moonwalk fix:** per-frame facing auto-correction — detected that the right-direction *walk* frames were mirrored (faced left) and flipped exactly those on both chefs; reverted direction map to natural.
- Tuned `CHEF_SCALE` down (was too tall). *(Open: male should be slightly taller than female — see ROADMAP #1.)*

## 2026-07-13 — Front-of-house + game feel
- **Tables** replace bare stools (guests read as seated; plate shows on the table while eating).
- **Waiting bench** (3 seats) by the door with auto-promotion when a table frees; turns customers away only when tables + bench are full.
- **Sound:** procedural Web-Audio SFX (order, sizzle, serve, perfect, coin, shoo, cheer, walkout, day-end) + mute toggle.
- **Juice:** particle bursts, screen-shake (world only), perfect sparkle, confetti on a shoo, burnt smoke, chain sparkle.
- Fixed a latent door-orbit bug (leaving customers could circle the exit forever at low frame rates).

## 2026-07-13 — Drinks, clock, pacing
- Added **whiskey sour** + **shaker/bar** station (sour mix from a carafe + whiskey from the bar); north-wall bar backdrop.
- **Last-call clock:** the day timer keeps running past 0 until the store empties.
- Doubled post-order patience; customers read **menus** while deciding (removed once they order).

## 2026-07-13 — Visual fidelity
- **Supersampled rendering** (logical 320×180 upscaled to a backing buffer up to 6×) so text is crisp on the forced-landscape mobile view.
- 24-bit procedural hairdos for the (still procedural) customer cast.

## (earlier this build) — Core game
- Data-driven `DISHES` / `STATIONS` / `CAST`. Core loop: seat → take order → cook at the right station → serve. Wave-off mechanic for unsellable orders. Seating, patience/hearts, tips, Beli score, combos.
