import json, re, math, sys
from PIL import Image

d = json.load(open("/home/claude/work/room_ops.json"))
ALL, MAIN = d["all"], d["main"]
S = 5

def col(s, a=1.0):
    s = str(s)
    if s.startswith("#"):
        h = s[1:]
        if len(h) == 8:
            a *= int(h[6:8], 16) / 255.0; h = h[:6]
        if len(h) == 3: h = "".join(c * 2 for c in h)
        if len(h) != 6: return None
        try: r, g, b = int(h[0:2],16), int(h[2:4],16), int(h[4:6],16)
        except: return None
        return (r, g, b, max(0, min(255, int(255*a))))
    m = re.match(r"rgba?\(([^)]+)\)", s)
    if m:
        p = [x.strip() for x in m.group(1).split(",")]
        try:
            r, g, b = (int(float(x)) for x in p[:3])
            if len(p) > 3: a *= float(p[3])
            return (r, g, b, max(0, min(255, int(255*a))))
        except: return None
    return None

def render(cid, depth=0, W=320, H=180):
    img = Image.new("RGBA", (W, H), (0,0,0,0))
    if depth > 3 or cid not in ALL: return img
    stack, tx, ty, rot = [], 0.0, 0.0, 0.0
    for op in ALL[cid]:
        k = op[0]
        if k == "save": stack.append((tx,ty,rot))
        elif k == "restore":
            if stack: tx,ty,rot = stack.pop()
        elif k == "tr": tx += op[1]; ty += op[2]
        elif k == "rot": rot += op[1]
        elif k == "ident": tx=ty=0.0; rot=0.0
        elif k == "clr":
            x,y,w,h = [int(round(v)) for v in op[1:5]]
            img.paste((0,0,0,0), (x,y,x+w,y+h))
        elif k == "r":
            x,y,w,h,fs,ga = op[1],op[2],op[3],op[4],op[5],op[6]
            c = col(fs, 1.0 if ga is None else ga)
            if c is None or w is None or h is None: continue
            if abs(rot) > 1e-6:
                # rotate the rect about the current origin (sway); approximate by corner transform
                lay = Image.new("RGBA", (W,H), (0,0,0,0))
                sub = Image.new("RGBA", (max(1,int(round(abs(w)))), max(1,int(round(abs(h))))), c)
                lay.paste(sub, (int(round(x)), int(round(y))))
                lay = lay.rotate(-rot*180/math.pi, resample=Image.NEAREST, center=(0,0))
                off = Image.new("RGBA", (W,H), (0,0,0,0))
                off.paste(lay, (int(round(tx)), int(round(ty))), lay)
                img = Image.alpha_composite(img, off)
            else:
                x2,y2 = x+tx, y+ty
                xi,yi,wi,hi = int(round(x2)), int(round(y2)), int(round(w)), int(round(h))
                if wi <= 0 or hi <= 0: continue
                sub = Image.new("RGBA", (wi,hi), c)
                lay = Image.new("RGBA", (W,H), (0,0,0,0)); lay.paste(sub, (xi,yi))
                img = Image.alpha_composite(img, lay)
        elif k == "img":
            sid, x, y, w, h, ga = op[1], op[2], op[3], op[4], op[5], op[6]
            if sid is None: continue
            src = render(sid, depth+1)
            if x is None: x = 0
            if y is None: y = 0
            lay = Image.new("RGBA", (W,H), (0,0,0,0))
            if w and h and (int(round(w)) != src.width or int(round(h)) != src.height):
                try: src = src.resize((max(1,int(round(w))), max(1,int(round(h)))), Image.NEAREST)
                except: pass
            lay.paste(src, (int(round(x+tx)), int(round(y+ty))), src)
            if ga is not None and ga < 1:
                al = lay.split()[3].point(lambda v: int(v*ga)); lay.putalpha(al)
            img = Image.alpha_composite(img, lay)
    return img

out = render(MAIN)
bg = Image.new("RGBA", (320,180), (12,10,18,255))
out = Image.alpha_composite(bg, out).convert("RGB")
out = out.resize((320*S, 180*S), Image.NEAREST)
name = sys.argv[1] if len(sys.argv) > 1 else "room.png"
out.save("/home/claude/work/" + name)
print("wrote", name)
