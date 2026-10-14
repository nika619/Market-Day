// Market Day "Unboxing" — a native SVGator build. The box, lid, tissue and twine are 3D geometry projected through one camera
// into SVGator paths (so the lid really lifts and tilts in perspective); the hands are a rig of jointed fingers.
// Everything that moves comes from functions of time and is written out as keyframes. Writes unbox.json (+ unbox.js for the previewer).
// usage: node scene-unbox.js [set2]      STILL=<ms> node scene-unbox.js   (static frame at that time, for design passes)
const fs = require('fs'), path = require('path');
const CONTENT = process.argv[2] === 'set2' ? require('./content-take2.js') : require('./content-take1.js');
const BASE = 'https://cdn.jsdelivr.net/gh/nika619/conjure-svgator@main/assets/';
const W = 1920, H = 1080, DUR = 15000;
const STILL = process.env.STILL != null ? +process.env.STILL : null;
const cb = (a, b, c, d) => ({ type: 'cubic-bezier', value: { from: { x: a, y: b }, to: { x: c, y: d } } });
const PREM = cb(.4, 0, .2, 1), OUT = cb(.16, 1, .3, 1), IO = cb(.45, 0, .55, 1), IN = cb(.7, 0, .84, 0);
const r0 = v => Math.round(v), r1 = v => Math.round(v * 10) / 10, f3 = v => +v.toFixed(3);
const rgb = ([r, g, b], a = 1) => ({ r: Math.round(r), g: Math.round(g), b: Math.round(b), a: +a.toFixed(3) });
const col = (c, a = 1) => ({ type: 'color', value: rgb(c, a) });
const lin = (x1, y1, x2, y2, stops) => ({ type: 'linear-gradient', value: { from: { x: x1, y: y1 }, to: { x: x2, y: y2 }, stops: stops.map(([o, c, a = 1]) => ({ color: rgb(c, a), offset: o })), spread: 'pad', fixed: false } });
const rad = (cx, cy, r, stops) => ({ type: 'radial-gradient', value: { center: { x: cx, y: cy }, radius: r, stops: stops.map(([o, c, a = 1]) => ({ color: rgb(c, a), offset: o })), spread: 'pad', fixed: false } });
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), mixN = (a, b, u) => a + (b - a) * u, mix3 = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
const bez = (x1, y1, x2, y2) => x => { let lo = 0, hi = 1, u = x; for (let i = 0; i < 26; i++) { u = (lo + hi) / 2; const bx = 3 * (1 - u) ** 2 * u * x1 + 3 * (1 - u) * u * u * x2 + u ** 3; bx < x ? lo = u : hi = u; } return 3 * (1 - u) ** 2 * u * y1 + 3 * (1 - u) * u * u * y2 + u ** 3; };
const ePrem = bez(.4, 0, .2, 1), eIO = bez(.45, 0, .55, 1), eOut = bez(.16, 1, .3, 1), eIn = bez(.7, 0, .84, 0);
const span = (t, a, b, e = ePrem) => e(clamp((t - a) / (b - a)));   // 0 before a, 1 after b, eased between

// ---------------- element factory ----------------
let idn = 0;
function E(type, title, o = {}) {
  const n = { id: o.id || 'u' + (++idn), type, title, properties: {} }, p = n.properties, tr = {};
  if (o.o) tr.origin = { x: r1(o.o[0]), y: r1(o.o[1]) };
  if (o.t) tr.translate = { x: r1(o.t[0]), y: r1(o.t[1]) };
  if (o.s != null) tr.scale = typeof o.s === 'number' ? { x: f3(o.s), y: f3(o.s) } : { x: f3(o.s[0]), y: f3(o.s[1]) };
  if (o.r) tr.rotate = r1(o.r);
  if (Object.keys(tr).length) p.transform = tr;
  const c = {};
  if (o.op != null) c.opacity = o.op;
  if (o.blend) c.blend = o.blend;
  if (o.clip) c.clip = { path: o.clip, rule: false };
  if (Object.keys(c).length) p.compositing = c;
  if (o.shape) p.shape = o.shape;
  if (o.fill) p.fill = { paint: o.fill };
  if (o.stroke) p.stroke = o.stroke;
  if (o.blur) p.filter = { list: [{ type: 'blur', value: { x: o.blur, y: o.blur } }] };
  if (o.anim && STILL == null) n.animators = o.anim;
  if (!Object.keys(p).length) delete n.properties;
  if (o.kids) n.children = o.kids.filter(Boolean);
  return n;
}
const G = (title, kids, o = {}) => E('g', title, { kids, ...o });
const nd = (x, y) => ({ x: r0(x), y: r0(y), type: 'corner' });
const poly = pts => { const n = pts.map(([x, y]) => nd(x, y)); n.push({ ...n[0] }); return n; };
function smooth(pts, closed = false, k = 1 / 6) { // Catmull-Rom -> cubic nodes; every node has start/end, so all keyframes share one topology
  const P = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]], out = [];
  for (let i = 1; i < P.length - 1; i++) { const [x, y] = P[i], [ax, ay] = P[i - 1], [bx, by] = P[i + 1];
    out.push({ x: r0(x), y: r0(y), type: 'cusp', start: { x: r0(x - (bx - ax) * k), y: r0(y - (by - ay) * k) }, end: { x: r0(x + (bx - ax) * k), y: r0(y + (by - ay) * k) } }); }
  if (closed) out.push({ ...out[0] });
  return out;
}
const pathEl = (title, nodes, o = {}) => E('path', title, { shape: { path: nodes }, ...o });
const stk = (paint, width, extra = {}) => ({ paint, width, opacity: 1, lineCap: 'round', lineJoin: 'round', ...extra });
const NOFILL = { type: 'none' };
const img = (file, w, h, fit) => ({ size: { width: r1(w), height: r1(h) }, href: /^https?:/.test(file) ? file : BASE + file, ...(fit ? { aspectRatio: fit } : {}) });
const rect = (title, x, y, w, h, o = {}) => E('rect', title, { o: [x, y], shape: { size: { width: r1(w), height: r1(h) }, radius: { x: r1(o.rx || 0), y: r1(o.rx || 0) } }, ...o });
const ell = (title, cx, cy, rx, ry, o = {}) => E('ellipse', title, { o: [cx, cy], shape: { radius: { x: r1(rx), y: r1(ry) } }, ...o });

// keyframes: sample f(t) at the given times; value wrappers per channel; linear between samples unless an easing is given
const KT = (a, b, step) => { const out = []; for (let t = a; t < b; t += step) out.push(Math.round(t)); out.push(b); return out; };
const keys = (times, f, wrap = v => v) => ({ keys: times.map(t => ({ time: t, value: wrap(f(t)) })) });
const XY = v => ({ x: r1(v[0]), y: r1(v[1]) }), SC = v => typeof v === 'number' ? { x: f3(v), y: f3(v) } : { x: f3(v[0]), y: f3(v[1]) };
const eased = (pairs, wrap = v => v, e = PREM) => ({ keys: pairs.map(([t, v], i) => ({ time: t, value: wrap(v), ...(i < pairs.length - 1 ? { easing: e } : {}) })) });
const dedupe = k => { const ks = k.keys.filter((q, i, a) => i === 0 || i === a.length - 1 || JSON.stringify(q.value) !== JSON.stringify(a[i - 1].value) || JSON.stringify(q.value) !== JSON.stringify(a[i + 1].value)); return { keys: ks }; };

// ---------------- camera ----------------
const CAM = { e: [600, -1700, 620], t: [0, 60, 85], f: 3500, cx: 1230, cy: 655 };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = a => { const l = Math.hypot(...a); return a.map(v => v / l); };
const FWD = nrm(sub(CAM.t, CAM.e)), RGT = nrm(crs(FWD, [0, 0, 1])), UPV = crs(RGT, FWD);
const proj = p => { const d = sub(p, CAM.e), z = dot(d, FWD); return [CAM.cx + CAM.f * dot(d, RGT) / z, CAM.cy - CAM.f * dot(d, UPV) / z]; };
const P2 = pts => pts.map(proj);
const pxPerMm = p => { const a = proj(p), b = proj([p[0] + 10, p[1], p[2]]); return Math.hypot(b[0] - a[0], b[1] - a[1]) / 10; };

// ---------------- palette: warm market light, kraft and jute, one sage accent from the herbs ----------------
const KRAFT = { top: [230, 190, 136], top2: [210, 166, 112], front: [186, 138, 88], front2: [160, 114, 70], side: [148, 104, 64], side2: [126, 86, 52], inner: [120, 82, 50], inner2: [92, 60, 36] };
const JUTE = [216, 180, 124], JUTE_D = [152, 112, 68], JUTE_L = [244, 222, 176];
const SKIN = [202, 146, 104], SKIN_D = [146, 92, 60], SKIN_L = [230, 182, 142], SKIN_RIM = [255, 212, 166], NAIL = [238, 204, 180];
const LINEN = [212, 204, 188], LINEN_D = [168, 158, 140], TISSUE = [248, 242, 230], TISSUE_D = [214, 202, 184];

// ---------------- timeline (ms) ----------------
const T = { reach: [200, 950], pull: [1050, 2350], release: [2250, 2550], lift: [2550, 3350], drop: [3350, 3950], toLid: [3700, 4650],
  lidUp: [4750, 5650], lidAway: [5650, 6450], toTissue: [6300, 7050], open: [7150, 8250], exit: [8250, 9000], push: [9000, 10700], text: 10700, out: [14300, 14960] };

// ---------------- the box (mm) ----------------
const PROD = [0, -26, 36]; // where the product stands in the box (its base)
const B = { w: 300, d: 300, h: 116, wall: 3 }, L = { w: 308, d: 308, z0: 110, z1: 148 };
const boxFaces = (x0, x1, y0, y1, z0, z1) => ({
  front: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], right: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]],
  left: [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], back: [[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]],
  top: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] });
const body = boxFaces(-B.w / 2, B.w / 2, -B.d / 2, B.d / 2, 0, B.h);
const lidF = boxFaces(-L.w / 2, L.w / 2, -L.d / 2, L.d / 2, L.z0, L.z1);
// lid motion: a press, a lift with a backward tilt, then carried up and away toward the seller
function lidXf(t) {
  const press = span(t, T.lidUp[0], T.lidUp[0] + 140, eIO) - span(t, T.lidUp[0] + 140, T.lidUp[0] + 280, eIO);
  const up = span(t, T.lidUp[0] + 200, T.lidUp[1]), away = span(t, T.lidAway[0], T.lidAway[1], eIn);
  return { dz: -2.5 * press + 170 * up + 520 * away, dy: 40 * up + 380 * away, dx: -30 * up - 60 * away, th: (16 * up + 22 * away) * Math.PI / 180 };
}
const lidPt = (p, t) => { const x = lidXf(t), c = [0, -L.d / 2, L.z0], y = p[1] - c[1], z = p[2] - c[2]; // tilt about the front-bottom edge
  return [p[0] + x.dx, c[1] + y * Math.cos(x.th) - z * Math.sin(x.th) + x.dy, c[2] + y * Math.sin(x.th) + z * Math.cos(x.th) + x.dz]; };

// ---------------- the hands: anchors in the world, poses as joint angles ----------------
// pose: [spread angles for index, middle, ring, pinky], length factors (foreshortening = curl), thumb [angle, bend, length]
const POSE = {
  // thumb angle convention: + swings the thumb outward (away from the hand); pinch is solved so the thumb tip meets the index tip
  open:  { sp: [-8, -2, 4, 11], k: [1, .98, .95, .9], th: [42, -6, 1], hand: 1 },
  relax: { sp: [4, 1, 4, 8], k: [.76, .7, .68, .66], th: [24, 8, .98], hand: 1 },
  pinch: { sp: [30, 12, 13, 17], k: [.62, .5, .48, .47], th: [9, 0, 1.06], hand: 1 },
  grip:  { sp: [-3, -1, 2, 6], k: [1.16, 1.18, 1.14, 1.05], th: [30, 6, .86], hand: .97 },
};
const lerpPose = (a, b, u) => ({ sp: a.sp.map((v, i) => mixN(v, b.sp[i], u)), k: a.k.map((v, i) => mixN(v, b.k[i], u)), th: a.th.map((v, i) => mixN(v, b.th[i], u)), hand: mixN(a.hand, b.hand, u) });
const zt = L.z1 + 1.5, KNOT = [0, -6, zt + 4];
const SH = { L: [-290, 600, 620], R: [290, 600, 620] }; // the seller's shoulders, behind and above the counter
// where each hand is (world), which pose, as functions of time
function handAt(side, t) {
  const s = side === 'L' ? -1 : 1;
  const pinch0 = [s * 118, -62, 240], pinch1 = [s * 300, -40, 300];
  const away = [s * 330, 420, 560];
  const lidGrip = [s * (L.w / 2 + 6), -30, L.z1 - 16];
  const flapGrip = (u) => [s * mixN(26, 210, u), mixN(-40, -60, u), mixN(B.h + 6, B.h + 40 + 30 * Math.sin(u * Math.PI), u)];
  let p, pose;
  if (t < T.reach[1]) { const u = span(t, T.reach[0], T.reach[1]); p = mix3(away, pinch0, u); pose = lerpPose(POSE.relax, POSE.pinch, span(t, T.reach[1] - 320, T.reach[1])); }
  else if (t < T.lift[0]) { const ant = Math.sin(clamp((t - T.pull[0]) / 160) * Math.PI) * (t < T.pull[0] + 160 ? 1 : 0); const u = span(t, T.pull[0] + 120, T.pull[1]);
    p = mix3(pinch0, pinch1, u).map((v, i) => v + (i === 0 ? -s * 6 * ant : 0)); pose = POSE.pinch; }
  else if (t < T.drop[0]) { const u = span(t, T.lift[0], T.lift[1]); p = mix3(pinch1, [s * 260 - 260, -70, 330], u); pose = POSE.pinch; }
  else if (t < T.toLid[1]) { const u = span(t, T.toLid[0], T.toLid[1]); const from = [s * 260 - 260, -70, 330 + 30 * span(t, T.drop[0], T.drop[0] + 300)];
    p = mix3(from, lidGrip, u).map((v, i) => v + (i === 2 ? Math.sin(u * Math.PI) * 60 : 0)); pose = lerpPose(lerpPose(POSE.pinch, POSE.open, span(t, T.drop[0], T.drop[0] + 260, eOut)), POSE.grip, span(t, T.toLid[1] - 300, T.toLid[1])); }
  else if (t < T.toTissue[0]) { p = lidPt(lidGrip, t); pose = POSE.grip; }
  else if (t < T.open[0]) { const u = span(t, T.toTissue[0], T.toTissue[1]); p = mix3([s * 200, 900, 1200], flapGrip(0), u); pose = lerpPose(POSE.relax, POSE.pinch, span(t, T.toTissue[1] - 300, T.toTissue[1])); }
  else if (t < T.exit[0]) { p = flapGrip(span(t, T.open[0], T.open[1])); pose = POSE.pinch; }
  else { const u = span(t, T.exit[0], T.exit[1], eIn); p = mix3(flapGrip(1), [s * 520, 900, 1700], u); pose = lerpPose(POSE.pinch, POSE.open, span(t, T.exit[0], T.exit[0] + 260, eOut)); }
  return { p, pose };
}

// ---------------- the twine: one rope, described per strand as points that move between configurations ----------------
const N = 5; // points per strand
const lineN = (a, b, n = N) => Array.from({ length: n }, (_, i) => mix3(a, b, i / (n - 1)));
function rope(t, u) { // the twine while it hangs between the two hands (a sagging curve), u in 0..1 from left hand to right hand
  const a = handAt('L', t).p, b = handAt('R', t).p, sag = 170 + 40 * Math.sin(t / 300);
  const p = mix3(a, b, u); p[2] -= sag * 4 * u * (1 - u); p[1] -= 40 * Math.sin(u * Math.PI); return p;
}
function floorRope(u) { // where it lands: a loose S on the counter, left of the box
  return [-560 + 260 * Math.sin(u * 3.4) + 90 * u, -150 + 260 * u - 60 * Math.cos(u * 6), 3];
}
const STRANDS = [ // name, tied shape (world points), slice of the rope it becomes
  ['tail L', () => null, [0, .1]],
  ['across L', () => lineN([-154, 0, zt], [KNOT[0] - 6, KNOT[1] + 2, KNOT[2]]), [.1, .26]],
  ['front', () => [[0, -154.5, zt], [0, -154.5, L.z0], [0, -150.5, L.z0 - 3], [0, -150.5, 50], [0, -150.5, 0]], [.26, .44]],
  ['across back', () => lineN([KNOT[0], KNOT[1] + 6, KNOT[2]], [0, 154, zt]), [.44, .56]],
  ['side', () => [[154.5, 0, zt], [154.5, 0, L.z0], [150.5, 0, L.z0 - 3], [150.5, 0, 50], [150.5, 0, 0]], [.56, .74]],
  ['across R', () => lineN([KNOT[0] + 6, KNOT[1] + 2, KNOT[2]], [154, 0, zt]), [.74, .9]],
  ['tail R', () => null, [.9, 1]],
];
function strandPts(i, t) {
  const [name, tied, [u0, u1]] = STRANDS[i], us = Array.from({ length: N }, (_, j) => mixN(u0, u1, j / (N - 1)));
  const slack = span(t, T.release[0] + (name === 'front' || name === 'side' ? 120 : 0), T.lift[1]), fall = span(t, T.drop[0], T.drop[1], eIn);
  const hang = us.map(u => rope(t, u)), floor = us.map(floorRope);
  let pts;
  if (name.startsWith('tail')) { // from the knot up to the fingers while tied
    const hp = handAt(name.endsWith('L') ? 'L' : 'R', t).p, tiedPts = Array.from({ length: N }, (_, j) => { const u = j / (N - 1), q = mix3(KNOT, hp, u); q[2] += 22 * Math.sin(u * Math.PI) * (1 - span(t, T.pull[0], T.pull[1])); return q; });
    pts = tiedPts.map((q, j) => mix3(q, hang[name.endsWith('L') ? N - 1 - j : j], slack));
    if (name.endsWith('L')) pts = pts.reverse();
  } else pts = tied().map((q, j) => mix3(q, hang[j], slack));
  return pts.map((q, j) => mix3(q, floor[j], fall));
}
function bowLoop(dir, t) { // a loop of the bow; shrinks into the knot as the tails are pulled
  const b = 1 - span(t, T.pull[0] + 150, T.release[1], eIn), [dx, dy] = dir, K = KNOT;
  return [K, [K[0] + dx * 30 * b - dy * 17 * b, K[1] + dy * 30 * b + dx * 17 * b, zt + 7], [K[0] + dx * 96 * b, K[1] + dy * 96 * b, zt + 5], [K[0] + dx * 30 * b + dy * 17 * b, K[1] + dy * 30 * b - dx * 17 * b, zt + 7], K];
}

// ---------------- tissue flaps (hinged on the left and right walls, folded over the product) ----------------
function flap(side, t) { // closed: covering half the opening with a soft bulge; open: folded out over the wall
  const s = side === 'L' ? -1 : 1, u = span(t, T.open[0], T.open[1]), ang = u * 2.25; // radians about the hinge
  const hingeX = s * (B.w / 2 - 4), z = B.h + 2, ys = [-142, -70, 0, 70, 142];
  const reach = 162; // how far the flap reaches across from its wall
  const edge = ys.map((y, i) => { const r = reach + (i % 2 ? 9 : -5), dome = 62 * Math.sin(i / 4 * Math.PI);
    return [hingeX - s * r * Math.cos(ang), y, z + r * Math.sin(ang) * .7 + dome * (1 - u) + 4]; });
  const hinge = ys.slice().reverse().map(y => [hingeX, y, z]);
  return [...edge, ...hinge];
}

// ---------------- builders ----------------
const bulbs = Array.from({ length: 15 }, (_, i) => { const u = i / 14; return [-60 + u * 2040, 98 + Math.sin(u * Math.PI) * 112 + (i % 2) * 7, 26 + (i % 3) * 9]; });
function background() {
  const kids = [rect('stall air', 0, 0, W, H, { fill: lin(0, 0, 0, 1, [[0, [34, 22, 15]], [.35, [70, 44, 27]], [.62, [104, 66, 38]], [1, [120, 78, 44]]]) })];
  kids.push(rect('awning (out of focus)', -40, -30, W + 80, 120, { fill: lin(0, 0, 0, 1, [[0, [26, 30, 22]], [1, [44, 46, 32], 0]]) }));
  const shelf = (x, y, w, h, c, i) => G('shelf ' + i, [rect('shelf board', x, y + h - 14, w, 14, { rx: 6, fill: col([72, 46, 28], .8) }),
    ...Array.from({ length: Math.floor(w / 70) }, (_, j) => { const jx = x + 22 + j * 70, jh = 46 + (j * 37 % 30); return rect('jar', jx, y + h - 14 - jh, 44, jh, { rx: 10, fill: lin(0, 0, 1, 0, [[0, c], [.5, c.map(v => v * 1.35)], [1, c]]) }); })]);
  kids.push(G('shelves (out of focus)', [shelf(-30, 260, 420, 150, [96, 62, 34], 1), shelf(30, 430, 360, 130, [104, 70, 36], 2), shelf(1560, 240, 420, 160, [92, 60, 34], 3), shelf(1600, 420, 360, 130, [100, 66, 36], 4)], { op: .55 }));
  kids.push(G('herbs (out of focus)', [[150, 520, 140, 80], [380, 470, 100, 60], [1720, 500, 150, 90], [1500, 420, 90, 60]].map(([x, y, rx, ry], i) => ell('herb bunch ' + (i + 1), x, y, rx, ry, { fill: rad(.5, .45, .55, [[0, [96, 116, 58], .85], [1, [60, 74, 40], 0]]) }))));
  kids.push(pathEl('string-light wire', smooth(bulbs.map(([x, y]) => [x, y - 10])), { fill: NOFILL, stroke: stk(col([30, 20, 14], .55), 3) }));
  kids.push(G('string lights (bokeh)', bulbs.map(([x, y, r], i) => ell('bulb ' + (i + 1), x, y, r * 1.6, r * 1.6, { fill: rad(.5, .5, .5, [[0, [255, 232, 180], .95], [.25, [255, 204, 130], .7], [1, [255, 170, 90], 0]]),
    anim: { compositing: { opacity: keys(KT(0, DUR, 1250), t => +(.78 + .22 * Math.sin(t / 900 + i * 1.7)).toFixed(2)) } }, op: .9 }))));
  const disks = [[200, 600, 84], [500, 560, 52], [720, 610, 66], [1500, 590, 60], [1690, 640, 92], [1880, 560, 54], [60, 380, 44], [1180, 470, 36], [900, 520, 30]];
  kids.push(G('bokeh', disks.map(([x, y, r], i) => ell('bokeh ' + (i + 1), x, y, r, r, { fill: rad(.5, .5, .5, [[0, [255, 214, 150], .28], [.75, [255, 190, 120], .13], [1, [255, 180, 110], 0]]) }))));
  return G('background (the stall, out of focus)', kids);
}
function seller() { // the seller behind the counter, chest down and softly out of focus; the arms come from these shoulders
  const Y = 600, at = (x, z) => proj([x, Y, z]);
  const shirt = [at(-330, 640), at(-150, 700), at(150, 700), at(330, 640), at(300, 300), at(250, -80), at(-250, -80), at(-300, 300)];
  const apron = [at(-130, 520), at(130, 520), at(150, 300), at(250, -80), at(-250, -80), at(-150, 300)];
  return G('seller (out of focus)', [
    pathEl('shirt', smooth(shirt, true), { fill: lin(0, 0, 1, 0, [[0, [206, 194, 172]], [.55, [182, 168, 146]], [1, [140, 126, 104]]]) }),
    pathEl('apron', smooth(apron, true), { fill: lin(0, 0, 1, 1, [[0, [168, 148, 118]], [1, [118, 100, 78]]]) }),
    pathEl('apron strap L', [nd(...at(-125, 515)), nd(...at(-60, 700))], { fill: NOFILL, stroke: stk(col([96, 66, 42]), 16) }),
    pathEl('apron strap R', [nd(...at(125, 515)), nd(...at(60, 700))], { fill: NOFILL, stroke: stk(col([96, 66, 42]), 16) }),
    pathEl('apron pocket', poly([at(-80, 330), at(80, 330), at(84, 250), at(-84, 250)]), { fill: NOFILL, stroke: stk(col([96, 80, 60], .7), 3) }),
  ], { op: .92 });
}
function counter() {
  const DEPTH = 470, X0 = -2300, X1 = 1500, Y0 = -1000; // every corner stays in front of the camera
  const top = P2([[X0, Y0, 0], [X1, Y0, 0], [X1, DEPTH, 0], [X0, DEPTH, 0]]);
  const kids = [pathEl('oak counter', poly(top), { fill: lin(0, 1, 0, 0, [[0, [176, 118, 70]], [.5, [142, 92, 54]], [1, [104, 66, 38]]]) })];
  for (let x = X0 + 100, i = 0; x <= X1 - 100; x += 180, i++) {
    if (i % 2) kids.push(pathEl('plank tone', poly(P2([[x, Y0, 0], [Math.min(x + 180, X1), Y0, 0], [Math.min(x + 180, X1), DEPTH, 0], [x, DEPTH, 0]])), { fill: col([70, 42, 22], .07) }));
    const a = proj([x, Y0, 0]), b = proj([x, DEPTH, 0]);
    kids.push(pathEl('plank seam', [nd(...a), nd(...b)], { fill: NOFILL, stroke: stk(col([54, 32, 18], .5), 2) }));
  }
  for (let x = X0 + 60, i = 0; x <= X1 - 60; x += 97, i++) { if (i % 3 === 1) continue;
    const pts = []; for (let y = Y0; y <= DEPTH; y += 490) pts.push(proj([x + Math.sin(y / 260 + i * 1.3) * 10, y, 0]));
    kids.push(pathEl('grain', smooth(pts), { fill: NOFILL, stroke: stk(col([86, 54, 30], .14), 1.2) })); }
  const e = [proj([X0, DEPTH, 0]), proj([X1, DEPTH, 0])];
  kids.push(pathEl('counter front lip (far)', poly([e[0], e[1], [e[1][0], e[1][1] + 26], [e[0][0], e[0][1] + 26]]), { fill: col([84, 52, 30]) }));
  kids.push(pathEl('counter back edge (sunlit)', [nd(...e[0]), nd(...e[1])], { fill: NOFILL, stroke: stk(col([250, 202, 136], .6), 3.5) }));
  kids.push(pathEl('sun pool', smooth(P2([[-900, -300, 0], [-200, 200, 0], [700, 380, 0], [900, -100, 0], [100, -500, 0]]), true), { fill: rad(.45, .45, .6, [[0, [255, 214, 150], .2], [1, [255, 200, 130], 0]]), blend: 'screen' }));
  const onScreen = e => { const ns = (e.properties && e.properties.shape && e.properties.shape.path) || []; if (!ns.length || e.title === 'oak counter' || e.title === 'sun pool') return true;
    const xs = ns.map(q => q.x), ys = ns.map(q => q.y); return Math.max(...xs) > -60 && Math.min(...xs) < W + 60 && Math.max(...ys) > -60 && Math.min(...ys) < H + 60; };
  return G('oak counter', kids.filter(onScreen)); // lines that never reach the frame are dropped
}
const face = (title, pts, paint, o = {}) => pathEl(title, poly(P2(pts)), { fill: paint, ...o });
function fibres(title, quad, n, seed, c) { // short paper fibres scattered on a face, for material
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, kids = [];
  for (let i = 0; i < n; i++) { const u = rnd(), v = rnd(), a = mix3(mix3(quad[0], quad[1], u), mix3(quad[3], quad[2], u), v), d = [(rnd() - .5) * 14, (rnd() - .5) * 14, 0];
    const p = proj(a), q = proj([a[0] + d[0], a[1] + d[1], a[2] + (quad[0][2] === quad[2][2] ? 0 : d[1])]); kids.push(pathEl('fibre', [nd(...p), nd(...q)], { fill: NOFILL, stroke: stk(col(c, .22), 1) })); }
  return G(title, kids);
}
function boxInside() { // seen once the lid is off: inner walls, tissue nest, the product, then the front tissue fold
  const w = B.w / 2 - B.wall, d = B.d / 2 - B.wall;
  const fl = proj([-B.w / 2, -B.d / 2, B.h]), fr = proj([B.w / 2, -B.d / 2, B.h]), br = proj([B.w / 2, B.d / 2, B.h]), bl = proj([-B.w / 2, B.d / 2, B.h]);
  const win = E('clipPath', 'opening', { id: 'c-open', kids: [pathEl('window', poly([fl, fr, br, [br[0], br[1] - 600], [bl[0], bl[1] - 600], bl]), { fill: col([255, 255, 255]) })] });
  const pb = PROD, ppm = pxPerMm(pb), base = proj(pb), PH = 134 * ppm, PW = 134 * ppm;
  return G('box inside', [win,
    face('inner back wall', [[w, d, 8], [-w, d, 8], [-w, d, B.h], [w, d, B.h]], lin(0, 0, 0, 1, [[0, KRAFT.inner], [1, KRAFT.inner2]])),
    face('inner left wall', [[-w, d, 8], [-w, -d, 8], [-w, -d, B.h], [-w, d, B.h]], lin(1, 0, 0, 0, [[0, [108, 72, 42]], [1, [140, 98, 60]]])),
    pathEl('tissue nest', smooth(P2([[-w, -d + 10, 60], [-w + 40, 0, 74], [-w + 10, d - 10, 96], [0, d - 4, 84], [w - 10, d - 10, 100], [w - 30, 0, 70], [w - 6, -d + 10, 80], [0, -d + 6, 66]]), true), { fill: lin(0, 0, 1, 1, [[0, TISSUE], [1, TISSUE_D]]) }),
    pathEl('tissue fold shade', smooth(P2([[-w + 30, d - 30, 86], [-40, 20, 52], [w - 40, d - 26, 88]])), { fill: NOFILL, stroke: stk(col(TISSUE_D, .9), 10) }),
    ell('nest shadow', base[0], base[1] - 4, PW * .34, PW * .07, { fill: rad(.5, .5, .5, [[0, [90, 66, 40], .55], [1, [90, 66, 40], 0]]) }),
    E('image', 'product-image (transparent PNG, sits in the box)', { o: [base[0] - PW / 2, base[1] - PH], shape: img(CONTENT.product, PW, PH, 'xMidYMax meet') }),
    pathEl('front tissue fold (in front of the product base)', smooth(P2([[-w, -d + 4, 60], [-60, -d + 2, 52], [20, -d + 10, 58], [w - 20, -d + 4, 64], [w, -d + 20, 50], [w - 30, -d - 2, 40], [-w + 20, -d - 2, 40]]), true), { fill: lin(0, 0, 0, 1, [[0, TISSUE], [1, TISSUE_D]]) }),
  ], { clip: 'c-open' });
}
function boxOuter() {
  const shadow = [[-150, 150, 0], [150, 150, 0], [150, -150, 0], [-150, -150, 0]].map(p => [p[0] + 0, p[1], 0]);
  const sun = [.75, -.9]; // the sun is behind and to the left: the shadow falls toward the camera, to the right
  const cast = [[-150, -150, 0], [150, -150, 0], [150, 150, 0], [150 + B.h * sun[0] * 1.6, 150 + B.h * sun[1] * 1.6, 0], [150 + B.h * sun[0] * 1.6, -150 + B.h * sun[1] * 1.6, 0], [-150 + B.h * sun[0] * 1.6, -150 + B.h * sun[1] * 1.6, 0]];
  return G('box outside', [
    pathEl('cast shadow', poly(P2(cast)), { fill: col([34, 18, 8], .34), blur: 14 }),
    face('contact shadow', shadow.map(p => [p[0] * 1.03, p[1] * 1.03, 0]), col([26, 14, 6], .5), { blur: 4 }),
    face('box front', body.front, lin(0, 0, 0, 1, [[0, KRAFT.front], [1, KRAFT.front2]])),
    face('box right side', body.right, lin(0, 0, 1, 1, [[0, KRAFT.side], [1, KRAFT.side2]])),
    pathEl('front rim light', [nd(...proj([-150, -150, B.h])), nd(...proj([150, -150, B.h]))], { fill: NOFILL, stroke: stk(col([248, 214, 160], .75), 2) }),
    pathEl('corner edge light', [nd(...proj([150, -150, 0])), nd(...proj([150, -150, B.h]))], { fill: NOFILL, stroke: stk(col([222, 178, 124], .55), 1.6) }),
  ]);
}
const lidTimes = KT(T.lidUp[0], T.lidAway[1], 100);
function lid() {
  const facePath = (title, pts, paint) => pathEl(title, poly(P2(pts)), { fill: paint, anim: { shape: { path: dedupe(keys(lidTimes, t => poly(P2(pts.map(p => lidPt(p, t)))))) } } });
  const edge = (title, a, b, c, w) => pathEl(title, [nd(...proj(a)), nd(...proj(b))], { fill: NOFILL, stroke: stk(col(c, .85), w), anim: { shape: { path: dedupe(keys(lidTimes, t => [nd(...proj(lidPt(a, t))), nd(...proj(lidPt(b, t)))])) } } });
  return G('lid', [
    facePath('lid front skirt', lidF.front, lin(0, 0, 0, 1, [[0, [200, 152, 100]], [1, [178, 132, 86]]])),
    facePath('lid right skirt', lidF.right, lin(0, 0, 0, 1, [[0, [164, 120, 76]], [1, [142, 102, 64]]])),
    facePath('lid top', lidF.top, lin(0, 0, 1, 1, [[0, KRAFT.top], [1, KRAFT.top2]])),
    edge('lid front edge light', lidF.top[0], lidF.top[1], [254, 224, 176], 2.4),
    edge('lid side edge light', lidF.top[1], lidF.top[2], [242, 204, 152], 1.6),
  ], { anim: { compositing: { opacity: eased([[T.lidAway[1] - 120, 1], [T.lidAway[1], 0]]) } }, op: 1 });
}
const ropeTimes = [0, ...KT(T.reach[0], T.drop[1] + 160, 160)];
function twine() {
  const strand = (title, ptsAt, w = 7) => { const path3 = t => smooth(P2(ptsAt(t)));
    const anim = { shape: { path: dedupe(keys(ropeTimes, path3)) } }, p0 = path3(STILL != null ? STILL : 0);
    return pathEl(title, p0, { fill: NOFILL, stroke: stk(lin(0, 0, 1, 1, [[0, JUTE_L], [.5, JUTE], [1, JUTE_D]]), w), anim }); };
  const kids = STRANDS.map((s, i) => strand('twine: ' + s[0], t => strandPts(i, t)));
  const loop = (title, dir) => { const path3 = t => smooth(P2(bowLoop(dir, t)));
    const anim = { shape: { path: dedupe(keys([0, ...KT(T.pull[0], T.release[1], 120)], path3)) }, compositing: { opacity: eased([[T.release[1] - 80, 1], [T.release[1], 0]]) } };
    return pathEl(title, path3(STILL != null ? STILL : 0), { fill: NOFILL, stroke: stk(lin(0, 0, 1, 1, [[0, JUTE_L], [.5, JUTE], [1, JUTE_D]]), 7), anim, op: STILL != null && STILL > T.release[1] ? 0 : 1 }); };
  kids.push(loop('bow loop (left)', nrm([-1, .55, 0])), loop('bow loop (right)', nrm([1, .75, 0])));
  const k = proj(KNOT); kids.push(ell('knot', k[0], k[1], 10, 8, { fill: rad(.4, .35, .7, [[0, JUTE_L], [.6, JUTE], [1, JUTE_D]]), anim: { compositing: { opacity: eased([[T.release[0], 1], [T.release[0] + 160, 0]]) } }, op: STILL != null && STILL > T.release[0] ? 0 : 1 }));
  return G('twine', kids);
}
function flaps() {
  const times = KT(T.open[0], T.open[1], 120);
  const one = side => { const f = t => smooth(P2(flap(side, t)), true);
    const fold = t => { const q = flap(side, t); return smooth(P2([mix3(q[9], q[1], .15), mix3(mix3(q[8], q[2], .5), q[2], .3), mix3(q[7], q[3], .7)])); };
    return G('tissue flap ' + side, [
      pathEl('tissue', f(STILL != null ? STILL : 0), { fill: lin(side === 'L' ? 0 : 1, 0, side === 'L' ? 1 : 0, 1, [[0, TISSUE], [1, TISSUE_D]]), stroke: stk(col([226, 214, 196], .8), 1.4), anim: { shape: { path: dedupe(keys(times, f)) } } }),
      pathEl('crease', fold(STILL != null ? STILL : 0), { fill: NOFILL, stroke: stk(col(TISSUE_D, .9), 2.2), anim: { shape: { path: dedupe(keys(times, fold)) } } }),
    ]); };
  return G('tissue flaps (fold open by hand)', [one('L'), one('R')]);
}

// ---------------- hand rig (screen space). Local frame: wrist at (0,0), fingers toward +y, forearm toward -y ----------------
const FINGERS = [ // name, knuckle x, lengths (proximal, middle, distal), width
  ['index', -27, [42, 26, 20], 18], ['middle', -9, [46, 29, 22], 18.5], ['ring', 9, [43, 27, 21], 17.5], ['pinky', 25, [33, 22, 18], 15]];
const HAND_SCALE = 1.32; // illustration scale: hands read a touch larger than life next to the box
const POSES = [[0, 'relax'], [T.reach[1] - 320, 'relax'], [T.reach[1], 'pinch'], [T.drop[0], 'pinch'], [T.drop[0] + 260, 'open'], [T.toLid[1] - 300, 'open'], [T.toLid[1], 'grip'],
  [T.lidAway[1], 'grip'], [T.toTissue[0] + 200, 'relax'], [T.toTissue[1] - 300, 'relax'], [T.toTissue[1], 'pinch'], [T.exit[0], 'pinch'], [T.exit[0] + 260, 'open']];
const poseAt = t => { let i = 0; while (i < POSES.length - 1 && POSES[i + 1][0] <= t) i++; if (i === POSES.length - 1) return POSE[POSES[i][1]];
  const [t0, a] = POSES[i], [t1, b] = POSES[i + 1]; return lerpPose(POSE[a], POSE[b], ePrem(clamp((t - t0) / (t1 - t0)))); };
const poseKeys = f => ({ keys: POSES.map(([t, name], i) => ({ time: t, value: f(POSE[name]), ...(i < POSES.length - 1 ? { easing: PREM } : {}) })) });
const handTimes = KT(0, T.exit[1], 100);
function handRig(side) {
  const mirror = side === 'L', s = mirror ? -1 : 1, T0s = STILL != null ? STILL : 0;
  const at = t => { const pz = handAt(side, t).p, a = proj(pz), sh = proj(SH[side]);
    const dir = nrm([sh[0] - a[0], sh[1] - a[1], 0]), ang = Math.atan2(dir[1], dir[0]) * 180 / Math.PI + 90; return { a, ang, sc: pxPerMm(pz) * HAND_SCALE }; };
  const A0 = at(T0s), P0 = poseAt(T0s);
  const cap = (title, l, w) => G(title, [rect('shade', -w / 2 + 2, -w * .3 + 2.5, w, l + w * .6, { rx: w / 2, fill: col(SKIN_D, .45) }), rect('skin', -w / 2, -w * .3, w, l + w * .6, { rx: w / 2, fill: lin(0, 0, 1, 0, [[0, SKIN_L], [.6, SKIN], [1, SKIN_D]]) })]);
  const crease = (y, w) => pathEl('knuckle crease', [nd(-w * .28, y), nd(w * .28, y)], { fill: NOFILL, stroke: stk(col(SKIN_D, .35), 1.4) });
  const finger = ([name, kx, ls, w], fi) => {
    let inner = G(name + ' tip', [cap(name + ' distal', ls[2], w * .84), ell(name + ' nail', 0, ls[2] - 1, w * .3, w * .38, { fill: lin(0, 0, 0, 1, [[0, NAIL], [1, [222, 178, 158]]]) })], { o: [0, ls[1]] });
    inner = G(name + ' middle joint', [cap(name + ' middle', ls[1], w * .92), crease(2, w), inner], { o: [0, ls[0]] });
    return G(name, [cap(name + ' proximal', ls[0], w), crease(ls[0] - 2, w), inner],
      { o: [kx, 80], r: P0.sp[fi], s: [1, P0.k[fi]], anim: { transform: { rotate: poseKeys(q => r1(q.sp[fi])), scale: poseKeys(q => SC([1, q.k[fi]])) } } });
  };
  const thumb = G('thumb', [cap('thumb base', 38, 22), G('thumb tip', [cap('thumb distal', 30, 19.5), ell('thumb nail', 0, 28, 6.5, 8, { fill: col(NAIL) })],
      { o: [0, 36], r: P0.th[1], anim: { transform: { rotate: poseKeys(q => r1(q.th[1])) } } })],
    { o: [-42, 52], r: P0.th[0], s: [1, P0.th[2]], anim: { transform: { rotate: poseKeys(q => r1(q.th[0])), scale: poseKeys(q => SC([1, q.th[2]])) } } });
  const backOfHand = pathEl('back of hand', smooth([[-35, -6], [-43, 30], [-40, 72], [-25, 87], [0, 89], [25, 87], [38, 74], [40, 30], [34, -6]], true), { fill: lin(0, 0, 1, 1, [[0, SKIN_RIM], [.15, SKIN_L], [.6, SKIN], [1, SKIN_D]]) });
  const knuckles = G('knuckles', [-27, -9, 9, 25].map((x, i) => ell('knuckle', x, 80, 8.5 - i * .6, 5, { fill: col(SKIN_L, .5) })));
  const tendons = G('tendons', [[-20, 64], [-6, 68], [10, 66], [24, 62]].map(([x, y]) => pathEl('tendon', [nd(x * .45, 12), nd(x, y)], { fill: NOFILL, stroke: stk(col(SKIN_D, .16), 3.2) })));
  const arm = G('forearm and sleeve', [
    pathEl('forearm', smooth([[-34, 4], [-46, -150], [-54, -420], [54, -420], [46, -150], [33, 4]], true), { fill: lin(0, 0, 1, 0, [[0, SKIN_RIM], [.16, SKIN_L], [.6, SKIN], [1, SKIN_D]]) }),
    pathEl('rolled cuff', smooth([[-60, -236], [0, -250], [60, -236], [64, -296], [0, -310], [-64, -296]], true), { fill: lin(0, 0, 1, 0, [[0, [236, 230, 216]], [.7, LINEN], [1, LINEN_D]]) }),
    pathEl('cuff fold', smooth([[-58, -268], [0, -281], [60, -270]]), { fill: NOFILL, stroke: stk(col(LINEN_D, .8), 3) }),
    pathEl('sleeve', smooth([[-64, -296], [-82, -760], [82, -760], [64, -296]], true), { fill: lin(0, 0, 1, 0, [[0, [226, 218, 202]], [.6, LINEN], [1, LINEN_D]]) }),
    pathEl('sleeve crease', smooth([[-22, -320], [-14, -500], [-28, -700]]), { fill: NOFILL, stroke: stk(col(LINEN_D, .5), 2.6) }),
  ]);
  const rig = G(side === 'L' ? 'left hand' : 'right hand', [G('hand (mirrored for the left)', [arm, backOfHand, knuckles, ...FINGERS.map(finger), thumb], { s: [s * A0.sc, A0.sc], t: [55, -128] /* the pinch point (thumb tip on index tip) sits on the anchor */ })], {
    o: A0.a, r: A0.ang, anim: { transform: { origin: dedupe(keys(handTimes, t => at(t).a, XY)), rotate: dedupe(keys(handTimes, t => at(t).ang, r1)) } } });
  return rig;
}
// a soft shadow under each hand on whatever is below it (lid, box rim or counter), offset by the sun and fading with height
function handShadow(side) {
  const surf = (p, t) => { const onBox = Math.abs(p[0]) < 160 && Math.abs(p[1]) < 160; const z = onBox ? (t < T.lidUp[0] ? L.z1 : B.h) : 0; return z; };
  const sh = t => { const p = handAt(side, t).p, z = surf(p, t), h = Math.max(0, p[2] - z); return { q: proj([p[0] + h * .35, p[1] - h * .5, z]), a: clamp(.3 - h / 1100, .05, .3), sc: pxPerMm([p[0], p[1], z]) }; };
  const S0 = sh(STILL != null ? STILL : 0);
  return ell((side === 'L' ? 'left' : 'right') + ' hand shadow', 0, 0, 86 * S0.sc, 34 * S0.sc, { fill: rad(.5, .5, .5, [[0, [30, 16, 8], 1], [1, [30, 16, 8], 0]]), o: S0.q, op: S0.a,
    anim: { transform: { origin: dedupe(keys(handTimes, t => sh(t).q, XY)) }, compositing: { opacity: dedupe(keys(handTimes, t => sh(t).a, f3)) } } });
}

// ---------------- camera move, ambient life ----------------
const PROD_SCR = proj([0, -26, 100]); // the middle of the product: the push lands it on the right third
const PUSH = { o: PROD_SCR, to: [1330, 640], s: 1.5 };
const pushAnim = (depth) => ({ transform: {
  origin: eased([[T.push[0], PUSH.o], [T.push[1], PUSH.o.map((v, i) => v + (PUSH.to[i] - v) * depth)]], XY, PREM),
  scale: eased([[T.push[0], 1], [T.push[1], 1 + (PUSH.s - 1) * depth]], SC, PREM) } });
const motes = G('dust in the sunlight', Array.from({ length: 14 }, (_, i) => { const x = 260 + (i * 523) % 1500, y = 160 + (i * 311) % 560, r = 2.5 + (i % 4);
  return ell('mote', x, y, r, r, { fill: rad(.5, .5, .5, [[0, [255, 236, 200], .9], [1, [255, 220, 170], 0]]), anim: { transform: { origin: eased([[0, [x, y]], [DUR, [x + 40 - (i % 3) * 30, y - 90 - (i % 5) * 20]]], XY, cb(.3, 0, .7, 1)) } } }); }), { blend: 'screen' });

// ---------------- text card (same slots as the other Market Day builds) ----------------
const C = CONTENT, ACC = C.accent || [244, 190, 110], CREAM = [246, 238, 220];
const HX = 112, HY = 372, FS = 92, CARD = [60, 104, 682, 756], T0 = T.text;
const txt = (title, text, x, y, font, size, weight, o = {}) => E('text', title, { o: [x, y], shape: { text, rangeStyles: o.ranges || [], fontFamily: font, fontSize: size, fontStyle: { bold: false, italic: false, weight }, letterSpacing: o.ls || 0, textAnchor: 'start' }, fill: col(o.color || CREAM) });
const hl = C.headline, lines = hl.split('\n'), accentFrom = hl.length - lines[lines.length - 1].length;
const CTAW = 170 + C.cta.length * 19, CPER = 2 * (CTAW - 72) + Math.PI * 72, at = d => T0 + d;
const op = pairs => ({ compositing: { opacity: { keys: pairs.map(([t, v]) => ({ time: t, value: v })) } } });
const text = G('EDIT ME 1 - text: headline, subline, cta-text', [
  G('glass-card', [rect('card glass', CARD[0], CARD[1], CARD[2], CARD[3], { rx: 40, fill: lin(0, 0, 1, 1, [[0, [40, 26, 16], .62], [1, [24, 16, 10], .72]]) }),
    rect('card edge', CARD[0] + .6, CARD[1] + .6, CARD[2] - 1.2, CARD[3] - 1.2, { rx: 40, fill: NOFILL, stroke: { paint: col([255, 255, 255], .3), width: 1.2, opacity: 1 } })],
    { op: 0, anim: { ...op([[0, 0], [at(-100), 0], [at(500), 1], [14000, 1], [14350, 0]]), transform: { origin: eased([[at(-100), [0, 24]], [at(600), [0, 0]]], XY, OUT) } }, o: [0, 24] }),
  E('image', 'logo', { o: [HX, 142], shape: img(C.logo, 300, 100, 'xMinYMid meet'), op: 0, anim: op([[0, 0], [at(300), 0], [at(800), 1], [14000, 1], [14350, 0]]) }),
  G('headline-reveal', [txt('headline (max 3 lines, 9 chars each)', hl, HX, HY, 'Fraunces', FS, 700, { ls: 1, ranges: [{ from: accentFrom, to: hl.length - 1, properties: { fill: { paint: col(ACC) } } }] })],
    { op: 0, o: [0, 30], anim: { ...op([[0, 0], [at(400), 0], [at(1000), 1], [14000, 1], [14350, 0]]), transform: { origin: eased([[at(400), [0, 30]], [at(1100), [0, 0]]], XY, OUT) } } }),
  G('subline-reveal', [txt('subline', C.subline, HX + 2, HY + 2 * FS + 78, 'DM Sans', 30, 500, { color: [232, 222, 204] })],
    { op: 0, o: [0, 18], anim: { ...op([[0, 0], [at(800), 0], [at(1300), 1], [14000, 1], [14350, 0]]), transform: { origin: eased([[at(800), [0, 18]], [at(1400), [0, 0]]], XY, OUT) } } }),
  G('cta', [rect('cta-glass', HX, 736, CTAW, 72, { rx: 36, fill: col([255, 255, 255], .09) }),
    rect('cta-outline', HX, 736, CTAW, 72, { rx: 36, fill: NOFILL, stroke: { paint: col(ACC), width: 2, dashArray: [r1(CPER)], dashOffset: r1(CPER), lineCap: 'round', opacity: 1 }, anim: { stroke: { dashOffset: eased([[at(1100), CPER], [at(1800), 0]], r1) } } }),
    txt('cta-text (max 12 chars)', C.cta, HX + 40, 781, 'DM Sans', 24, 700, { ls: 3 })], { op: 0, anim: op([[0, 0], [at(1000), 0], [at(1400), 1], [14000, 1], [14350, 0]]) }),
]);

// ---------------- assemble ----------------
const world = G('world (the camera pushes in after the reveal)', [seller(), counter(), boxInside(), boxOuter(), flaps(), lid(), twine(), handShadow('L'), handShadow('R'), handRig('L'), handRig('R')], { o: PUSH.o, t: [-PUSH.o[0], -PUSH.o[1]], anim: pushAnim(1) });
const backdrop = G('backdrop (moves less: depth)', [background()], { o: PUSH.o, t: [-PUSH.o[0], -PUSH.o[1]], anim: pushAnim(.35) });
const brand = rect('brand-color (one fill grades the whole film like a colour filter; opacity 0 = original warm light)', 0, 0, W, H, { fill: col(C.brand), blend: 'soft-light', op: C.brandOpacity });
const grade = G('finish', [
  rect('warm sun haze', 0, 0, W, H, { fill: lin(0, 0, .8, .7, [[0, [255, 206, 140], .16], [.5, [255, 190, 120], 0]]), blend: 'screen' }),
  E('image', 'vignette', { shape: img('vignette.png', W, H) }),
  rect('fade from black', 0, 0, W, H, { fill: col([0, 0, 0]), op: 1, anim: op([[0, 1], [120, 1], [800, 0]]) }),
  rect('fade to black', 0, 0, W, H, { fill: col([0, 0, 0]), op: 0, anim: op([[0, 0], [T.out[0], 0], [T.out[1], 1]]) }),
  rect('letterbox-top (delete both bars for a full frame)', 0, 0, W, 76, { fill: col([0, 0, 0]) }), rect('letterbox-bottom', 0, H - 76, W, 76, { fill: col([0, 0, 0]) }),
]);
const doc = { id: 'svg-unbox', type: 'svg', animation: { duration: DUR, direction: 1, iterations: 0, fill: 1, alternate: false, speed: 1 },
  properties: { shape: { position: { x: 0, y: 0 }, size: { width: W, height: H }, bgColor: col([0, 0, 0]) } }, children: [backdrop, world, motes, brand, text, grade] };
if (STILL != null) { // design pass: bake the pose at STILL into the static values and drop every animator
  const strip = e => { delete e.animators; (e.children || []).forEach(strip); }; strip(doc);
}
let n = 0, nk = 0; (function walk(e) { n++; for (const g in e.animators || {}) for (const c in e.animators[g]) { const ks = e.animators[g][c].keys; nk += ks.length; ks.forEach((q, i) => console.assert(!i || q.time > ks[i - 1].time, 'key order', e.title, c, q.time)); } (e.children || []).forEach(walk); })(doc);
const out = process.argv[2] === 'set2' ? 'unbox-set2' : 'unbox';
fs.writeFileSync(path.join(__dirname, out + '.json'), JSON.stringify(doc));
fs.writeFileSync(path.join(__dirname, out + '.js'), 'window.SCENE_BASE=' + JSON.stringify(BASE) + ';window.SCENE=' + JSON.stringify(doc) + ';');
console.log(out, 'elements', n, 'keys', nk, (JSON.stringify(doc).length / 1024).toFixed(1), 'KB', STILL != null ? 'STILL ' + STILL : '', '| box top', P2(body.top).map(p => p.map(Math.round).join(',')).join(' '));
