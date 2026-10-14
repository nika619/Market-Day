# Turns the generated market art in ../art-market into the web-ready files in ../assets/market (linked by scene-market.js).
# Light sprites (glow, spark, streak, vignette) are shared with the first build and stay in ../assets.
import os, json
import numpy as np
from PIL import Image, ImageFilter

D = os.path.dirname(__file__)
A = os.path.join(D, '..', 'art-market')
O = os.path.join(D, '..', 'assets', 'market')
os.makedirs(O, exist_ok=True)
op = lambda n: Image.open(os.path.join(A, n))
def save(im, name, **kw):
    p = os.path.join(O, name); im.save(p, **kw); print(f'{name:24s} {im.size} {os.path.getsize(p)//1024} KB')

stall = op('stall.png').convert('RGB')
save(stall.resize((2560, 1440), Image.LANCZOS), 'stall.jpg', quality=88)
save(stall.resize((1280, 720), Image.LANCZOS).filter(ImageFilter.GaussianBlur(14)), 'stall-soft.jpg', quality=80)
save(op('macro.png').convert('RGB').resize((3200, 1800), Image.LANCZOS), 'macro.jpg', quality=86)

seller = op('seller.png').convert('RGBA')
save(seller.resize((3840, 2160), Image.LANCZOS), 'seller.webp', quality=90, method=5)
save(seller.resize((960, 540), Image.LANCZOS).filter(ImageFilter.GaussianBlur(8)), 'seller-soft.webp', quality=80, method=5)
save(op('fg.png').convert('RGBA').resize((1280, 720), Image.LANCZOS), 'fg-soft.webp', quality=84, method=5)

# sprite sheet: 3 x 2 equal cells, each cropped to its alpha bounding box
s = op('sprites.png').convert('RGBA'); cw, ch = s.width // 3, s.height // 2
cells = {'tag': (0, 0), 'sprig': (1, 0), 'parcel': (2, 0), 'petal': (0, 1), 'bulb': (1, 1), 'twine': (2, 1)}
for nm, (cx, cy) in cells.items():
    c = s.crop((cx * cw, cy * ch, (cx + 1) * cw, (cy + 1) * ch))
    ys, xs = np.where(np.asarray(c)[:, :, 3] > 24)
    c = c.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)); c.thumbnail((560, 560), Image.LANCZOS)
    save(c, nm + '.webp', quality=90, method=5)

for n, f in (('product1', 'product-demo.jpg'), ('product2', 'product-demo-2.jpg')):
    save(op(n + '.png').convert('RGB').resize((1024, 1024), Image.LANCZOS), f, quality=90)

# string-light positions in plate pixels (2560 x 1440): bright local maxima in the upper part of the stall plate
g = np.asarray(stall.resize((640, 360)).convert('L').filter(ImageFilter.GaussianBlur(1.5))).astype(float)
mx = np.asarray(Image.fromarray(g.astype('uint8')).filter(ImageFilter.MaxFilter(21))).astype(float)
ys, xs = np.where((g >= mx) & (g > 232) & (np.arange(360)[:, None] < 150))
pts = sorted(((int(x * 4), int(y * 4)) for x, y in zip(xs, ys)), key=lambda p: p[0])
json.dump(pts, open(os.path.join(D, 'lights.json'), 'w')); print(len(pts), 'string lights', pts[:40])

LOGO1 = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><g fill="none" stroke="#f6eedc" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="60" cy="60" r="46"/><path d="M60 24c14 14 18 28 0 46-18-18-14-32 0-46z" fill="#f6eedc"/><path d="M38 86c14-6 30-6 44 0"/></g></svg>'''
LOGO2 = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><g fill="none" stroke="#eaf3ee" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M26 44h56v26a24 24 0 01-24 24h-8a24 24 0 01-24-24z" fill="#eaf3ee"/><path d="M82 52h8a10 10 0 010 20h-8"/><path d="M44 28c-4 4 4 6 0 10M60 26c-4 4 4 6 0 10"/></g></svg>'''
for nm, sv in (('logo-demo.svg', LOGO1), ('logo-demo-2.svg', LOGO2)):
    open(os.path.join(O, nm), 'w', encoding='utf8').write(sv); print(nm)
