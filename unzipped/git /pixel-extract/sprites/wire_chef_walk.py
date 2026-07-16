#!/usr/bin/env python3
"""One-off: build CHARS[chefM]/CHARS[chefF] walk/idle blobs from already-generated PixelLab art.
idle = the character rotation (south/east/north -> front/right/back).
walk1/walk2 = frames 0 and 2 of the 4-frame running-4-frames animation for that direction.
west has no generated data (never rendered) -> omitted, same disclosed gap as combat's 'left'.
"""
import ssl, base64, json, urllib.request, sys, io
from PIL import Image

CDN = "https://backblaze.pixellab.ai/file/pixellab-characters/d54cfff1-4f62-4b10-bf5f-c04ee40e807c"
DIRMAP = {"south": "front", "east": "right", "north": "back"}

def flip_png(png):
    im = Image.open(io.BytesIO(png)).convert("RGBA").transpose(Image.FLIP_LEFT_RIGHT)
    buf = io.BytesIO(); im.save(buf, "PNG"); return buf.getvalue()

def ctx():
    c = ssl.create_default_context()
    if not c.get_ca_certs():
        c.load_verify_locations("/etc/ssl/cert.pem")
    return c

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120, context=ctx()) as r:
        return r.read()

def datauri(png):
    if png[:8] != b"\x89PNG\r\n\x1a\n":
        sys.exit("not a PNG: %r" % png[:12])
    return "data:image/png;base64," + base64.b64encode(png).decode()

CHEFS = {
    "chefM": {
        "id": "59ac123a-846e-4ff8-b363-2d0e4d3f2482",
        "run": {
            "south": "dadc2fc8-324e-420e-baef-59729a3b9874",
            "east": "6772a7cc-8c9c-40c1-aa5b-f54b216f150d",
            "north": "b0ace03a-690f-49cb-a114-9862cb82a3c3",
        },
    },
    "chefF": {
        "id": "345b84b7-e5b6-4384-a37b-33ec60200b6e",
        "run": {
            "south": "4559b281-df3c-4bad-b45f-b1919d85b997",
            "east": "4ec4fad2-5c3f-4dfe-a87d-a7ffcbb2cfa4",
            "north": "87d2faa6-44f5-45d0-a803-b1c5f7b84569",
        },
    },
}

out_parts = []
for name, cfg in CHEFS.items():
    cid = cfg["id"]
    dparts = []
    east_raw = {}
    for d, dkey in DIRMAP.items():
        idle_png = fetch(f"{CDN}/{cid}/rotations/{d}.png")
        anim_id = cfg["run"][d]
        w1_png = fetch(f"{CDN}/{cid}/animations/{anim_id}/{d}/0.png")
        w2_png = fetch(f"{CDN}/{cid}/animations/{anim_id}/{d}/2.png")
        dparts.append('%s:{idle:%s,walk1:%s,walk2:%s}' % (
            dkey, json.dumps(datauri(idle_png)), json.dumps(datauri(w1_png)), json.dumps(datauri(w2_png))))
        if d == "east":
            east_raw = {"idle": idle_png, "w1": w1_png, "w2": w2_png}
        print(f"  {name} {d}->{dkey}: idle+walk1+walk2 fetched", file=sys.stderr)
    # left = horizontally-mirrored east (the game's own L/R-mirror convention; no separate west anim exists)
    dparts.append('left:{idle:%s,walk1:%s,walk2:%s}' % (
        json.dumps(datauri(flip_png(east_raw["idle"]))),
        json.dumps(datauri(flip_png(east_raw["w1"]))),
        json.dumps(datauri(flip_png(east_raw["w2"])))))
    print(f"  {name} left (mirrored east)", file=sys.stderr)
    out_parts.append('%s:{%s}' % (name, ",".join(dparts)))

body = "\n".join(p + "," for p in out_parts) + "\n"
open("art/0797_chefM.b64", "w").write(out_parts[0] + ",\n")
open("art/0798_chefF.b64", "w").write(out_parts[1] + ",\n")
print("wrote art/0797_chefM.b64 (%d chars), art/0798_chefF.b64 (%d chars)" % (
    len(out_parts[0]), len(out_parts[1])), file=sys.stderr)
