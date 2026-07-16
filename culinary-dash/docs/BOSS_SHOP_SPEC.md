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

### Fight structure (reuses combat)
- New `phase==="boss"` encounters run on the impact spine like Brandon does today: chef HP bar, mash to
  strike in the exposed window, KO fall. `chefMaxHP()`, `punchDmg()`, `guardMult()`, `fightSpeedMult()`
  make your **stats the lever** (2a).
- **Win** → `reward` coins banked, `run.bossesBeaten++`, back to service.
- **Lose** (chef HP 0) → `phase="gameover"` with a boss message → tap → `startCampaign()` = **FULL WIPE**
  (1a). The Panic Button one-shot (shop #11), if owned, converts the *first* would-be wipe of a run into a
  costly flee (lose the night + a rep hit) instead — a mercy valve so a single bad read isn't instant death.

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
