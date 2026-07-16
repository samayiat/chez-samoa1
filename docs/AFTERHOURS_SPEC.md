# After Hours — Weekend Night Mode (Roadmap #13)

New game mode, locked with the user unless marked *(flagged)*.

## Concept
- **On weekend nights, the restaurant turns into an after-hours spot.** Flashing club lights, different energy.
- **Bottle service:** groups of patrons buy **bottles of liquor at ~$750 each**. Big money mode.

## The Riot
- **Every now and again, someone drinks a whole bottle and starts a riot** — they trash everything.
- Riot = **multiple waves of drunk enemies** (reuses the Brawl combat: chef HP, mash-to-punch, equipment destruction, red-X carryover). *(flagged: assumed same win/lose rules as the Brawl; waves ~2–3.)*
- **After hours, enemies are already drunk** — the whiskey buff (faster + stronger) is their **baseline** at night. Drinking mid-fight would stack on top. *(flagged assumption on stacking.)*

## Economy & risk
- The mode is the money engine: $750 bottles vs the risk of a riot wrecking equipment you then have to buy back. High roll, high risk — feeds the repair/shop economy (#8/#11).

## Systems needed
- [ ] Weekday/weekend calendar (day counter exists; needs a week cycle)
- [ ] Night mode: lighting/flash effects, after-hours patron groups
- [ ] Bottle service flow (sell/carry bottles, group tables, $750 pricing)
- [ ] Riot trigger (bottle-chugger) + multi-wave brawl variant with drunk-baseline enemies
- [ ] Equipment damage carryover into the next service day

## Dependencies
- Brawl (#12) combat systems; money economy (#8/#11); save/day progression for the week cycle.

## Assets
- Reuses punch frames + existing sprites. Flashing lights, bottles: procedural to start.
