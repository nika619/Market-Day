# Soundtrack for the films: the generated music, shifted so its big hit lands on the orb reveal (9.0 s),
# plus sound effects on the cuts. Writes audio/market-15s.wav (one loop), audio/market-proof.wav (loop, card, loop)
# and audio/market-submission.wav (the 42.3 s submission film: title, pizza loop, editor, candle, mugs, end card).
import os, subprocess
import numpy as np

A = os.path.join(os.path.dirname(__file__), '..', 'audio')
SR = 48000
def load(name):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(A, name), '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()
def env(x, win=0.02):
    m = x.mean(axis=1) ** 2; w = int(SR * win)
    return np.sqrt(np.convolve(m, np.ones(w) / w, mode='same'))
def peak_time(x): return float(np.argmax(env(x))) / SR
def onset(x, lo, hi):  # time of the steepest rise in loudness between lo and hi seconds
    e = 20 * np.log10(env(x, 0.05) + 1e-9); d = e[int(.05 * SR):] - e[:-int(.05 * SR)]
    i0, i1 = int(lo * SR), int(hi * SR); return (i0 + int(np.argmax(d[i0:i1]))) / SR + .05
def place(out, clip, t, gain_db=0.0):
    i = int(round(t * SR)); g = 10 ** (gain_db / 20)
    if i < 0: clip, i = clip[-i:], 0
    n = min(len(clip), len(out) - i)
    if n > 0: out[i:i + n] += clip[:n] * g

music, impact, whoosh, glint = (load(n) for n in ('music-market.mp3', 'impact.mp3', 'whoosh.mp3', 'glint.mp3'))
hit = 0.0  # the market bed has no big drop of its own; the impact effect carries the 9.0 s reveal
print(f'impact peak {peak_time(impact):.2f}s, whoosh peak {peak_time(whoosh):.2f}s, glint peak {peak_time(glint):.2f}s')

def loop15():
    out = np.zeros((15 * SR, 2), np.float32)
    place(out, music, 0, -3)
    fade = np.ones(len(out)); n0, n1 = int(14.0 * SR), 15 * SR
    fade[n0:n1] = np.linspace(1, 0, n1 - n0) ** 1.5; fade[:int(.25 * SR)] = np.linspace(0, 1, int(.25 * SR))
    out *= fade[:, None]
    place(out, glint, 2.05 - peak_time(glint), -7)        # the eye opens
    place(out, impact, 3.0 - peak_time(impact), -4)       # flash cut to the stall
    place(out, whoosh, 6.18 - peak_time(whoosh), -5)      # whip to the hand
    place(out, glint, 7.85 - peak_time(glint), -9)        # the seed of light appears
    place(out, impact, 9.0 - peak_time(impact), 0)        # the product drops onto the tray
    place(out, glint, 10.05 - peak_time(glint), -10)      # the label card hops on
    place(out, glint, 14.37 - peak_time(glint), -8)       # last glint
    return out

one = loop15()
card = np.zeros((int(2.5 * SR), 2), np.float32)
place(card, whoosh, 2.45 - peak_time(whoosh), -8)          # swoosh into the second brand
proof = np.concatenate([one, card, one])

def submission():  # cut list must match build/assemble-market.py
    out = np.zeros((int(42.3 * SR), 2), np.float32)
    bed = np.zeros_like(out); n = len(music); x0 = int(22.0 * SR); xf = n - x0  # second pass of the bed crossfades in at 22 s
    a = music.copy(); a[x0:] *= np.linspace(1, 0, xf)[:, None]; place(bed, a, 0)
    b = music.copy(); b[:xf] *= np.linspace(0, 1, xf)[:, None]; place(bed, b, 22.0)
    f = np.ones(len(out)); f[int(41.0 * SR):] = np.linspace(1, 0, len(out) - int(41.0 * SR)) ** 1.5; f[:int(.3 * SR)] = np.linspace(0, 1, int(.3 * SR))
    out += bed * f[:, None] * 10 ** (-3 / 20)
    sfx = lambda clip, t, g: place(out, clip, t - peak_time(clip), g)
    sfx(glint, 0.45, -9)                                   # title wipes in
    for t0, a0 in ((2.8, 0.0), (24.8, 8.0), (31.3, 8.0)):  # brand segments: (start in film, start in loop)
        for t, clip, g in ((3.0, impact, -4), (6.18, whoosh, -5), (7.85, glint, -9), (9.0, impact, 0), (10.05, glint, -10)):
            if t >= a0 + .05 and t0 + t - a0 < t0 + (15.0 - a0): sfx(clip, t0 + t - a0, g)
    for t in (17.8, 24.8, 31.3, 37.8): sfx(whoosh, t, -7)  # cuts
    sfx(glint, 39.3, -8)                                   # end-card thumbnails
    return out

for name, x in (('market-15s.wav', one), ('market-proof.wav', proof), ('market-submission.wav', submission())):
    x = x / max(1.0, float(np.abs(x).max()) / 0.95)
    p = os.path.join(A, name)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', str(SR), p], input=x.astype(np.float32).tobytes(), check=True)
    print(name, len(x) / SR, 's')
