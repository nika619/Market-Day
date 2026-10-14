// Market Day — builds the SVGator project document (market.json) for create_project and for the local previewer. Same engine as scene.js, market art.
// Rule kept everywhere: motion lives on wrapper groups, never on the text or on the swappable images themselves.
const fs = require('fs'), path = require('path');
const SET = process.argv[2] || 'set1', CONTENT = require('./content-market' + SET.slice(3) + '.js'); // set1 candles, set2 mugs, set3 pizza
const BASE = 'https://cdn.jsdelivr.net/gh/nika619/conjure-svgator@main/assets/';
const W = 1920, H = 1080, DUR = 15000, P = [960, 540];
const TRAY0 = [948, 678], DX = 400, TRAY = [TRAY0[0] + DX, TRAY0[1]], F1 = [1260, 585], MK = f => 'market/' + f; // seller is placed so the tray sits right of the text card
// on the tray floor, in seller-plate pixels: where the product touches the tray (bottom centre of its box), its box, and where the label card stands (front right)
const BASE_PT = [950, 818], PBOX = [860, 380], TAG = [1252, 798], PC = [BASE_PT[0] + DX, 640] /* product centre in the scene */, LAND = 9500 /* the product touches the tray */;
const cb = (a, b, c, d) => ({ type: 'cubic-bezier', value: { from: { x: a, y: b }, to: { x: c, y: d } } });
const LIN = { type: 'linear', value: null };
const IO = cb(.45, 0, .55, 1), OUT = cb(.16, 1, .3, 1), IN = cb(.7, 0, .84, 0), BACK = cb(.34, 1.56, .64, 1), SOFT = cb(.3, 0, .15, 1);
const GOLD = [244, 190, 110], CREAM = [246, 238, 220], WHITEGOLD = [255, 238, 205];
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

// ---------------- camera for the scene: [time, zoom, scene point, where it sits on screen, easing to the next key, roll in degrees] ----------------
const MIDP = [PC[0], 560];
const MIDA = MIDP; // at zoom 1.0 the scene sits where it was composed, so the whole tray fits; the slow push starts from here without a jump
const CAM = [
  [3000, 1.55, [760, 300], [960, 520], cb(.25, .1, .25, 1), -1.4],
  [5850, 1.22, [1000, 520], [975, 540], IN, .3],
  [6200, 1.4, [1380, 600], [900, 560], LIN, 1.0],
  [9000, 1.6, [PC[0], 650], [960, 540], cb(.5, 0, .1, 1), -1.5],
  [10800, 1.0, [960, 540], [960, 540], IO, 0],
  [13700, 1.06, MIDP, MIDA, IN, -.7],
  [15000, 1.13, MIDP, [MIDA[0] - 10, MIDA[1] + 6], LIN, -1.3],
];
const camKeys = (d, from = 0) => { const L = CAM.filter(k => k[0] >= from); const out = {
  o: L.map(([t, s, C, A, e, r = 0]) => { const c = Math.cos(r * Math.PI / 180), n = Math.sin(r * Math.PI / 180), vx = s * (C[0] - P[0]), vy = s * (C[1] - P[1]);
    const O = [A[0] - (c * vx - n * vy), A[1] - (n * vx + c * vy)]; return [t, [P[0] + (O[0] - P[0]) * d, P[1] + (O[1] - P[1]) * d], e]; }),
  s: L.map(([t, s, , , e]) => [t, 1 + (s - 1) * d, e]) };
  if (L.some(k => k[5])) out.r = L.map(([t, , , , e, r = 0]) => [t, r, e]);
  return out; };
const layer = (title, d, kids, o = {}) => piv(title, P, { a: camKeys(d, o.from), kids, ...o });
const place = kids => E('g', 'seller placement (tray sits right of the text card)', { o: TRAY, t: [-TRAY0[0], -TRAY0[1]], kids });
const BREATH = { s: osc(3000, 15000, 12000, [1, 1], [1.005, 1.011], IO), r: osc(3000, 15000, 12000, -.3, .35, IO) };
const breathe = (title, kids) => place([piv(title, [960, 1080], { a: BREATH, kids })]); // whatever rests on the tray moves with the seller

// ---------------- shot 1: the counter (macro close-up of hands tying a parcel) ----------------
const dustA = Array.from({ length: 5 }, (_, i) => { const x = R(700, 1900), y = R(80, 1000), z = R(26, 120); return spr('bokeh', 'glow-gold.jpg', x, y, z, z, { ...light, a: { o: [[0, [x, y], LIN], [3000, [x - z * R(1, 2.4), y - R(10, 50)]]], op: [[0, 0, IO], [R(500, 1200), R(.25, .6), IO], [3000, R(.1, .4)]] } }); });
const shot1 = E('g', 'shot-1 the counter (macro close-up)', { a: { op: [[0, 1], [2999, 1], [3000, 0]] }, kids: [
  piv('macro-camera (slow push-in)', F1, { a: { r: [[0, .8, IO], [2550, -.5, IN], [3000, -2]], s: [[0, 1.08, LIN], [2550, 1.17, IN], [3000, 1.9]], o: [[0, [1276, 590], LIN], [2550, [1248, 583], IN], [3000, [1100, 610]]] }, kids: [
    full('macro plate', MK('macro.jpg')),
    spr('sun-flare', 'glow-gold.jpg', 800, 110, 560, 560, { ...light, a: { op: [[0, 0], [900, 0, IO], [1700, .7, IO], [2600, .35]], s: [[900, .6, OUT], [1700, 1.15, IO], [2600, .9]] } }),
  ] }),
  spr('lens-streak', 'streak.jpg', 900, 150, 2600, 170, { ...light, a: { op: [[0, 0], [2000, 0, OUT], [2160, .8, IO], [2700, 0]], s: [[2000, [.2, 1], OUT], [2200, [1, 1], IO], [2700, [1.25, .5]]] } }),
  ...dustA,
  rect('fade from black', 0, 0, W, H, { fill: col([0, 0, 0]), a: { op: [[0, 1], [220, 1, cb(.3, 0, .3, 1)], [1500, 0]] } }),
  spr('light burst', 'glow.jpg', F1[0], F1[1] - 100, 700, 700, { ...light, a: { op: [[0, 0], [2620, 0, IN], [3000, 1]], s: [[2620, .2, IN], [3000, 7]] } }),
] });

// ---------------- shot 2 + 4: the stall (multiplane camera) ----------------
const KS = 2300 / 2560, LIGHTS = [[140, 56], [260, 90], [344, 116], [580, 170], [648, 252], [700, 196], [764, 236], [1194, 184], [1844, 200]].map(([x, y]) => [-190 + x * KS, -107 + y * KS]); // string-light bulbs, plate pixels -> scene pixels
const bulbGlow = ([x, y], i) => { const t = 3250 + i * 200; return spr('string-light glow', 'glow-gold.jpg', x, y, 190, 190, { ...light, a: { op: [[3000, 0], [t, 0, OUT], [t + 180, 1, IO], [t + 520, .62, IO], [9000, .7], [10800, .55], [14000, .6], [14700, 0]], s: [[t, .4, OUT], [t + 180, 1.15, IO], [t + 520, 1]] } }); };
const SUN = [1750, -60];
const shafts = E('g', 'sun shafts', { kids: [0, 1].map(i => piv('shaft ' + (i + 1), SUN, { a: { r: [[3000, [150, 172][i]], [15000, [158, 166][i]]] }, kids: [
  spr('shaft', 'streak.jpg', SUN[0] + 700, SUN[1], 1700, [320, 230][i], { ...light, a: { op: [[3000, 0], [4500, 0], [5300, [.3, .22][i]], [9000, [.3, .22][i]], [9500, [.48, .36][i]], [11200, [.3, .22][i]], [14000, [.3, .22][i]], [14700, 0]] } })] })) });
const ASP = { tag: 1.39, petal: 1.15, sprig: 1.76, parcel: .84 };
const drift = (file, w, y0, y1, t0, dur) => spr('drift', MK(file + '.webp'), 0, 0, w, w * ASP[file], { a: { o: [[t0, [2050, y0], LIN], [t0 + dur, [-150, y1]]], r: [[t0, R(0, 60), LIN], [t0 + dur, R(200, 420)]], op: [[3000, 0], [t0, 0], [t0 + 400, .9], [t0 + dur - 400, .9], [t0 + dur, 0]] } });
const mote = () => { const x = R(60, 1880), y = R(120, 1040), z = R(8, 26); return spr('dust mote', 'glow-gold.jpg', x, y, z, z, { ...light, a: { o: [[3000, [x, y]], [15000, [x + R(-70, 70), y - R(90, 260)]]], op: [[3000, R(.1, .5)], [R(4500, 11000), R(.7, 1)], [14800, 0]] } }); };

const scene = E('g', 'shot-2 + shot-4 the stall (multiplane camera)', { a: { op: [[0, 0], [2999, 0], [3000, 1], [6199, 1], [6200, 0], [8999, 0], [9000, 1]] }, kids: [
  layer('depth-1 stall', .6, [spr('stall', MK('stall.jpg'), 960, 540, 2300, 1294), ...LIGHTS.map(bulbGlow)]),
  shafts,
  layer('depth-3 seller', 1, [
    breathe('seller (breathes)', [full('seller', MK('seller.webp'))]),
    E('g', 'drift, dust', { kids: [drift('tag', 70, 300, 640, 3500, 2600), drift('sprig', 56, 700, 380, 3900, 2300), drift('petal', 60, 520, 860, 4300, 2000), drift('parcel', 80, 860, 560, 10200, 3600), ...Array.from({ length: 10 }, mote)] }),
  ]),
  rect('dusk (lifts as the string lights come on)', 0, 0, W, H, { fill: col([10, 18, 44]), a: { op: [[3000, .6], [3400, .6], [5400, 0, IO]] } }),
  layer('depth-4 foreground (out of focus)', 1.4, [spr('foreground', MK('fg-soft.webp'), 960, 540, 2300, 1294)]),
  rect('fade to black', 0, 0, W, H, { fill: col([0, 0, 0]), a: { op: [[0, 0], [14050, 0, IO], [14850, 1]] } }),
] });

// ---------------- shot 3: the presentation (video frames, then the light gathers on the tray) ----------------
const HP = [968, 560], hd = path.join(__dirname, '..', 'assets', 'market', 'hand');
const frames = fs.existsSync(hd) ? fs.readdirSync(hd).filter(f => /\.jpe?g$/.test(f)).sort() : [];
const T0 = 6400, TD = 2300; // each frame dissolves over the one below
const shot3 = E('g', 'shot-3 the presentation', { a: { op: [[0, 0], [6199, 0], [6200, 1], [8999, 1], [9000, 0]] }, kids: [
  piv('hand-camera', HP, { a: { r: [[6200, 2, OUT], [6750, .3, LIN], [8650, -.4, IN], [9000, -1.5]], s: [[6200, 1.2, OUT], [6750, 1.04, LIN], [8650, 1.14, IN], [9000, 1.6]], o: [[6200, [1060, 560], OUT], [6750, [968, 560], LIN], [8650, [968, 552], IN], [9000, [960, 580]]] }, kids: [
    E('g', 'presentation frames (video, dissolving)', { kids: frames.map((f, i) => full('frame ' + (i + 1), MK('hand/' + f), i ? { a: { op: [[T0 + TD * (i - 1) / (frames.length - 1), 0, LIN], [T0 + TD * i / (frames.length - 1), 1]] } } : {})) }),
    spr('tray-glow', 'glow-gold.jpg', HP[0], HP[1], 620, 380, { ...light, a: { op: [[6200, 0], [7400, 0, IO], [8300, .55, IO], [9000, 1]], s: [[7400, .5, OUT], [9000, 2.4]] } }),
    spr('flare-core', 'spark.jpg', HP[0], HP[1], 420, 420, { ...light, a: { op: [[6200, 0], [7900, 0, OUT], [8500, 1, IO], [9000, 1]], r: [[7900, 0, LIN], [9000, 90]], s: [[7900, .1, OUT], [8650, .8, IN], [9000, 3]] } }),
    spr('lens-streak', 'streak.jpg', HP[0], HP[1], 2400, 160, { ...light, a: { op: [[6200, 0], [8200, 0, OUT], [8600, .8, IO], [9000, 0]], s: [[8200, [.2, 1], OUT], [8700, [1, 1], IO], [9000, [1.3, .5]]] } }),
  ] }),
] });

// ---------------- EDIT ME 1: live text ----------------
const C = CONTENT, ACC = C.accent || GOLD, HX = 112, HY = 372, FS = 92, CARD = [60, 104, 682, 756];
const txt = (title, text, x, y, font, size, weight, o = {}) => E('text', title, { o: [x, y], shape: { text, rangeStyles: o.ranges || [], fontFamily: font, fontSize: size, fontStyle: { bold: false, italic: !!o.italic, weight }, letterSpacing: o.ls || 0, textAnchor: 'start' }, fill: col(o.color || CREAM), ...(o.a ? { a: o.a } : {}) });
const hl = C.headline, lines = hl.split('\n'), accentFrom = hl.length - lines[lines.length - 1].length;
const CTAW = 322 /* fixed pill: fits up to 9 characters, the same box for every brand */, CPER = 2 * (CTAW - 72) + Math.PI * 72;
const text = E('g', 'EDIT ME 1 - text: headline, subline, cta-text', { a: { op: [[0, 0], [10200, 0], [10201, 1], [13700, 1, IO], [14150, 0]] }, kids: [
  E('g', 'glass-card (frosted panel: a blurred copy of the scene behind it)', { a: { op: [[10200, 0], [10900, 1]] }, kids: [
    E('g', 'glass backdrop', { clip: 'c-card', kids: [
      E('clipPath', 'card shape', { id: 'c-card', kids: [rect('shape', CARD[0], CARD[1], CARD[2], CARD[3], { rx: 40, fill: col([255, 255, 255]) })] }),
      layer('blurred stall (follows the camera)', .6, [spr('stall-soft', MK('stall-soft.jpg'), 960, 540, 2300, 1294)], { from: 9000 }),
      layer('blurred seller (follows the camera)', 1, [place([full('seller-soft', MK('seller-soft.webp'))])], { from: 9000 }),
      rect('glass shade', CARD[0], CARD[1], CARD[2], CARD[3], { fill: col([14, 8, 4], .38) }),
      rect('glass tint', CARD[0], CARD[1], CARD[2], CARD[3], { fill: col([255, 255, 255], .06) }),
    ] }),
    rect('glass edge', CARD[0] + .6, CARD[1] + .6, CARD[2] - 1.2, CARD[3] - 1.2, { rx: 40, fill: { type: 'none' }, stroke: { paint: col([255, 255, 255], .42), width: 1.2, opacity: 1 } }),
  ] }),
  E('g', 'headline-reveal (line-by-line wipe)', { mask: 'm-head', kids: [
    E('mask', 'wipe mask', { id: 'm-head', kids: [0, 1, 2].map(i => rect('line ' + (i + 1), HX - 20, HY - 86 + i * FS, 10, FS, { fill: col([255, 255, 255]), a: { size: [[10500 + i * 190, [0, FS], OUT], [11300 + i * 190, [900, FS]]] } })) }),
    txt('headline (max 3 lines, 9 chars each)', hl, HX, HY, 'Fraunces', FS, 700, { ls: 1, ranges: [{ from: accentFrom, to: hl.length - 1, properties: { fill: { paint: col(ACC) } } }] }),
  ] }),
  spr('headline-sheen', 'streak.jpg', 0, 0, 600, 46, { ...light, r: 90, a: { o: [[10500, [80, 440], cb(.3, 0, .2, 1)], [11650, [980, 440]]], op: [[10200, 0], [10500, 0, OUT], [10700, .9, LIN], [11350, .9, IO], [11650, 0]] } }),
  E('g', 'subline-reveal', { a: { op: [[10200, 0], [11350, 0, OUT], [11950, 1]], o: [[11350, [0, 16], OUT], [11950, [0, 0]]] }, kids: [txt('subline', C.subline, HX + 2, HY + 2 * FS + 78, 'DM Sans', 30, 500, { color: [232, 222, 204] })] }),
  E('g', 'cta', { kids: [
    rect('cta-glass', HX, 736, CTAW, 72, { rx: 36, fill: col([255, 255, 255], .09), a: { op: [[10200, 0], [11900, 0], [12350, 1]] } }),
    rect('cta-outline (draws itself)', HX, 736, CTAW, 72, { rx: 36, fill: { type: 'none' }, stroke: { paint: col(ACC), width: 2, dashArray: [f1(CPER)], dashOffset: f1(CPER), lineCap: 'round', opacity: 1 }, a: { dash: [[11600, CPER, cb(.5, 0, .2, 1)], [12350, 0]] } }),
    E('g', 'cta-text-reveal', { a: { op: [[10200, 0], [11900, 0, OUT], [12350, 1]] }, kids: [
      txt('cta-text (max 9 chars)', C.cta, HX + 40, 781, 'DM Sans', 24, 700, { ls: 3 }),
      E('g', 'cta-arrow', { a: { o: [[11900, [-14, 0], OUT], [12400, [0, 0]]] }, kids: [E('path', 'arrow', { shape: { path: [[CTAW - 74, 772], [CTAW - 38, 772], [CTAW - 48, 762], [CTAW - 38, 772], [CTAW - 48, 782]].map(([x, y]) => ({ x: HX + x, y, type: 'corner', mode: 0 })) }, fill: { type: 'none' }, stroke: { paint: col(CREAM), width: 2, lineCap: 'round', lineJoin: 'round', opacity: 1 } })] }),
    ] }),
  ] }),
  E('path', 'light-thread (from the button to the product)', { shape: { path: [
    { x: HX + CTAW, y: 772, type: 'cusp', mode: 0, end: { x: HX + CTAW + 260, y: 772 } },
    { x: 1000, y: 850, type: 'cusp', mode: 0, start: { x: 780, y: 880 }, end: { x: 1120, y: 820 } },
    { x: 1150, y: 700, type: 'cusp', mode: 0, start: { x: 1090, y: 790 } }] },
    fill: { type: 'none' }, stroke: { paint: col(ACC), width: 1.6, dashArray: [1500], dashOffset: 1500, lineCap: 'round', opacity: .85 }, a: { dash: [[11250, 1500, cb(.4, 0, .2, 1)], [12100, 0]], op: [[10200, 0], [11250, 1, LIN], [12100, 1, IO], [13000, .45]] } }),
] });

// ---------------- the one recolour layer ----------------
const brand = rect('brand-color (one fill grades the whole film like a colour filter; opacity 0 = original warm light)', 0, 0, W, H, { fill: col(C.brand), blend: 'soft-light', op: C.brandOpacity });

// ---------------- EDIT ME 2: images ----------------
const fadeOut = v => [[14050, v], [14250, f1(v * .9)], [14450, f1(v * .5)], [14650, f1(v * .1)], [14850, 0]]; // follows the eased fade to black (opacity keys stay linear)
const images = E('g', 'EDIT ME 2 - images: product-image, logo', { kids: [
  layer('product (rides the scene camera)', 1, [
    breathe('product on the tray (moves with the seller)', [
      spr('contact shadow', MK('shadow.png'), BASE_PT[0], BASE_PT[1] - 22, 560, 120, { a: { op: [[0, 0], [9000, 0], [LAND, .55], ...fadeOut(.55)], s: [[9000, .45, IN], [LAND, 1]] } }),
      piv('product-drop (lands on the tray)', BASE_PT, { a: { o: [[9000, [BASE_PT[0], BASE_PT[1] - 100], IN], [LAND, BASE_PT]], op: [[0, 0], [8999, 0], [9000, 0], [9150, 1], ...fadeOut(1)] }, kids: [
        piv('product-settle (squash on landing)', BASE_PT, { a: { s: [[LAND, [1, 1], OUT], [LAND + 110, [1.035, .955], IO], [LAND + 330, [.99, 1.012], IO], [LAND + 520, [1, 1]]] }, kids: [
          E('image', 'product-image (transparent cut-out, its base on the bottom edge)', { o: [BASE_PT[0] - PBOX[0] / 2, BASE_PT[1] - PBOX[1]], shape: img(C.product, PBOX[0], PBOX[1], 'xMidYMax meet') }),
        ] }),
      ] }),
      spr('landing glow (light spreads over the tray)', 'glow-gold.jpg', BASE_PT[0], BASE_PT[1] - 150, 1000, 330, { ...light, a: { op: [[0, 0], [LAND - 80, 0], [LAND + 60, .7], [LAND + 750, 0]], s: [[LAND - 80, .5, OUT], [LAND + 750, 1.15]] } }),
      spr('last glint', 'spark.jpg', BASE_PT[0] + 150, BASE_PT[1] - 250, 420, 420, { ...light, a: { op: [[0, 0], [14230, 0, OUT], [14370, 1, IO], [14750, 0]], s: [[14230, .2, OUT], [14370, 1.2, IO], [14750, .1]], r: [[14230, 0, LIN], [14750, 60]] } }),
    ]),
  ], { from: 9000 }),
  E('g', 'logo-reveal', { a: { op: [[0, 0], [10300, 0, OUT], [10900, 1, LIN], [13700, 1, IO], [14150, 0]], o: [[10300, [0, 18], OUT], [10900, [0, 0]]] }, kids: [E('image', 'logo', { o: [HX, 142], shape: img(C.logo, 300, 100, 'xMinYMid meet') })] }),
] });

// ---------------- EDIT ME 3: the label card that hops onto the tray and says what the product is ----------------
const TW = 320, TH = 126, TX = TAG[0] - TW / 2, TY = TAG[1] - TH, J = 10000, KRAFT = [214, 183, 138], INK = [62, 38, 22];
const label = E('g', 'EDIT ME 3 - label: label-title, label-detail', { kids: [
  layer('label (rides the scene camera)', 1, [
    breathe('label on the tray (moves with the seller)', [
      spr('label shadow', MK('shadow.png'), TAG[0] + 8, TAG[1] - 6, 310, 48, { a: { op: [[0, 0], [J - 1, 0], [J, .15], [J + 330, .1], [J + 520, .45], [12820, .45], [12990, .22], [13120, .45], ...fadeOut(.45)], s: [[J, [.5, 1], OUT], [J + 520, [1, 1]]] } }),
      piv('label-jump (hops onto the tray, hops again later)', TAG, { a: {
        o: [[J, TAG, OUT], [J + 330, [TAG[0], TAG[1] - 90], IN], [J + 520, TAG, LIN], [12820, TAG, OUT], [12990, [TAG[0], TAG[1] - 34], IN], [13120, TAG]],
        s: [[J, [.7, .15], OUT], [J + 170, [.9, 1.16], OUT], [J + 330, [1, 1], IN], [J + 520, [1.1, .86], OUT], [J + 690, [.97, 1.04], IO], [J + 860, [1, 1], LIN], [12700, [1, 1], OUT], [12820, [1.06, .92], OUT], [12900, [.97, 1.05], IO], [12990, [1, 1], IN], [13120, [1.05, .94], OUT], [13280, [1, 1]]],
        r: [[J, -10, OUT], [J + 330, 4, IN], [J + 520, -3, OUT], [J + 860, -2, LIN], [12820, -2, OUT], [12990, 2, IN], [13120, -2]],
        op: [[0, 0], [J - 1, 0], [J, 1], ...fadeOut(1)] }, kids: [
        rect('label-card (kraft)', TX, TY, TW, TH, { rx: 14, fill: col(KRAFT), stroke: { paint: col([150, 110, 68]), width: 1.5, opacity: 1 } }),
        rect('label-stitch', TX + 8, TY + 8, TW - 16, TH - 16, { rx: 9, fill: { type: 'none' }, stroke: { paint: col([120, 84, 50]), width: 1.2, dashArray: [5, 5], opacity: .55 } }),
        rect('label-rule (accent colour)', TX + 26, TY + 70, 46, 3, { fill: col(ACC) }),
        E('g', 'label-title-pop', { a: { op: [[0, 0], [J + 380, 0], [J + 560, 1]], o: [[J + 380, [0, 18], BACK], [J + 640, [0, 0]]] }, kids: [txt('label-title (max 12 chars)', C.label, TX + 24, TY + 56, 'Fraunces', 38, 600, { italic: true, color: INK })] }),
        E('g', 'label-detail-pop', { a: { op: [[0, 0], [J + 500, 0], [J + 680, 1]], o: [[J + 500, [0, 14], BACK], [J + 760, [0, 0]]] }, kids: [txt('label-detail (max 22 chars)', C.labelDetail, TX + 26, TY + 101, 'DM Sans', 18, 600, { color: [112, 78, 46], ls: .5 })] }),
      ] }),
    ]),
  ], { from: 9000 }),
] });

// ---------------- finishing layer ----------------
const grade = E('g', 'finish: flash, vignette, letterbox', { kids: [
  rect('flash (hides the cuts)', 0, 0, W, H, { fill: col(WHITEGOLD), a: { op: [[0, 0], [2760, 0, IN], [3000, .85, OUT], [3500, 0, LIN], [6090, 0, IN], [6200, .55, OUT], [6500, 0, LIN], [8700, 0, IN], [9000, 1, cb(.2, .6, .3, 1)], [9600, 0]] } }),
  E('image', 'vignette', { shape: img('vignette.png', W, H) }),
  rect('letterbox-top (delete both bars for a full frame)', 0, 0, W, 76, { fill: col([0, 0, 0]) }), rect('letterbox-bottom', 0, H - 76, W, 76, { fill: col([0, 0, 0]) }),
] });

const doc = { id: 'svg-market', type: 'svg', animation: { duration: DUR, direction: 1, iterations: 0, fill: 1, alternate: false, speed: 1 },
  properties: { shape: { position: { x: 0, y: 0 }, size: { width: W, height: H }, bgColor: col([0, 0, 0]) } }, children: [shot1, scene, shot3, text, brand, images, label, grade] };

// self-check: the stall plate must always cover the frame, and every key must sit inside the timeline in order
(function check() {
  const k = camKeys(.6);
  k.o.forEach(([t, o], i) => { const s = k.s[i][1], x0 = o[0] - s * 1150, x1 = o[0] + s * 1150, y0 = o[1] - s * 647, y1 = o[1] + s * 647; console.assert(x0 <= 0 && x1 >= W && y0 <= 0 && y1 >= H, 'stall uncovered at', t, x0, x1, y0, y1); });
  let n = 0, keysN = 0; (function walk(e) { n++; for (const g in e.animators || {}) for (const c in e.animators[g]) { const ks = e.animators[g][c].keys; keysN += ks.length; ks.forEach((q, i) => console.assert(q.time >= 0 && q.time <= DUR && (!i || q.time > ks[i - 1].time), 'bad key order', e.title, g, c, q.time)); } (e.children || []).forEach(walk); })(doc);
  console.log('elements', n, 'keyframes', keysN, 'video frames', frames.length);
})();
const out = SET === 'set1' ? 'market' : 'market-' + SET;
fs.writeFileSync(path.join(__dirname, out + '.json'), JSON.stringify(doc));
fs.writeFileSync(path.join(__dirname, out + '.js'), 'window.SCENE_BASE=' + JSON.stringify(BASE) + ';window.SCENE=' + JSON.stringify(doc) + ';');
console.log(out + '.json', (JSON.stringify(doc).length / 1024).toFixed(1), 'KB');
