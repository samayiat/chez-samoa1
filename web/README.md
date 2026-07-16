# Culinary Dash — hosted PWA (Cloudflare Pages)

This folder is the **online** version of the game: the built game with the PWA plumbing
baked into its `<head>`, plus the manifest, service worker, and icons — all root-relative.
Hosting it means **no Termux, no local server** to update: push a new build, the host
redeploys, and the installed app pulls it on the next online launch.

## One-time setup (Cloudflare Pages — free, works with a private repo)

1. Sign in / create a free account at https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Authorize GitHub, pick the repo **`samayiat/chez-samoa1`**.
3. Configure the build:
   - **Production branch:** `claude/unzip-file-mf4npt`
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `web`
4. **Save and Deploy.** You get a URL like `https://culinary-dash.pages.dev`.

## Install on the Retroid (once)

Open the `*.pages.dev` URL in Chrome → ⋮ → **Install app**. It's a real HTTPS origin
(secure context), so fullscreen, orientation-lock, gamepad, and install all work — same as
the localhost server, but no server to run.

## Updating — the whole ritual, from anywhere

1. New build lands in `game/culinary-dash.html`.
2. `python3 web/build_web.py`  → regenerates `web/index.html`.
3. Commit + push.
4. Cloudflare redeploys in ~1 min. **Reopen the app on the Retroid while online** — the
   service worker is network-first, so it fetches the new build. Done. No device commands.

(Termux is now optional — only needed if you want to edit *on* the device.)
