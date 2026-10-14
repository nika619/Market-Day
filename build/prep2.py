# Procedural light sprites and helper plates (all drawn here, no outside art). Light sprites sit on black and are used with screen blend.
import os
import numpy as np
from PIL import Image, ImageFilter

O = os.path.join(os.path.dirname(__file__), '..', 'assets')
def save(im, name, **kw):
    p = os.path.join(O, name); im.save(p, **kw); print(f'{name:28s} {im.size} {os.path.getsize(p)//1024} KB')
def radial(n, power):
    yy, xx = np.mgrid[0:n, 0:n]; r = np.hypot(xx - (n - 1) / 2, yy - (n - 1) / 2) / (n / 2)
    return np.clip(1 - r, 0, 1) ** power
def tint(a, rgb): return Image.fromarray((a[..., None] * np.array(rgb)).clip(0, 255).astype('uint8'))

g = radial(256, 2.4)
save(tint(g, (255, 244, 224)), 'glow.jpg', quality=92)          # warm white
save(tint(g, (255, 178, 74)), 'glow-gold.jpg', quality=92)      # gold
# four-point star: bright core + two thin crossed streaks
n = 384; yy, xx = np.mgrid[0:n, 0:n]; x = (xx - (n - 1) / 2) / (n / 2); y = (yy - (n - 1) / 2) / (n / 2)
star = np.clip(1 - np.abs(x), 0, 1) ** 3 * np.exp(-(y * 46) ** 2) + np.clip(1 - np.abs(y), 0, 1) ** 3 * np.exp(-(x * 46) ** 2) + radial(n, 5) * 0.9
save(tint(np.clip(star, 0, 1), (255, 236, 196)), 'spark.jpg', quality=92)
# anamorphic streak
w, h = 1024, 96; yy, xx = np.mgrid[0:h, 0:w]; x = (xx - (w - 1) / 2) / (w / 2); y = (yy - (h - 1) / 2) / (h / 2)
st = np.clip(1 - np.abs(x), 0, 1) ** 2.2 * np.exp(-(y * 5.5) ** 2)
save(tint(st, (255, 214, 150)), 'streak.jpg', quality=92)
# vignette and left scrim: black with alpha
w, h = 480, 270; yy, xx = np.mgrid[0:h, 0:w]; x = (xx - (w - 1) / 2) / (w / 2); y = (yy - (h - 1) / 2) / (h / 2)
va = np.clip((np.hypot(x * 0.92, y * 1.05) - 0.62) / 0.75, 0, 1) ** 1.6 * 0.72
save(Image.fromarray(np.dstack([np.zeros((h, w, 3)), va * 255]).astype('uint8'), 'RGBA'), 'vignette.png')
sa = np.clip(1 - xx / (w * 0.66), 0, 1) ** 1.6 * 0.7
save(Image.fromarray(np.dstack([np.zeros((h, w, 3)), sa * 255]).astype('uint8'), 'RGBA'), 'scrim-left.png')

# black silhouette of the sorcerer (same outline), faded over him instead of a brightness filter
c = Image.open(os.path.join(O, 'sorcerer.webp')).resize((1920, 1080), Image.LANCZOS)
sil = Image.merge('RGBA', (*[Image.new('L', c.size, v) for v in (3, 4, 8)], c.getchannel('A')))
save(sil, 'sorcerer-shadow.webp', quality=80, method=5)
# out-of-focus foreground copies (blurred here once, so the project needs no blur filter)
lf = Image.open(os.path.join(O, 'leaves-frame.webp')).resize((1280, 720), Image.LANCZOS)
save(lf.filter(ImageFilter.GaussianBlur(5)), 'leaves-frame-soft.webp', quality=82, method=5)
lo = Image.open(os.path.join(O, 'leaf-oak.webp')); pad = Image.new('RGBA', (lo.width + 120, lo.height + 120), (0, 0, 0, 0)); pad.paste(lo, (60, 60))
save(pad.filter(ImageFilter.GaussianBlur(14)), 'leaf-soft.webp', quality=80, method=5)

# blurred copies for the frosted glass card
save(Image.open(os.path.join(O, 'forest.jpg')).resize((1280, 720), Image.LANCZOS).filter(ImageFilter.GaussianBlur(16)), 'forest-soft.jpg', quality=82)
save(c.resize((960, 540), Image.LANCZOS).filter(ImageFilter.GaussianBlur(9)), 'sorcerer-soft.webp', quality=80, method=5)

LOGO = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><g fill="none" stroke="#f1c877" stroke-width="2.4" stroke-linecap="round"><circle cx="60" cy="60" r="34"/><circle cx="60" cy="60" r="20"/><path d="M60 6v108M6 60h108M26 26l68 68M94 26L26 94"/></g><path d="M60 14l7 39 39 7-39 7-7 39-7-39-39-7 39-7z" fill="#f1c877"/><circle cx="60" cy="60" r="5" fill="#0b0d16"/></svg>'''
LOGO2 = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><g fill="none" stroke="#eaf6ff" stroke-width="6" stroke-linecap="round"><path d="M22 74a38 38 0 0176 0"/><path d="M36 74a24 24 0 0148 0"/></g><rect x="14" y="70" width="18" height="32" rx="8" fill="#eaf6ff"/><rect x="88" y="70" width="18" height="32" rx="8" fill="#eaf6ff"/><circle cx="60" cy="74" r="6" fill="#7fd6ff"/></svg>'''
for nm, s in (('logo-demo.svg', LOGO), ('logo-demo-2.svg', LOGO2)):
    open(os.path.join(O, nm), 'w', encoding='utf8').write(s); print(nm)
