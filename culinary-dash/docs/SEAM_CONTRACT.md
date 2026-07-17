# The Fight Seam — day → fight → day/night contract

> **Why this doc exists.** The rebuild moves boss fights out of the 2D file and into
> a separate 3D arena (see `REBUILD_PLAN.md`). For that to work without the game
> feeling like two games glued together, the 3D arena must consume and produce
> **exactly** the state the 2D restaurant already hands its own fights today. This
> file is the source of truth for that interface. Line numbers refer to
> `culinary-dash.html` (identical to `culinary-dash_src.html`).

The 2D restaurant is already authored around a single explicit handoff. A fight is
not a free-floating mode — it is a **function of the restaurant's state** that returns
a **delta applied back to the restaurant**. The 3D arena replaces the *body* of that
function; the signature must not change.

---

## Where the handoff happens today

**Entry — end of day, store has emptied** (`update` ~1291–1296):

1. `run.bossTomorrow` set? → `startBossNight(bid)` (a scheduled, named boss).
2. else `Math.random() < brawlChance()` → `startBrawl()` (the bad-order mob).
3. else → `startNight()` (after-hours) or `finishDay()`.

There is also a mid-day **scuffle** (`state="squareup"`, `chefScuffleHit` ~656) and an
after-hours **riot** (`startRiot` ~3552, which reuses the whole brawl). Both are combat
and both leave for the arena eventually — but **Phase 1 only re-homes the scheduled
boss night (`startBossNight` → Vince).** Everything else keeps running in 2D until
Phase 2 (see `REBUILD_PLAN.md`).

---

## IN — state the arena receives

The 2D game must serialize this into a plain payload and pass it to
`mountBrawl(container, payload)`. None of it may be read live from 2D globals by the
arena — the arena is a separate module.

| Field | Source in 2D | Meaning |
|---|---|---|
| `boss` | `run.bossTomorrow` / `BOSSES[id]` (~1661) | which encounter (`'vince'` for Phase 1) |
| `roster` | `badLedger` (~1598) | cast-type indices whose unsellable order was *taken* today; seeds the mob in a brawl. For a named boss, informs the supporting mob, not the boss itself |
| `count` | `brawlSizeMult()` / `brawlChance()` (~1620) | mob size / odds, scaled by `beli()` |
| `chefHp` | `chefMaxHP()` = `CHEF_HP + 5·statLvl('hp')` (~1650) | starting + max HP |
| `dmg` / `guard` / `speed` | `punchDmg` / `guardMult` / `fightSpeedMult` (~1651–1654) | office-upgrade combat mults |
| `drinkState` | `START_DRINKS=0` (~2349) | starts sober; buff is *earned in-fight*, never passed in |
| `spectators` / `critics` | seated diners at close, `SPECTATE_CHANCE` (~2504–2515) | who is filming; critics set the Beli stakes and always stay |
| `brokenStations` | `s.broken` re-asserted at `startBrawl` (~2518) | stations wrecked on a *prior* day stay wrecked into this fight |
| `seed` | (new) | the sim is deterministic; a seed makes a fight reproducible for testing |

**Invariant:** a fight never mutates restaurant state directly. It reads this payload,
runs, and returns the OUT delta below. This is what lets the arena be a separate module.

---

## OUT — result the arena returns

Returned via `onComplete(result)` (or a resolved promise). The 2D game applies it.

| Field | Applied in 2D by | Effect |
|---|---|---|
| `outcome` | `'win'` \| `'lose'` | branches everything below |
| `beliAdj` | `brawlWin` (~3231) adds a **time-scaled** gain via `fightAudience()`/`witnessOf` (~5067); `chefKO` (~3241) subtracts, scaled by who filmed | feeds `dayScore → reputation → beli` (~5060) |
| `newlyBroken` | on a loss, `chefKO` marks `ceil(n/2)` random stations `.broken=true` (~3244) | **persists** — nothing clears it but an office repair (`REPAIR_STATION/BAR`, ~5299). Degrades the *next* service day and can kill the *after-hours bar* |
| `barBroken` | `BAR.broken` | if the bar was wrecked, after-hours is dead: `startNight` reads `barDead:BAR.broken` (~3495) → "$0 / THE BAR'S WRECKED" |

**Where control returns** after the arena hands back the result (`updateBrawl` routing
~2980): `B.fromNight` → `resumeNight(outcome)`; else `isNightDay()` → `startNight()`;
else `finishDay()`. The arena does **not** decide this — the 2D game does, from
`outcome` + calendar state.

---

## The night round-trip (why the contract is save/restore, not fire-and-forget)

The tightest existing example of this contract is the **riot** — a fight that
*interrupts* after-hours and must put it back:

- `startRiot` stashes `{t, barDead}` in `brawl.nightSave` (~3559) before the fight.
- `resumeNight` (~3572) restores the night clock, reopens booths, re-reads `BAR.broken`,
  or falls through to `finishDay()` on a KO.

The 3D arena must support the same shape: **a fight can be launched from the night, and
on return the night resumes exactly where it paused.** (Not needed for Phase 1 — the
scheduled boss night fires at day-close, not mid-night — but the arena's return payload
must carry enough for the 2D side to do this when riots move over in Phase 2.)

---

## Functions to honor by name (the 2D anchors)

- **Entry:** `startBrawl` (~2491), `startBossNight` (~1719)
- **Exit + rating + wreckage:** `brawlWin` (~3231), `chefKO` (~3241), `bossNightWin/Lose` + `endBossNight` (~1732)
- **Where control returns:** `startNight` (~3493), `resumeNight` (~3572), `finishDay` (~5284)
- **Carried physical-state channel:** `BAR.broken`, `STATIONS[].broken`

## Phase-1 minimal cut

For Vince specifically, the arena needs to consume `{boss:'vince', chefHp, dmg, guard,
speed, spectators, critics, brokenStations, seed}` and return `{outcome, beliAdj,
newlyBroken, barBroken}`. `roster`/`count` matter only if Vince has a supporting mob;
start without one. The 2D `startBossNight`/`endBossNight` path is the wrapper we splice
into — it already produces the IN fields and consumes the OUT fields, so the splice is
"call the arena instead of `updateBossNight`, apply its result through the existing
`endBossNight`."
