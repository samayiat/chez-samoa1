# Production Plan — Fight Mode + Bottle Service

Scope: **The Brawl (#12)** and **bottle service (the core of After Hours #13)**, wired into the live game. One run becomes: **DAY → LAST CALL → BRAWL (if triggered) → NIGHT (bottle service, riot risk) → RESULTS.**

## Why this order
The riot **is** the brawl with drunk enemies — so combat gets built once (P1) and bottle service rides it (P4). Broken equipment links the two: stations smashed in the brawl cripple your night (bar destroyed = bottle revenue dead). The two features fund and punish each other with no calendar system needed yet.

## Explicitly OUT of this build
- Weekend calendar (night runs **every** game until the week cycle exists)
- Money-spend shop / buy-back (interim: destruction = score damage + dead stations for the night)
- Back-office vignette, customer sprite wiring (#10 — service customers stay procedural; the brawl uses the staged shadow ENEMY sprites, so no visual clash)
- Save codes (#8) — after this build, so saves can carry night earnings

## Phases

### P0 — Foundations (shared plumbing)
- Embed `punchdata.js` (ENEMY shadow set + chef PUNCH, ~196KB) + nested loaders
- Extend phase machine: `play → lastcall → brawl → night → over`
- **Bad-order ledger**: count + remember which cast members ordered unsellables (counted when the order is taken — default, flagged)
- **Equipment model**: `broken` flag per station, red-X overlay, `contextLabel` refuses broken stations, order-refusal flow ("we don't have it" → angry leave, no pay)
- Headless-harness extensions for all of the above
**Exit:** day plays exactly as before; ledger and broken-state verified headlessly.

### P1 — Brawl core (the fight)
- Trigger: ledger > 4 at day end → the mob returns through the door (shadow versions of the actual offenders; roster padded with random shadows if needed)
- **Chef HP** (hearts), **enemy HP** (2–3 punches each), enemy AI: approach → lunge attack (cooldown, chef damage), hit-flash + knockback, KO fall/fade
- **Punch**: right-button mash → PUNCH frame + hitbox + `drawChefFist` motion lines + impact particles/sfx
- **90s timer.** Win = clear mob · Survive = timer ends · **Lose = chef KO → half the stations destroyed (random — flagged)**
- Brawl HUD: chef hearts, enemy pips, timer
**Exit:** full fight playable and headless-verified (win/survive/KO paths). **← play checkpoint: you fight it.**

### P2 — Brawl flavor (the spec's personality)  ✅ BUILT + VERIFIED (2026-07-13-p2)
- **Spectator tables**: chance seated customers stay and record (procedural phone + REC blink) — critics always stay
- **GOING LIVE** (once per brawl, needs a spectator): banner + shout → mob full heal, ×1.2 size, ×1.25 damage, RAGE red tint swap
- **Whiskey runner**: chugged enemy is faster+stronger; interruptible by punching; wrecks the bar once lit → chug + chef-heal both die if the bar's smashed
- **Critic stakes**: critic present → lose = Beli −3 *(tunable #3)*; win = bonus scaled by time remaining (survive-the-timer = +0.5)
**Exit:** all three events land in play + verified. → **MET** (31/31 headless checks).

### P3 — Bottle service (night mode)  ✅ BUILT + VERIFIED (2026-07-13-p3)
- Night transition: last guest gone → lights drop, strobe/color cycle overlay ✓ (procedural audio tempo-up = light, deferred to P5 SFX pass)
- **Groups** (2–3) arrive together, take a table, order a **bottle ($750)** ✓
- Chef fetches the bottle from the **bar** (new carry), serves the table → cha-ching; group drinks, lingers, leaves ✓
- Night runs ~75s; **broken bar guts it** (bar destroyed = "BAR WRECKED" sign + $0 revenue — the brawl's teeth) ✓
**Exit:** a full day→night run banks money. → **MET** (22/22 headless checks). **← play checkpoint: play a night.**

### P4 — The riot
- Per served bottle: chance the group's chugger downs the whole thing → **RIOT**: night pauses, 2 waves of **drunk-baseline** enemies (whiskey buff pre-applied) via P1 combat, then night resumes if you win
**Exit:** riot triggers, fights, and resolves headlessly + in play.

### P5 — Polish, balance, commit
- SFX pass (punch hits, KO thud, bottle pop, register, riot alarm), shake/particle tuning
- **Results screen v2**: day tips + night sales − damage, fight record, rating change
- Balance pass on all flagged numbers; full regression harness; **commit zip + changelog + docs sync**

## Tunables (defaults chosen, flag if you want different)
| # | Call | Default |
|---|---|---|
| 1 | Run sequence | brawl **before** night |
| 2 | KO destruction | **random** half of stations |
| 3 | Critic loss penalty | **−3** Beli |
| 4 | Bad order counts when | **order is taken** |
| 5 | Night frequency | **every run** until calendar exists |

## Risks
- File size → ~700KB total after embed: fine for the in-chat delivery model
- Combat feel is the big unknown → hence the P1 play checkpoint before flavor gets built on top
- Balance numbers (damage, HP, $750 economy vs repair costs) all land in P5 with your play feedback
