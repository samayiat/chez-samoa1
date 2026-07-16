#!/usr/bin/env python3
"""One-shot: split culinary-dash.html into a greppable src + art/ blobs.

Line-for-line: every art blob line is replaced by a ONE-LINE marker, so
src and built file have IDENTICAL line numbers. Line refs stay valid forever.
"""
import os, re, sys, hashlib

BIG = 5000
HTML = "culinary-dash.html"
SRC  = "culinary-dash.src.html"
ART  = "art"

raw = open(HTML, "r", encoding="utf-8", newline="").read()
lines = raw.split("\n")

os.makedirs(ART, exist_ok=True)
out, n = [], 0
for i, ln in enumerate(lines, 1):
    if len(ln) > BIG:
        # name it after the first identifier on the line
        m = re.search(r"([A-Za-z_][A-Za-z0-9_]*)\s*[:=]", ln)
        key = m.group(1) if m else "art"
        name = f"{i:04d}_{key}"
        with open(f"{ART}/{name}.b64", "w", encoding="utf-8", newline="") as f:
            f.write(ln)
        out.append(f"/*__ART__ {name}*/")
        n += 1
    else:
        out.append(ln)

with open(SRC, "w", encoding="utf-8", newline="") as f:
    f.write("\n".join(out))

print(f"extracted {n} blobs -> {ART}/")
print(f"{HTML}: {len(raw):,} chars")
print(f"{SRC}: {os.path.getsize(SRC):,} chars  <- the file you actually work in")
print(f"art/: {sum(os.path.getsize(f'{ART}/{x}') for x in os.listdir(ART)):,} chars (never read this)")
