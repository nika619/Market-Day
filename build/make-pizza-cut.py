# Lays the top-down pizza photo flat in the tray's perspective: cut-out, squash to the tray's ellipse, crust side, contact shadow.
# Output assets/market/product-cut-3.webp: transparent, the pizza's front edge on the bottom edge, like the other product cut-outs.
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd

SRC, OUT = 'art-market/product3.png', 'assets/market/product-cut-3.webp'
K = 0.37            # tray floor ellipse, height / width, measured on the seller plate (980 x 360 px)
W = 1800            # output width (the pizza shows ~820 px wide at 1080p, ~1640 at 4K)
SIDE = 28           # visible crust side below the front edge, px at W
PAD = 14            # room for the contact shadow under the front edge

im = Image.open(SRC).convert('RGB')
L = np.asarray(im.convert('L').filter(ImageFilter.GaussianBlur(3))).astype(float)
m = L > 90
m = nd.binary_closing(m, structure=np.ones((3, 3)), iterations=10)
m = nd.binary_fill_holes(m)
lab, n = nd.label(m)
m = lab == 1 + int(np.argmax(nd.sum(m, lab, range(1, n + 1))))
yy, xx = np.mgrid[:m.shape[0], :m.shape[1]]
CX, CY = 500, 492                                # centre of the pizza in the photo
# outline as a smooth radius per angle: the outermost crust pixel on each ray, low-passed so charred spots and the board leaking in leave no notches
ang = np.linspace(0, 2 * np.pi, 720, endpoint=False); rs = np.arange(300, 500)
px = (CX + rs[None] * np.cos(ang)[:, None]).round().astype(int).clip(0, m.shape[1] - 1)
py = (CY + rs[None] * np.sin(ang)[:, None]).round().astype(int).clip(0, m.shape[0] - 1)
hit = m[py, px]
rad = np.where(hit.any(1), rs[::-1][np.argmax(hit[:, ::-1], 1)], 470).astype(float)
rad = nd.median_filter(rad, 41, mode='wrap')
F = np.fft.rfft(rad); F[7:] = 0; rad = np.fft.irfft(F, len(rad)) - 4
rad = np.minimum(rad, 498)
th = np.mod(np.arctan2(yy - CY, xx - CX), 2 * np.pi)
a = Image.fromarray((np.hypot(xx - CX, yy - CY) < np.interp(th, ang, rad, period=2 * np.pi)).astype('uint8') * 255).filter(ImageFilter.GaussianBlur(1.5))
top = im.convert('RGBA'); top.putalpha(a)
top = top.crop(top.getbbox())
assert abs(top.width - top.height) < 60, top.size  # still roughly round

# warm key light from the back right, the front left falls off slightly
h = round(W * K)
top = top.resize((W, h), Image.LANCZOS)
g = np.asarray(top).astype(float)
gx, gy = np.meshgrid(np.linspace(-1, 1, W), np.linspace(-1, 1, h))
light = 1.06 - 0.10 * np.clip(np.hypot(gx - .45, gy + .7) / 2.2, 0, 1)
g[..., :3] = np.clip(g[..., :3] * light[..., None], 0, 255)
top = Image.fromarray(g.astype('uint8'), 'RGBA')

H = h + SIDE + PAD
out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
sh = Image.new('L', (W, H), 0)  # contact shadow: the base ellipse pushed down and blurred
sh.paste(top.getchannel('A').resize((int(W * .96), h)), (int(W * .02), SIDE + 6))
sh = sh.filter(ImageFilter.GaussianBlur(10)).point(lambda v: int(v * .6))
out.paste(Image.new('RGBA', (W, H), (18, 9, 4, 255)), (0, 0), sh)
side = Image.new('RGBA', (W, H), (0, 0, 0, 0))
tb = top.filter(ImageFilter.GaussianBlur(7)); tb.putalpha(top.getchannel('A'))  # blurred colour so charred spots don't streak down the side
for d in range(SIDE, 0, -1):  # crust side: the outline extruded down, darker toward the tray
    f = 0.80 - 0.45 * (d / SIDE) ** 1.2
    c = np.asarray(tb).astype(float); c[..., :3] *= f
    side.alpha_composite(Image.fromarray(c.astype('uint8'), 'RGBA'), (0, d))
out.alpha_composite(side.filter(ImageFilter.GaussianBlur(2.2)))
out.alpha_composite(top, (0, 0))
out.save(OUT, quality=92, method=6)
print(OUT, out.size, 'aspect', round(W / H, 3))
if len(sys.argv) > 1:
    bg = Image.new('RGBA', out.size, (92, 60, 38, 255)); bg.alpha_composite(out); bg.convert('RGB').resize((W // 2, H // 2)).save(sys.argv[1], quality=85)
