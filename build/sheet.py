# python sheet.py <dir> <out.jpg> [cols] [cellWidth]  -> labelled contact sheet of the t_*.png frames
import sys, glob, os
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4; cw = int(sys.argv[4]) if len(sys.argv) > 4 else 480
fs = sorted(glob.glob(os.path.join(d, 't_*.png'))); ch = cw * 9 // 16; rows = -(-len(fs) // cols)
sh = Image.new('RGB', (cols * cw, rows * (ch + 18)), (16, 16, 16)); dr = ImageDraw.Draw(sh)
for i, f in enumerate(fs):
    im = Image.open(f).convert('RGB').resize((cw, ch), Image.LANCZOS); x, y = (i % cols) * cw, (i // cols) * (ch + 18)
    sh.paste(im, (x, y + 18)); dr.text((x + 4, y + 3), os.path.basename(f)[2:7].lstrip('0') + ' ms', fill=(255, 255, 255))
sh.save(out, quality=88); print(out, sh.size)
