// Market Day "one take" — builds the SVGator project document (take.json) to import into SVGator and for the local previewer.
// The film is one continuous live-action take (three chained 4K clips) stored as 360 frames at 24 fps, one image layer each.
// Rule kept everywhere: motion lives on wrapper groups, never on the text or on the swappable images themselves.
const fs = require('fs'), path = require('path');
const CONTENT = process.argv[2] === 'set2' ? require('./content-take2.js') : require('./content-take1.js');
const BASE = 'https://cdn.jsdelivr.net/gh/nika619/conjure-svgator@main/assets/';
const W = 1920, H = 1080, DUR = 15000, FPS = 24, P = [960, 540];
const cb = (a, b, c, d) => ({ type: 'cubic-bezier', value: { from: { x: a, y: b }, to: { x: c, y: d } } });
const LIN = { type: 'linear', value: null };
const IO = cb(.45, 0, .55, 1), OUT = cb(.16, 1, .3, 1), IN = cb(.7, 0, .84, 0);
const GOLD = [244, 190, 110], CREAM = [246, 238, 220], WHITEGOLD = [255, 238, 205];
const col = ([r, g, b], a = 1) => ({ type: 'color', value: { r, g, b, a } });
const f1 = v => +v.toFixed(2), f3 = v => +v.toFixed(3), r1 = v => Math.round(v * 10) / 10;
const MK = f => 'market/' + f;

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
      const [grp, chn, wrap] = CH[k], ks = o.a[k].map(([t, v, e], i, all) => ({ time: Math.round(t), value: wrap(v), ...(e && e !== LIN && k !== 'op' && i < all.length - 1 ? { easing: e } : {}) }));
      (n.animators[grp] = n.animators[grp] || {})[chn] = { keys: ks };
      (p[grp] = p[grp] || {})[chn] = ks[0].value; // static baseline = first keyframe
    }
  }
  if (!Object.keys(p).length) delete n.properties;
  if (o.kids) n.children = o.kids.filter(Boolean);
  return n;
}
const img = (file, w, h, fit) => ({ size: { width: r1(w), height: r1(h) }, href: /^https?:/.test(file) ? file : BASE + file, ...(fit ? { aspectRatio: fit } : {}) });
const spr = (title, file, cx, cy, w, h, o = {}) => E('image', title, { o: [cx, cy], t: [-w / 2, -h / 2], shape: img(file, w, h, o.fit), ...o });
const full = (title, file, o = {}) => E('image', title, { shape: img(file, W, H), ...o });
const rect = (title, x, y, w, h, o = {}) => E('rect', title, { o: [x, y], shape: { size: { width: w, height: h }, radius: { x: o.rx || 0, y: o.rx || 0 } }, ...o });
const light = { blend: 'screen' };

// ---------------- the take: 360 frames, each one a layer that switches on at its time (hard cuts, so the top visible layer is the current frame) ----------------
const fd = path.join(__dirname, '..', 'assets', 'market', 'take');
const frames = fs.existsSync(fd) ? fs.readdirSync(fd).filter(f => /^f\d{3}\.jpg$/.test(f)).sort() : [];
const take = E('g', 'video frames (one continuous take, 24 fps)', { kids: frames.map((f, i) => {
  const t = Math.round(i * 1000 / FPS);
  return full('frame ' + (i + 1), MK('take/' + f), i ? { op: 0, a: { op: [[0, 0], [t - 1, 0], [t, 1]] } } : {});
}) });

// ---------------- the product, placed in the open box and tracked to it ----------------
// Authored in the coordinates of the last frame (the box held toward the camera). track.json gives, for each tracked frame,
// where the base point sits, the scale against the last frame and a small roll; before the box is lifted it is the resting pose.
const BASEPT = [1380, 615], PW = 320, PH = 320; // product base point in the last frame, and the box the product image fits
const T = JSON.parse(fs.readFileSync(path.join(__dirname, 'track.json'), 'utf8'));
const tk = T.keys.map(k => [Math.round(k.f * 1000 / FPS), k]);
const productKeys = { o: tk.map(([t, k]) => [t, [k.x, k.y]]), s: tk.map(([t, k]) => [t, k.s]), r: tk.map(([t, k]) => [t, k.r]) };
const C = CONTENT, ACC = C.accent || GOLD, REVEAL = T.reveal; // ms the product appears (the box is open and still)
const product = E('g', 'EDIT ME 2 - images: product-image (transparent PNG, sits in the box), logo', { kids: [
  E('g', 'product (tracked to the box)', { o: BASEPT, t: [-BASEPT[0], -BASEPT[1]], a: productKeys, kids: [
    E('g', 'product-reveal', { op: 0, a: { op: [[0, 0], [REVEAL, 0], [REVEAL + 450, 1], [14350, 1], [14800, 0]] }, kids: [
      spr('contact shadow', MK('shadow.png'), BASEPT[0], BASEPT[1] - 4, PW * .78, 44, { op: .55 }),
      E('g', 'product-settle', { o: BASEPT, t: [-BASEPT[0], -BASEPT[1]], a: { s: [[REVEAL, .94, OUT], [REVEAL + 700, 1]] }, kids: [
        E('image', 'product-image', { o: [BASEPT[0] - PW / 2, BASEPT[1] - PH], shape: img(C.product, PW, PH, 'xMidYMax meet') }),
      ] }),
    ] }),
    spr('soft light as the product lands', 'glow.jpg', BASEPT[0], BASEPT[1] - PH * .45, 620, 620, { ...light, op: 0, a: { op: [[0, 0], [REVEAL - 150, 0, OUT], [REVEAL + 200, .55, IO], [REVEAL + 1100, 0]], s: [[REVEAL - 150, .6, OUT], [REVEAL + 1100, 1.15]] } }),
  ] }),
  E('g', 'logo-reveal', { op: 0, a: { op: [[0, 0], [11500, 0, OUT], [12100, 1, LIN], [14050, 1, IO], [14450, 0]], o: [[11500, [0, 18], OUT], [12100, [0, 0]]] }, kids: [E('image', 'logo', { o: [112, 142], shape: img(C.logo, 300, 100, 'xMinYMid meet') })] }),
] });

// ---------------- EDIT ME 1: live text on a frosted card ----------------
const HX = 112, HY = 372, FS = 92, CARD = [60, 104, 682, 756], T0 = 11400; // the card lands as the box comes to rest
const txt = (title, text, x, y, font, size, weight, o = {}) => E('text', title, { o: [x, y], shape: { text, rangeStyles: o.ranges || [], fontFamily: font, fontSize: size, fontStyle: { bold: false, italic: !!o.italic, weight }, letterSpacing: o.ls || 0, textAnchor: 'start' }, fill: col(o.color || CREAM), ...(o.a ? { a: o.a } : {}) });
const hl = C.headline, lines = hl.split('\n'), accentFrom = hl.length - lines[lines.length - 1].length;
const CTAW = 170 + C.cta.length * 19, CPER = 2 * (CTAW - 72) + Math.PI * 72;
const at = d => T0 + d;
const text = E('g', 'EDIT ME 1 - text: headline, subline, cta-text', { op: 0, a: { op: [[0, 0], [at(-200), 0], [at(-199), 1], [14050, 1, IO], [14450, 0]] }, kids: [
  E('g', 'glass-card (frosted panel: a blurred still of the stall behind it)', { op: 0, a: { op: [[at(-200), 0], [at(500), 1]] }, kids: [
    E('g', 'glass backdrop', { clip: 'c-card', kids: [
      E('clipPath', 'card shape', { id: 'c-card', kids: [rect('shape', CARD[0], CARD[1], CARD[2], CARD[3], { rx: 40, fill: col([255, 255, 255]) })] }),
      full('stall-soft', MK('take-soft.jpg')),
      rect('glass shade', CARD[0], CARD[1], CARD[2], CARD[3], { fill: col([14, 8, 4], .38) }),
      rect('glass tint', CARD[0], CARD[1], CARD[2], CARD[3], { fill: col([255, 255, 255], .06) }),
    ] }),
    rect('glass edge', CARD[0] + .6, CARD[1] + .6, CARD[2] - 1.2, CARD[3] - 1.2, { rx: 40, fill: { type: 'none' }, stroke: { paint: col([255, 255, 255], .42), width: 1.2, opacity: 1 } }),
  ] }),
  E('g', 'headline-reveal (line-by-line wipe)', { mask: 'm-head', kids: [
    E('mask', 'wipe mask', { id: 'm-head', kids: [0, 1, 2].map(i => rect('line ' + (i + 1), HX - 20, HY - 86 + i * FS, 10, FS, { fill: col([255, 255, 255]), a: { size: [[at(100 + i * 170), [0, FS], OUT], [at(800 + i * 170), [900, FS]]] } })) }),
    txt('headline (max 3 lines, 9 chars each)', hl, HX, HY, 'Fraunces', FS, 700, { ls: 1, ranges: [{ from: accentFrom, to: hl.length - 1, properties: { fill: { paint: col(ACC) } } }] }),
  ] }),
  E('g', 'subline-reveal', { op: 0, a: { op: [[at(-200), 0], [at(700), 0, OUT], [at(1200), 1]], o: [[at(700), [0, 16], OUT], [at(1200), [0, 0]]] }, kids: [txt('subline', C.subline, HX + 2, HY + 2 * FS + 78, 'DM Sans', 30, 500, { color: [232, 222, 204] })] }),
  E('g', 'cta', { kids: [
    rect('cta-glass', HX, 736, CTAW, 72, { rx: 36, fill: col([255, 255, 255], .09), op: 0, a: { op: [[at(-200), 0], [at(1000), 0], [at(1400), 1]] } }),
    rect('cta-outline (draws itself)', HX, 736, CTAW, 72, { rx: 36, fill: { type: 'none' }, stroke: { paint: col(ACC), width: 2, dashArray: [f1(CPER)], dashOffset: f1(CPER), lineCap: 'round', opacity: 1 }, a: { dash: [[at(800), CPER, cb(.5, 0, .2, 1)], [at(1450), 0]] } }),
    E('g', 'cta-text-reveal', { op: 0, a: { op: [[at(-200), 0], [at(1000), 0, OUT], [at(1400), 1]] }, kids: [
      txt('cta-text (max 12 chars)', C.cta, HX + 40, 781, 'DM Sans', 24, 700, { ls: 3 }),
      E('path', 'arrow', { shape: { path: [[CTAW - 74, 772], [CTAW - 38, 772], [CTAW - 48, 762], [CTAW - 38, 772], [CTAW - 48, 782]].map(([x, y]) => ({ x: HX + x, y, type: 'corner', mode: 0 })) }, fill: { type: 'none' }, stroke: { paint: col(CREAM), width: 2, lineCap: 'round', lineJoin: 'round', opacity: 1 } }),
    ] }),
  ] }),
] });

// ---------------- the one recolour layer ----------------
const brand = rect('brand-color (one fill grades the whole film like a colour filter; opacity 0 = original warm light)', 0, 0, W, H, { fill: col(C.brand), blend: 'soft-light', op: C.brandOpacity });

// ---------------- finishing layer ----------------
const grade = E('g', 'finish: fades, vignette, letterbox', { kids: [
  E('image', 'vignette', { shape: img('vignette.png', W, H) }),
  rect('fade from black', 0, 0, W, H, { fill: col([0, 0, 0]), a: { op: [[0, 1], [120, 1, cb(.3, 0, .3, 1)], [900, 0]] } }),
  rect('fade to black (the loop restarts on the tied box)', 0, 0, W, H, { fill: col([0, 0, 0]), op: 0, a: { op: [[0, 0], [14350, 0, IO], [14960, 1]] } }),
  rect('letterbox-top (delete both bars for a full frame)', 0, 0, W, 76, { fill: col([0, 0, 0]) }), rect('letterbox-bottom', 0, H - 76, W, 76, { fill: col([0, 0, 0]) }),
] });

const doc = { id: 'svg-take', type: 'svg', animation: { duration: DUR, direction: 1, iterations: 0, fill: 1, alternate: false, speed: 1 },
  properties: { shape: { position: { x: 0, y: 0 }, size: { width: W, height: H }, bgColor: col([0, 0, 0]) } }, children: [take, brand, product, text, grade] };

// self-check: every key sits inside the timeline in order, and the take is complete
(function check() {
  console.assert(frames.length === 360 || process.env.ALLOW_PARTIAL, 'take has', frames.length, 'frames, expected 360');
  let n = 0, keysN = 0; (function walk(e) { n++; for (const g in e.animators || {}) for (const c in e.animators[g]) { const ks = e.animators[g][c].keys; keysN += ks.length; ks.forEach((q, i) => console.assert(q.time >= 0 && q.time <= DUR && (!i || q.time > ks[i - 1].time), 'bad key order', e.title, g, c, q.time)); } (e.children || []).forEach(walk); })(doc);
  console.log('elements', n, 'keyframes', keysN, 'frames', frames.length, 'tracked keys', tk.length, T.placeholder ? '(PLACEHOLDER track)' : '');
})();
const out = process.argv[2] === 'set2' ? 'take-set2' : 'take';
fs.writeFileSync(path.join(__dirname, out + '.json'), JSON.stringify(doc));
fs.writeFileSync(path.join(__dirname, out + '.js'), 'window.SCENE_BASE=' + JSON.stringify(BASE) + ';window.SCENE=' + JSON.stringify(doc) + ';');
console.log(out + '.json', (JSON.stringify(doc).length / 1024).toFixed(1), 'KB');
