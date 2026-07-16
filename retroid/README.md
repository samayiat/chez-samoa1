# Culinary Dash → Retroid Pocket (PWA install kit)

Turn the single built `culinary-dash.html` into an **installed, offline, full-screen
app** on the Retroid Pocket G2 — no native build, no editing the game source, no
Claude-chat iframe.

## Why this exists

The game code already requests fullscreen + landscape-lock on first touch, reads the
hall-effect sticks as a gamepad, and drives the rumble motor. None of that works inside
the Claude chat's sandboxed `<iframe>` (it eats gamepad input and `B` exits the app —
see `DECISIONS.md`). Run the same file from a real origin and all of it lights up.

`localhost` on the device is a **secure context**, so installing as a PWA there gives
you the full experience *and* makes it fully offline. That's what this kit sets up.

## What's in here

| file | what it is |
|---|---|
| `serve.py` | stdlib-only host server. Serves the game and injects the manifest link + service-worker registration into `<head>` on the fly — **the game HTML is never modified.** |
| `manifest.webmanifest` | `display: fullscreen`, `orientation: landscape`, icons. |
| `sw.js` | service worker — offline cache; network-first for the game so a rebuild shows up on the next online refresh. |
| `icon-*.png` | home-screen icons (the "her" chef, upscaled crisp). Includes a maskable variant. |

## Install on the Retroid (one time)

1. **Get the files onto the device.** Copy this whole `retroid/` folder **and** your
   built `culinary-dash.html` into it, so `serve.py` sits next to the game. (Any transfer
   works — USB, `scp`, a cloud drive, `git clone`.)

2. **Install Termux** (from F-Droid or GitHub — the Play-Store build is outdated), then:
   ```sh
   pkg install python
   cd /path/to/retroid          # e.g. cd /sdcard/Download/retroid
   python3 serve.py             # serves ./culinary-dash.html on :8080
   ```
   Point it elsewhere if needed: `python3 serve.py --game /sdcard/Download/culinary-dash.html`

3. **Open Chrome on the Retroid → `http://localhost:8080`.**

4. **Install it:** Chrome ⋮ menu → **Add to Home screen** / **Install app**. Accept.

5. Launch it from the **home-screen icon.** It opens standalone — no URL bar, fullscreen,
   landscape-locked, sticks + rumble live. After the first launch it works **offline**;
   you don't need Termux running to play (the service worker cached it).

## Updating after a new build

Replace `culinary-dash.html` with the fresh `cd test` build, start `serve.py`, open the
installed app **while online once** — the service worker is network-first for the page,
so it pulls the new build and re-caches it. (Bump `CACHE` in `sw.js` if you change the
icon/manifest set.)

## Notes / gotchas

- **Use `localhost`, not the LAN IP, on the device.** Fullscreen and orientation-lock
  need a secure context; `http://<lan-ip>` is not one and Chrome won't offer "Install".
  `http://localhost` and `http://127.0.0.1` count as secure.
- **This kit is for *playing/installing* on the device.** For fast *dev iteration* (edit
  on the Mac, refresh on the Retroid over WiFi), serve the repo root from the Mac with
  `npx -y serve -l 3000 .` and open `http://<mac-ip>:3000/culinary-dash-devtools.html`
  in Chrome — that runs the real gamepad/haptics too, it just won't offer PWA install
  over LAN http.
- `B` stays unbound on purpose — Android routes it to system BACK. Standalone-installed,
  BACK no longer nukes a browser tab, but the mapping is still correct to leave alone.
- The icon is `her_south` (the default chef). Swap `icon-*.png` for `him_*` or a dish if
  you'd rather; keep the sizes and the maskable safe-zone.
