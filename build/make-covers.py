# Cover (4:3, Contra) and thumbnail (16:9) for the submission, from the local 4K renders at 12.5 s (all text in, label at rest).
import os
from PIL import Image
B = os.path.dirname(os.path.abspath(__file__)); FM = os.path.join(B, '..', '..', 'final-market')
hero = lambda s: Image.open(os.path.join(B, f'm4k_{s}', 'f_0375.png')).convert('RGB')
p, c, m = hero('market-set3'), hero('market'), hero('market-set2')
p.resize((1920, 1080), Image.LANCZOS).save(os.path.join(FM, '4-thumbnail-16x9.jpg'), quality=92)
strip = lambda im, w: im.crop((0, 152, 3840, 2008)).resize((w, round(w * 1856 / 3840)), Image.LANCZOS)  # drop the letterbox bars
cov = Image.new('RGB', (1600, 1200), (11, 7, 4))
top = strip(p, 1600); cov.paste(top, (0, 0))
for i, im in enumerate((c, m)):
    t = strip(im, 794); cov.paste(t.crop((0, 0, 794, 1200 - top.height - 12)), (i * 806, top.height + 12))
cov.save(os.path.join(FM, '4-cover-4x3.png'))
print('cover', cov.size, 'top', top.size)
