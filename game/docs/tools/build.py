#!/usr/bin/env python3
"""build — culinary-dash.src.html + art/*.b64  ->  culinary-dash.html

The shipped game stays ONE self-contained HTML file with art embedded.
You edit the src; the blobs never enter your context.

  python3 docs/tools/build.py            # build
  python3 docs/tools/build.py --check    # build + verify round-trip vs existing html
"""
import os, re, sys, hashlib

SRC = "culinary-dash.src.html"
OUT = "culinary-dash.html"
ART = "art"
MARK = re.compile(r"^/\*__ART__ (.+?)\*/$")

src = open(SRC, "r", encoding="utf-8", newline="").read()
out, used = [], 0
for i, ln in enumerate(src.split("\n"), 1):
    m = MARK.match(ln)
    if m:
        p = f"{ART}/{m.group(1)}.b64"
        if not os.path.exists(p):
            sys.exit(f"FATAL line {i}: missing art file {p}")
        out.append(open(p, "r", encoding="utf-8", newline="").read())
        used += 1
    else:
        out.append(ln)
built = "\n".join(out)

if "--check" in sys.argv and os.path.exists(OUT):
    old = open(OUT, "r", encoding="utf-8", newline="").read()
    a, b = hashlib.md5(old.encode()).hexdigest(), hashlib.md5(built.encode()).hexdigest()
    print(f"existing: {a}\nrebuilt : {b}")
    print("ROUND-TRIP IDENTICAL ✓" if a == b else "!! DIFFERS !!")
    if a != b:
        sys.exit(1)

with open(OUT, "w", encoding="utf-8", newline="") as f:
    f.write(built)
print(f"built {OUT}: {len(built):,} chars, {used} blobs inlined")
