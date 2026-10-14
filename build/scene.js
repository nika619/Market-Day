// Conjure v3 — builds the SVGator project document (conjure.json) for create_project and for the local previewer.
// Rule kept everywhere: motion lives on wrapper groups, never on the text or on the swappable images themselves.
const fs = require('fs'), path = require('path');
const CONTENT = process.argv[2] === 'set2' ? require('./content2.js') : require('./content1.js');
const BASE = 'https://cdn.jsdelivr.net/gh/nika619/conjure-svgator@main/assets/';
const W = 1920, H = 1080, DUR = 15000, P = [960, 540];
const RING = [1100, 250], RS = 820, ORB = [1575, 450], OR = 175, EYE = [1161, 347], SEED = [1095, 334];
const cb = (a, b, c, d) => ({ type: 'cubic-bezier', value: { from: { x: a, y: b }, to: { x: c, y: d } } });
const LIN = { type: 'linear', value: null };
const IO = cb(.45, 0, .55, 1), OUT = cb(.16, 1, .3, 1), IN = cb(.7, 0, .84, 0), BACK = cb(.34, 1.56, .64, 1), SOFT = cb(.3, 0, .15, 1);
const GOLD = [241, 200, 119], CREAM = [246, 238, 220], WHITEGOLD = [255, 238, 205];
const col = ([r, g, b], a = 1) => ({ type: 'color', value: { r, g, b, a } });
const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(20261013);
const R = (a, b) => +(a + (b - a) * rnd()).toFixed(1);
const f1 = v => +v.toFixed(2), f3 = v => +v.toFixed(3), r1 = v => Math.round(v * 10) / 10;

const CH = { // animator spec key -> [group, channel, value wrapper]
  o: ['transform', 'origin', v => ({ x: f1(v[0]), y: f1(v[1]) })],
  s: ['transform', 'scale', v => typeof v === 'number' ? { x: f3(v), y: f3(v) } : { x: f3(v[0]), y: f3(v[1]) }],
  r: ['transform', 'rotate', v => f1(v)],
  op: ['compositing', 'opacity', v => f1(v)],
  dash: ['stroke', 'dashOffset', v => f1(v)],
  size: ['shape', 'size', v => ({ width: f1(v[0]), height: f1(v[1]) })],
};
let idn = 0;
function E(type, title, o = {}) {
  const n = { id: (o.id || 'c' + (++idn)), type, title, properties: {} }, p = n.properties;
  if (o.o) o.o = o.o.map(r1); if (o.t) o.t = o.t.map(r1);
  const tr = {};
  if (o.o) tr.origin = { x: o.o[0], y: o.o[1] };
  if (o.t) tr.translate = { x: o.t[0], y: o.t[1] };
  if (o.s != null) tr.scale = CH.s[2](o.s);
  if (o.r) tr.rotate = o.r;
  if (Object.keys(tr).length) p.transform = tr;
  const c = {};
  if (o.op != null) c.opacity = o.op;
  if (o.blend) c.blend = o.blend;
  if (o.mask) c.mask = { source: o.mask };
  if (o.clip) c.clip = { path: o.clip, rule: false };
  if (Object.keys(c).length) p.compositing = c;
  if (o.shape) p.shape = o.shape;
  if (o.fill) p.fill = { paint: o.fill };
  if (o.stroke) p.stroke = o.stroke;
  if (type === 'mask') p.mask = { type: 'luminance' };
  if (o.a) {
    n.animators = {};
    for (const k in o.a) {
      const [grp, chn, wrap] = CH[k], ks = o.a[k].map(([t, v, e], i, all) => ({ time: Math.round(t), value: wrap(v), ...(e && e !== LIN && k !== 'op' && i < all.length - 1 ? { easing: e } : {}) })); // no easing = linear
      (n.animators[grp] = n.animators[grp] || {})[chn] = { keys: ks };
      (p[grp] = p[grp] || {})[chn] = ks[0].value; // static baseline = first keyframe
    }
  }
  if (!Object.keys(p).length) delete n.properties;
  if (o.kids) n.children = o.kids.filter(Boolean);
  return n;
}
const img = (file, w, h, fit) => ({ size: { width: r1(w), height: r1(h) }, href: /^https?:/.test(file) ? file : BASE + file, ...(fit ? { aspectRatio: fit } : {}) });
// image centred on (cx, cy): scales and turns about its own centre
const spr = (title, file, cx, cy, w, h, o = {}) => E('image', title, { o: [cx, cy], t: [-w / 2, -h / 2], shape: img(file, w, h, o.fit), ...o });
const full = (title, file, o = {}) => E('image', title, { shape: img(file, W, H), ...o }); // every full-frame plate is already 16:9
const rect = (title, x, y, w, h, o = {}) => E('rect', title, { o: [x, y], shape: { size: { width: w, height: h }, radius: { x: o.rx || 0, y: o.rx || 0 } }, ...o });
// group that pivots about (px, py) while its children stay in canvas coordinates
const piv = (title, [px, py], o = {}) => E('g', title, { o: [px, py], t: [-px, -py], ...o });
// alternate between a and b from t0 to t1
const osc = (t0, t1, period, a, b, e = LIN) => { const out = []; for (let t = t0, i = 0; t < t1 + period / 2; t += period / 2, i++) out.push([Math.min(t, t1), i % 2 ? b : a, e]); return out; };
const light = { blend: 'screen' };

// ---------------- camera for the master scene: [time, zoom, scene point, where it sits on screen, easing] ----------------
const PALM = [1572, 642];
const CAM = [ // [time, zoom, scene point, where it sits on screen, easing to the next key, roll in degrees]
  [3000, 1.66, [1150, 230], [930, 480], cb(.25, .1, .25, 1), -1.4],
  [5850, 1.30, [1150, 330], [975, 540], IN, .3],
  [6200, 1.50, [1480, 600], [870, 560], LIN, 1.2],
  [9000, 2.15, ORB, [960, 540], cb(.5, 0, .1, 1), -1.5],
  [10800, 1.06, [960, 540], [1040, 540], IO, 0],
  [13700, 1.13, PALM, [1688.7, 648.1], IN, -.7], // slow push centred on the palm, so the orb and the light thread stay put
  [15000, 1.2, PALM, [1650, 640], LIN, -1.3],
];
const camKeys = (d, from = 0) => { const L = CAM.filter(k => k[0] >= from); const out = {
  o: L.map(([t, s, C, A, e, r = 0]) => { const c = Math.cos(r * Math.PI / 180), n = Math.sin(r * Math.PI / 180), vx = s * (C[0] - P[0]), vy = s * (C[1] - P[1]);
    const O = [A[0] - (c * vx - n * vy), A[1] - (n * vx + c * vy)]; return [t, [P[0] + (O[0] - P[0]) * d, P[1] + (O[1] - P[1]) * d], e]; }),
  s: L.map(([t, s, , , e]) => [t, 1 + (s - 1) * d, e]) };
  if (L.some(k => k[5])) out.r = L.map(([t, , , , e, r = 0]) => [t, r, e]); // every depth rolls together; parallax comes from position and zoom
  return out; };
const layer = (title, d, kids, o = {}) => piv(title, P, { a: camKeys(d, o.from), kids, ...o });

// ---------------- shot 1: awakening ----------------
const dustA = Array.from({ length: 5 }, (_, i) => { const x = R(700, 1900), y = R(80, 1000), z = R(26, 120); return spr('bokeh', 'glow-gold.jpg', x, y, z, z, { ...light, a: { o: [[0, [x, y], LIN], [3000, [x - z * R(1, 2.4), y - R(10, 50)]]], op: [[0, 0, IO], [R(500, 1200), R(.25, .6), IO], [3000, R(.1, .4)]] } }); });
const shot1 = E('g', 'shot-1 awakening (face close-up)', { a: { op: [[0, 1], [2999, 1], [3000, 0]] }, kids: [
  piv('face-camera (slow push-in)', EYE, { a: { r: [[0, .8, IO], [2550, -.5, IN], [3000, -2]], s: [[0, 1.08, LIN], [2550, 1.17, IN], [3000, 1.9]], o: [[0, [1176, 352], LIN], [2550, [1148, 345], IN], [3000, [1000, 380]]] }, kids: [
    full('face eyes closed', 'face-closed.jpg'),
    full('face eyes open', 'face-open.jpg', { a: { op: [[0, 0], [1900, 0, IO], [2040, 1]] } }),
    spr('eye-glow', 'glow-gold.jpg', EYE[0] + 6, EYE[1] + 2, 300, 300, { ...light, a: { op: [[0, 0], [1950, 0, OUT], [2150, .9, IO], [2600, .35]], s: [[1950, .3, OUT], [2150, 1.2, IO], [2600, .8]] } }),
    spr('eye-glint', 'spark.jpg', EYE[0] + 6, EYE[1] + 2, 520, 520, { ...light, a: { op: [[0, 0], [1990, 0, OUT], [2120, 1, IO], [2550, 0]], s: [[1990, .1, OUT], [2140, 1, IO], [2550, .5]], r: [[1990, 0, LIN], [2550, 35]] } }),
  ] }),
  spr('lens-streak', 'streak.jpg', 1010, 347, 2600, 170, { ...light, a: { op: [[0, 0], [2000, 0, OUT], [2160, .85, IO], [2700, 0]], s: [[2000, [.2, 1], OUT], [2200, [1, 1], IO], [2700, [1.25, .5]]] } }),
  ...dustA,
  spr('foreground leaf (out of focus)', 'leaf-soft.webp', 0, 0, 640, 660, { a: { o: [[0, [-260, 1010], LIN], [3000, [470, 900]]], r: [[0, -40, LIN], [3000, 28]] } }),
  rect('fade from black', 0, 0, W, H, { fill: col([0, 0, 0]), a: { op: [[0, 1], [220, 1, cb(.3, 0, .3, 1)], [1500, 0]] } }),
  spr('light burst', 'glow.jpg', 1010, 380, 700, 700, { ...light, a: { op: [[0, 0], [2620, 0, IN], [3000, 1]], s: [[2620, .2, IN], [3000, 7]] } }),
] });

// ---------------- shot 2 + 4: the master scene ----------------
const RR = RS / 2, CO = 2 * Math.PI * .8625 * RR, CI = 2 * Math.PI * .3625 * RR;
const runeMask = (id, r, wdt, rot, dash) => E('mask', 'reveal mask', { id, kids: [E('ellipse', 'draw-on stroke', { o: RING, r: rot, shape: { radius: { x: r, y: r } }, fill: { type: 'none' }, stroke: { paint: col([255, 255, 255]), width: wdt, dashArray: [f1(Math.abs(dash[0][1]))], dashOffset: dash[0][1], opacity: 1 }, a: { dash } })] });
const runes = layer('depth-2 rune circle', .9, [
  E('g', 'light shafts', { kids: [0, 1].map(i => piv('shaft ' + (i + 1), RING, { r: [-28, 34][i], a: { r: [[3000, [-28, 34][i]], [15000, [-14, 20][i]]] }, kids: [
    spr('shaft', 'streak.jpg', RING[0] + 700, RING[1], 1700, [320, 230][i], { ...light, a: { op: [[3000, 0], [4500, 0], [5300, [.38, .28][i]], [9000, [.38, .28][i]], [9500, [.6, .45][i]], [11200, [.38, .28][i]], [14000, [.38, .28][i]], [14700, 0]] } })] })) }),
  E('g', 'rune-circle', { kids: [
    spr('rune-glow', 'rune-glow.jpg', RING[0], RING[1], 1500, 1500, { ...light, a: { op: [[3000, 0], [4450, 0, OUT], [4750, .95, IO], [5700, .45, LIN], [9000, .45, OUT], [9350, .85, IO], [10600, .5], [14000, .5, IO], [14600, 0]], s: [[4450, .9, OUT], [4750, 1.08, IO], [5700, 1]] } }),
    E('g', 'outer runes (draw on)', { mask: 'm-outer', ...light, a: { op: [[14000, 1, IO], [14700, 0]] }, kids: [runeMask('m-outer', .8625 * RR, .3 * RR, -90, [[3250, CO, cb(.5, 0, .2, 1)], [4650, 0]]),
      spr('rune-outer', 'rune-outer.jpg', RING[0], RING[1], RS, RS, { a: { r: [[3000, -25, LIN], [15000, 35]] } })] }),
    E('g', 'inner runes (draw on)', { mask: 'm-inner', ...light, a: { op: [[14000, 1, IO], [14700, 0]] }, kids: [runeMask('m-inner', .3625 * RR, .735 * RR, 90, [[3700, -CI, cb(.5, 0, .2, 1)], [5000, 0]]),
      spr('rune-inner', 'rune-inner.jpg', RING[0], RING[1], RS, RS, { a: { r: [[3000, 30, LIN], [15000, -50]] } })] }),
    piv('comet (leads the draw-on)', RING, { a: { r: [[3250, 0, cb(.5, 0, .2, 1)], [4650, 360]] }, kids: ['spark.jpg', 'glow-gold.jpg'].map((f, i) => spr(i ? 'comet-glow' : 'comet-head', f, RING[0], RING[1] - .8625 * RR, 260 - i * 60, 260 - i * 60, { ...light, a: { op: [[3000, 0], [3250, 0], [3330, 1], [4480, 1], [4750, 0]] } })) }),
  ] }),
]);
const ringDef = [[272, 71, -18, -11, 5200], [236, 104, 24, 17, 6100]]; // rx, ry, tilt a, tilt b, period
const ellC = (a, b) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
const orbitRing = (i, front) => { const [a, b, r0, r1, per] = ringDef[i], half = f1(ellC(a, b) / 2);
  return E('ellipse', `orbit-ring-${i + 1} ${front ? 'near' : 'far'} side`, { o: ORB, shape: { radius: { x: a, y: b } }, fill: { type: 'none' },
    stroke: { paint: col(front ? WHITEGOLD : GOLD), width: front ? 2.6 : 1.8, dashArray: [half, half], dashOffset: front ? 0 : half, opacity: front ? .95 : .6 },
    a: { r: [[9000, r0], [15000, r1]], s: [[9000, .5, BACK], [9900 + i * 150, 1]], op: [[9000, 0], [9250 + i * 150, 0, OUT], [9900 + i * 150, 1], [13800, 1, IN], [14250, 0]] } }); };
const leafOrbit = (i, file, a0, rad, t0, sz) => piv('leaf swirl', RING, { a: { r: [[t0, a0, cb(.3, .2, .5, 1)], [t0 + 2600, a0 + 210]], op: [[3000, 0], [t0, 0, OUT], [t0 + 500, 1, LIN], [t0 + 2100, 1, IO], [t0 + 2600, 0]] }, kids: [
  spr('leaf', file, RING[0] + rad, RING[1], sz, sz, { a: { r: [[t0, R(0, 90), LIN], [t0 + 2600, R(260, 520)]], s: [[t0, .4, OUT], [t0 + 900, 1, IN], [t0 + 2600, .5]] } })] });
const mote = () => { const x = R(60, 1880), y = R(120, 1040), z = R(8, 26); return spr('dust mote', 'glow-gold.jpg', x, y, z, z, { ...light, a: { o: [[3000, [x, y]], [15000, [x + R(-70, 70), y - R(90, 260)]]], op: [[3000, R(.1, .5)], [R(4500, 11000), R(.7, 1)], [14800, 0]] } }); };
const butterfly = (n, path, t0, t1, sz) => { const fade = k => ({ op: [[0, 0], [t0, 0], [t0 + 500, k], [t1 - 500, k], [t1, 0]] });
  return E('g', 'butterfly path', { a: { o: path.map(([f, p]) => [t0 + (t1 - t0) * f, p, IO]) }, kids: [
    spr('butterfly glow', 'glow-gold.jpg', 0, 0, sz * 2.6, sz * 2.6, { ...light, a: fade(.55) }),
    E('g', 'wing flap', { r: R(-25, 25), a: { s: osc(t0, t1, 360, [1, 1], [.22, 1]) }, kids: [spr('butterfly-' + n, 'butterfly.webp', 0, 0, sz * 1.27, sz, { a: fade(1) })] })] }); };

const scene = E('g', 'shot-2 + shot-4 the scene (multiplane camera)', { a: { op: [[0, 0], [2999, 0], [3000, 1], [6199, 1], [6200, 0], [8999, 0], [9000, 1]] }, kids: [
  layer('depth-1 forest', .6, [
    spr('forest', 'forest.jpg', 960, 540, 2300, 1294),
    spr('lantern-glow', 'glow-gold.jpg', 1745, 225, 420, 420, { ...light, a: { op: osc(3000, 15000, 4000, .35, .65) } }),
    E('g', 'lantern (sways)', { o: [1745, -10], t: [-62, 0], a: { r: osc(3000, 15000, 6000, -2.6, 2.6, IO) }, kids: [E('image', 'lantern', { shape: img('lantern.webp', 124, 274) })] }),
  ]),
  runes,
  layer('depth-3 sorcerer', 1, [
    piv('sorcerer (breathes)', [1000, 1080], { a: { s: osc(3000, 15000, 12000, [1, 1], [1.005, 1.011], IO), r: osc(3000, 15000, 12000, -.3, .35, IO) }, kids: [
      full('sorcerer', 'sorcerer.webp'),
      full('sorcerer-shadow (fades off as the circle lights him)', 'sorcerer-shadow.webp', { a: { op: [[3000, .97], [3500, .97, cb(.4, 0, .2, 1)], [5200, 0], [13900, 0, IO], [14700, 1]] } }),
    ] }),
    spr('palm-glow', 'glow-gold.jpg', 1588, 628, 460, 280, { ...light, a: { op: [[8999, 0], [9000, 1, IO], [9800, .6, IO], [11800, .8], [13800, .5], [14350, 0]] } }),
    E('g', 'orbit rings, far side', { kids: [
      spr('orb-halo', 'glow-gold.jpg', ORB[0], ORB[1], 780, 780, { ...light, a: { op: [[8999, 0], [9000, 1, OUT], [10000, .5, IO], [12000, .62], [13800, .45], [14350, 0]] } }),
      orbitRing(0, false), orbitRing(1, false)] }),
    E('g', 'leaves, butterflies, dust', { kids: [
      leafOrbit(0, 'leaf-oak.webp', 150, 470, 3500, 150), leafOrbit(1, 'leaf-maple.webp', 20, 540, 3750, 130), leafOrbit(2, 'leaf-beech.webp', 250, 430, 4050, 110), leafOrbit(3, 'twig.webp', 95, 600, 3300, 170),
      butterfly(1, [[0, [1960, 330]], [.4, [1790, 250]], [.7, [1640, 230]], [1, [1470, 150]]], 4300, 6200, 46),
      butterfly(2, [[0, [1960, 760]], [.25, [1800, 690]], [.45, [1830, 480]], [.7, [1770, 250]], [1, [1840, 190]]], 9700, 14000, 44),
      ...Array.from({ length: 10 }, mote),
    ] }),
  ]),
  layer('depth-4 foreground leaves (out of focus)', 1.4, [spr('leaves-frame', 'leaves-frame-soft.webp', 960, 540, 2300, 1294)]),
  rect('fade to black', 0, 0, W, H, { fill: col([0, 0, 0]), a: { op: [[0, 0], [14050, 0, IO], [14850, 1]] } }),
] });

// ---------------- shot 3: the hand opens, the light gathers ----------------
const HP = [1095, 380], hd = path.join(__dirname, '..', 'assets', 'hand');
const frames = fs.readdirSync(hd).filter(f => /\.jpe?g$/.test(f)).sort();
const T0 = 6600, TD = 1600; // the opening plays across these frames; each one dissolves over the one below
const spark = i => { const a = R(-170, -10) * Math.PI / 180, d = R(160, 430), t0 = R(7750, 8350), z = R(40, 110); return spr('spark', 'spark.jpg', SEED[0], SEED[1], z, z, { ...light, a: { o: [[t0, SEED, OUT], [t0 + 900, [SEED[0] + Math.cos(a) * d, SEED[1] + Math.sin(a) * d]]], op: [[6200, 0], [t0, 0], [t0 + 150, 1], [t0 + 900, 0]] } }); };
const shot3 = E('g', 'shot-3 the hand opens', { a: { op: [[0, 0], [6199, 0], [6200, 1], [8999, 1], [9000, 0]] }, kids: [
  piv('hand-camera', HP, { a: { r: [[6200, 2, OUT], [6750, .3, LIN], [8650, -.4, IN], [9000, -1.5]], s: [[6200, 1.25, OUT], [6750, 1.06, LIN], [8650, 1.17, IN], [9000, 1.7]], o: [[6200, [1250, 410], OUT], [6750, [1095, 380], LIN], [8650, [1095, 372], IN], [9000, [1085, 410]]] }, kids: [
    E('g', 'hand frames (painted sequence)', { kids: frames.map((f, i) => full('frame ' + (i + 1), 'hand/' + f, i ? { a: { op: [[T0 + TD * (i - 1) / (frames.length - 1), 0, LIN], [T0 + TD * i / (frames.length - 1), 1]] } } : {})) }),
    spr('fist-glow', 'glow-gold.jpg', 1010, 480, 520, 520, { ...light, a: { op: [[6200, .25, IO], [6450, .6, IO], [6700, .3, IO], [7300, .7, IO], [7900, 0]], s: [[6200, .7, IO], [7300, 1.2]] } }),
    E('ellipse', 'shockwave', { o: SEED, shape: { radius: { x: 60, y: 60 } }, fill: { type: 'none' }, stroke: { paint: col(WHITEGOLD), width: 3, opacity: 1 }, a: { s: [[7780, .2, OUT], [8500, 5]], op: [[6200, 0], [7780, 0], [7800, .9, OUT], [8500, 0]] } }),
    spr('blob-halo', 'glow-gold.jpg', SEED[0], SEED[1], 900, 900, { ...light, a: { op: [[6200, 0], [7700, 0, OUT], [8300, .8, LIN], [9000, 1]], s: [[7700, .1, OUT], [8300, .55, IO], [8650, .8, IN], [9000, 4]] } }),
    spr('blob (wobbles)', 'glow-gold.jpg', SEED[0], SEED[1], 440, 440, { ...light, a: { op: [[6200, 0], [7750, 0], [7850, 1]], r: [[7750, 0, LIN], [9000, 150]], s: [[7750, [.05, .05], BACK], [8050, [.5, .42], IO], [8200, [.44, .56], IO], [8350, [.62, .5], IO], [8500, [.56, .7], IO], [8650, [.8, .72], IN], [9000, [6, 6]]] } }),
    spr('blob-inner', 'glow.jpg', SEED[0], SEED[1], 300, 300, { ...light, a: { op: [[6200, 0], [7750, 0], [7900, 1]], r: [[7750, 0, LIN], [9000, -120]], s: [[7750, [.05, .05], BACK], [8100, [.4, .52], IO], [8280, [.56, .42], IO], [8460, [.5, .66], IO], [8650, [.75, .7], IN], [9000, [7, 7]]] } }),
    spr('blob-outer (wobbles the other way)', 'glow-gold.jpg', SEED[0], SEED[1], 620, 620, { ...light, a: { op: [[6200, 0], [7850, 0], [8050, .8]], r: [[7850, 40, LIN], [9000, -110]], s: [[7850, [.1, .1], OUT], [8150, [.46, .6], IO], [8320, [.64, .5], IO], [8490, [.55, .74], IO], [8650, [.8, .7], IN], [9000, [6, 6]]] } }),
    spr('blob-core', 'spark.jpg', SEED[0], SEED[1], 420, 420, { ...light, a: { op: [[6200, 0], [7750, 0], [7850, 1]], r: [[7750, 0, LIN], [9000, -80]], s: [[7750, .1, BACK], [8000, .3, IO], [8650, .6, IN], [9000, 3]] } }),
    ...Array.from({ length: 4 }, (_, i) => spark(i)),
  ] }),
  spr('foreground leaf (out of focus)', 'leaf-soft.webp', 0, 0, 700, 720, { a: { o: [[6200, [2050, 1000], LIN], [9000, [1580, 930]]], r: [[6200, 60, LIN], [9000, 20]] } }),
] });

// ---------------- EDIT ME 1: live text ----------------
const C = CONTENT, HX = 112, HY = 372, FS = 100, CARD = [60, 104, 742, 756];
const txt = (title, text, x, y, font, size, weight, o = {}) => E('text', title, { o: [x, y], shape: { text, rangeStyles: o.ranges || [], fontFamily: font, fontSize: size, fontStyle: { bold: false, italic: !!o.italic, weight }, letterSpacing: o.ls || 0, textAnchor: 'start' }, fill: col(o.color || CREAM), ...(o.a ? { a: o.a } : {}) });
const hl = C.headline, lines = hl.split('\n'), accentFrom = hl.length - lines[lines.length - 1].length;
const CTAW = 170 + C.cta.length * 19, CPER = 2 * (CTAW - 72) + Math.PI * 72;
const text = E('g', 'EDIT ME 1 - text: headline, subline, cta-text', { a: { op: [[0, 0], [10200, 0], [10201, 1], [13700, 1, IO], [14150, 0]] }, kids: [
  E('g', 'glass-card (frosted panel: a blurred copy of the scene behind it)', { a: { op: [[10200, 0], [10900, 1]] }, kids: [
    E('g', 'glass backdrop', { clip: 'c-card', kids: [
      E('clipPath', 'card shape', { id: 'c-card', kids: [rect('shape', CARD[0], CARD[1], CARD[2], CARD[3], { rx: 40, fill: col([255, 255, 255]) })] }),
      layer('blurred forest (follows the camera)', .6, [spr('forest-soft', 'forest-soft.jpg', 960, 540, 2300, 1294)], { from: 9000 }),
      layer('blurred sorcerer (follows the camera)', 1, [full('sorcerer-soft', 'sorcerer-soft.webp')], { from: 9000 }),
      rect('glass shade', CARD[0], CARD[1], CARD[2], CARD[3], { fill: col([6, 8, 16], .34) }),
      rect('glass tint', CARD[0], CARD[1], CARD[2], CARD[3], { fill: col([255, 255, 255], .06) }),
    ] }),
    rect('glass edge', CARD[0] + .6, CARD[1] + .6, CARD[2] - 1.2, CARD[3] - 1.2, { rx: 40, fill: { type: 'none' }, stroke: { paint: col([255, 255, 255], .42), width: 1.2, opacity: 1 } }),
  ] }),
  E('g', 'headline-reveal (line-by-line wipe)', { mask: 'm-head', kids: [
    E('mask', 'wipe mask', { id: 'm-head', kids: [0, 1, 2].map(i => rect('line ' + (i + 1), HX - 20, HY - 86 + i * FS, 10, FS, { fill: col([255, 255, 255]), a: { size: [[10500 + i * 190, [0, FS], OUT], [11300 + i * 190, [900, FS]]] } })) }),
    txt('headline (max 3 lines, 10 chars each)', hl, HX, HY, 'Cinzel', FS, 600, { ls: 2, ranges: [{ from: accentFrom, to: hl.length - 1, properties: { fill: { paint: col(GOLD) } } }] }),
  ] }),
  spr('headline-sheen', 'streak.jpg', 0, 0, 600, 46, { ...light, r: 90, a: { o: [[10500, [80, 440], cb(.3, 0, .2, 1)], [11650, [980, 440]]], op: [[10200, 0], [10500, 0, OUT], [10700, .9, LIN], [11350, .9, IO], [11650, 0]] } }),
  E('g', 'subline-reveal', { a: { op: [[10200, 0], [11350, 0, OUT], [11950, 1]], o: [[11350, [0, 16], OUT], [11950, [0, 0]]] }, kids: [txt('subline', C.subline, HX + 2, HY + 2 * FS + 78, 'Cormorant Garamond', 36, 500, { color: [226, 216, 196] })] }),
  E('g', 'cta', { kids: [
    rect('cta-glass', HX, 736, CTAW, 72, { rx: 36, fill: col([255, 255, 255], .09), a: { op: [[10200, 0], [11900, 0], [12350, 1]] } }),
    rect('cta-outline (draws itself)', HX, 736, CTAW, 72, { rx: 36, fill: { type: 'none' }, stroke: { paint: col(GOLD), width: 2, dashArray: [f1(CPER)], dashOffset: f1(CPER), lineCap: 'round', opacity: 1 }, a: { dash: [[11600, CPER, cb(.5, 0, .2, 1)], [12350, 0]] } }),
    E('g', 'cta-text-reveal', { a: { op: [[10200, 0], [11900, 0, OUT], [12350, 1]] }, kids: [
      txt('cta-text (max 12 chars)', C.cta, HX + 40, 781, 'Cinzel', 26, 600, { ls: 3 }),
      E('g', 'cta-arrow', { a: { o: [[11900, [-14, 0], OUT], [12400, [0, 0]]] }, kids: [E('path', 'arrow', { shape: { path: [[CTAW - 74, 772], [CTAW - 38, 772], [CTAW - 48, 762], [CTAW - 38, 772], [CTAW - 48, 782]].map(([x, y]) => ({ x: HX + x, y, type: 'corner', mode: 0 })) }, fill: { type: 'none' }, stroke: { paint: col(CREAM), width: 2, lineCap: 'round', lineJoin: 'round', opacity: 1 } })] }),
    ] }),
  ] }),
  E('path', 'light-thread (from the button to the orb)', { shape: { path: [
    { x: HX + CTAW, y: 772, type: 'cusp', mode: 0, end: { x: HX + CTAW + 260, y: 772 } },
    { x: 1090, y: 850, type: 'cusp', mode: 0, start: { x: 810, y: 880 }, end: { x: 1340, y: 824 } },
    { x: 1640, y: 684, type: 'cusp', mode: 0, start: { x: 1550, y: 814 } }] },
    fill: { type: 'none' }, stroke: { paint: col(GOLD), width: 1.6, dashArray: [1500], dashOffset: 1500, lineCap: 'round', opacity: .85 }, a: { dash: [[11250, 1500, cb(.4, 0, .2, 1)], [12100, 0]], op: [[10200, 0], [11250, 1, LIN], [12100, 1, IO], [13000, .45]] } }),
] });

// ---------------- the one recolour layer ----------------
const brand = rect('brand-color (one fill re-hues the whole world; opacity 0 = original gold)', 0, 0, W, H, { fill: col(C.brand), blend: 'hue', op: C.brandOpacity });

// ---------------- EDIT ME 2: images ----------------
const burst = i => { const a = (i * 72 + R(-12, 12)) * Math.PI / 180, d = R(260, 450), z = R(50, 120); return spr('spark', 'spark.jpg', ORB[0], ORB[1], z, z, { ...light, a: { o: [[9000, ORB, OUT], [9900, [ORB[0] + Math.cos(a) * d, ORB[1] + Math.sin(a) * d]]], op: [[8999, 0], [9000, 1], [9900, 0]] } }); };
const bead = (i, turns, t0) => { const [a, b, r0, r1, per] = ringDef[i]; return piv('bead tilt', ORB, { a: { r: [[9000, r0], [15000, r1]] }, kids: [
  piv('bead squash', ORB, { s: [1, f1(b / a)], kids: [piv('bead orbit', ORB, { a: { r: [[9000, t0, LIN], [15000, t0 + 360 * turns]] }, kids: [spr('bead', 'spark.jpg', ORB[0] + a, ORB[1], 70, 70 * a / b * .5, { ...light, a: { op: [[0, 0], [9600, 0, OUT], [10200, 1], [13800, 1, IN], [14250, 0]] } })] })] })] }); };
const images = E('g', 'EDIT ME 2 - images: product-image, logo', { kids: [
  layer('orb (rides the scene camera)', 1, [
    piv('orb-float', ORB, { a: { s: [[9000, .5, BACK], [9700, 1, LIN], [13900, 1, IN], [14350, 0]], o: [[9000, ORB, LIN], ...osc(9700, 13900, 3300, ORB, [ORB[0], ORB[1] - 9], IO)], op: [[0, 0], [8999, 0], [9000, 1], [14350, 1], [14351, 0]] }, kids: [
      E('g', 'orb-window (circle crop)', { clip: 'c-orb', kids: [
        E('clipPath', 'circle crop', { id: 'c-orb', kids: [E('ellipse', 'crop', { o: ORB, shape: { radius: { x: OR * .955, y: OR * .955 } }, fill: col([255, 255, 255]) })] }),
        piv('product-drift', ORB, { a: { s: osc(9000, 15000, 6000, 1.1, 1.0, IO) }, kids: [spr('product-image', C.product, ORB[0], ORB[1], OR * 2, OR * 2, { fit: 'xMidYMid slice' })] }),
      ] }),
      spr('light condensing into the product', 'glow.jpg', ORB[0], ORB[1], OR * 5, OR * 5, { ...light, a: { op: [[9000, 1, cb(.5, 0, .6, 1)], [9950, 0]], s: [[9000, 1.3, OUT], [9950, .7]] } }),
      spr('orb-glass', 'orb-glass.jpg', ORB[0], ORB[1], OR * 2 / .86, OR * 2 / .86, light),
      orbitRing(0, true), orbitRing(1, true), bead(0, 3, 40), bead(1, -2, 200),
    ] }),
    E('ellipse', 'shockwave', { o: ORB, shape: { radius: { x: OR, y: OR } }, fill: { type: 'none' }, stroke: { paint: col(WHITEGOLD), width: 3, opacity: 1 }, a: { s: [[9000, .7, OUT], [9900, 3]], op: [[8999, 0], [9000, .9, OUT], [9900, 0]] } }),
    ...Array.from({ length: 5 }, (_, i) => burst(i)),
    spr('last glint', 'spark.jpg', ORB[0], ORB[1], 420, 420, { ...light, a: { op: [[0, 0], [14230, 0, OUT], [14370, 1, IO], [14750, 0]], s: [[14230, .2, OUT], [14370, 1.2, IO], [14750, .1]], r: [[14230, 0, LIN], [14750, 60]] } }),
  ], { from: 9000 }),
  E('g', 'logo-reveal', { a: { op: [[0, 0], [10300, 0, OUT], [10900, 1, LIN], [13700, 1, IO], [14150, 0]], o: [[10300, [0, 18], OUT], [10900, [0, 0]]] }, kids: [E('image', 'logo', { o: [HX, 142], shape: img(C.logo, 300, 100, 'xMinYMid meet') })] }),
] });

// ---------------- finishing layer ----------------
const grade = E('g', 'finish: flash, vignette, letterbox', { kids: [
  rect('flash (hides the cuts)', 0, 0, W, H, { fill: col(WHITEGOLD), a: { op: [[0, 0], [2760, 0, IN], [3000, .85, OUT], [3500, 0, LIN], [6090, 0, IN], [6200, .55, OUT], [6500, 0, LIN], [8700, 0, IN], [9000, 1, cb(.2, .6, .3, 1)], [9600, 0]] } }),
  E('image', 'vignette', { shape: img('vignette.png', W, H) }),
  rect('letterbox-top (delete both bars for a full frame)', 0, 0, W, 76, { fill: col([0, 0, 0]) }), rect('letterbox-bottom', 0, H - 76, W, 76, { fill: col([0, 0, 0]) }),
] });

const doc = { id: 'svg-conjure', type: 'svg', animation: { duration: DUR, direction: 1, iterations: 0, fill: 1, alternate: false, speed: 1 },
  properties: { shape: { position: { x: 0, y: 0 }, size: { width: W, height: H }, bgColor: col([0, 0, 0]) } }, children: [shot1, scene, shot3, text, brand, images, grade] };

// self-check: the forest plate must always cover the frame, and every key must sit inside the timeline in order
(function check() {
  const k = camKeys(.6);
  k.o.forEach(([t, o], i) => { const s = k.s[i][1], x0 = o[0] - s * 1150, x1 = o[0] + s * 1150, y0 = o[1] - s * 647, y1 = o[1] + s * 647; console.assert(x0 <= 0 && x1 >= W && y0 <= 0 && y1 >= H, 'forest uncovered at', t, x0, x1, y0, y1); });
  let n = 0, keysN = 0; (function walk(e) { n++; for (const g in e.animators || {}) for (const c in e.animators[g]) { const ks = e.animators[g][c].keys; keysN += ks.length; ks.forEach((q, i) => console.assert(q.time >= 0 && q.time <= DUR && (!i || q.time > ks[i - 1].time), 'bad key order', e.title, g, c, q.time)); } (e.children || []).forEach(walk); })(doc);
  console.log('elements', n, 'keyframes', keysN, 'hand frames', frames.length);
})();
const out = process.argv[2] === 'set2' ? 'conjure-set2' : 'conjure';
fs.writeFileSync(path.join(__dirname, out + '.json'), JSON.stringify(doc));
fs.writeFileSync(path.join(__dirname, out + '.js'), 'window.SCENE_BASE=' + JSON.stringify(BASE) + ';window.SCENE=' + JSON.stringify(doc) + ';');
console.log(out + '.json', (JSON.stringify(doc).length / 1024).toFixed(1), 'KB');
