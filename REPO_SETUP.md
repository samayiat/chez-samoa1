# REPO_SETUP — read once, then delete

This is the complete repo. Nothing is missing.

`art/` was **reconstructed** here by reversing the build: your
`culinary-dash_src.html` has 26 marker lines and the shipped
`culinary-dash.html` has identical line numbering, so each blob was lifted from
the built file at its marker's line. Every non-marker line matched byte-for-byte,
and `build.py --check` confirms it:

```
existing: fa5d4ec3e33608c6e5ee926b335be4ac
rebuilt : fa5d4ec3e33608c6e5ee926b335be4ac
ROUND-TRIP IDENTICAL ✓
```

`docs/tools/cd test` then ran clean: **ALL PHASE-A CHECKS PASSED**.

## Push it

**Private repo.** It's a gift for one person.

```bash
cd <this-folder>
git init
git branch -M main
git add .
git status                  # check the three things below
git commit -m "Initial commit: Culinary Dash"
git remote add origin git@github.com:<you>/culinary-dash.git
git push -u origin main
```

### Check `git status` before committing

1. **`culinary-dash.html` is NOT listed** — it's gitignored and ships via
   Releases. If it appears, `.gitignore` isn't at the root.
2. **`art/*.b64` ARE listed** — 26 of them. They're build inputs.
3. **`git ls-files -s docs/tools/cd` shows `100755`.** If it says `100644` the
   exec bit was lost and you unzipped onto a FUSE mount — see DECISIONS.md.

## Clone onto the G2

```bash
cdg2
export PATH="$HOME/.local/bin:$PATH"
cd /root
git clone git@github.com:<you>/culinary-dash.git
cd culinary-dash
./docs/tools/cd test          # -> ALL PHASE-A CHECKS PASSED
cp culinary-dash.html /root/shared/
# browser: file:///sdcard/culinary-dash/culinary-dash.html
```

`/root` is ext4 with real exec bits. **Not `/sdcard`** — that's locked.

## Ship a build to her

```bash
./docs/tools/cd test
gh release create v0.1.0 culinary-dash.html --notes "..."
```

## Deliberately NOT in this repo

- **`culinary-dash.html`** — generated, gitignored, ships as a Release asset.
- **`culinary-dash-devtools.html`** — the DEV build. Gitignored, and it was
  removed from this tree. It's one flag away from her build, which is exactly
  what makes it dangerous. Regenerate it; never commit it.
- **`pixel lab zip 7-15.zip`** — the PNG sprite masters from Pixel Lab. These
  are upstream of `ingest`, not build inputs, and the build never reads them.
  **They are still worth keeping** — they're the only source for re-ingesting a
  sprite at a different size or hue. Put them in a separate `culinary-dash-art`
  repo or cloud storage. Don't let them rot on a laptop; `art/*.b64` can be
  rebuilt from them, but they can't be rebuilt from anything.
