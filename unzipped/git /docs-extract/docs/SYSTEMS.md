# Systems — What Exists Today

- **Core loop** — seat → take order → cook at the right station → serve; wave-off for unsellable items (chef points + head-shake, crowd cheer/confetti/coins).
- **Dishes / stations** — 5 dishes over station kinds: **timing** (fryer→karaage, pot→lobster), **assemble** (salad bar→garden salad; shared shaker→whiskey sour + gin sour), and **source** (ICE BOX→raw lobster). The shaker is shared: grabbing a spirit (gin/whiskey) picks the drink, sour mix is common. The pot is fed from the ice box — fetch raw lobster there, carry it over, boil. The fryer keeps a co-located chicken crate (selective; fast dish stays snappy). Data-driven tables; each dish has an explicit `recipe` (ingredient ids), `recipeOf()` falling back to a station's crate list.
- **Tables + waiting bench** — 5 dining tables; 3-seat waiting bench with auto-promotion when a table frees.
- **Sound** — procedural Web-Audio SFX; mute toggle (top-left).
- **Kitchen idles** — the room breathes with nobody touching it: pot steam (idle gentle → boiling hard), fryer heat shimmer + oil bubbles while cooking, and a clean-plate stack on the pass that wobbles when dishes are set down/picked up and *rattles* when a thief swipes a plate. Intensity lives in one pure function, `idleAmt(st)`; wrecked stations are cold.
- **Juice** — particle bursts, screen-shake (world only), perfect sparkle, confetti on a shoo, burnt smoke, chain sparkle.
- **Clock / last call** — day timer keeps running past 0 until the store empties.
- **Rendering** — logical 320×180, supersampled up to 6× for crisp text; forced landscape (rotate in portrait).
- **Chef** — real sprites, 4 dir, walk animation, female/male swap on title.
- **Customers** — still procedural (blocks + 24-bit procedural hair). Real-sprite wiring pending (Roadmap #10).
- **Impact spine (fights)** — every blow in every fight (brawl/riot, Brandon, the daytime scuffle) goes through `impact(w,dx,dy)`, which derives **shake, hitstop, camera kick, sound pitch and spark direction from ONE ranked weight** (`HIT.scuff` < `jab` < `hurt` < `heavy` < `stumble`, `+HIT_KO` for a knockdown, `+HIT_BODY` per extra body clipped — sub-linear, so a crowd-clip reads as one bigger hit rather than pinning the cap). A heavier hit is bigger on every channel *by construction*; the ranking is tested monotonic. **Feedback follows contact** — a whiff is quiet. `tickHitstop()`/`tickKick()` are split out of the loop so they're testable. The fight has its own sfx (`sfxHit`, `noise`, `whiff`/`ko`/`hurt`); it used to borrow the kitchen's and lie about what happened.
- **Ticket rail** — the HUD carries every open order, so the room is readable **with her back turned** (this is what unblocks pre-cooking). One bar per ticket: **length = its whole 30s life** (empties exactly as they walk), **colour = the 12s speed tip** cooling gold→grey→red, **notch = where the tip dies** (computed — Comfy Stools slide it 40%→31%). Sorted most-urgent-first by `orderT`, which is also hearts order, so it never reshuffles. Tickets whose dish is **plated on the pass** go bright + green tick (*go serve*); ones still **on the heat** recede. Cover is allocated one-for-one, so 3 lobster orders + 1 lobster = 1 marked, not 3. Pure functions: `ticketLife()`, `tipNotch()`, `inFlight()` (splits `ready`/`cooking`), `railTickets()`.
- **Legible incentives** — the order bubble's top bar is a live **speed-tip meter** (gold→grey over 12s, depleting): the +50% quick-serve bonus is visible *while it's winnable*, so the room reads as money at a glance. `CHAIN xN` shows its 2.2s window and reddens before breaking. `tipHeat(c)` is the single source of truth shared by bubble and tests.
- **Menu / Beli / combos** — menus shown while ordering; Beli score; combo chains; tips.

## The Brawl (P0–P2 built)
- **Trigger + phases** — >4 unsellable orders taken in a day → at close the mob returns; phase machine `play → brawl → over`. Bad-order ledger remembers the offenders (they seed the mob roster).
- **Combat core (P1)** — chef HP + hearts, enemy HP (punch-out pips), 90s timer; mash-to-punch (user-drawn fists) with knockback, a drunk "special" haymaker, chef drink-to-buff/heal at the bar. Enemy archetypes: smashers (raid stations/bar, capped), chasers (telegraphed lunge), thieves (grab food, flee), plus polygon-monster wave ramp. Win = clear or survive; lose (KO) = half the stations wrecked.
- **Flavor (P2)** — **spectator/recording tables** (critics always stay); **GOING LIVE** once-per-brawl mob buff (full heal, +20% size, +25% damage, RAGE red tint); **whiskey buff with teeth** (chugged enemies faster+stronger, interruptible, and can smash the bar → `BAR.broken` kills enemy chug *and* the chef's heal); **critic stakes** (lose = Beli −3, win = time-scaled Beli gain), shown on the results screen.
## After Hours (P3 built)
- **Night phase** — run is DAY → (BRAWL) → NIGHT → RESULTS. Club lights (dim + rotating colored beams + strobe), magenta HUD with live bottle-sales $ and a night timer.
- **Bottle service** — groups of 2–3 arrive, seat, order a **$750 bottle**; chef grabs a bottle at the bar and serves the table → banked to coins; group parties then leaves. Un-served groups leave thirsty.
- **Brawl carryover** — a bar wrecked in the fight → dead night ("BAR WRECKED", $0). Results screen shows the after-hours takings.
- **Not yet** — P4 riot (bottle-chugger → drunk-baseline multi-wave brawl), P5 polish/balance/results-v2/commit. Weekend calendar, buy-back economy, and save codes remain out of this build (see PRODPLAN_FIGHT_BOTTLES.md).

### Camera (shake -> kick -> zoom)
One weight `w` from the `HIT` table drives every channel (see the impact spine). The camera is three
stacked things, all derived from `w`:
- **shake** — `SHAKE_PER_W*w`, capped `SHAKE_MAX`, decays at `SHAKE_DECAY`. Isotropic random rumble.
- **hitstop** — `w*STOP_PER_W*stopMult()`, capped `STOP_MAX` (set so it never binds). `stopMult()` = buffed
  x drunk, drunk via `wastedAmt()`. Budgeted by `STOP_DUTY_MAX`: `stop/(cd+stop)` must stay under it,
  because punchT only decays while unfrozen. Phase-gated to the brawl.
- **kick** — `KICK_PER_W*w` along the blow direction. Directional; decays with `KICK_FRICTION`.
- **zoom** — `camZoom(shake+|kick|+1, ...)`. NOT free decoration: the baked floor is WxH at (0,0) with no
  bleed, so the zoom is what stops the offset exposing the screen edge. Must always satisfy
  `(z-1)*H/2 >= |sy|` (H is the tight axis). Driven by the smooth magnitude so it punches instead of strobing.

`sx/sy` are re-randomised per frame and rounded; the zoom is computed from the smooth band that
contains them, so coverage holds for any draw the loop can make.

### Drunk vision (wastedAmt -> warp + afterimages)
`wastedAmt()` is 0..1 and is the ONLY input to both effects. `depth` ramps with drinks past `WASTED_AT`
(saturating after `WASTED_DEPTH`); `fade` eases out over the last `WASTED_FADE` seconds of the window.
Both clamped, so the result is always 0..1 and always agrees with `isWasted()`.
- **warp** — `drawDrunkWarp()`, a canvas post-process between the world and the HUD. 45 strips on a
  travelling sine; each strip is overdrawn by its own max excursion `k` on both sides so it can't expose
  an edge (the punch-zoom does NOT cover this — it runs after rasterisation). Skipped entirely at amt 0.
- **afterimages** — `brawl.ghosts`, sampled on the sim clock (so hitstop freezes the trail too), drawn
  under the chef. Trail length is bound by `GHOST_LIFE/GHOST_EVERY`; `GHOST_MAX` is a backstop for
  retuning, enforced every frame.

### Plants (procedural, per-locale, destructible)
Three families: `PLANT_SPOTS` (floor pots, solid), `HANG_SPOTS` (ceiling baskets, decor, drawn in the
wall layer BEFORE drawBarBack — keep them clear of BAR_BACK_L..R), `VINE_SPOTS` (margin runners +
bottom creepers, decor, drawn in the room backdrop). Only floor pots are solid or wreckable.
`PLANT_SPOTS` (6, all front-of-house) -> `plants[]` at runtime. `plantParams(seed)` is the pure shape
decision (species-specific fields only); `genPlant(seed)` draws it into a bottom-centred canvas cached on
`ENV+":"+seed` — the View row's rebake regenerates all of them.
- **solid** via `resolveChefCollision` (day only — the brawl chef walks through tables too), radius
  `PLANT_R`. Broken plants are walkable.
- **wrecked** by `smashPlantsNear()` off `impact()`, brawl only, `PLANT_HP` ~= a few solid blows.
- **reset** in `startDay()`.
Invariants pinned by tests: clearance from every anchor, full room reachability, >=PLANT_R off the FLOOR
edge (or the clamp traps the chef), and genuine per-seed variation in every locale.

### Ambience (all decor, none of it solid, none of it read by any system)
- `MOTES` + `drawMotes()` — specks living inside the light `buildFloor` bakes. `moteDrift(env)` pure.
  `inWindowLight()` / `inWarmPool()` must stay in step with the pools in `buildFloor` (WARM_POOLS/WARM_R).
- `driftAt(t)` pure + `drawDrifter()` — one world x shared by all windows, drawn inside the window clip.
- `glassKind(env)` pure + `drawGlass()` — frost/rain/condensation; NEBULA+WARP deliberately clean.
- `cat` + `updateCat()`/`drawCat()`/`resetCat()` — states sleep/sit/groom/walk/bolt. Ticked from the top
  of update() so it survives the brawl/night early-returns. Reset in startDay(). Not solid, not wreckable.

### Tables + candles
`tableStyle(env)` pure -> palette + `foot` (pod/rattan/chrome/coral/trestle/float); `drawTable(s,ty)`
branches on foot. One style per locale, five matching tables. Drawn at s.y+6 IN FRONT of the seated
customer (that's what hides their legs — there are no chairs), so stay ~16 wide and never grow upward.
`drawCandle(x,y,ph)` — locale-independent, halo is a stepped diamond, phase offset per table.
`CANDLE_DX` must stay >4 to clear the plate zone.

### Fight moves / combo
`FIGHT_COMBO` + `comboMove(step)` (pure) pick the move per swing; `brawl.comboStep`/`brawl.comboT` hold it.
`moveDur(id,move,dir)` derives duration from FRAME COUNT x `FIGHT_FRAME_MS` — the cadence is the art.
`fightDir(id,move,dir)` resolves left->right and fills art holes; `shouldMirror()` is the flip decision
(fightDir's fallback would mask it). `takingpunch` is driven by `hurtFlash`; `HURT_DUR` must match the
value set on a hit. `uppercut` is generated but out of the combo on purpose — it's the special candidate.
NB: `COMBO_WINDOW`/`combo`/`comboTimer` are the SERVICE tip chain, unrelated. Draw-path behaviour here is
NOT testable headless (images don't decode) — verify with `work/combo_probe.js`, cooldown respected.

### Combat weight
`MOVE_KNOCK` scales `BRAWL_KNOCK` per move — jab holds (5px, inside the 29px punch arc = combo range),
finisher sends (17px). DO NOT raise BRAWL_KNOCK flatly: it breaks the combo to fix the float.
`LUNGE_WINDOW`/`LUNGE_SPEED` — root+lunge for the opening of a swing, steering returns on recovery.
`iflashes` + `drawImpactFlashes()` — contact-point pop, lives on the impact() spine (NB: `flashes` is the
floating TEXT pops, unrelated). `COMBAT_ZOOM` makes camZoom authored with the safety as a FLOOR — the
max() must never become a min(). Hitstop and combo speed share one budget (STOP_DUTY_MAX).
`drawBrawlHUD` is deliberately HP + GO-LIVE only.
