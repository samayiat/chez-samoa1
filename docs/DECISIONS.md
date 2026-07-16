# Locked Decisions & Preferences

Don't relitigate these.

- **Delivery:** runs inside the Claude chat; Claude is the backend. Self-contained single HTML for now.
- **Chef default:** female ("her") is the default player; switchable on the title (tap the chef box). Male alt embedded.
- **Character views:** 4 directions only (front / back / left / right), straight-on. **Not** isometric.
- **Sprite edges:** thin **subtle** 1px black outline (not thick). Pipeline: flood-fill → de-fringe → erode 1px → 1px outline → color-bleed → quantize; plus per-frame facing auto-correct.
- **Chef heights:** male taller than female (fix pending — Roadmap #1).
- **Walking is the point:** keep the fetch/carry loop; just make the chef faster.
- **Save:** no in-game load box, no self-hosting; Claude handles reload from a pasted save code.
- **Long-term platform:** host app on device (browser/PWA), not a native build — lifts the file-size limit. Parked.
- **Aesthetic:** Habbo Hotel — 4-dir, expressive hair, clean outlines.
- **Egg-white sours (locked mechanic, builds with pancakes):** once eggs exist (pancakes #5), the sours can take an **optional egg white** — a **dry-shake** that takes **longer to make** but raises the **Beli rating and the tip**. It's opt-in per drink, not the default. (Roadmap #14.)
- **Scope ethos:** charming and **small** — a gift for one person. Robustness over breadth. Personal touches from the Culinary Brain land well.
- **Working style:** one thing at a time; slow down; interview with tappable options when scoping; verify visually; batch patches from a manifest.
- **The tip and patience are ONE clock (structural fact, don't relitigate):** `advanceDialogue()` sets `c.orderT` and `c.hearts=HEARTS_MAX` on **adjacent lines**, so `tipHeat` (dead at 12s) and `hearts` (dead at 30s) are the same age at two zooms. Consequences: (a) any UI showing both is showing **one fact twice** — the rail draws **one** bar for this reason; (b) sorting tickets by `orderT` *is* sorting by hearts, so "most urgent first" and "stable order" are the same sort; (c) if `PATIENCE_DRAIN` or `SPEED_TIP_WINDOW` is ever retuned, the rail's notch follows automatically — it's computed, never hardcoded.
- **Meters must never be blank (the disclosure rule):** a bar that encodes nothing (the old rail's static green top) or sits empty for most of its life (a heat-only rail bar: dead 18 of every 30s) is the bug the legibility arc exists to kill. **Length carries the fact that lasts the whole life; colour is a landmark on that length, never independent information** — that's what keeps it readable without hue at 320×180.
- **The pass is visible from the rail (locked):** a ticket whose dish is already **plated on the pass** must read *go serve* (bright + tick), never *handled/ignore*. It's the fastest money on the floor. Only dishes still **on the heat** may recede. Cover is allocated **one-for-one** so she can never be told 3 orders are handled by 1 lobster — under-cooking is worse than double-cooking.
- **Visual verification beats a green suite:** the harness ctx is a Proxy that discards writes and **cannot be monkey-patched**; use a **separate recording ctx** + rasterizer to look at actual pixels. The rail's dim-the-plated-ticket bug passed every test and was only caught by rendering it.
- **The rasterizer was blind to the camera (fixed — `work/cam_raster.py`):** `roomshot.js`'s recorder had `setTransform: () => ops.push(["ident"])` and `room_raster.py` tracked only translate+rotate. **The camera matrix was discarded, so every render silently showed the room at 1:1 with no zoom and no pan** — any "I looked at it" for a camera-dependent change was worthless, including the COMBAT_ZOOM pass. `cam_raster.py` keeps the matrix and applies it; it's unit-checked against a synthetic op stream with a known transform. The recorder **also discards `fillText`** — so *"no text ops were drawn"* proves nothing about a HUD, and text never appears in any render. Both traps are the same shape as the Proxy one: the tool silently answers a different question than the one asked.
- **Don't measure a pan by correlating renders:** the walls are a tile grid and the floor is planks — both periodic, so cross-correlation locks onto the wrong peak and lies confidently (it did, three times, off by exactly one plank). Test whether the **predicted** shift explains the image (compare its error against the zero-shift error) rather than searching for a best shift.
- **tinted() is a NUDGE, not a recolour (locked):** it hardcodes `globalAlpha=0.5`, so it lands halfway to the target — 50% blue over a red lobster measures RGB(90,54,91), i.e. purple. Fine for the angry-customer red flash; useless for moving a colour any real distance. To recolour, **hue-rotate at ingest** (`ingest local key@deg=path`), which moves the hue and leaves the shading intact, costs no runtime and no cache.
- **Raw lobster is BLUE and that's a mechanic, not a palette choice (locked):** `drawRawLobHeld` is `#3a4f7a`; the cooked dish is red. The blue->red shift is the raw/cooked tell. Any red raw-lobster art must be hue-rotated to ~204deg before packing, or the ice box looks stocked with finished dishes.
- **Dim means UNUSABLE, and nothing else (locked):** the SPECIAL dims only on cooldown; that's the brawl HUD's grammar. DRINK used to dim while chugging, which on an 8s hold said "disabled" for the whole time it was working. A button that is busy stays bright and shows a **ring** (`chugFrac`, same sweep grammar as the SPECIAL's cooldown). Never signal "in progress" by dimming. The ring is legal under the UI-strip rule because it's an action you can act on (hold or release), not a readout.
- **Cats: sprite for sit/walk, PROCEDURAL for sleep/groom (locked):** the v3 rotations are east/west only — `cat.dir` is `+1/-1` and the logic has no north/south facing, so front/back have nowhere to go. Sleep and groom have no art and keep their hand-drawn loaf and paw-up; a static sprite sleeps standing up. **The cat is ~9px and that's correct** — the side views downscale to 10x9/11x9, the procedural cat's exact footprint. Don't "fix" the cat's size: that idea came from measuring the FRONT view (5x9), which the game cannot display. Pre-scale at ingest (`--height 9 --snap`), never at draw — the game turns smoothing ON for detailed art and would blur a 5:1 downscale.
- **Downscale pixel art with --snap, never plain LANCZOS:** LANCZOS 5:1 turns a 7-colour sprite into 73 shades of grey; nearest keeps the palette but drops thin features (a white chin). Snap = resample smoothly, then force every pixel back to a colour that existed in the source. Applies to any future sprite that renders far below its master size.
- **Sober start, and the ladder is HELD not tapped (locked — closes the START_DRINKS call):** `START_DRINKS=0`. The drinks are earned mid-fight, never handed over: at 5 she began permanently buffed and instantly WASTED, so the mechanic was unreachable in the shipping build. The button **chains while held** (`chugHeld`, id-matched release). **Release stops only the NEXT chug — the one in her mouth lands**, so a tap is still exactly one drink and the old behaviour is the degenerate case. `nextChugTime()`'s existing acceleration (2.2s→0.45s) is what makes a hold feel like it's running away from you; **sober→WASTED is an 8.0s hold** in a 20-30s fight, and the cost — stood at the bar, not swinging — is the mechanic. Don't add a drink counter: the rungs are already legible diegetically (warp, drift, afterimages), which is exactly why the UI strip cut the counter and kept HP.
- **The camera LEANS, it does not follow (locked):** the crop `COMBAT_ZOOM` buys is `(z-1)*W/2` = 35.2px and that is the **entire** budget keeping black off the baked-at-exactly-WxH floor — camera travel and shake spend the same 35.2px. That caps pan at ~±28px against a 300px walk band (19%). Following her properly needs z~2.13, a 150x84 room — a different game. So: `LEAN_K=0.35` of her offset from centre, clamped. **`LEAN_K` is not a feel knob, it's a distribution knob** — the clamp hands the camera ~28px of travel no matter what K is, and K decides how much of her band it's spread over. K=1 (a true follow) spends it inside 56px and pins to the rail for 81% of the room; 0.35 spreads it over ~160px. Bumping K does not make the camera follow harder, it makes it pin sooner.
- **The pan budget is NOT monotone in the shake (structural fact, don't "fix" it):** the obvious story — it gets loud, the budget collapses, the camera locks — is **false**, and was asserted in a test before the test killed it. `camZoom` maxes over both axes and **H is the tight one** (2·off/180 > 2·off/320), so once the safety binds it over-crops X: a heavy blow **buys** horizontal pan. Pan is ±28.0px at rest, dips to a **minimum ±16.8px at off≈14.7** (exactly where COMBAT_ZOOM hands over to the safety), and is at its **widest ±29.8px under the heaviest blow in the game**. All three are pinned.
- **The loop is untestable, so nothing may live in it (locked):** `loop()` never runs headless — so any math inline there is untestable *by construction*, and the harness modelling it by hand is a false green waiting to happen. It was one: with the camera math inline, a mutation reverting the transform to the old centred form **passed all 618 tests**; the camera could be deleted and the suite stayed green. Camera math now lives in `camMatrix()`, which the loop and the harness both call, leaving one `setTransform` line as the untestable residue. Corollary, learned the same day: **test the OUTPUT, not the input.** The first fix still failed, because every lean test read `camX` (correct under the mutation) while the loop draws with `e`.
- **Feedback follows contact (locked):** no fight feedback fires on a button press. The special used to `addShake(3.4)` on activation before any contact test, so whiffing shook harder than landing a jab, and the hit itself added 0.0. A whiff must be quiet — that's what makes it read as a whiff.
- **One weight, every channel (locked):** all fight feedback derives from a single ranked scalar via `impact()`. Never hand-tune shake/sound/stop/kick at a call site — that's exactly how the ranking inverted (the biggest move in the game became the quietest). If a blow should feel bigger, give it a bigger **weight**; the channels follow. Weights are ordered `scuff < jab < hurt < heavy < stumble`, `+HIT_KO` on a knockdown, `+HIT_BODY` (sub-linear) per extra body. The cosy floor rule holds inside this: the daytime scuffle is deliberately the lightest blow in the game.
- **Caps hide inversions:** the old `addShake` cap of 4.5 made a 3-body clip and a STUMBLE render identically, which is *why* nobody noticed the ranking was broken. Keep headroom above the heaviest blow, and when comparing two blows in a test, assert neither is pinned to the cap — otherwise the test passes on clamping rather than on the thing it claims to measure (this happened, and was only caught by mutation testing).
- **Derive tuning from the integrator, don't guess:** `BRAWL_KNOCK=KNOCKBACK*12` because the knockback integrator (v*dt/frame, v*=0.80^(dt*60)) settles at ~v0/12 px — measured. This keeps the legacy 5px shove that `KNOCKBACK`'s "small enough to combo" comment protects.
- **The 5px shove is load-bearing; knockback is PER-MOVE, never a flat raise (locked):** the fight reads floaty because bodies barely move when hit — but the punch arc is **29px wide and holds combo range**, so launching a body the ~15px that would fix the float walks it out of the arc and breaks the combo. The float and the combo were the same number. Resolved the classic beat-em-up way: **`MOVE_KNOCK` per move — the jab HOLDS them (~5px), the finisher SENDS them (~17px).** Anyone "fixing the floatiness" by raising `BRAWL_KNOCK` globally is re-introducing the bug a test now catches. Corollary: **knockback distance is a named lever on the plant-wreck rate** (see ROADMAP) — it moved in this commit, so that figure predates it.
- **The gamepad is a first-class input, not a keyboard variant (locked):** `keyboardControls` is `(pointer:fine) && !ontouchstart` — it means "no touchscreen", which is the wrong question for a pad. The phase dispatch lives in `primaryAction()`/`secondaryAction()`; touch, keys and pad all call it. Deadzone on the **magnitude**, never per-axis (per-axis makes diagonals sticky). Poll **before** the hitstop gate or presses vanish in the held frame. **B (button 1) stays unbound** — Android routes it to system BACK and kills the host app before the page sees it; the Gamepad API is polling, so there's nothing to preventDefault.
- **The Claude chat is not a play host (confirmed on device 2026-07-15):** the artifact iframe never receives gamepad input — it drives the Android UI, and B exits the app. Fullscreen browser or PWA is a requirement, not a preference (see PARKED).
- **No wall-clock in the sim, ever:** `performance.now()` is for animation frame-pickers only. The drunk-drift read it to steer `chef.x` — frame-rate dependent, unreproducible, and fatal to lockstep. Sim timing rides `dt` (see `B.driftT`). `docs/tools/determinism.js` is the instrument; a harness test guards it, and that test MUST advance the clock between runs (`__advanceClock`) or it passes on a wall-clock read.
- **Lockstep is the multiplayer shape, not host-authoritative (design call, 2026-07-15):** two identical RP5s running the same exe means floats agree, so send inputs and let both simulate — no world serialization, no host authority, no interpolation. Verified: with Math.random seeded, 1800 frames of day + drunk brawl are byte-identical across two devices with two clocks. Remaining work: seed the 63 sim-side Math.random calls, and put the loop on a fixed step (it's `dt=(now-last)/1000` today, which also means the game plays differently at 30fps than 60).
- **The punch input BUFFERS, it never accelerates (locked):** a press during a swing is remembered for `PUNCH_BUFFER` (0.16s) and spent when `punchGate()` opens — it used to be discarded, so mashing dropped inputs and you had to play to the animation. The gate is untouched: cadence comes from the ART (3-frame jab, 7-frame roundhouse). Measured 3 swings from 30 presses vs 3 from 4. **`chefPunch()` alone clears `bufT`** — a press is spent when it becomes a swing; clearing it in updateBrawl too is redundant state that masks a one-press-two-swings bug.
- **Post-hitstop timing is free, don't re-derive it:** the loop skips `update()` entirely while frozen, so anything living in update() (punchT, comboT, bufT) is already post-hitstop. Never time combat off `performance.now()` — `stopMult()` makes the held frame longer when drunk, and a wall-clock gap would drift by state.
- **HAPTIC_MIN_MS=45 is a MEASURED HARDWARE FLOOR, not taste (locked):** the motor is an ERM; single pulses at 20ms and 38ms were **not felt at all** on the target device. #29 shipped an 8-38ms curve — every buzz was imperceptible, under a green suite that only checked `navigator.vibrate` was called. **No pulse may ever dip below the floor**, including the leading beat of a pattern (that bug recurred four lines into the fix). Nothing headless can verify haptics; it needs a person holding the device.
- **The fight is the loud part; the day is a tap on the shoulder (locked):** the `NOTIFY` channel (arrive / ready / taken / served) is separate from `impact()` — a customer walking in is not an impact. Every notify pattern must be weaker **by PEAK pulse** than the lightest thing the spine can make (a test enforces it). Peak, not total: two taps with a gap are felt as two taps, not one long buzz, so texture is free and intensity is capped. A tap must mean something you can ACT on — the bench doesn't buzz, because patrons there can't order yet.
- **The drink hits the motor too (locked):** `hapticMult()` mirrors `stopMult()` exactly — `1 + (HAPTIC_WASTED_MULT-1)*wastedAmt()`, x1.60 at full depth, **fight-only**. One drink, every channel. A drunk KO is the hardest thing in the game (>=90% of `HAPTIC_CEIL_MS`), and `HAPTIC_CEIL_MS` is a hard cap so no multiplier can run the motor away.
- **Haptics ride the impact spine, like everything else (locked):** `hapticFor(w)` off the same ranked weight as shake/hitstop/kick/sparks/sfx, returning a PATTERN, clamped, ONE buzz per blow (never per body). A jab and a KO must not buzz the same. `HAPTIC_DOUBLE_AT` sits between the heaviest normal blow and the lightest KO, so thump-THUMP means *someone went down* — not merely *that was big*. Never call `navigator.vibrate` from a call site; it goes through `buzz()` off `impact()`. **Android-only** (iOS has no Vibration API) and possibly blocked in a cross-origin iframe — guarded three ways so it silently no-ops rather than breaking the fight. The harness sandbox must keep a `vibrate` stub on `navigator`, or removing the guard crashes the whole suite instead of failing one test.
- **The chef punches in FOUR directions; the box rotates (locked):** `PUNCH_AXIS[chef.dir]` is the facing vector, `PUNCH_REACH` runs along it, `PUNCH_YBAND` across it. Nothing may collapse the facing to left/right — three places did, one of which overwrote `chef.dir`, and the front/back fight art (which has always shipped) had never once been drawn. **Same numbers all four ways:** a north punch crossing 24px of depth is fine because `PUNCH_YBAND` already makes 30px of y punchable laterally — the foreshortening was priced in when that went to 30. Enemies stay 2-dir with a radial hitbox, and that is WHY the circle exists: they have no facing to test against.
- **The punch box is SQUARE-CORNERED, never a radius (locked):** `PUNCH_REACH` 24 forward, `PUNCH_BACK` 5 behind, `PUNCH_YBAND` **30** lateral (the character's left/right = screen y). It was 14 — half the forward reach — so you had to line up on depth and the fight read as "I can only hit what's dead ahead". A circle would taper the lateral reach as forward distance grows, pinching exactly where the reach is wanted; the corners are the feature. **Lateral must stay wider than forward** — that's the invariant, not the number.
- **Copies drift, references move — both hide a change:** the arc test kept `const ARC = 24` (its own copy), so retuning the code left it asserting the old value. Fixed by reading `PUNCH_REACH` — which then made a mutation narrowing the band back to 14 pass all 681, because every assertion re-derived itself. Read the constants for behaviour, and pin the VALUE separately against a *reason* (lateral > forward; at least a body wide).
- **The enemy's reach circle is not a depth bug (don't "fix" it):** `hypot(chef-e) < ATK_REACH` already limits them to ~±13 laterally. Converting it to a box makes their reach **1.37x bigger** (531->728px^2, +40 diagonal cells, minus nothing). The genuine asymmetry is REAR: the punch reaches 5px behind her, their circle ~12px — that's why they seem to hit from anywhere.
- **The root is the WHOLE swing; LUNGE_WINDOW is only the DRIVE (locked, revised 2026-07-15g):** she commits to a punch for its entire duration — steering returns the frame it ends. The first version rooted only the opening 45% and handed control back for the recovery, reasoning that a rooted chef reads as a stun. Wrong: the recovery is the *longer* half, so you could walk through every punch, and that was the floatiness. The commitment IS the weight. **The two windows must stay separate** — one constant did both jobs, which capped the root at 45%, because widening it to 1.0 would also drive her the whole swing (a 29px roundhouse dash). Drive stays at 45%: jab 6.1px, cross 11.5px, roundhouse 13.8px. Rooting without the impulse still reads as a mannequin, so the drive stays.
- **Never assert a feel invariant on a CONSTANT:** `LUNGE_SPEED>0` "tests" that the lunge carries her forward and passes whatever the sim does with it. Three such tests watched the chef stay steerable through half of every punch and stayed green. Hold the stick through a real swing and measure where she ends up.
- **Hitstop and combo length are ONE budget (structural fact, don't relitigate):** duty = `stop/(cooldown+stop)`, so a faster combo and a heavier freeze draw on the same account. `FIGHT_FRAME_MS=52` made the jab *faster* than the old fixed 220ms swing and blew the budget the moment `STOP_PER_W` went up; the heavier hitstop (.085→.11, cap .30→.42) is **paid for** by dragging the combo out (52→90ms/frame: jab 270ms, roundhouse 630ms). Retuning either side alone silently re-breaks it. A test pins the budget in every chef state — and pins that the budget is actually approached, not trivially satisfied.
- **Cadence is defined in POST-HITSTOP time (locked, applies to #19):** `stopMult()` scales hitstop by state (drunk ×2.13, buffed ×1.25), so a rhythm authored in raw time silently changes by state — tuned sober, wrong drunk, and miserable to diagnose. Gaps are measured after the freeze, always.
- **The brawl UI is stripped, and that's the design (locked):** in service the HUD earns its bar — money, day, rating, orders are things she acts on. In a fight it was an opaque black band across a 180px room reporting things she *cannot act on mid-punch*. **Gone: wave count, enemies-left, round timer, drink counter, the band itself.** What survives is only what has no diegetic tell: **HP** (pulses under 25%) and the **GO-LIVE banner**, which is an *event*, not a readout. **No locale frame** — the monsters already recast per locale, so the locale is on screen throwing punches; it doesn't need a border saying so. The rage tint already exists as a channel if HP should later go fully diegetic.
- **Combat zoom is AUTHORED, with the safety as a floor (locked):** `camZoom` used to derive zoom purely from shake, because it existed as a *safety* — the baked floor is exactly W×H with no bleed, so a shaken camera tears a black band off the edge. It is now `max(COMBAT_ZOOM, safety)` with `COMBAT_ZOOM=1.22`, which already covers max shake on its own, so **the safety term stops binding** — which is what buys `SHAKE_MAX` headroom. The floor may never be removed: the authored zoom can never undercut the safety, and a test pins that. The zoom crops the border and therefore the greenery. **That's intended** — the fight tightens onto her and whatever the sky sent in.

## Punch-zoom: the camera crops to cover its own shake
The baked floor is exactly WxH at (0,0) — there is no bleed — so a shaken camera exposes cleared canvas
at the screen edge. Options were: bake a margin (touches buildFloor, the wall and the windows, all of
which use absolute coords), clamp the offset (caps the shake, which was the thing being asked for), or
zoom in enough to crop the gap. Zoom won: it costs one transform, it scales *with* the shake so it
disappears when the room is still, and a punch-in is exactly what a beat-em-up wants anyway. The fix
and the feature are the same line. `ZOOM_SAFETY=1.35` crops 35% more than strictly needed.
**Invariant: `(z-1)*W/2 >= |sx|` and `(z-1)*H/2 >= |sy|`, always.** H is the binding axis. Tested by
exhaustive sweep, not by eye.
Zoom reads the *smooth* magnitude (`shake+|kick|`), never the per-frame random offset — the offset is
re-randomised every frame, so zooming on it would strobe rather than punch.

## Never trust a half-set impulse pair
`e.kbx` set without `e.kby` made `e.y` NaN, and NaN silently fails every comparison it touches: the
enemy stopped being hittable, stopped being drawn, and held the wave open forever. No error, no crash —
just a fight that never ends. Both the setter and the integrator are now defensive (`||0`), because the
bug is not "I forgot kby once", it's "any future caller can forget kby".
Corollary for probes: a test that force-kills (`state="ko"`) walks straight past this. The bug only
appears if you make the chef actually punch things.

## The juice ceiling is a framerate budget, not a taste limit
Every particle is a fillRect on a phone. A real fight peaked at 652. `PARTICLE_MAX=520`, trimmed once per
frame (O(1) amortised, not per-spawn), oldest first — the newest particles are the ones the player just
caused, so they're the ones worth keeping.

## Drunk visuals read one number, and it's the same number the mechanics read
`wastedAmt()` is the only input to the warp and the afterimages. The alternative — each effect deciding
for itself how drunk she looks — is how the fight feedback got inverted before the impact spine: five
channels hand-tuned until the special shook less than a jab. A visual that disagrees with the mechanic is
worse than no visual, because it teaches the player the wrong model. Eases out rather than snapping,
because an effect that vanishes between frames reads as a glitch, not as sobering up.

## Post-process effects can't lean on the punch-zoom
The zoom protects the world draw. Anything that moves *pixels* after the world is rasterised (the warp)
is on its own and must guarantee its own edge coverage. The warp does it with per-strip overdraw sized to
the strip's own excursion. Any future post-process needs the same argument made explicitly.

## Hitstop has a duty-cycle budget, and it's a constant
The temptation with "make the freeze longer" is to turn the number up until it feels good in one moment.
But hitstop stops the whole sim, and because `punchT` only decays while unfrozen, a longer freeze also
delays the next punch — the real cycle is `(cooldown + stop)`. Past roughly half, a mash stops reading as
impact and starts reading as a dropped framerate. `STOP_DUTY_MAX=0.55` lives next to the tunables so the
next person to touch `STOP_PER_W` sees the constraint, and it's asserted across every chef state.
The tight case is BUFFED, not drunk: the buff *shortens* the cooldown to 132ms while the multiplier
lengthens the freeze, so the two squeeze from both ends.

## State multipliers belong inside impact(), not at call sites
`stopMult()` is applied in one place. The spine's rule is one weight -> every channel; a state modifier is
a second axis, and the only way it stays honest is if it's also applied in exactly one place. Ten call
sites each deciding how drunk the freeze should be is how the feedback got inverted in the first place.
It is phase-gated, because `brawl` outlives the fight and a stale drunk object must not smear the day.

## Plants are front of house, and that's a game decision not a dressing one
The kitchen is where the timing game lives; a solid prop there costs real play for atmosphere. The dining
room has spare floor at its edges and nothing to lose. It also happens to be true of restaurants.

## Destructible decor listens to the spine; it does not get its own AI
Plants take damage from `impact(w,dx,dy,x,y)` — the spine already carries "a blow of weight w landed
here", which is the definition of collateral. The alternative (plants as raid targets) means new enemy
states, new target allocation, and a second thing to keep in sync with the fight. Cost of the chosen
route: zero new AI, and it works for every blow that exists now or later, for free.

## Solid decor needs a reachability test, not just a clearance test
Clearance says "the plant isn't ON the fryer". Reachability says "she can still GET to the fryer". Only
the second one catches a ring of plants around a station, or a plant that plugs the last pass gap. If
anything solid is ever added again, it needs the flood-fill test — a wall that appears in one locale and
not another would otherwise be a bug nobody finds until she plays it.

## Decor goes on the architecture, not on the floor
Placing props by "where is it safe to collide" produces open-floor clutter that reads as obstacles. Rooms
are planted at their edges: corners, walls, ceilings. The corollary is that most greenery needs no
collision at all, so the amount of it can go **up** while the gameplay risk goes **down** — 2 solid pots
now versus 6 before, with roughly four times the visible greenery.

## Ambience rides existing systems instead of adding parallel ones
The motes light nothing themselves — they live inside light `buildFloor` already baked. The drifters and
the glass live inside the window clip that already existed, so they're bounded by the frames for free and
can't leak into the room. Cost of ambience added this way is close to zero; the alternative (a new
lighting pass, a new clip) is where this sort of thing usually goes wrong.

## The room travels with the view (OVERRIDES "one restaurant, six skies")
The dining set is fully recast per locale. The earlier position — hers stays hers, only the light changes
— was overruled by design call: alien tables in NEBULA, coral UNDERWATER. What this costs is the
conceit that the restaurant is a constant thing parked in front of a changing view; what it buys is that
swapping the View row now transforms the whole room, which is a much bigger moment. If a future change
wants the restaurant to feel like a fixed place again, THIS is the decision to reverse.

## The cat is the only thing that isn't native to the locale
Plants, monsters, drifters, weather and now the tables are all cast from the view outside. The cat is the same tabby
under all six skies. That contrast IS the content: she's the fixed point that makes the sky feel like
the variable. If a future locale ever re-skins the cat, this decision is what it's overriding.

## Matching sets, not procedural furniture
Plants are seeded per spot because plants differ. Tables are one style per locale because a restaurant
buys a set. Procedural variation is a tool for things that vary in life, not a default.

## Source of truth is a git repo, not a hand-carried ZIP
**2026-07-15. Locked.**

Until now a "commit" meant hand-delivering three artifacts (built html, docs
ZIP, CHANGELOG entry) between sessions. That is version control performed
manually. It survived because everything ran in one chat; it stopped surviving
the moment a second machine existed.

The cost was paid in full on 2026-07-15: an afternoon spent moving files onto a
handheld, and a `/sdcard` bind-mount design that only existed to solve a
transfer problem `git clone` solves for free.

Don't relitigate. If a future session proposes "just zip it over," that's this
day again.

## Repo lives on ext4, never on /sdcard
**2026-07-15. Locked.**

Android's shared storage (`/storage/emulated`, `/sdcard`) is FUSE: mounted
noexec, no POSIX permission bits. Consequences, all silent:

- `chmod +x` **reports success and does nothing**.
- `./docs/tools/cd` dies with Permission denied.
- `bash docs/tools/cd test` is **NOT a workaround** — `cd test` re-invokes
  itself via `"$0" script`, which is a direct exec. It fails *after* the build
  succeeds, so it presents as a harness bug.
- git can't track file modes or symlinks; expect permanent spurious diffs.

Repo goes in the Debian rootfs. Only the built `culinary-dash.html` is copied
to `/sdcard` for the browser to open.

## Debian (proot) over Termux for the agent
**2026-07-15. Locked.**

Claude Code ships as a glibc-linked linux-arm64 binary; Termux is Bionic. The
workarounds exist but are a maintenance tax. The deciding argument isn't
compatibility though — **an agent can only shell out to the environment it
lives in.** Claude Code in Debian cannot run Termux's node. One box, not two,
and the box is the one the agent is in.

## Ask the binary, not the model
**2026-07-15. Locked.**

Twice in one afternoon a session was told a Claude Code feature didn't exist,
by a model whose training predates the feature. Twice the answer was in
`claude --help`.

Corollary, learned the same day: **test capability, not layout.**
`[ -d .../installed-rootfs/debian ]` asserts a fact about proot-distro's
internals it never promised. `proot-distro login debian -- true` asks the only
question that matters. Same family of error as trusting `chmod +x` on FUSE — an
operation that reports success while telling you nothing.

## The built artifact is NOT committed; it ships as a Release asset
**2026-07-15. Locked.**

`culinary-dash.html` is gitignored. Built files ship as GitHub Release assets,
tagged per delivery.

Git dedupes by content hash, so an unchanged `art/*.b64` costs nothing across
commits. The built file inlines all 22 blobs and changes on every commit —
committing it would store ~800KB of unchanged art *per commit*. That is the
readsafe split undone in history-space while preserved in context-space.

`build.py --check` loses its referent, and that's acceptable: per its own
docstring it exists to verify the one-shot `split_art.py` migration, which it
already did. Ongoing verification is `cd test` → ALL PHASE-A CHECKS PASSED,
which needs no committed html. If the round-trip check is ever wanted back,
compare against the last Release asset.

Reversing this after the first push means rewriting history.
