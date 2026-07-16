# The Brawl — Full Spec (Roadmap #12)

End-of-day boss rush. All design locked with the user unless marked *(flagged)*.

## Trigger
- **More than 4 customers order unsellable items in one day** → at closing, all those troublemakers return as a mob.

## Combat
- **Chef fights:** walk up + **mash the action button** to punch each troublemaker (punch frames salvaged; one frame per fighter, mirrored L/R; idle = existing sprites).
- **Enemies have health** (a punch-out meter each).
- **Chef has HP** — mob damage hits the **chef** (new system).
- **Timer: ~90 seconds** (a minute and a half).

## Win / Lose
- **Win** = knock out the whole mob, **or** survive until the timer runs out.
- **Win:** whatever equipment isn't broken, you keep. Quick wins are rewarded (see Rating).
- **Lose (chef KO'd):** battle ends immediately → **half the kitchen equipment is destroyed** *(flagged: selection assumed random unless the user wants to choose which half)*.

## Broken equipment
- Broken station = **red X overlay**, unusable (procedural, no art needed).
- Customers can still order dishes that need a broken station → you must tell them **"we don't have it"** → they **leave angry, no money**.
- Repair: **buy back** with money (needs the money economy, #8/#11) or the dish stays **off the menu**. Interim (pre-economy): menu removal only.

## Spectators & Going Live
- **Some seated tables occasionally stick around** for the fight — they're the ones who **start recording** (phones up).
- **GOING LIVE:** one recording spectator shouts **"I'M GOING LIVE"** (LIVE badge over their head) → the mob is buffed: **full health restored, sprites +20% bigger, +25% more damage**. Phone/LIVE badge procedural.

## Whiskey buff (enemy)
- **Enemies can run to the bar and drink from the whiskey bottle** → that enemy gets **faster and stronger**.
- Creates a defend-the-bar dynamic: intercept the runner or pay for it. *(flagged: assumed per-enemy buff, chef can interrupt by punching them mid-run/drink; stacks with Going Live.)*

## The Critic & Rating stakes
- **More than one critic can exist** — multiple Critic instances may be seated at once *(interim: duplicate the existing Critic; long-term: critic variant art)*.
- If a **critic is present during the fight**:
  - **Lose** → bad review: **rating drops ~3–4 points** *(flagged: tune vs the Beli scale — a 3–4 point swing is huge; verify intended scale)*.
  - **Win quickly** → **rating rises faster** (speed-scaled boost).

## Systems needed (build checklist)
- [ ] Bad-order counter per day → brawl trigger
- [ ] Brawl phase (end-of-day): mob spawn, mash-to-punch, enemy HP
- [ ] Chef HP + KO state
- [ ] 90s brawl timer
- [ ] Equipment broken/destroyed state + red X + order-refusal flow (angry leave, no pay)
- [ ] Spectator/recording tables + Going Live buff event
- [ ] Whiskey-bottle enemy buff (run to bar, drink, faster+stronger; interruptible)
- [ ] Critic-present rating hooks (loss penalty / speed-scaled win bonus)
- [ ] Repair/buy-back (blocked on money economy #8/#11)

## Assets
- Fighters: **shadow-masked enemy set** (all 8 customers, from clean masters, L/R) staged in `punchdata.js`; **RAGE red tint = buffed state** (runtime). **Chef punch = USER-DRAWN fists** (round-tripped via the contact sheet, diff-extracted onto the pristine wired sprites; heights match idles exactly; L drawn, R mirrored; staged in `punchdata.js`). `drawChefFist(dir, ext)` remains in code as a backup/effect layer (motion lines). Enemies now ALSO punch: the user-drawn glove was lifted, **rage-tinted red, scaled per character, and composited onto all 8 shadow enemies** (idle + punch, L/R each, in `ENEMY`). Lunge remains the movement; punch frame plays on contact. No outstanding art.
- Phone, LIVE badge, red X: **procedural** — no new art needed.

## Enemy variety (added 2026-07-13)
Three enemy archetypes now share the mob:
1. **Smashers** (default) — raid stations/bar, chip HP, defend when the chef is close. Capped at MAX_RAIDERS at once.
2. **Chasers** — hunt the chef; wander loosely, telegraph (windup ring + "!") then lunge for damage.
3. **Thieves** (NEW) — don't fight. Beeline to a station/fridge, grab a GENERIC food blob (not dish-specific), then speed-walk (slippery, faster than normal) for the door. Escape with it = you lose the food + coins. **Punch a carrying thief → they DROP the food AND coins** (bonus pickup) and flee. They're evasive, not tanky — the threat is losing loot, so they pull you into a chase.

## Polygon monster ramp (added 2026-07-13)
Procedural mirror-noise monsters (monster_gen.py, ported to JS) mix into the mob and RAMP by wave:
- Wave 1: all/mostly human cast (angry customers).
- Wave 2: mixed — a chunk are polygon monsters.
- Wave 3: **mostly/all polygon monsters** — the place is overrun.
Monsters use the same combat states; visually distinct (generated sprites, moody palettes). Bigger "BIG" seeds can anchor as minibosses later.
