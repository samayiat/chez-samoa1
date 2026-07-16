#!/usr/bin/env python3
"""
Culinary Dash — PWA host server (stdlib only, runs in Termux).

Serves the built `culinary-dash.html` and splices the PWA plumbing into its
<head> on the fly, so the game source and the built file are never edited:

  - <link rel="manifest">          -> installable to the home screen
  - theme-color / web-app-capable  -> chrome-less standalone launch
  - apple-touch-icon               -> nice icon on iOS too
  - a tiny service-worker register -> fully offline after the first load

Run it ON the device (localhost is a secure context, so fullscreen +
orientation-lock + install all work and no network is needed):

    python3 serve.py                 # serves ./culinary-dash.html on :8080
    python3 serve.py --game ../culinary-dash-devtools.html
    python3 serve.py --port 3000 --game /sdcard/Download/culinary-dash.html

Then open http://localhost:8080 in Chrome and use the ⋮ menu ->
"Add to Home screen" / "Install app".
"""
import argparse
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))

INJECT = """
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#2c2234">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="apple-touch-icon" href="/icon-180.png">
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function (e) {
      console.warn('SW register failed:', e);
    });
  });
}
</script>
"""

ASSETS = {
    "/manifest.webmanifest": ("manifest.webmanifest", "application/manifest+json"),
    "/sw.js": ("sw.js", "application/javascript"),
    "/icon-192.png": ("icon-192.png", "image/png"),
    "/icon-512.png": ("icon-512.png", "image/png"),
    "/icon-512-maskable.png": ("icon-512-maskable.png", "image/png"),
    "/icon-180.png": ("icon-180.png", "image/png"),
}


def build_handler(game_path):
    class Handler(BaseHTTPRequestHandler):
        server_version = "CulinaryDashPWA/1.0"

        def _send(self, body, ctype, extra=None):
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)

        def _game_html(self):
            with open(game_path, "rb") as f:
                html = f.read()
            marker = b"</head>"
            i = html.lower().find(marker)
            if i != -1:
                html = html[:i] + INJECT.encode("utf-8") + html[i:]
            else:  # no <head>? prepend so the manifest is still found
                html = INJECT.encode("utf-8") + html
            return html

        def do_GET(self):
            path = self.path.split("?", 1)[0]
            try:
                if path in ("/", "/index.html", "/culinary-dash.html"):
                    self._send(self._game_html(), "text/html; charset=utf-8",
                               {"Cache-Control": "no-cache"})
                    return
                if path in ASSETS:
                    fname, ctype = ASSETS[path]
                    with open(os.path.join(HERE, fname), "rb") as f:
                        body = f.read()
                    # sw.js must be revalidated and allowed to control the root scope
                    extra = {}
                    if path == "/sw.js":
                        extra = {"Cache-Control": "no-cache", "Service-Worker-Allowed": "/"}
                    self._send(body, ctype, extra)
                    return
                self.send_error(404, "Not found")
            except FileNotFoundError:
                self.send_error(404, "Not found")
            except BrokenPipeError:
                pass

        do_HEAD = do_GET

        def log_message(self, fmt, *args):
            sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    return Handler


def main():
    ap = argparse.ArgumentParser(description="Culinary Dash PWA host server")
    ap.add_argument("--game", default=os.path.join(HERE, "culinary-dash.html"),
                    help="path to the built game HTML (default: ./culinary-dash.html)")
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--host", default="0.0.0.0",
                    help="bind address (default 0.0.0.0; open it via http://localhost:PORT)")
    args = ap.parse_args()

    if not os.path.isfile(args.game):
        sys.exit(
            "error: game file not found: %s\n"
            "  copy the built culinary-dash.html next to serve.py, or pass --game PATH"
            % args.game
        )

    httpd = ThreadingHTTPServer((args.host, args.port), build_handler(args.game))
    print("Culinary Dash PWA host")
    print("  serving : %s" % args.game)
    print("  open    : http://localhost:%d   (on the device — install from the ⋮ menu)" % args.port)
    print("  stop    : Ctrl-C")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")


if __name__ == "__main__":
    main()
