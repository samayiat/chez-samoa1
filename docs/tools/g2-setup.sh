#!/usr/bin/env bash
# g2-setup.sh — stand up the Culinary Dash dev loop on a Retroid Pocket G2.
# v2 — see CHANGES FROM v1 at the bottom.
#
# LAYOUT (this is the important part):
#
#   /root/culinary-dash        <- THE REPO. Debian's own ext4 rootfs.
#                                 Real exec bits, real file modes, symlinks.
#   /sdcard/culinary-dash      <- DROP ZONE. Android FUSE. The built .html
#                                 lands here so the browser can open it.
#                                 Nothing else goes here. Ever.
#
# The repo does NOT live on /sdcard. /storage/emulated is FUSE, mounted
# noexec, with no POSIX permission bits: chmod +x silently succeeds and
# changes nothing, and `docs/tools/cd test` dies at its own `"$0" script`
# self-invocation — after the build has already succeeded, so it reads like
# a harness bug. Source on ext4, artifact on FUSE. That's the whole trick.
#
# Run it twice. It auto-detects where it is:
#   $ bash g2-setup.sh      # in Termux — installs Debian, cdg2, drop zone
#   $ cdg2                  # into Debian, wake-lock held
#   $ bash g2-setup.sh      # again, inside Debian — toolchain + Claude Code
#
# Idempotent. Safe to re-run.
#
# WHY DEBIAN AND NOT TERMUX: Claude Code ships as a glibc-linked linux-arm64
# binary; Termux is Bionic. The agent can only shell out to the environment
# it lives in, so the toolchain lives there too. One box, not two.

set -euo pipefail

DROP_HOST="${DROP_HOST:-/sdcard/culinary-dash}"    # Android-visible
DROP="${DROP:-/root/shared}"                       # same dir, inside Debian
PROJECT="${PROJECT:-/root/culinary-dash}"          # the repo, on ext4
DISTRO="${DISTRO:-debian}"

say()  { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
ok()   { printf '    \033[32m/\033[0m %s\n' "$*"; }
warn() { printf '    \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31mFATAL:\033[0m %s\n' "$*" >&2; exit 1; }

if [ -d /data/data/com.termux/files/usr ] && ! [ -f /etc/debian_version ]; then
  ENV=termux
elif [ -f /etc/debian_version ]; then
  ENV=debian
else
  die "Don't recognise this environment. Expected Termux or proot-Debian."
fi

# =====================================================================
# TERMUX SIDE
# =====================================================================
if [ "$ENV" = termux ]; then
  say "Termux side"

  pkg update -y >/dev/null 2>&1 || warn "pkg update had issues; continuing"
  pkg install -y proot-distro >/dev/null
  ok "proot-distro present"

  if [ ! -d "$HOME/storage" ]; then
    warn "Shared storage not set up. Run: termux-setup-storage"
    warn "Grant the permission, then re-run this script."
    exit 1
  fi
  mkdir -p "$HOME/storage/shared/culinary-dash"
  ok "drop zone: $DROP_HOST"

  # Ask proot-distro whether the container WORKS, rather than guessing where
  # it keeps its rootfs. The installed-rootfs path is an implementation
  # detail and varies by version; a functional login test never goes stale.
  if proot-distro login "$DISTRO" -- true >/dev/null 2>&1; then
    ok "$DISTRO already installed and usable"
  else
    say "Installing $DISTRO rootfs (a few minutes)"
    # 'already exists' is a success for our purposes, not a failure.
    proot-distro install "$DISTRO" 2>&1 | tee /tmp/pd-install.log || {
      grep -q "already exists" /tmp/pd-install.log \
        || die "proot-distro install failed — see /tmp/pd-install.log"
      ok "$DISTRO container already present"
    }
  fi

  # --- the launcher ---------------------------------------------------
  # NO exec. `exec proot-distro ...` replaces this shell image and takes the
  # EXIT trap with it, so termux-wake-unlock never fires and the lock leaks
  # until Termux is force-stopped. It fails silently as battery drain, never
  # as an error. proot runs as a child; the trap survives.
  #
  # The `--` matters too: without it a passed command gets parsed as
  # proot-distro's own options.
  LAUNCHER="$PREFIX/bin/cdg2"
  cat > "$LAUNCHER" <<EOF
#!/data/data/com.termux/files/usr/bin/bash
# cdg2 — enter the Culinary Dash dev environment, screen-off guard on.
set -euo pipefail
termux-wake-lock
trap 'termux-wake-unlock' EXIT
proot-distro login $DISTRO --bind $DROP_HOST:$DROP -- "\$@"
EOF
  chmod +x "$LAUNCHER"
  ok "launcher installed: cdg2 (wake-lock released on exit)"

  cat <<EOF

  Termux side done.

  NEXT:
    1. Settings -> Apps -> Termux -> Battery -> Unrestricted.
       The wake-lock alone will not save an overnight session.
    2. cdg2
    3. Inside Debian:  bash /root/g2-setup.sh

  (Termux can read the whole Debian rootfs, so to get this script in:
     cp g2-setup.sh \$PREFIX/var/lib/proot-distro/installed-rootfs/$DISTRO/root/
   The reverse needs a mount you don't have yet — hence this direction.)

EOF
  exit 0
fi

# =====================================================================
# DEBIAN SIDE
# =====================================================================
say "Debian side"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq python3 git ripgrep curl ca-certificates gawk >/dev/null
ok "python3, git, ripgrep, gawk"

need_node=1
if command -v node >/dev/null 2>&1; then
  major="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
  if [ "$major" -ge 18 ]; then ok "node $(node -v)"; need_node=0
  else warn "node $(node -v) too old (<18); upgrading"; fi
fi
if [ "$need_node" -eq 1 ]; then
  apt-get install -y -qq nodejs npm >/dev/null 2>&1 || true
  major="$(node -v 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/' || echo 0)"
  if [ "${major:-0}" -lt 18 ]; then
    say "Installing Node 22 from NodeSource"
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
    apt-get install -y -qq nodejs >/dev/null
  fi
  ok "node $(node -v)"
fi

if command -v claude >/dev/null 2>&1; then
  ok "claude $(claude --version 2>/dev/null || echo '(installed)')"
else
  say "Installing Claude Code"
  npm install -g @anthropic-ai/claude-code >/dev/null
  ok "claude $(claude --version 2>/dev/null || echo installed)"
fi

# Remote Control refuses API-key auth, and the error it throws talks about
# organization policy — which sends you hunting in the wrong place entirely.
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  warn "ANTHROPIC_API_KEY is set. Remote Control requires claude.ai OAuth and"
  warn "will refuse to start. Unset it, then: claude -> /login"
else
  ok "no ANTHROPIC_API_KEY (good — Remote Control needs OAuth)"
fi

say "Verifying the toolchain"
for t in bash python3 node awk sed grep; do
  command -v "$t" >/dev/null || die "missing: $t"
done
ok "cd grep / show / build / test have what they need"

# --- the noexec trap ------------------------------------------------------
if [ -d "$DROP" ]; then
  ok "drop zone mounted at $DROP -> $DROP_HOST"
else
  warn "$DROP not mounted. Enter via 'cdg2', not a bare proot-distro login."
fi

case "$(readlink -f "$PROJECT" 2>/dev/null || echo "$PROJECT")" in
  /storage/*|/sdcard/*|"$DROP"/*)
    die "$PROJECT is on Android's FUSE mount. It is noexec with no permission
       bits: chmod +x will lie to you and 'cd test' will die at its own
       \"\$0\" script self-invocation, after the build succeeds. Move the repo
       to the Debian rootfs and let only the built .html go to ${DROP}." ;;
esac

if [ -f "$PROJECT/culinary-dash.src.html" ]; then
  ok "project found at $PROJECT (ext4 — exec bits real)"
  if [ -x "$PROJECT/docs/tools/cd" ]; then
    ok "docs/tools/cd is executable"
  else
    warn "docs/tools/cd not executable — run: chmod +x $PROJECT/docs/tools/cd"
  fi
else
  warn "no culinary-dash.src.html at $PROJECT yet — clone/copy the repo there"
fi

cat <<EOF

  Debian side done.

  FIRST RUN (once — workspace trust + sign in):
    cd $PROJECT && claude
    /login          # claude.ai account, NOT an API key
    exit

  THE LOOP:
    cd $PROJECT
    ./docs/tools/cd test              # build + harness, on the G2
    cp culinary-dash.html $DROP/      # hand it to Android
    # then in the G2's browser:  file://$DROP_HOST/culinary-dash.html

  DRIVE IT FROM THE IPHONE:
    claude remote-control --name culinary-dash
    # spacebar -> QR -> scan. Or: Claude app -> Code tab -> culinary-dash.
    # Outbound HTTPS only. No sshd, no Tailscale, no port forwarding.

  PUSH:
    /config -> 'Push when Claude decides'
    then: "run cd test, copy the build to $DROP, notify me when it passes"

  IF A SESSION DIES OVERNIGHT: battery optimisation, not the network.
  Termux must be Unrestricted. A >10min network gap also exits the process.

EOF

# ---------------------------------------------------------------------
# CHANGES FROM v1
#   1. cdg2 no longer execs. exec replaced the shell image and took the EXIT
#      trap with it — the wake-lock leaked until Termux was force-stopped.
#      Added -- before "$@" so passed commands aren't eaten as options.
#   2. Repo moved off /sdcard to the Debian rootfs. The FUSE mount is noexec
#      with no permission bits; 'bash docs/tools/cd test' is NOT a sufficient
#      workaround because cd re-execs itself via "$0". Only the built
#      artifact goes to shared storage now. This also fixes git's
#      core.fileMode spurious diffs and symlink loss for free.
#   3. Hard failure if PROJECT is on FUSE, rather than a warning.
# ---------------------------------------------------------------------
