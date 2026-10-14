# Turns the generated masters in ../art into the web-ready files the SVGator project links to (../assets).
import os, sys
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

A = os.path.join(os.path.dirname(__file__), '..', 'art')
O = os.path.join(os.path.dirname(__file__), '..', 'assets')
os.makedirs(O, exist_ok=True)
op = lambda n: Image.open(os.path.join(A, n))
def save(im, name, **kw):
    p = os.path.join(O, name); im.save(p, **kw); print(f'{name:28s} {im.size} {os.path.getsize(p)//1024} KB')

# full-frame plates
# forest: the generated plate is almost black on the left third; lift it there so trees read behind the headline
bg = np.asarray(op('bg.png').convert('RGB').resize((2560, 1440), Image.LANCZOS)).astype(float) / 255
gam = 0.6 + 0.4 * np.clip(np.linspace(0, 1, 2560) / 0.55, 0, 1) ** 1.5
save(Image.fromarray((bg ** gam[None, :, None] * 255).astype('uint8')), 'forest.jpg', quality=88)
save(op('char.png').resize((3840, 2160), Image.LANCZOS), 'sorcerer.webp', quality=90, method=5)
save(op('fgleaves.png').resize((2560, 1440), Image.LANCZOS), 'leaves-frame.webp', quality=86, method=5)

# face: the open-eye plate is the closed plate with only the eye region swapped, so nothing else shifts
fc = op('face_closed.png').convert('RGB').resize((3840, 2160), Image.LANCZOS)
fo = op('face_open.png').convert('RGB').resize((3840, 2160), Image.LANCZOS)
m = Image.new('L', fc.size, 0)
ex, ey = 1161 * 2, 347 * 2
ImageDraw.Draw(m).ellipse([ex - 250, ey - 150, ex + 250, ey + 150], fill=255)
m = m.filter(ImageFilter.GaussianBlur(50))
save(fc, 'face-closed.jpg', quality=88)
save(Image.composite(fo, fc, m), 'face-open.jpg', quality=88)

# rune circle (light on black, used with screen blend), split into two bands that turn against each other
r = op('rune.png').convert('RGB').resize((2048, 2048), Image.LANCZOS)
n = np.asarray(r).astype(float)
yy, xx = np.mgrid[0:2048, 0:2048]
rad = np.hypot(xx - 1023.5, yy - 1023.5) / 1024.0
split, f = 0.725, 0.012
w_out = np.clip((rad - (split - f)) / (2 * f), 0, 1)[..., None]
save(Image.fromarray((n * w_out).astype('uint8')), 'rune-outer.jpg', quality=88)
save(Image.fromarray((n * (1 - w_out)).astype('uint8')), 'rune-inner.jpg', quality=88)
save(r.resize((512, 512)).filter(ImageFilter.GaussianBlur(14)), 'rune-glow.jpg', quality=80)

# glass orb: neutral highlights on black (screen blend), so it never fights the brand colour
g = op('orb.png').convert('L').resize((1024, 1024), Image.LANCZOS)
save(Image.merge('RGB', (g, g, g)), 'orb-glass.jpg', quality=90)
save(op('island.png').convert('RGB').resize((1024, 1024), Image.LANCZOS), 'product-demo.jpg', quality=90)
save(op('headphones.png').convert('RGB').resize((1024, 1024), Image.LANCZOS), 'product-demo-2.jpg', quality=90)

# sprite sheet -> one file per object (fixed 3x2 cells: the maple stem touches the lantern chain, so no blob labelling)
s = op('sprites.png'); W3 = s.width // 3
cells = {'leaf-oak': (0, 0), 'leaf-maple': (1, 0), 'leaf-beech': (2, 0), 'butterfly': (0, 1), 'lantern': (1, 1), 'twig': (2, 1)}
for nm, (cx, cy) in cells.items():
    c = s.crop((cx * W3, 0 if cy == 0 else 745, (cx + 1) * W3, 745 if cy == 0 else s.height))
    a = np.asarray(c)[:, :, 3]; ys, xs = np.where(a > 24)
    c = c.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    c.thumbnail((640, 640), Image.LANCZOS)
    save(c, nm + '.webp', quality=90, method=5)
