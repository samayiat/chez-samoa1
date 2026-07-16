# Culinary Dash — runnable working tree

Reconstructed in-repo so the game can be built, tested, and edited from here (phone/web
driven), not only on the Mac. Round-trip verified: `build.py --check` is byte-identical to
the shipped `culinary-dash.html`, and the harness passes (772 checks).

## Layout (matches the docs' expectations)
- `culinary-dash.src.html`  — **edit this.** ~204KB of code; art is split out (safe to grep/read).
- `art/*.b64`               — 23 sprite blobs. Never read/grep these (kills context).
- `culinary-dash.html`      — BUILT artifact (art inlined). Ships / plays. Never hand-edit.
- `culinary-dash-devtools.html` — built with the DEV pause menu.
- `docs/harness.js`, `docs/tools/{cd,build.py,ingest,split_art.py,...}` — the house tools.

## Loop (run from this `game/` dir)
    docs/tools/cd grep '<pat>'    # safe grep of the src
    docs/tools/cd show <a> <b>    # print a src line range
    # ...edit culinary-dash.src.html...
    docs/tools/cd test            # build + run harness -> ALL PHASE-A CHECKS PASSED
    python3 docs/tools/build.py --check   # prove round-trip identical

This tree was rebuilt from the shipped built file via `split_art.py`; it is functionally
equivalent to the Mac working tree for build/test purposes.
