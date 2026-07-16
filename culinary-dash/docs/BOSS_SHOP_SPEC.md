# Bosses, the Shop & the Stake — Spec (Roadmap #40)

Design **locked with the user 2026-07-16** (voice memo → three tappable calls answered **1a / 2a / 3a**).
This is the "there's not enough goal" patch: a reason to grind the addicting service loop.

## The locked calls
- **1a — The stake is a FULL WIPE.** Lose a boss fight → bank to 0, every upgrade + stat gone, back to
  Day 1 / Week 1. Reuses the existing `phase==="gameover"` → `startCampaign()` path (today's eviction
  screen), with a boss-flavoured message. "You lose your whole restaurant" — literally.
- **2a — It's a real fight; STATS are the lever.** You always throw hands with the boss (reuses the
  brawl/Brandon mash-combat + impact spine). Purchased combat stats (HP / power / guard / feet) decide
  whether you can trade blows long enough to win. Under-levelled = you'll almost certainly get KO'd, but
  raw skill can occasionally steal it. NOT a hard gate — a gate isn't a fight.
- **3a — TELEGRAPHED a day ahead.** End-of-day: a challenger is announced for *tomorrow* night. You get
  one shopping day (the back office) to buy the stats you need. A wipe you saw coming and didn't prep for
  is earned, not cheap.

## The loop this creates
```
DAY (service, earn coins) → results → BACK OFFICE (spend on stats/upgrades) → next day
     ↑                                                                             │
     └──────────────  beat boss (+big coins) ──────  BOSS NIGHT  ←── telegraphed ──┘
                                                          │
                                                     lose → FULL WIPE (Day 1)
```
Service funds the shop; the shop funds survival; the boss is the wall you must be ready for. High stakes,
clear goal.

---

## Part 1 — Stats + the (long) shop

### Stat model
`run.stats = { hp, pow, guard, feet }` — integer LEVELS, default 0, cap 5 each. Persisted in the run like
`run.upgrades`. Boolean one-shot upgrades stay in `run.upgrades` (the existing pattern).

| stat | name | per level | caps at L5 | wired into |
|---|---|---|---|---|
| `hp` | **Iron Gut** | +5 max HP | +25 HP | brawl `chefHP` init + bar denominator, boss `chefHP` |
| `pow` | **Heavy Hands** | +12% punch dmg | +60% | `punchDmg()` at every player-hit site |
| `guard` | **Bouncer's Build** | −8% dmg taken | −40% (floored ≥1) | `guardMult()` on enemy/boss damage to chef |
| `feet` | **Quick Feet** | +6% fight move speed | +30% | `fightSpeedMult()` on brawl + boss chef speed |

Escalating cost: `statCost(id, lvl) = STAT_BASE[id] * (lvl+1)`. Bases chosen so a full combat build costs
real service days (numbers land in the balance pass — flag them, don't trust them blind).
Helpers (all pure, all tested): `statLvl(id)`, `chefMaxHP()`, `punchDmg()`, `guardMult()`, `fightSpeedMult()`.

### The shop list (the "pretty long list" the user asked for)
Rendered in the back office (`officeRows()`), **repairs first, then stats, then one-shots**. The office row
list gets a **scroll offset** (drag on touch / d-pad on the Retroid) clamped to content — today it hard-caps
at ~6 rows and a long list would fall off the bottom.

**Combat stats** (leveled, gate the bosses):
1. Iron Gut · Heavy Hands · Bouncer's Build · Quick Feet (above)

**Service / economy one-shots** (booleans — make the list long *and* deepen the day):
2. **Bigger Tip Jar** — +15% tips *(exists)*
3. **Comfy Stools** — patience/hearts drain slower *(exists)*
4. **Prep Rail** — timing stations cook ~12% faster
5. **Second Fryer** — a wrecked station is auto-repaired free once per fight
6. **Neon Sign** — a fuller house (higher spawn rate / a touch more rep)
7. **Loyalty Punch-Cards** — quick-serve speed-tip window is longer
8. **Security Camera** — robbers appear far less often
9. **Reinforced Stations** — stations take more hits before they wreck (`STATION_HP`↑)
10. **Top-Shelf Liquor** — after-hours bottles sell for more
11. **Panic Button** — one free "flee the boss" per run (see below), else the wipe stands

> Improvised extras are fine — Claude can add per request. Keep each one a single, legible effect.

---

## Part 2 — The bosses

### Roster (data-driven `BOSSES[]`)
Generalise the Brandon boss (its `draw → fire → reload` cycle is already a telegraphed recurrent-attack
state machine — the exact shape a boss wants). Each entry:
```
{ id, name, tagline, hp, dmg, reward, recLevel,  // recLevel = combat stat sum you "should" have
  pattern: [ ...telegraphed attack steps... ] }   // its own recurrent set
```
Three to start, each a distinct **recurrent attack pattern** (all procedural, no new art — reuse
polygon-monster / shadow bodies + Brandon's rig):

1. **Brandon "The Regular"** — the gunslinger (existing). Cycle: draw → 6-shot volley (dodge the drifting
   crosshair) → reload (the strike window). The tutorial boss; low `recLevel`.
2. **Vince "The Landlord"** — a charger. Cycle: telegraphed lunge (windup ring + "!") across the room →
   recover (strike window) → ground-pound shockwave you jump/step out of. Punishes standing still.
3. **The Health Inspector** — zoner. Cycle: lobs 3 clipboards/AoE markers (telegraphed circles, step off
   them) → summons two shadow minions (reuse brawl enemies) → exposed while they're alive. Punishes greed.

Bosses **escalate**: which one shows scales with `run.week` / how many you've beaten (`run.bossesBeaten`).
Reward scales with `recLevel`. Beating one = a big coin drop (`reward`, e.g. 3–8k), the point of the grind.

### Vince's moveset (tripled 2026-07-16: 2 -> 6 distinct recurrent attacks)
`BOSSES[0].rotation = ["charge","pound","paper","stomp","dcharge"]` — 5 attacks cycle deterministically by
`bossFight.cycle`, plus a 6th, **grab**, which is reactive: it preempts whichever rotation slot was due if
she's standing inside `grabR` of him at the moment his windup resolves (punishes hugging him to dodge the
ranged/AOE attacks). Every one of the six still resolves into `"recover"` — the strike window never goes
away, only what precedes it varies (a harness test walks all 11 intermediate states and asserts each one
reaches `"recover"` within 600 frames, so "she can still do damage to him" is a proven invariant, not an
assumption):
1. **charge** — telegraphed lunge along her position at windup's end; connects = damage.
2. **pound** (ground pound) — AOE at a *remembered* spot (where he stood at windup's end); dodge by moving.
3. **paper** (eviction notice) — a ranged projectile thrown dead-straight; the only non-melee attack.
4. **grab** (reactive) — hugging him mid-fight gets you grabbed and flung across the room instead of
   whatever was scheduled next.
5. **stomp** (shockwave) — a faster, smaller AOE centred on his *current* spot, not a remembered one —
   forces you to keep backing off rather than just avoiding one fixed point.
6. **dcharge** (double charge) — two lunges back-to-back, re-aimed at her position between hits.

### A second boss (2026-07-16): The Health Inspector, a ranged zoner
`BOSSES[1]` — `kind:"zoner"`, the counterpoint to Vince's melee charger. `pickBoss()` already escalates by
`run.bossesBeaten`, so beating Vince once hands you the Inspector next, no new plumbing needed. Four
attacks, `rotation:["citation","zones","spread","summon"]`, none of them a lunge:
1. **citation** — a danger circle frozen at wherever she was standing at the telegraph. Pure positional:
   sidestepping counters it completely, standing still doesn't.
2. **zones** — several circles placed around her current position; overlapping ANY of them at resolution
   is a hit, so she has to find the actual gap rather than dodge one point.
3. **spread** — a FAN of projectiles (not Vince's single straight paper) — forces lateral movement, since
   backing straight up stays in the fan's spread.
4. **summon** — spawns 1-2 roaming adds that chase and tag her once each before expiring. Deliberately
   **not a gate**: the strike window opens in the same resolve as the adds spawn, so the boss himself is
   never made unhittable by summoning — the adds are pressure on top of the fight, not a wall around it.

`bossNightStrike()` is kind-agnostic (it only reads `B.def.reach`/`koChance` + `punchDmg()`), so the same
strike handler works on both bosses with zero new code. Same structural guarantee as Vince: every one of
the Inspector's four attacks — citation/zones/spread/summon — resolves into `"recover"` too.

### A third boss (2026-07-16): Chef Bruno "The Ringer", a trickster
`BOSSES[2]` — `kind:"trickster"`. Vince tests positioning, the Inspector tests zone-awareness; Bruno tests
**timing/discipline**. `rotation:["feint","jab","combo","counter"]`:
1. **feint** — plays the *exact same telegraph* as `jab` (same flash text, same visual ring) and resolves
   into nothing. The mixup is visual, not textual — she genuinely can't tell them apart before it resolves.
2. **jab** — short telegraph, low damage, connects in `jabR` or whiffs cleanly outside it.
3. **combo** — two hits with a real gap (`comboGap`) between them where nothing happens — trains against
   bailing early on a combo that isn't over.
4. **counter** — his signature: a *sustained* stance (`counterTime` seconds), not an instant punish.
   Standing within `counterR` at any point during it costs a hit — "wait him out," not "watch one instant."

`updateRinger` was added purely additively (a new function, a new `else if` in `updateBossNight`'s
dispatch, new draw branches keyed on his new state names) — `vinceStrike()`, `bossNightStrike()`, Vince, and
the Inspector are all untouched. Same guarantee once more: all 8 of his states resolve into `"recover"`.

### Boss-intro cinematic (2026-07-16): tight zoom + typed name, before every fight
Every boss-night fight now opens with a ~1.8s cinematic: the camera punches in tight on the boss
(`BOSS_INTRO_ZOOM=3.0`, framing his fixed spawn point `(262,78)` with margin inside the pan clamp — verified
by arithmetic, not eyeballed) while his name types onto the screen letter by letter, then cuts to the normal
fight camera. Combat and movement are frozen for the duration (`bossFight.introT`, gated at the top of
`updateBossNight`) — nothing can happen to the chef or the boss during the reveal.

Built entirely by **extending the three existing, already-tested camera functions** (`camZoom`,
`tickCamLean`, and the `updateBossNight` dispatch) rather than adding new inline math anywhere — this
project's own `DECISIONS.md` has a hard-won rule that camera math living in `loop()` is untestable by
construction (a past mutation reverting the whole transform once passed all 618 tests). The zoom's safety
floor (`max(want, safety)`) is untouched; the intro just raises what "want" asks for.

**Deliberately excluded: Brandon** (the original, separate, heavily-pinned daytime-scuffle boss). His
`updateBoss()` has ~30 tests that call it once immediately after `startBoss()` expecting his `"draw"`
sequence to already be progressing — a mandatory hold ahead of that would break most of them. Extending the
cinematic to him would need its own dedicated pass built around those constraints.

### Fight structure (reuses combat)
- New `phase==="boss"` encounters run on the impact spine like Brandon does today: chef HP bar, mash to
  strike in the exposed window, KO fall. `chefMaxHP()`, `punchDmg()`, `guardMult()`, `fightSpeedMult()`
  make your **stats the lever** (2a).
- **Win** → `reward` coins banked, `run.bossesBeaten++`, back to service.
- **Lose** (chef HP 0) → `phase="gameover"` with a boss message → tap → `startCampaign()` = **FULL WIPE**
  (1a). The Panic Button one-shot (shop #11), if owned, converts the *first* would-be wipe of a run into a
  costly flee (lose the night + a rep hit) instead — a mercy valve so a single bad read isn't instant death.

### Punch animation + combo (2026-07-16): the strike button throws a real punch now
Before this, tapping STRIKE in a boss fight was invisible math — no swing, no combo, chef stood in idle/walk
the whole fight. Fixed by reusing the brawl's own animation/combo machinery (`comboMove`, `moveDur`,
`fightDir`, `hasFightArt`, `pickFightFrame`, `drawFighter`, `shouldMirror`, `punchGate`,
`FIGHT_COMBO_WINDOW`, `PUNCH_BUFFER`) against new fields on `bossFight` (`punchT`, `punchDur`, `move`,
`comboStep`, `comboT`, `bufT`) via a new `bossNightSwing()` — the animation/combo half only.
**`vinceStrike()` is untouched:** landing damage on the boss is still exactly gated on
`state==="recover"`, same rule as always. This is purely the missing "it looks and feels like a fight"
layer, applied kind-agnostically to all three bosses.

### The boss-night overhaul (2026-07-16): pacing fix, HP-gated stages, way more juice
Reported: fights end too fast, attacks are plain circles/squares, banners do the talking instead of the
visuals. Three parts, each its own slice:
1. **Pacing fix**: `vinceStrike()` had no rate limit beyond `state==="recover"`, so mashing could land 5+
   full-damage hits in one exposure. Capped to one clean hit per exposure (`bossFight.struck`, reset by a
   single generic check in `updateBossNight`) and retuned HP upward (Vince 60, Inspector 50, Ringer 55) now
   that the cap makes HP mean what it looks like it means.
2. **HP-gated attack stages**: `bossPhase(B)`/`bossRotation(B)` — Stage 1 (>66% HP) is the original
   rotation, Stage 2 (33-66%) reorders toward the harder moves, Stage 3 (<=33%, "enraged") adds one new
   signature finisher per boss (Vince's WRECKING BALL, the Inspector's CONDEMNED, Bruno's HAYMAKER — each
   built on an existing attack's shape at bigger numbers) and shortens `windup` only, never `recover`.
3. **Juice**: a new `HIT.devastating` weight + `bossBigHit()` bundling an ember/smoke particle burst, an
   expanding shockwave ring, and a screen-punch effect (built by generalizing the existing drunk-vision warp
   — composes via `Math.max`, never sums) — all reusing existing primitives (`impact()`, `burst()`,
   `drawDrunkWarp()`) rather than inventing parallel systems. Every telegraph became 3 staggered rings +
   a particle trickle (`dangerRing()`/`bossDanger()`) instead of one flat pulse, plus a screen-edge color
   bleed keyed to the attacking boss's palette. Every per-attack `flash()` banner (~30 sites) is gone — the
   boss-name cinematic, win/lose banners, and the damage-number pop are untouched.

See `CHANGELOG.md` (slices I/J/K/L) for the full arithmetic and test breakdown.

### Telegraph + trigger (3a)
- `nextDay()` / `finishDay()`: with the boss NOT already queued, roll `bossChance()` (random "after work").
  On a hit, set `run.bossTomorrow = pickBoss()`. The **results + office screens show the warning** ("⚔ A
  CHALLENGER COMES TOMORROW NIGHT — get ready") so the shopping day has stakes.
- The queued day: after service/after-hours resolves (end of `finishDay` path), if `run.bossTomorrow`, go
  to the boss instead of straight to results. Clear the flag on resolve.
- Frequency: rare enough to prep for, common enough to matter — start ~1-in-4 nights, never two nights
  running. All flagged for the balance pass.

---

## Build order (each a tested, committed slice)
- **A. Stats + shop + office scroll.** `run.stats`, stat helpers wired into combat, long `UPGRADES`,
  scrollable office. Headless-testable (stat math, rows, affordability, scroll clamp). ← self-contained.
- **B. Boss roster + telegraph + reward + wipe.** `BOSSES[]`, generalise the boss phase, `bossTomorrow`
  flag + warning UI, reward on win, gameover-wipe on loss, Panic Button valve.
- **C. Balance pass (needs her hands on the Retroid).** Every number above is a starting guess; combat
  feel and the economy curve can only be judged in play. Flag them, don't ship them as final.

## Invariants to keep green
- Combat feedback stays **on the impact spine** — bosses call `impact()`, never hand-tune shake/haptics.
- The full harness (772 today) stays green; new systems add their own checks (stat math monotonic, wipe
  really resets the run, a queued boss actually fires, reward banks, scroll clamps).
- Nothing here relitigates a locked DECISION; it extends the run economy + the boss phase that already ship.
