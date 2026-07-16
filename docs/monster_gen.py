"""Culinary Dash — 8-bit monster generator (mirror-noise creatures).
Deterministic per seed. Usage: gen_monster(seed, gw=6, gh=12) -> PIL RGBA."""
from PIL import Image
import numpy as np
from scipy import ndimage
import random

PALETTES=[  # (dark, base, light) — moody, fits the game floor
 ((36,18,48),(96,48,128),(168,104,200)),   # witch purple
 ((14,40,30),(40,110,70),(120,200,140)),   # slime green
 ((50,16,16),(140,40,40),(230,110,90)),    # rage red
 ((16,28,52),(48,84,150),(130,180,240)),   # spook blue
 ((48,34,12),(130,96,32),(220,180,90)),    # bog gold
 ((30,30,36),(90,90,104),(190,190,210)),   # ghost grey
 ((40,12,36),(130,40,110),(230,120,200)),  # neon pink
 ((10,36,40),(30,110,120),(110,220,230)),  # deep teal
]

def gen_monster(seed, gw=6, gh=12, density=0.52, eyes=None, palette=None, big=False):
    rng=random.Random(seed)
    if big: gw,gh=gw+3,gh+6
    # noise half-grid, denser toward bottom (legs) and center (body)
    half=np.zeros((gh,gw),bool)
    for y in range(gh):
        for x in range(gw):
            p=density*(0.55+0.7*(y/gh))*(0.6+0.8*(x/gw))
            half[y,x]=rng.random()<p
    # smooth: kill lonely px, fill strong neighbors (one CA pass)
    for _ in range(2):
        n=sum(np.roll(np.roll(half,dy,0),dx,1) for dy in(-1,0,1) for dx in(-1,0,1))-half
        half=(half&(n>=2))|(n>=5)
    grid=np.hstack([half, half[:,::-1]])                     # mirror -> symmetry
    lab,n=ndimage.label(grid)
    if n>1:
        sizes=ndimage.sum(grid,lab,range(1,n+1)); grid=(lab==(np.argmax(sizes)+1))
    if grid.sum()<10: return gen_monster(seed+1000,gw,gh,density,eyes,palette,big)
    H,W=grid.shape
    pal=palette if palette is not None else PALETTES[rng.randrange(len(PALETTES))]
    dark,base,light=pal
    img=np.zeros((H,W,4),np.uint8)
    img[grid]= (*base,255)
    # shading: light on top-left body edge, dark on bottom
    up=grid&~np.roll(grid,1,0); img[up]= (*light,255)
    dn=grid&~np.roll(grid,-1,0); img[dn]= (*dark,255)
    # eyes: symmetric bright pair (or one cyclops) in upper body third
    ys,xs=np.where(grid[:max(2,H//2)])
    if len(ys)==0: ys,xs=np.where(grid)
    ecount = eyes if eyes is not None else rng.choice([1,2,2,2,3])
    ey=int(np.median(ys)); mid=W//2
    cols=[mid-2,mid+1] if ecount==2 else ([mid] if ecount==1 else [mid-3,mid,mid+2])
    placed=0
    for ex in cols:
        cand=[(abs(yy-ey)+abs(xx-ex),yy,xx) for yy,xx in zip(ys,xs) if abs(xx-ex)<=2 and abs(yy-ey)<=3]
        if not cand: continue
        _,py,px=min(cand)
        img[py,px]=(255,255,255,255); placed+=1
        if py+1<H and grid[py+1,px]: img[py+1,px]=(20,16,28,255)
    if placed==0:
        cand=[(abs(yy-ey)+abs(xx-mid),yy,xx) for yy,xx in zip(ys,xs)]
        _,py,px=min(cand)
        img[py,px]=(255,255,255,255)
        if py+1<H and grid[py+1,px]: img[py+1,px]=(20,16,28,255)
    # 1px outline
    out=Image.fromarray(img)
    a=np.asarray(out).copy()
    solid=a[:,:,3]>0
    ring=ndimage.binary_dilation(solid)&~solid
    padded=np.zeros((H+2,W+2,4),np.uint8); padded[1:-1,1:-1]=a
    ps=np.zeros((H+2,W+2),bool); ps[1:-1,1:-1]=solid
    ring=ndimage.binary_dilation(ps)&~ps
    padded[ring]=(12,10,16,255)
    return Image.fromarray(padded)
