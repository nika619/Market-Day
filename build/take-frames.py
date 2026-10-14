# Joins the three chained 4K clips into one 15 s take and writes it as 24 fps JPEG frames for the SVGator project.
# Each clip starts on the frame the previous one ends on, so the duplicate first frame of clips 2 and 3 is dropped.
# usage: python take-frames.py [quality]   (ffmpeg -q:v, lower = better; default 4)
import os, sys, glob, subprocess, shutil

D = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(D, '..', 'art-take')
OUT = os.path.join(D, '..', 'assets', 'market', 'take')
TMP = os.path.join(ART, 'frames-tmp')
Q = sys.argv[1] if len(sys.argv) > 1 else '4'
PER = 120  # frames used per clip: 5 s at 24 fps

shutil.rmtree(OUT, ignore_errors=True); shutil.rmtree(TMP, ignore_errors=True)
os.makedirs(OUT); os.makedirs(TMP)
n = 0
for c in (1, 2, 3):
    src = os.path.join(ART, f'clip{c}.mp4')
    d = os.path.join(TMP, str(c)); os.makedirs(d)
    subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-vf', 'fps=24,scale=3840:2160:flags=lanczos', '-q:v', Q, os.path.join(d, '%04d.jpg')], check=True)
    fs = sorted(glob.glob(os.path.join(d, '*.jpg')))
    if c > 1: fs = fs[1:]  # same picture as the last frame of the previous clip
    assert len(fs) >= PER, f'clip{c} has only {len(fs)} usable frames'
    for f in fs[:PER]:
        os.replace(f, os.path.join(OUT, f'f{n:03d}.jpg')); n += 1
shutil.rmtree(TMP)
size = sum(os.path.getsize(f) for f in glob.glob(os.path.join(OUT, '*.jpg')))
print(n, 'frames', round(size / 2**20, 1), 'MB', round(size / n / 1024), 'KB each')
assert n == 3 * PER
