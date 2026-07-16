from PIL import Image
D = "work/sprites/combo"
BG = (22, 19, 32)
SCALE = 3

def make(name, files, dur=100):
    imgs = []
    for f in files:
        im = Image.open(f).convert("RGBA")
        bg = Image.new("RGBA", im.size, BG + (255,))
        bg.alpha_composite(im)
        rgb = bg.convert("RGB").resize((im.width * SCALE, im.height * SCALE), Image.NEAREST)
        imgs.append(rgb.convert("P", palette=Image.ADAPTIVE))
    imgs[0].save(f"{D}/{name}.gif", save_all=True, append_images=imgs[1:],
                 duration=dur, loop=0, disposal=2)
    print(name, len(imgs), "frames")

def fr(prefix, n):
    return [f"{D}/{prefix}_{i}.png" for i in range(n)]

make("jab", fr("jab", 3))
make("cross", fr("cross", 6))
make("roundhouse", fr("roundhouse", 7))
make("uppercut", fr("uppercut", 7))
make("takingpunch", fr("takingpunch", 6))
make("combo", fr("jab", 3) + fr("cross", 6) + fr("roundhouse", 7), dur=90)
