# Tracks the open box through the end of the take so the product layer moves with it.
# Writes track.json: for frames F0..359, where the product's base point sits, its scale against the last frame, and a damped roll.
# usage: python track.py            (real tracking on assets/market/take/f*.jpg)
#        python track.py placeholder (poses measured on the key frames, for layout tests before the clips exist)
import os, sys, json, math
import numpy as np

D = os.path.dirname(os.path.abspath(__file__))
FR = os.path.join(D, '..', 'assets', 'market', 'take')
BASEPT = (1380.0, 615.0)          # product base point in the last frame (1920 x 1080 space); keep in sync with scene-take.js
ROI = (1060, 270, 1720, 1000)     # the box in the last frame
F0, LAST, REVEAL = 216, 359, 9200  # first tracked frame (box open and still), last frame, ms the product appears
ROLL = 0.35                        # the box mostly yaws and pitches; only a third of the measured in-plane turn reads as roll
out = {'reveal': REVEAL, 'keys': []}

def ease(u): return u * u * (3 - 2 * u)

if len(sys.argv) > 1 and sys.argv[1] == 'placeholder':
    k2, k3 = ((1300.0, 670.0), .92), (BASEPT, 1.0)   # resting on the counter (key frame 3) and held up (key frame 4)
    for f in range(F0, LAST + 1):
        u = 0 if f < 240 else 1 if f > 300 else ease((f - 240) / 60)
        sway = math.sin((f - 300) / 9) * 2 if f > 300 else 0
        out['keys'].append({'f': f, 'x': round(k2[0][0] + (k3[0][0] - k2[0][0]) * u, 1), 'y': round(k2[0][1] + (k3[0][1] - k2[0][1]) * u + sway, 1), 's': round(k2[1] + (k3[1] - k2[1]) * u, 4), 'r': 0})
    out['placeholder'] = True
else:
    import cv2
    S = 0.5  # track at 960 x 540
    load = lambda f: cv2.cvtColor(cv2.resize(cv2.imread(os.path.join(FR, f'f{f:03d}.jpg')), (960, 540), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)
    ref = load(LAST)
    mask = np.zeros_like(ref); mask[int(ROI[1] * S):int(ROI[3] * S), int(ROI[0] * S):int(ROI[2] * S)] = 255
    detect = lambda im, m: cv2.goodFeaturesToTrack(im, 400, .01, 5, mask=m)
    refp = detect(ref, mask).reshape(-1, 2); cur = refp.copy(); prev = ref
    Ms = {LAST: np.array([[1, 0, 0], [0, 1, 0]], float)}
    for f in range(LAST - 1, F0 - 1, -1):
        im = load(f)
        nxt, st, _ = cv2.calcOpticalFlowPyrLK(prev, im, cur.reshape(-1, 1, 2).astype(np.float32), None, winSize=(21, 21), maxLevel=4)
        back, st2, _ = cv2.calcOpticalFlowPyrLK(im, prev, nxt, None, winSize=(21, 21), maxLevel=4)
        ok = (st.ravel() == 1) & (st2.ravel() == 1) & (np.linalg.norm(back.reshape(-1, 2) - cur, axis=1) < 1.0)  # forward-backward check
        refp, cur = refp[ok], nxt.reshape(-1, 2)[ok]
        M, inl = cv2.estimateAffinePartial2D(refp, cur, method=cv2.RANSAC, ransacReprojThreshold=2.5)
        assert M is not None and inl.sum() >= 12, f'tracking lost at frame {f}: {0 if inl is None else inl.sum()} inliers'
        Ms[f] = M
        if len(cur) < 120:  # top up: new corners inside the box as it sits now, mapped back to the last frame through M
            box = cv2.transform(np.array([[[ROI[0] * S, ROI[1] * S], [ROI[2] * S, ROI[1] * S], [ROI[2] * S, ROI[3] * S], [ROI[0] * S, ROI[3] * S]]], np.float32), M)
            m2 = np.zeros_like(im); cv2.fillConvexPoly(m2, box.astype(np.int32)[0], 255)
            newp = detect(im, m2)
            if newp is not None:
                newp = newp.reshape(-1, 2); Mi = cv2.invertAffineTransform(M)
                refp = np.vstack([refp, cv2.transform(newp[None].astype(np.float32), Mi)[0]]); cur = np.vstack([cur, newp])
        prev = im
        print(f, len(cur), int(inl.sum()), end='  \r')
    fs_ = sorted(Ms)
    raw = []
    for f in fs_:
        M = Ms[f]; a, b = M[0, 0], M[1, 0]
        p = M @ np.array([BASEPT[0] * S, BASEPT[1] * S, 1])
        raw.append([p[0] / S, p[1] / S, math.hypot(a, b), math.degrees(math.atan2(b, a))])
    raw = np.array(raw)
    k = np.ones(5) / 5; sm = np.vstack([np.convolve(np.pad(raw[:, c], 2, mode='edge'), k, mode='valid') for c in range(4)]).T  # 5-frame smoothing against jitter
    for f, (x, y, s, r) in zip(fs_, sm):
        out['keys'].append({'f': f, 'x': round(float(x), 1), 'y': round(float(y), 1), 's': round(float(s), 4), 'r': round(float(r) * ROLL, 2)})
    print('\ntracked', len(fs_), 'frames; scale range', round(sm[:, 2].min(), 3), round(sm[:, 2].max(), 3))
json.dump(out, open(os.path.join(D, 'track.json'), 'w'))
print('track.json', len(out['keys']), 'keys', '(placeholder)' if out.get('placeholder') else '')
