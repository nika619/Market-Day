# Assembles the Market Day submission film (final-market/1-submission-video.mp4, 4K, 42.3 s) and the three 15 s template loops.
# Inputs: m4k_<set>/f_NNNN.png (local 4K renders), tt4k/t_NNNNN.png (titles.html overlay), the editor take in %TEMP%/rec, ../audio/*.wav.
# Cut list (seconds): 0 title · 2.8 pizza loop · 17.8 editor · 24.8 candle 8.0-14.5 · 31.3 mugs 8.0-14.5 · 37.8 end card · 42.3 (mix-market.py uses the same cuts).
import os, sys, glob, shutil, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

B = os.path.dirname(os.path.abspath(__file__)); FM = os.path.join(B, '..', '..', 'final-market'); AU = os.path.join(B, '..', 'audio')
FPS, W, H = 30, 3840, 2160
REC = os.path.join(os.environ['TEMP'], 'rec', 'editor-new-1.mp4')
EDIT = [(9.9, 11.9, 1), (44.0, 58.4, 4), (58.6, 60.0, 1)]  # (start, end, speed) in the take: pizza lands + label hops, label retyped (4x), "Diavola" hops
RW, RH = 1248, 648                                          # take cropped above the Windows toast that covers its lower right
WX, WY, WW = 920, 600, 2800; WH = round(WW * RH / RW)       # the editor window in the 4K frame (clear of the caption card, top left)
FOCUS = (1248, 355)                                         # zoom target in take pixels: right edge (whole headline card + label in view), timeline ruler (y > 568) out

def ff(*a): subprocess.run(['ffmpeg', '-v', 'error', '-y', *a], check=True)
def fresh(d): shutil.rmtree(d, ignore_errors=True); os.makedirs(d); return d

def editor_frames():
    src = fresh(os.path.join(B, 'ed_src')); out = fresh(os.path.join(B, 'ed4k')); frames = []
    for k, (s, e, sp) in enumerate(EDIT):
        ff('-ss', str(s), '-i', REC, '-t', str(e - s), '-vf', f'fps={FPS},crop={RW}:{RH}:0:0', os.path.join(src, f's{k}_%04d.png'))
        seg = sorted(glob.glob(os.path.join(src, f's{k}_*.png')))[::sp][:round((e - s) / sp * FPS)]
        frames += [(f, k) for f in seg]
    assert len(frames) == 210, len(frames)
    yy, xx = np.mgrid[:H, :W]; r = np.clip(np.hypot((xx - W * .5) / W, (yy - H * .46) / H) / .62, 0, 1)[..., None]
    bg = Image.fromarray((np.array([42, 26, 16]) * (1 - r) + np.array([11, 7, 4]) * r).astype('uint8'))  # same warm vignette as the title cards
    sh = Image.new('L', (W, H), 0); ImageDraw.Draw(sh).rounded_rectangle((WX, WY + 40, WX + WW, WY + WH + 40), 40, fill=150)
    bg.paste((0, 0, 0), (0, 0), sh.filter(ImageFilter.GaussianBlur(70)))
    mask = Image.new('L', (WW, WH), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, WW - 1, WH - 1), 30, fill=255)
    for i, (f, k) in enumerate(frames):
        u = min(1, max(0, (i - 60) / 18)); u = u * u * (3 - 2 * u); z = 1 + .52 * u  # zoom in on the label over the first 18 frames of the retype
        cw, ch = RW / z, RH / z
        cx = min(max(RW / 2 + (FOCUS[0] - RW / 2) * u, cw / 2), RW - cw / 2); cy = min(max(RH / 2 + (FOCUS[1] - RH / 2) * u, ch / 2), RH - ch / 2)
        win = Image.open(f).convert('RGB').resize((WW, WH), Image.LANCZOS, box=(cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2))
        fr = bg.copy(); fr.paste(win, (WX, WY), mask)
        ImageDraw.Draw(fr).rounded_rectangle((WX, WY, WX + WW - 1, WY + WH - 1), 30, outline=(92, 80, 66), width=3)
        fr.save(os.path.join(out, f'e_{i:04d}.png'), compress_level=1)
    return out

def submission(ed):
    base, ov = fresh(os.path.join(B, 'sub_base')), fresh(os.path.join(B, 'sub_ov'))
    black = os.path.join(B, 'black4k.png'); Image.new('RGB', (W, H)).save(black)
    clear = os.path.join(B, 'clear4k.png'); Image.new('RGBA', (W, H)).save(clear)
    m = lambda s, a, b: [os.path.join(B, f'm4k_{s}', f'f_{i:04d}.png') for i in range(a, b)]
    seq = [black] * 84 + m('market-set3', 0, 450) + sorted(glob.glob(os.path.join(ed, 'e_*.png'))) + m('market', 240, 435) + m('market-set2', 240, 435) + [black] * 135
    assert len(seq) == 1269 and all(map(os.path.exists, seq)), len(seq)
    miss = 0
    for i, f in enumerate(seq):
        os.link(f, os.path.join(base, f'b_{i:04d}.png'))
        t = os.path.join(B, 'tt4k', f't_{round(i * 1000 / FPS):05d}.png'); miss += not os.path.exists(t) and any(a <= i * 1000 / FPS < b for a, b in TITLES)
        os.link(t if os.path.exists(t) else clear, os.path.join(ov, f'o_{i:04d}.png'))
    assert miss == 0, f'{miss} title frames missing'
    out = os.path.join(FM, '1-submission-video.mp4')
    ff('-framerate', str(FPS), '-i', os.path.join(base, 'b_%04d.png'), '-framerate', str(FPS), '-i', os.path.join(ov, 'o_%04d.png'), '-i', os.path.join(AU, 'market-submission.wav'),
       '-filter_complex', '[0][1]overlay=format=auto,format=yuv420p[v]', '-map', '[v]', '-map', '2:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-profile:v', 'high',
       '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', '-shortest', out)
    return out

TITLES = [(0, 2800), (3300, 5700), (18000, 24500), (25100, 27500), (31600, 34000), (37800, 42300)]

def loops():
    for s, name in (('market-set3', 'pizza'), ('market', 'candle'), ('market-set2', 'mugs')):
        ff('-framerate', str(FPS), '-i', os.path.join(B, f'm4k_{s}', 'f_%04d.png'), '-i', os.path.join(AU, 'market-15s.wav'), '-vf', 'format=yuv420p',
           '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', '-shortest',
           os.path.join(FM, f'1-template-loop-{name}.mp4'))

if __name__ == '__main__':
    steps = sys.argv[1:] or ['editor', 'film', 'loops']
    if 'editor' in steps: editor_frames()
    if 'film' in steps: print(submission(os.path.join(B, 'ed4k')))
    if 'loops' in steps: loops()
